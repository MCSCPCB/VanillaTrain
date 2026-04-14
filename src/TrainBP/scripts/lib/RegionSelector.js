import { BlockVolume, system, world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

import { loadTrainData, saveTrainData } from "./DataStorage.js";
import { EntityBlockGenerator } from "./TrainEntity";
import {
     getOverworldDimension,
     getRailDirectionAtLocation,
     isHorizontalRailDirection,
} from "./shared.js";

const MAX_RADIUS = 5.0;
const MAX_HEIGHT = 15.0;
const WRENCH_ITEM_ID = "train:wrench";
const CONNECT_CORE_BLOCK_ID = "train:connect_core";
const DEFAULT_MINECART_TYPE = "minecraft:minecart";
const PREVIEW_INTERVAL = 1;
const PREVIEW_EMIT_INTERVAL = 1;
const PREVIEW_HORIZONTAL_DELTA_LIMIT = MAX_RADIUS * 2;
const PREVIEW_VERTICAL_DELTA_LIMIT = MAX_HEIGHT;
const PREVIEW_MAX_DISTANCE = Math.ceil(
     Math.hypot(
          PREVIEW_HORIZONTAL_DELTA_LIMIT,
          PREVIEW_VERTICAL_DELTA_LIMIT,
          PREVIEW_HORIZONTAL_DELTA_LIMIT
     )
);
const PREVIEW_FACE_EAST_PARTICLE = "train:selection_face_x1";
const PREVIEW_FACE_WEST_PARTICLE = "train:selection_face_x2";
const PREVIEW_FACE_TOP_PARTICLE = "train:selection_face_top";
const PREVIEW_FACE_BOTTOM_PARTICLE = "train:selection_face_bottom";
const PREVIEW_FACE_SOUTH_PARTICLE = "train:selection_face_z1";
const PREVIEW_FACE_NORTH_PARTICLE = "train:selection_face_z2";

function createActionBarMessage(text, translate, withValues = undefined) {
     const rawtext = [];

     if (text) {
          rawtext.push({ text });
     }

     if (translate) {
          const translateEntry = { translate };
          if (withValues) {
               translateEntry.with = withValues;
          }
          rawtext.push(translateEntry);
     }

    return { rawtext };
}

function getHeldItemTypeId(player) {
     return player
          ?.getComponent("minecraft:inventory")
          ?.container?.getItem(player.selectedSlotIndex)?.typeId;
}

function getPreviewTargetLocation(player) {
     try {
          const hit = player.getBlockFromViewDirection({
               maxDistance: PREVIEW_MAX_DISTANCE,
          });
          return hit?.block?.location ?? null;
     } catch {
          return null;
     }
}

function clampPreviewAxis(startValue, targetValue, maxDelta) {
     const delta = targetValue - startValue;
     if (Math.abs(delta) <= maxDelta) {
          return targetValue;
     }

     return startValue + Math.sign(delta) * maxDelta;
}

function clampPreviewEnd(start, end) {
     return {
          x: clampPreviewAxis(
               start.x,
               end.x,
               PREVIEW_HORIZONTAL_DELTA_LIMIT
          ),
          y: clampPreviewAxis(start.y, end.y, PREVIEW_VERTICAL_DELTA_LIMIT),
          z: clampPreviewAxis(
               start.z,
               end.z,
               PREVIEW_HORIZONTAL_DELTA_LIMIT
          ),
     };
}

function pushPreviewParticle(particles, particleId, x, y, z) {
     particles.push({
          particleId,
          location: { x, y, z },
     });
}

function pushPreviewFaceParticles(
     particles,
     particleId,
     minA,
     maxA,
     minB,
     maxB,
     createLocation
) {
     for (let a = minA; a <= maxA; a++) {
          for (let b = minB; b <= maxB; b++) {
               const location = createLocation(a, b);
               pushPreviewParticle(
                    particles,
                    particleId,
                    location.x,
                    location.y,
                    location.z
               );
          }
     }
}

function buildPreviewShell(start, end) {
     const minX = Math.min(start.x, end.x);
     const maxX = Math.max(start.x, end.x);
     const minY = Math.min(start.y, end.y);
     const maxY = Math.max(start.y, end.y);
     const minZ = Math.min(start.z, end.z);
     const maxZ = Math.max(start.z, end.z);
     const particles = [];

     pushPreviewFaceParticles(
          particles,
          PREVIEW_FACE_WEST_PARTICLE,
          minY,
          maxY,
          minZ,
          maxZ,
          (y, z) => ({
               x: minX + 0.5,
               y: y + 0.5,
               z: z + 0.5,
          })
     );
     pushPreviewFaceParticles(
          particles,
          PREVIEW_FACE_EAST_PARTICLE,
          minY,
          maxY,
          minZ,
          maxZ,
          (y, z) => ({
               x: maxX + 0.5,
               y: y + 0.5,
               z: z + 0.5,
          })
     );
     pushPreviewFaceParticles(
          particles,
          PREVIEW_FACE_BOTTOM_PARTICLE,
          minX,
          maxX,
          minZ,
          maxZ,
          (x, z) => ({
               x: x + 0.5,
               y: minY + 0.5,
               z: z + 0.5,
          })
     );
     pushPreviewFaceParticles(
          particles,
          PREVIEW_FACE_TOP_PARTICLE,
          minX,
          maxX,
          minZ,
          maxZ,
          (x, z) => ({
               x: x + 0.5,
               y: maxY + 0.5,
               z: z + 0.5,
          })
     );
     pushPreviewFaceParticles(
          particles,
          PREVIEW_FACE_NORTH_PARTICLE,
          minX,
          maxX,
          minY,
          maxY,
          (x, y) => ({
               x: x + 0.5,
               y: y + 0.5,
               z: minZ + 0.5,
          })
     );
     pushPreviewFaceParticles(
          particles,
          PREVIEW_FACE_SOUTH_PARTICLE,
          minX,
          maxX,
          minY,
          maxY,
          (x, y) => ({
               x: x + 0.5,
               y: y + 0.5,
               z: maxZ + 0.5,
          })
     );

     return particles;
}

function emitPreviewShell(dimension, previewParticles) {
     for (const { particleId, location } of previewParticles) {
          dimension.spawnParticle(particleId, location);
     }
}

// 选区必须围绕核心对称，这样列车旋转时才会始终围绕矿车中心
function calculateSymmetricRegion(center, start, end) {
     const getMaxRadiusForAxis = (axis) => {
          const radiusFromStart = Math.abs(center[axis] - start[axis]);
          const radiusFromEnd = Math.abs(center[axis] - end[axis]);
          return Math.max(radiusFromStart, radiusFromEnd);
     };

     const maxRadiusX = getMaxRadiusForAxis("x");
     const maxRadiusZ = getMaxRadiusForAxis("z");

     return {
          start: {
               x: center.x - maxRadiusX,
               y: Math.min(start.y, end.y),
               z: center.z - maxRadiusZ,
          },
          end: {
               x: center.x + maxRadiusX,
               y: Math.max(start.y, end.y),
               z: center.z + maxRadiusZ,
          },
     };
}

// 收集列车名称并写入列车数据，供管理界面和连接表单读取
function showMessageForm(player, start, end) {
     const form = new ModalFormData();
     form.title(createActionBarMessage(null, "title.form"));
     form.textField(
          createActionBarMessage("§i§l", "textField1.form"),
          createActionBarMessage("§i§l", "textField2.form")
     );
     form.submitButton(createActionBarMessage("§j§l", "yes.form"));

     form.show(player)
          .then((response) => {
               if (response.canceled) {
                    player.onScreenDisplay.setActionBar(
                         createActionBarMessage("§f§l", "cancel.coordinate")
                    );
                    return;
               }

               const [minecartName] = response.formValues;
               const dimension = getOverworldDimension();
               const volume = new BlockVolume(start, end);
               let coreLocation = { x: 0, y: 0, z: 0 };

               for (const location of volume.getBlockLocationIterator()) {
                    const block = dimension.getBlock(location);
                    if (block?.typeId === CONNECT_CORE_BLOCK_ID) {
                         coreLocation = location;
                    }
               }

               const minecartLocation = {
                    x: coreLocation.x,
                    y: coreLocation.y - 1,
                    z: coreLocation.z,
               };
               const minecarts = dimension
                    .getEntitiesAtBlockLocation(minecartLocation)
                    .filter((entity) => entity.typeId === DEFAULT_MINECART_TYPE);

               if (minecarts.length === 0) {
                    return;
               }

               const minecart = minecarts[0];
               const trainData = loadTrainData(minecart.id) || {};
               trainData.minecartName = minecartName || "Minecart";
               saveTrainData(minecart.id, trainData);

               // 名称写入完成后，再开始生成列车结构和渲染数据
               system.run(() => {
                    const railDirection = getRailDirectionAtLocation(
                         {
                              x: Math.floor(minecart.location.x),
                              y: Math.floor(minecart.location.y),
                              z: Math.floor(minecart.location.z),
                         },
                         dimension
                    );

                    if (!isHorizontalRailDirection(railDirection)) {
                         player.onScreenDisplay.setActionBar(
                              createActionBarMessage("§m§l", "error.state")
                         );
                         return;
                    }

                    new EntityBlockGenerator(
                         minecart,
                         player,
                         start,
                         end
                    ).generate();
               });

               player.onScreenDisplay.setActionBar(
                    createActionBarMessage("§2§l", "confirm.coordinate")
               );
          })
          .catch((error) => {
               console.error(error, error.stack);
          });
}

export class RegionSelector {
     constructor() {
          this.selections = new Map();
          this.setupListener();
          this.setupPreviewLoop();

          world.afterEvents.playerLeave.subscribe(({ playerId }) => {
               this.selections.delete(playerId);
          });
     }

     setupListener() {
          // 扳手连续点两个方块，分别记录选区的起点和终点
          world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
               if (!event.isFirstEvent) {
                    return;
               }

               const { block, itemStack, player } = event;
               if (itemStack?.typeId !== WRENCH_ITEM_ID) {
                    return;
               }

               const position = {
                    x: Math.floor(block.location.x),
                    y: Math.floor(block.location.y),
                    z: Math.floor(block.location.z),
               };
               const selectionState = this.selections.get(player.id);

               if (!selectionState) {
                    this.selections.set(player.id, {
                         player,
                         start: position,
                         step: 1,
                         previewKey: "",
                         previewParticles: null,
                         nextPreviewTick: 0,
                    });

                    system.run(() => {
                         player.onScreenDisplay.setActionBar(
                              createActionBarMessage(
                                   "§2§l",
                                   "first.coordinate",
                                   [JSON.stringify(this.formatPos(position))]
                              )
                         );
                    });
                    return;
               }

               if (selectionState.step === 1) {
                    const [start, end] = this.normalizePositions(
                         selectionState.start,
                         position
                    );
                    this.selections.delete(player.id);

                    system.run(() => {
                         player.onScreenDisplay.setActionBar(
                              createActionBarMessage(
                                   "§2§l",
                                   "second.coordinate",
                                   [JSON.stringify(this.formatPos(position))]
                              )
                         );
                    });

                    this.onSelectionComplete(player, start, end);
               }
          });
     }

     setupPreviewLoop() {
          let previewTick = 0;

          system.runInterval(() => {
               previewTick++;

               if (!this.selections.size) {
                    return;
               }

               for (const selectionState of this.selections.values()) {
                    const player = selectionState?.player;
                    if (!player || selectionState.step !== 1) {
                         continue;
                    }

                    if (getHeldItemTypeId(player) !== WRENCH_ITEM_ID) {
                         continue;
                    }

                    const target = getPreviewTargetLocation(player);
                    if (!target) {
                         continue;
                    }

                    const clampedTarget = clampPreviewEnd(
                         selectionState.start,
                         target
                    );
                    const previewKey = `${clampedTarget.x},${clampedTarget.y},${clampedTarget.z}`;

                    if (selectionState.previewKey !== previewKey) {
                         const [start, end] = this.normalizePositions(
                              selectionState.start,
                              clampedTarget
                         );
                         selectionState.previewKey = previewKey;
                         selectionState.previewParticles = buildPreviewShell(
                              start,
                              end
                         );
                         selectionState.nextPreviewTick =
                              previewTick + PREVIEW_EMIT_INTERVAL;
                         emitPreviewShell(
                              player.dimension,
                              selectionState.previewParticles
                         );
                         continue;
                    }

                    if (
                         !selectionState.previewParticles ||
                         previewTick < selectionState.nextPreviewTick
                    ) {
                         continue;
                    }

                    selectionState.nextPreviewTick =
                         previewTick + PREVIEW_EMIT_INTERVAL;
                    emitPreviewShell(
                         player.dimension,
                         selectionState.previewParticles
                    );
               }
          }, PREVIEW_INTERVAL);
     }

     normalizePositions(firstPosition, secondPosition) {
          return [
               {
                    x: Math.min(firstPosition.x, secondPosition.x),
                    y: Math.min(firstPosition.y, secondPosition.y),
                    z: Math.min(firstPosition.z, secondPosition.z),
               },
               {
                    x: Math.max(firstPosition.x, secondPosition.x),
                    y: Math.max(firstPosition.y, secondPosition.y),
                    z: Math.max(firstPosition.z, secondPosition.z),
               },
          ];
     }

     formatPos(position) {
          return `${position.x}, ${position.y}, ${position.z}`;
     }

     onSelectionComplete(player, start, end) {
          system.run(() => {
               // 选区内必须只有一个核心方块，且核心正下方必须有唯一矿车
               const dimension = getOverworldDimension();
               const volume = new BlockVolume(start, end);
               let coreCount = 0;
               let coreLocation = { x: 0, y: 0, z: 0 };

               for (const location of volume.getBlockLocationIterator()) {
                    const block = dimension.getBlock(location);
                    if (block?.typeId === CONNECT_CORE_BLOCK_ID) {
                         coreCount++;
                         coreLocation = location;
                    }
               }

               if (coreCount !== 1) {
                    player.onScreenDisplay.setActionBar(
                         createActionBarMessage("§m§l", "error.coordinate")
                    );
                    return;
               }

               const minecartLocation = {
                    x: coreLocation.x,
                    y: coreLocation.y - 1,
                    z: coreLocation.z,
               };
               const minecarts = dimension
                    .getEntitiesAtBlockLocation(minecartLocation)
                    .filter((entity) => entity.typeId === DEFAULT_MINECART_TYPE);

               if (minecarts.length !== 1) {
                    player.onScreenDisplay.setActionBar(
                         createActionBarMessage("§m§l", "error.coordinate")
                    );
                    return;
               }

               const minecart = minecarts[0];
               const railBlock = dimension.getBlock({
                    x: Math.floor(minecart.location.x),
                    y: Math.floor(minecart.location.y),
                    z: Math.floor(minecart.location.z),
               });
               const center = {
                    x: railBlock.x,
                    y: railBlock.y,
                    z: railBlock.z,
               };

               const symmetricRegion = calculateSymmetricRegion(
                    center,
                    start,
                    end
               );
               // 选区需围绕核心对称，保证车体与矿车枢轴对齐
               if (
                    symmetricRegion.start.x !== start.x ||
                    symmetricRegion.start.z !== start.z ||
                    symmetricRegion.end.x !== end.x ||
                    symmetricRegion.end.z !== end.z
               ) {
                    player.onScreenDisplay.setActionBar(
                         createActionBarMessage("§m§l", "error.symmetry")
                    );
                    return;
               }

               const startDistX = Math.abs(start.x - coreLocation.x);
               const startDistZ = Math.abs(start.z - coreLocation.z);
               const endDistX = Math.abs(end.x - coreLocation.x);
               const endDistZ = Math.abs(end.z - coreLocation.z);
               const height = Math.abs(end.y - start.y);

               if (
                    startDistX > MAX_RADIUS ||
                    startDistZ > MAX_RADIUS ||
                    endDistX > MAX_RADIUS ||
                    endDistZ > MAX_RADIUS ||
                    height > MAX_HEIGHT
               ) {
                    // 限制列车尺寸，保证结构、渲染和碰撞数据都在支持范围内
                    player.onScreenDisplay.setActionBar(
                         createActionBarMessage("§m§l", "error.range")
                    );
                    return;
               }

               showMessageForm(player, start, end, minecart);
          });
     }
}
