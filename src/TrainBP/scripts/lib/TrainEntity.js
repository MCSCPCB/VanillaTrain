import {
     BlockPermutation,
     BlockVolume,
     world,
} from "@minecraft/server";

import {
     loadTrainData,
     minecartRegistry,
     saveTrainData,
} from "./DataStorage.js";
import {
     getOverworldDimension,
     getRailDirectionAtLocation,
} from "./shared.js";
import {
     BLOCK_MODEL_MAP,
     getBlockData,
     getBlockModelType,
     getBlockRotation,
} from "../map/BlockMap.js";
import {
     appendFragmentSlot,
     createEmptyRenderState,
     createFragmentSlotPayload,
     spawnFragmentEntities,
} from "./TrainRenderFragments.js";
import { createTrainLightSource } from "./TrainDynamicLights.js";
import {
     appendSimpleFragmentSlot,
     createSimpleFragmentSlotPayload,
} from "./TrainSimpleFragments.js";
import { TRAIN_COLLISION_PROFILE } from "./TrainSurfaceResolver.js";
import { createTrainTransform } from "./TrainTransform.js";
import {
     loadTrainPluginBlockRegistry,
} from "./TrainPluginProtocol.js";
import { TrainPluginRenderBuilder } from "./TrainPluginRuntime.js";

const AIR_BLOCK_ID = "minecraft:air";
const ENTITY_BLOCK_TYPE = "train:entity_block";
const SPECIAL_BLOCK_TYPE_IDS = new Map([
     ["minecraft:campfire", "campfire"],
     ["minecraft:soul_campfire", "soul_campfire"],
     ["minecraft:bell", "bell"],
     ["minecraft:torch", "torch"],
     ["minecraft:soul_torch", "soul_torch"],
     ["minecraft:copper_torch", "copper_torch"],
     ["minecraft:redstone_torch", "redstone_torch"],
     ["minecraft:lit_furnace", "lit_furnace"],
     ["minecraft:lit_blast_furnace", "lit_blast_furnace"],
     ["minecraft:lit_smoker", "lit_smoker"],
     ["minecraft:end_rod", "end_rod"],
]);
const NO_COLLISION_MODEL_TYPES = new Set([
     BLOCK_MODEL_MAP.LADDER_NORTH,
     BLOCK_MODEL_MAP.LADDER_SOUTH,
     BLOCK_MODEL_MAP.LADDER_WEST,
     BLOCK_MODEL_MAP.LADDER_EAST,
     BLOCK_MODEL_MAP.TORCH,
     BLOCK_MODEL_MAP.REDSTONE_TORCH,
     BLOCK_MODEL_MAP.CARPET,
     BLOCK_MODEL_MAP.PRESSURE_PLATE,
     BLOCK_MODEL_MAP.SIGN_STANDING,
     BLOCK_MODEL_MAP.SIGN_WALL,
     BLOCK_MODEL_MAP.HANGING_SIGN,
]);
const SLAB_BOTTOM_MODEL_TYPES = new Set([
     BLOCK_MODEL_MAP.SLAB_BOTTOM,
     BLOCK_MODEL_MAP.MULTI_FACE_SLAB_BOTTOM,
     BLOCK_MODEL_MAP.DAYLIGHT_DETECTOR,
     BLOCK_MODEL_MAP.BED,
]);

function isHorizontalTrapdoorBlock(block, modelType) {
     return (
          modelType === BLOCK_MODEL_MAP.TRAPDOOR &&
          getBlockData(block) === 0
     );
}

function isDoorBlock(block) {
     return block?.typeId?.endsWith("_door");
}

function getBlockState(block, stateName) {
     try {
          return block?.permutation?.getState(stateName);
     } catch {
          return undefined;
     }
}

function isLowerDoorBlock(block) {
     return isDoorBlock(block) && !getBlockState(block, "upper_block_bit");
}

function hasUpperDoorHalf(block) {
     if (!block?.dimension || !block?.location) {
          return false;
     }

     try {
          const upperBlock = block.dimension.getBlock({
               x: block.location.x,
               y: block.location.y + 1,
               z: block.location.z,
          });
          return (
               upperBlock?.typeId === block.typeId &&
               Boolean(getBlockState(upperBlock, "upper_block_bit"))
          );
     } catch {
          return false;
     }
}

function getSpecialBlockType(block, pluginBlockDefinition = null) {
     const mappedType = SPECIAL_BLOCK_TYPE_IDS.get(block?.typeId);
     if (mappedType) {
          return mappedType;
     }

     if (pluginBlockDefinition?.specialInteraction === "door") {
          return getBlockState(block, "upper_block_bit") ? null : "door";
     }

     if (isLowerDoorBlock(block)) {
          return "door";
     }

     return null;
}

function getCollisionProfileForBlock(block, pluginBlockDefinition = null) {
     if (
          !block ||
          block.typeId === AIR_BLOCK_ID ||
          block.typeId === "train:timber_frame" ||
          block.hasTag("rail")
     ) {
          return TRAIN_COLLISION_PROFILE.NONE;
     }

     if (pluginBlockDefinition) {
          if (pluginBlockDefinition.specialInteraction === "door") {
               return getBlockState(block, "open_bit")
                    ? TRAIN_COLLISION_PROFILE.NONE
                    : TRAIN_COLLISION_PROFILE.FULL;
          }

          if (
               pluginBlockDefinition.collisionProfile ===
               TRAIN_COLLISION_PROFILE.SLAB_BOTTOM
          ) {
               return TRAIN_COLLISION_PROFILE.SLAB_BOTTOM;
          }

          if (
               pluginBlockDefinition.collisionProfile ===
               TRAIN_COLLISION_PROFILE.NONE
          ) {
               return TRAIN_COLLISION_PROFILE.NONE;
          }
     }

     const modelType = getBlockModelType(block);

     if (isDoorBlock(block) && getBlockData(block) === 1) {
          return TRAIN_COLLISION_PROFILE.NONE;
     }

     if (NO_COLLISION_MODEL_TYPES.has(modelType)) {
          return TRAIN_COLLISION_PROFILE.NONE;
     }

     if (isHorizontalTrapdoorBlock(block, modelType)) {
          return TRAIN_COLLISION_PROFILE.SLAB_BOTTOM;
     }

     if (SLAB_BOTTOM_MODEL_TYPES.has(modelType)) {
          return TRAIN_COLLISION_PROFILE.SLAB_BOTTOM;
     }

     return TRAIN_COLLISION_PROFILE.FULL;
}

function getCollisionEventName(collisionProfile) {
     if (collisionProfile === TRAIN_COLLISION_PROFILE.NONE) {
          return "AABB_INTERACT_ONLY";
     }

     if (collisionProfile === TRAIN_COLLISION_PROFILE.SLAB_BOTTOM) {
          return "AABB_SLAB_BOTTOM";
     }

     return "AABB";
}

function createOffset(minecartLocation, blockLocation) {
     return {
          x: blockLocation.x - minecartLocation.x,
          y: blockLocation.y - minecartLocation.y,
          z: blockLocation.z - minecartLocation.z,
     };
}

function getDoorRuntimeData(block) {
     return getBlockState(block, "open_bit") ? 1 : 0;
}

// 生成器会把选区里的真实方块转成结构、碰撞实体和 fragment 渲染数据
export class EntityBlockGenerator {
     constructor(minecart, player, start, end) {
          this.dimension = getOverworldDimension();
          this.volume = new BlockVolume(start, end);
          this.minecart = minecart;
          this.minecartId = minecart.id;
          this.player = player;
          this.start = start;
          this.end = end;
     }

     generate() {
          const pluginBlockRegistry = loadTrainPluginBlockRegistry();
          const pluginRenderBuilder =
               pluginBlockRegistry.size > 0
                    ? new TrainPluginRenderBuilder()
                    : null;

          // 先把原始车体存成结构，列车拆回方块时直接从这里还原
          const structureAABBId = `mystructure:structure_${this.minecartId}_AABB`;
          const structureAABB = world.structureManager.createFromWorld(
               structureAABBId,
               this.dimension,
               this.start,
               this.end,
               {
                    saveMode: world,
                    includeBlocks: true,
                    includeEntities: false,
               }
          );
          const structureAABBVolume = new BlockVolume(
               { x: 0, y: 0, z: 0 },
               {
                    x: structureAABB.size.x - 1,
                    y: structureAABB.size.y - 1,
                    z: structureAABB.size.z - 1,
               }
          );

          // 结构里不保留轨道和建造辅助方块，还原时只放回真正的车体
          for (const location of structureAABBVolume.getBlockLocationIterator()) {
               const block = structureAABB.getBlockPermutation(location);
               if (
                    block.type.id === "train:timber_frame" ||
                    block.hasTag("rail")
               ) {
                    structureAABB.setBlockPermutation(
                         location,
                         BlockPermutation.resolve(AIR_BLOCK_ID)
                    );
               }
          }

          const minecartLocation = this.minecart.location;
          const railDirection = getRailDirectionAtLocation(
               minecartLocation,
               this.dimension
          );
          const trainData = loadTrainData(this.minecartId) || {};
          trainData.entities = Array.isArray(trainData.entities)
               ? trainData.entities
               : [];
          trainData.render = createEmptyRenderState();

          // 特殊方块单独记录，运行时据此补粒子或交互效果
          const specialBlocks = [];
          const lightSources = [];
          const blockSnapshots = [];

          // 先读取完整车体中的所有方块状态，再统一生成实体和清空方块
          for (const location of this.volume.getBlockLocationIterator()) {
               const block = this.dimension.getBlock(location);
               if (!block) {
                    continue;
               }

               const pluginBlockDefinition =
                    pluginBlockRegistry.get(block.typeId) ?? null;
               const offset = createOffset(minecartLocation, location);
               const collisionProfile = getCollisionProfileForBlock(
                    block,
                    pluginBlockDefinition
               );
               const needsEntityBlock =
                    getSpecialBlockType(block, pluginBlockDefinition) ===
                         "door" ||
                    collisionProfile !== TRAIN_COLLISION_PROFILE.NONE;
               const specialBlockType = getSpecialBlockType(
                    block,
                    pluginBlockDefinition
               );
               const specialBlockData =
                    specialBlockType === "door"
                         ? getDoorRuntimeData(block)
                         : specialBlockType
                              ? getBlockData(block)
                              : 0;
               blockSnapshots.push({
                    block,
                    location,
                    pluginBlockDefinition,
                    offset,
                    collisionProfile,
                    needsEntityBlock,
                    specialBlockType,
                    specialBlockData,
                    specialBlockRotation: specialBlockType
                         ? getBlockRotation(block)
                         : null,
                    hasCollision:
                         block.typeId !== AIR_BLOCK_ID &&
                         block.typeId !== "train:timber_frame" &&
                         !block.hasTag("rail") &&
                         needsEntityBlock,
                    isVirtualCollision:
                         collisionProfile === TRAIN_COLLISION_PROFILE.NONE &&
                         !needsEntityBlock &&
                         block.typeId !== AIR_BLOCK_ID &&
                         block.typeId !== "train:timber_frame" &&
                         !block.hasTag("rail"),
                    fragmentPayload: createFragmentSlotPayload(
                         block,
                         minecartLocation,
                         location
                    ),
                    simpleFragmentPayload: createSimpleFragmentSlotPayload(
                         block,
                         minecartLocation,
                         location
                    ),
                    lightSource: createTrainLightSource(
                         block,
                         minecartLocation,
                         location,
                         railDirection
                    ),
               });
          }

          // 统一处理采样结果，避免前面空气化影响后面的邻接状态
          for (const snapshot of blockSnapshots) {
               const {
                    block,
                    location,
                    pluginBlockDefinition,
                    offset,
                    collisionProfile,
                    needsEntityBlock,
                    specialBlockType,
                    specialBlockData,
                    specialBlockRotation,
                    hasCollision,
                    isVirtualCollision,
                    fragmentPayload,
                    simpleFragmentPayload,
                    lightSource,
               } = snapshot;

               if (specialBlockType) {
                    const specialBlock = {
                         type: specialBlockType,
                         blockId: block.typeId,
                         offset,
                         data: specialBlockData,
                         rotation: specialBlockRotation,
                    };

                    if (specialBlockType === "door") {
                         if (pluginBlockDefinition?.specialInteraction === "door") {
                              specialBlock.runtimeOnly = true;
                              if (hasUpperDoorHalf(block)) {
                                   specialBlock.upperOffset = {
                                        x: offset.x,
                                        y: offset.y + 1,
                                        z: offset.z,
                                   };
                              }
                         } else {
                              specialBlock.upperOffset = {
                                   x: offset.x,
                                   y: offset.y + 1,
                                   z: offset.z,
                              };
                         }
                    }

                    specialBlocks.push(specialBlock);
               }

               if (lightSource) {
                    lightSources.push(lightSource);
               }

               let renderFragmentRef = null;

               if (simpleFragmentPayload) {
                    appendSimpleFragmentSlot(
                         trainData.render,
                         simpleFragmentPayload
                    );
               } else if (fragmentPayload) {
                    const fragment = appendFragmentSlot(
                         trainData.render,
                         fragmentPayload
                    );
                    renderFragmentRef = {
                         fragmentIndex: trainData.render.fragments.length - 1,
                         slotIndex: fragment.slotCount - 1,
                    };
               }

               if (specialBlockType === "door" && renderFragmentRef) {
                    const doorState =
                         specialBlocks[specialBlocks.length - 1];
                    doorState.renderFragmentIndex =
                         renderFragmentRef.fragmentIndex;
                    doorState.renderSlotIndex =
                         renderFragmentRef.slotIndex;
               }

               if (pluginRenderBuilder && pluginBlockDefinition) {
                    pluginRenderBuilder.appendBlock(
                         block,
                         offset,
                         pluginBlockDefinition,
                         specialBlockType === "door" && specialBlockData === 1
                    );
               }

               // 需要实体承载的方块生成实体块，其余无碰撞方块只保留渲染数据
               if (hasCollision) {
                    const entity = this.dimension.spawnEntity(ENTITY_BLOCK_TYPE, {
                         x: location.x + 0.5,
                         y: location.y,
                         z: location.z + 0.5,
                    });

                    entity.runCommand(
                         `event entity @s ${getCollisionEventName(
                              collisionProfile
                         )}`
                    );
                    this.minecart.addTag(`${this.minecartId}`);
                    minecartRegistry.add(`${this.minecartId}`);
                    entity.addTag(`${this.minecartId}`);

                    trainData.entities.push({
                         entityId: entity.id,
                         offset,
                         railDirection,
                         collisionProfile,
                    });

                    block.setPermutation(BlockPermutation.resolve(AIR_BLOCK_ID));
               } else if (isVirtualCollision) {
                    this.minecart.addTag(`${this.minecartId}`);
                    minecartRegistry.add(`${this.minecartId}`);

                    trainData.entities.push({
                         entityId: null,
                         offset,
                         railDirection,
                         isVirtual: true,
                         collisionProfile,
                    });

                    block.setPermutation(BlockPermutation.resolve(AIR_BLOCK_ID));
               }
          }

          const width = Math.abs(this.end.x - this.start.x);
          const depth = Math.abs(this.end.z - this.start.z);
          const primaryRadius = Math.max(width, depth) / 2 + 0.5;
          const maxTopOffset = this.end.y - minecartLocation.y;
          const maxBottomOffset = minecartLocation.y - this.start.y;
          const secondaryRadiusY =
               Math.max(maxTopOffset, maxBottomOffset) + 0.5;

          // 保存列车体积范围和核心偏移，供绑定和还原读取
          trainData.radii = {
               primary: primaryRadius,
               secondary: primaryRadius,
               secondaryY: secondaryRadiusY,
          };
          trainData.hardBounds = {
               posX: this.end.x - minecartLocation.x + 0.5,
               negX: minecartLocation.x - this.start.x + 0.5,
               posZ: this.end.z - minecartLocation.z + 0.5,
               negZ: minecartLocation.z - this.start.z + 0.5,
          };
          trainData.coreOffset = {
               x: minecartLocation.x - this.start.x,
               y: minecartLocation.y - this.start.y,
               z: minecartLocation.z - this.start.z,
          };
          trainData.transform = createTrainTransform(
               this.minecart.getRotation().y
          );
          trainData.specialBlocks = specialBlocks;
          trainData.lightSources = lightSources;
          trainData.pluginRender = pluginRenderBuilder
               ? pluginRenderBuilder.build()
               : null;

          spawnFragmentEntities(this.dimension, this.minecart, trainData.render);
          saveTrainData(this.minecartId, trainData);
     }
}
