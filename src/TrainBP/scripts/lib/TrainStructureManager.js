import { BlockPermutation, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

import {
     activePlayerSeats,
     deleteTrainData,
     loadTrainData,
     minecartRegistry,
} from "./DataStorage";
import {
     getOverworldDimension,
     isHorizontalRailDirection,
     standardizeHorizontalEntityPosition,
} from "./shared.js";
import {
     FRAGMENT_COLLECTOR_TYPE,
     FRAGMENT_ENTITY_TYPE,
} from "./TrainRenderFragments.js";
import { clearMinecartConsist } from "./TrainConsistManager";
import { clearTrainDynamicLights } from "./TrainDynamicLights.js";
import { clearDriveBindingsForMinecart } from "./TrainDriveManager";
import { TRAIN_PLUGIN_ATTACHED_TAG } from "./TrainPluginProtocol.js";
import { getTrainUpdaterInstance } from "./TrainUpdater.js";
import {
     ensureTrainTransformData,
     getTrainStructureRotationDegrees,
} from "./TrainTransform.js";
import { EntityWithPlayerStop } from "./system-core.js";

const HANDBOOK_ITEM_ID = "train:minecart_handbook";
const DEFAULT_MINECART_TYPE = "minecraft:minecart";
const ENTITY_BLOCK_TYPE = "train:entity_block";
const AIR_BLOCK_ID = "minecraft:air";
const LIGHT_BLOCK_ID = "minecraft:light_block";
const RAIL_BLOCK_ID = "minecraft:rail";
const MINECART_BUTTON_TEXTURE = "textures/items/minecart_normal";
const TEMP_SEAT_TYPE = "train:temp_seat";
const HORIZONTAL_RAIL_SEARCH_RADIUS = 6;
const PLAYER_LEAVE_AUTO_BLOCKIZE_DELAY = 0;
const PLAYER_JOIN_RECOVERY_DELAY = 5;

function getInvalidRailDirectionMessage() {
     return {
          rawtext: [
               { text: "§7§l" },
               { translate: "error.state.managementForm" },
          ],
     };
}

function getPlacementBlockedMessage() {
     return {
          rawtext: [
               { text: "§7§l" },
               { translate: "error.place.managementForm" },
          ],
     };
}

function getConfirmButtonMessage() {
     return {
          rawtext: [
               { text: "§j§l" },
               { translate: "forcedYes.managementForm" },
          ],
     };
}

function getCancelButtonMessage() {
     return {
          rawtext: [{ text: "§j§l" }, { translate: "no.form" }],
     };
}

function isRuntimeCleanupTarget(entity) {
     return (
          entity.typeId === ENTITY_BLOCK_TYPE ||
          entity.typeId === FRAGMENT_COLLECTOR_TYPE ||
          entity.typeId === FRAGMENT_ENTITY_TYPE ||
          entity.hasTag(TRAIN_PLUGIN_ATTACHED_TAG)
     );
}

function removeEntityWithWarning(entity, actionName) {
     try {
          if (entity?.isValid()) {
               entity.remove();
          }
     } catch (error) {
          console.warn(`${actionName}: ${error}`);
     }
}

function getLegacyStructureRotationDegrees(
     minecartId,
     currentRotation,
     railDirection,
) {
     const hasInitialRotation = Boolean(
          world.getDynamicProperty(`hasInitialRotation_${minecartId}`),
     );
     const initialRotation = world.getDynamicProperty(
          `initialRotation_${minecartId}`,
     );

     if (!hasInitialRotation || !Number.isFinite(initialRotation)) {
          return null;
     }

     let rotationDelta = currentRotation - initialRotation;
     rotationDelta = ((((rotationDelta + 180) % 360) + 360) % 360) - 180;

     if (railDirection === 1) {
          const is90Multiple = Math.abs(initialRotation % 90) < 0.001;
          if (!is90Multiple) {
               rotationDelta = currentRotation;
          }

          if (rotationDelta > 0 && rotationDelta <= 100) {
               return 90;
          }

          if (rotationDelta > 100 || rotationDelta <= -100) {
               return 180;
          }

          if (rotationDelta < 0 && rotationDelta >= -100) {
               return 270;
          }

          return 0;
     }

     if (railDirection === 0) {
          if (rotationDelta > 0 && rotationDelta <= 160) {
               return 90;
          }

          if (rotationDelta > 160 || rotationDelta <= -160) {
               return 180;
          }

          if (rotationDelta < 0 && rotationDelta >= -160) {
               return 270;
          }
     }

     return 0;
}

// 这个管理器负责把已经运行中的列车拆回方块结构。
export class TrainStructureManager {
     constructor(autoBinder) {
          this.autoBinder = autoBinder;
          this.hasOnlinePlayers = false;
          this.isAutoBlockizing = false;
          this.setupHandBookInteractListener();
          this.setupAutoBlockizeListeners();

          system.runTimeout(() => {
               this.syncOnlinePlayerState();
          }, PLAYER_JOIN_RECOVERY_DELAY);
     }

     setupHandBookInteractListener() {
          // 玩家使用手册物品时，打开列车列表并选择要还原的目标。
          world.afterEvents.itemUse.subscribe((event) => {
               const { itemStack, source: player } = event;
               if (itemStack?.typeId !== HANDBOOK_ITEM_ID) {
                    return;
               }

               system.run(() => {
                    this.showManagementForm(player);
               });
          });
     }

     async showManagementForm(player) {
          const form = new ActionFormData();
          form.title({
               rawtext: [{ translate: "title.managementForm" }],
          });

          const selectableMinecartIds = [];

          for (const minecartId of minecartRegistry.getAll()) {
               const trainData = loadTrainData(minecartId);
               if (!trainData) {
                    continue;
               }

               selectableMinecartIds.push(minecartId);
               form.button(
                    {
                         rawtext: [
                              { translate: "button1.managementForm" },
                              { translate: "button2.managementForm" },
                              { text: ` ${trainData.minecartName}` },
                         ],
                    },
                    MINECART_BUTTON_TEXTURE,
               );
          }

          if (selectableMinecartIds.length === 0) {
               form.body({
                    rawtext: [{ translate: "body.managementForm" }],
               });
               await form.show(player);
               return;
          }

          const response = await form.show(player);
          if (response.canceled) {
               return;
          }

          const selectedId = selectableMinecartIds[response.selection];
          this.restoreToBlocks(player, selectedId);
     }

     setupAutoBlockizeListeners() {
          world.afterEvents.playerLeave.subscribe(() => {
               system.runTimeout(() => {
                    this.syncOnlinePlayerState();
               }, PLAYER_LEAVE_AUTO_BLOCKIZE_DELAY);
          });

          world.afterEvents.playerSpawn.subscribe(() => {
               system.runTimeout(() => {
                    this.syncOnlinePlayerState();
               }, PLAYER_JOIN_RECOVERY_DELAY);
          });
     }

     syncOnlinePlayerState() {
          const hasOnlinePlayers = world.getAllPlayers().length > 0;
          if (!hasOnlinePlayers) {
               this.hasOnlinePlayers = false;
               return;
          }

          if (this.hasOnlinePlayers) {
               return;
          }

          this.hasOnlinePlayers = true;
          this.restoreAllTrackedTrains();
     }

     standardizeMinecartPosition(minecart) {
          return standardizeHorizontalEntityPosition(minecart);
     }

     async showForceRestoreForm(player, message, minecartId, restoreOptions) {
          const form = new ActionFormData();
          form.title({
               rawtext: [{ translate: "title.managementForm" }],
          });
          form.body(message);
          form.button(getConfirmButtonMessage());
          form.button(getCancelButtonMessage());

          const response = await form.show(player);
          if (response.canceled || response.selection !== 0) {
               return;
          }

          this.restoreToBlocks(player, minecartId, restoreOptions);
     }

     restoreAllTrackedTrains() {
          if (this.isAutoBlockizing) {
               return;
          }

          this.isAutoBlockizing = true;

          try {
               this.cleanupTempSeats();

               for (const minecartId of [...minecartRegistry.getAll()]) {
                    try {
                         this.restoreToBlocks(undefined, minecartId, {
                              allowRailRecovery: true,
                              allowBlockedAreaClear: true,
                              silent: true,
                         });
                    } catch (error) {
                         console.warn(
                              `自动方块化列车 ${minecartId} 失败: ${error}`,
                         );
                    }
               }
          } finally {
               this.isAutoBlockizing = false;
          }
     }

     cleanupTempSeats() {
          activePlayerSeats.clear();

          for (const seat of getOverworldDimension().getEntities({
               type: TEMP_SEAT_TYPE,
          })) {
               removeEntityWithWarning(seat, "清理隐藏座位失败");
          }
     }

     findNearbyMinecart(dimension, location) {
          const minecartCandidates = dimension
               .getEntities({
                    type: DEFAULT_MINECART_TYPE,
                    location,
                    maxDistance: 0.75,
               })
               .filter((entity) => entity?.isValid());

          if (!minecartCandidates.length) {
               return null;
          }

          minecartCandidates.sort(
               (left, right) =>
                    Math.hypot(
                         left.location.x - location.x,
                         left.location.y - location.y,
                         left.location.z - location.z,
                    ) -
                    Math.hypot(
                         right.location.x - location.x,
                         right.location.y - location.y,
                         right.location.z - location.z,
                    ),
          );

          return minecartCandidates[0];
     }

     cleanupTrainRuntimeEntities(minecartId, renderedEntities = []) {
          const dimension = getOverworldDimension();
          const taggedEntities = dimension.getEntities({
               tags: [`${minecartId}`],
          });

          for (const entity of taggedEntities) {
               if (isRuntimeCleanupTarget(entity)) {
                    removeEntityWithWarning(entity, "移除实体时出错");
               }
          }

          for (const entity of renderedEntities) {
               removeEntityWithWarning(entity, "移除实体时出错");
          }
     }

     // 根据矿车朝向和保存的核心偏移，计算结构放回世界时的基准点。
     calculateCorePosition(
          minecartLocation,
          coreOffset,
          rotationDegrees,
          railDirection,
     ) {
          const pivot = minecartLocation;
          const originalBase = {
               x: pivot.x - coreOffset.x,
               y: pivot.y - coreOffset.y,
               z: pivot.z - coreOffset.z,
          };
          const originalCore = {
               x: originalBase.x + coreOffset.x,
               y: originalBase.y + coreOffset.y,
               z: originalBase.z + coreOffset.z,
          };
          const radians = rotationDegrees * (Math.PI / 180);

          const relativeX = originalCore.x - pivot.x;
          const relativeZ = originalCore.z - pivot.z;

          const rotatedX =
               relativeX * Math.cos(radians) - relativeZ * Math.sin(radians);
          const rotatedZ =
               relativeX * Math.sin(radians) + relativeZ * Math.cos(radians);

          const rotatedCore = {
               x: pivot.x + rotatedX,
               y: pivot.y,
               z: pivot.z + rotatedZ,
          };

          return {
               x: rotatedCore.x - coreOffset.x,
               y: pivot.y - coreOffset.y,
               z: rotatedCore.z - coreOffset.z,
          };
     }

     getStructureFootprint(structureId, rotation) {
          const structure = world.structureManager.get(structureId);
          const size = structure?.size;
          if (!size) {
               return null;
          }

          const useRotatedFootprint =
               rotation === "Rotate90" || rotation === "Rotate270";

          return {
               width: useRotatedFootprint ? size.z : size.x,
               depth: useRotatedFootprint ? size.x : size.z,
               height: size.y,
          };
     }

     // 放回结构前先检查目标区域是否为空，避免直接覆盖现有建筑。
     canPlaceStructure(dimension, placePosition, structureId, rotation) {
          const footprint = this.getStructureFootprint(structureId, rotation);
          if (!footprint) {
               return false;
          }

          for (let dx = 0; dx < footprint.width; dx++) {
               for (let dy = 0; dy < footprint.height; dy++) {
                    for (let dz = 0; dz < footprint.depth; dz++) {
                         const blockPosition = {
                              x: placePosition.x + dx,
                              y: placePosition.y + dy,
                              z: placePosition.z + dz,
                         };

                         try {
                              const block = dimension.getBlock(blockPosition);
                              const isAirLikeBlock =
                                   block?.typeId === AIR_BLOCK_ID ||
                                   block?.typeId?.startsWith(LIGHT_BLOCK_ID);
                              if (block && !isAirLikeBlock) {
                                   return false;
                              }
                         } catch (error) {
                              console.warn(`检查方块时出错: ${error}`);
                         }
                    }
               }
          }

          return true;
     }

     getRailBlockPosition(location) {
          return {
               x: Math.floor(location.x),
               y: Math.floor(location.y),
               z: Math.floor(location.z),
          };
     }

     getRailDirectionAtBlockPosition(dimension, blockPosition) {
          try {
               const block = dimension.getBlock(blockPosition);
               if (!block) {
                    return null;
               }

               return block.permutation.getState("rail_direction");
          } catch {
               return null;
          }
     }

     findNearestHorizontalRail(dimension, originPosition) {
          let bestCandidate = null;
          let bestDistanceSquared = Infinity;

          for (let dy = -1; dy <= 1; dy++) {
               for (
                    let dx = -HORIZONTAL_RAIL_SEARCH_RADIUS;
                    dx <= HORIZONTAL_RAIL_SEARCH_RADIUS;
                    dx++
               ) {
                    for (
                         let dz = -HORIZONTAL_RAIL_SEARCH_RADIUS;
                         dz <= HORIZONTAL_RAIL_SEARCH_RADIUS;
                         dz++
                    ) {
                         const blockPosition = {
                              x: originPosition.x + dx,
                              y: originPosition.y + dy,
                              z: originPosition.z + dz,
                         };
                         const railDirection =
                              this.getRailDirectionAtBlockPosition(
                                   dimension,
                                   blockPosition,
                              );

                         if (!isHorizontalRailDirection(railDirection)) {
                              continue;
                         }

                         const distanceSquared =
                              dx * dx + dz * dz + Math.abs(dy) * 0.25;

                         if (distanceSquared < bestDistanceSquared) {
                              bestDistanceSquared = distanceSquared;
                              bestCandidate = {
                                   ...blockPosition,
                                   railDirection,
                              };
                         }
                    }
               }
          }

          return bestCandidate;
     }

     placeFallbackRail(dimension, blockPosition) {
          const block = dimension.getBlock(blockPosition);
          if (!block) {
               return false;
          }

          try {
               if (
                    block.typeId !== AIR_BLOCK_ID &&
                    block.typeId !== LIGHT_BLOCK_ID &&
                    !block.hasTag("rail")
               ) {
                    dimension.runCommand(
                         `setblock ${blockPosition.x} ${blockPosition.y} ${blockPosition.z} air destroy`,
                    );
               }

               block.setPermutation(
                    BlockPermutation.resolve(RAIL_BLOCK_ID, {
                         rail_direction: 0,
                    }),
               );

               return true;
          } catch (error) {
               console.warn(`补放铁轨失败: ${error}`);
               return false;
          }
     }

     recoverMinecartRailContext(minecart, dimension) {
          const standardizedLocation =
               this.standardizeMinecartPosition(minecart);
          const currentRailPosition =
               this.getRailBlockPosition(standardizedLocation);
          const currentRailDirection = this.getRailDirectionAtBlockPosition(
               dimension,
               currentRailPosition,
          );

          if (isHorizontalRailDirection(currentRailDirection)) {
               return {
                    location: standardizedLocation,
                    railDirection: currentRailDirection,
               };
          }

          const nearestRail = this.findNearestHorizontalRail(
               dimension,
               currentRailPosition,
          );
          if (nearestRail) {
               minecart.teleport(
                    {
                         x: nearestRail.x + 0.5,
                         y: nearestRail.y,
                         z: nearestRail.z + 0.5,
                    },
                    {
                         dimension,
                         keepVelocity: false,
                         rotation: minecart.getRotation(),
                    },
               );

               const recoveredLocation =
                    this.standardizeMinecartPosition(minecart);
               return {
                    location: recoveredLocation,
                    railDirection: nearestRail.railDirection,
               };
          }

          if (!this.placeFallbackRail(dimension, currentRailPosition)) {
               return null;
          }

          return {
               location: this.standardizeMinecartPosition(minecart),
               railDirection: this.getRailDirectionAtBlockPosition(
                    dimension,
                    currentRailPosition,
               ),
          };
     }

     clearPlacementAreaBlocks(dimension, placePosition, structureId, rotation) {
          const footprint = this.getStructureFootprint(structureId, rotation);
          if (!footprint) {
               return false;
          }

          for (let dx = 0; dx < footprint.width; dx++) {
               for (let dy = 0; dy < footprint.height; dy++) {
                    for (let dz = 0; dz < footprint.depth; dz++) {
                         const blockPosition = {
                              x: placePosition.x + dx,
                              y: placePosition.y + dy,
                              z: placePosition.z + dz,
                         };

                         try {
                              const block = dimension.getBlock(blockPosition);
                              if (
                                   !block ||
                                   block.typeId === AIR_BLOCK_ID ||
                                   block.typeId === LIGHT_BLOCK_ID ||
                                   block.hasTag("rail")
                              ) {
                                   continue;
                              }

                              dimension.runCommand(
                                   `setblock ${blockPosition.x} ${blockPosition.y} ${blockPosition.z} air destroy`,
                              );
                         } catch (error) {
                              console.warn(`强制清理方块失败: ${error}`);
                              return false;
                         }
                    }
               }
          }

          return true;
     }

     restoreToBlocks(player, minecartId, options = {}) {
          // 还原时按当前矿车位置和保存的旋转数据计算结构放置方式。
          const trainData = loadTrainData(minecartId);
          if (!trainData) {
               return false;
          }

          const dimension = getOverworldDimension();
          const minecart = world.getEntity(minecartId);
          if (!minecart) {
               return false;
          }

          const {
               allowRailRecovery = false,
               allowBlockedAreaClear = false,
               silent = false,
          } = options;

          const structureAABBId = `mystructure:structure_${minecartId}_AABB`;
          const coreOffset = trainData.coreOffset;
          const { transform } = ensureTrainTransformData(
               trainData,
               minecart.getRotation().y,
          );

          let railContext = {
               location: this.standardizeMinecartPosition(minecart),
               railDirection: this.getRailDirectionAtBlockPosition(
                    dimension,
                    this.getRailBlockPosition(minecart.location),
               ),
          };

          if (!isHorizontalRailDirection(railContext.railDirection)) {
               if (!allowRailRecovery) {
                    if (player) {
                         void this.showForceRestoreForm(
                              player,
                              getInvalidRailDirectionMessage(),
                              minecartId,
                              {
                                   ...options,
                                   allowRailRecovery: true,
                              },
                         );
                    } else if (!silent) {
                         console.warn(`列车 ${minecartId} 当前不在有效平轨上`);
                    }
                    return false;
               }

               railContext = this.recoverMinecartRailContext(
                    minecart,
                    dimension,
               );
               if (
                    !railContext ||
                    !isHorizontalRailDirection(railContext.railDirection)
               ) {
                    if (!silent) {
                         console.warn(`列车 ${minecartId} 的轨道恢复失败`);
                    }
                    return false;
               }
          }

          const minecartLocation = railContext.location;
          const originalLocation = minecartLocation;
          const railDirection = railContext.railDirection;

          let structureRotation = "None";
          const rotationDegrees =
               getLegacyStructureRotationDegrees(
                    minecartId,
                    minecart.getRotation().y,
                    railDirection,
               ) ?? getTrainStructureRotationDegrees(transform);

          if (rotationDegrees === 90) {
               structureRotation = "Rotate90";
          } else if (rotationDegrees === 180) {
               structureRotation = "Rotate180";
          } else if (rotationDegrees === 270) {
               structureRotation = "Rotate270";
          }

          const rotatedPlacePosition = this.calculateCorePosition(
               minecartLocation,
               coreOffset,
               rotationDegrees,
               railDirection,
          );

          const canPlace = this.canPlaceStructure(
               dimension,
               rotatedPlacePosition,
               structureAABBId,
               structureRotation,
          );

          if (!canPlace) {
               if (!allowBlockedAreaClear) {
                    if (player) {
                         void this.showForceRestoreForm(
                              player,
                              getPlacementBlockedMessage(),
                              minecartId,
                              {
                                   ...options,
                                   allowBlockedAreaClear: true,
                              },
                         );
                    } else if (!silent) {
                         console.warn(
                              `列车 ${minecartId} 的目标区域仍有阻挡方块`,
                         );
                    }
                    return false;
               }

               const didClear = this.clearPlacementAreaBlocks(
                    dimension,
                    rotatedPlacePosition,
                    structureAABBId,
                    structureRotation,
               );
               if (!didClear) {
                    if (!silent) {
                         console.warn(`列车 ${minecartId} 的强制清场失败`);
                    }
                    return false;
               }
          }

          const renderedEntities =
               minecart.getComponent("minecraft:rideable")?.getRiders() ?? [];

          try {
               world.structureManager.place(
                    structureAABBId,
                    dimension,
                    rotatedPlacePosition,
                    {
                         rotation: structureRotation,
                    },
               );
          } catch (error) {
               if (!silent) {
                    console.warn(
                         `补完列车 ${minecartId} 的方块化失败: ${error}`,
                    );
               }
               return false;
          }

          getTrainUpdaterInstance()?.stopUpdaterById(minecartId);
          clearTrainDynamicLights(minecartId);

          // 还原前先解绑玩家，避免座位清理与结构还原冲突。
          if (
               this.autoBinder &&
               typeof this.autoBinder.unbindAllPlayers === "function"
          ) {
               this.autoBinder.unbindAllPlayers();
          } else {
               for (const activePlayer of world.getAllPlayers()) {
                    try {
                         new EntityWithPlayerStop(
                              activePlayer,
                         ).stopPlayerMoving();
                    } catch (error) {
                         console.warn(
                              `备用解绑玩家 ${activePlayer.name} 出错: ${error}`,
                         );
                    }
               }
          }

          this.cleanupTrainRuntimeEntities(minecartId, renderedEntities);

          if (minecart.isValid()) {
               minecart.remove();
          }

          let replacementMinecart = this.findNearbyMinecart(
               dimension,
               originalLocation,
          );
          if (!replacementMinecart) {
               replacementMinecart = dimension.spawnEntity(
                    DEFAULT_MINECART_TYPE,
                    originalLocation,
               );
          }

          system.runTimeout(() => {
               if (!replacementMinecart?.isValid()) {
                    return;
               }

               this.standardizeMinecartPosition(replacementMinecart);
               replacementMinecart.triggerEvent("train_type");
          }, 1);

          clearMinecartConsist(minecartId, { deleteSelf: true });
          clearDriveBindingsForMinecart(minecartId);
          minecartRegistry.remove(minecartId);
          deleteTrainData(minecartId);

          try {
               world.structureManager.delete(structureAABBId);
          } catch (error) {
               if (!silent) {
                    console.warn(`删除结构缓存失败: ${error}`);
               }
          }

          return true;
     }
}
