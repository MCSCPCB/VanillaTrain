import { system } from "@minecraft/server";

import {
     getBlockData,
     getFragmentTypeIndex,
     getBlockModelType,
     getBlockRenderOffset,
     getBlockRotation,
} from "../map/BlockMap.js";
import { spawnSimpleFragmentEntities } from "./TrainSimpleFragments.js";

const AIR_BLOCK_ID = "minecraft:air";
const TIMBER_FRAME_BLOCK_ID = "train:timber_frame";

export const FRAGMENT_SLOT_COUNT = 16;
export const FRAGMENT_RENDER_VERSION = 3;
export const FRAGMENT_COLLECTOR_TYPE = "train:fragment_collector";
export const FRAGMENT_ENTITY_TYPE = "train:fragment";
export const FRAGMENT_STACK_PROPERTY = "train:stack";
export const FRAGMENT_MOLANG_ANIMATION = "animation.fragment.update";

export function createFragmentStopExpression(stack) {
     return `${stack}return !${Math.random()};`;
}

function createSlotAssignment(slotIndex, payload) {
     return [
          `v.b${slotIndex}_type=${payload.typeIndex};`,
          `v.b${slotIndex}_model=${payload.modelType};`,
          `v.b${slotIndex}px=${payload.px};`,
          `v.b${slotIndex}py=${payload.py};`,
          `v.b${slotIndex}pz=${payload.pz};`,
          `v.b${slotIndex}rx=${payload.rx};`,
          `v.b${slotIndex}ry=${payload.ry};`,
          `v.b${slotIndex}rz=${payload.rz};`,
          `v.b${slotIndex}data=${payload.data};`,
          `v.b${slotIndex}v=${payload.visible};`,
     ].join("");
}

export function createEmptyRenderState() {
     return {
          version: FRAGMENT_RENDER_VERSION,
          collectorId: null,
          fragments: [],
          simpleFragments: [],
     };
}

export function createFragmentSlotPayload(block, minecartLocation, location) {
     if (
          !block ||
          block.typeId === AIR_BLOCK_ID ||
          block.typeId === TIMBER_FRAME_BLOCK_ID ||
          block.hasTag("rail")
     ) {
          return null;
     }

     // 床只让床头半块进入 fragment 渲染，避免双格模型重复。
     if (block.typeId === "minecraft:bed") {
          try {
               if (!block.permutation.getState("head_piece_bit")) {
                    return null;
               }
          } catch {}
     }

     // 门只让下半部分进入 fragment 渲染，
     // 上半部分仍由结构数据保留，不单独生成 fragment。
     if (block.typeId.endsWith("_door")) {
          try {
               if (block.permutation.getState("upper_block_bit")) {
                    return null;
               }
          } catch {}
     }

     const typeIndex = getFragmentTypeIndex(block.typeId);
     if (typeIndex <= 0) {
          return null;
     }

     const rotation = getBlockRotation(block);
     const data = getBlockData(block);
     const renderOffset = getBlockRenderOffset(block);

     return {
          typeIndex,
          modelType: getBlockModelType(block),
          px: location.x + 0.5 + renderOffset.x - minecartLocation.x,
          // fragment 几何以方块底面为原点。
          py: location.y + renderOffset.y - minecartLocation.y,
          // 局部 z 轴与世界 z 轴取反，用于保持 fragment 坐标系一致。
          pz: -(location.z + 0.5 + renderOffset.z - minecartLocation.z),
          rx: rotation.rx,
          ry: rotation.ry,
          rz: rotation.rz,
          data,
          visible: 1,
     };
}

export function appendFragmentSlot(renderState, payload) {
     let fragment =
          renderState.fragments[renderState.fragments.length - 1];
     if (!fragment || fragment.slotCount >= FRAGMENT_SLOT_COUNT) {
          fragment = {
               entityId: null,
               slotCount: 0,
               stack: "",
          };
          renderState.fragments.push(fragment);
     }

     fragment.stack += createSlotAssignment(fragment.slotCount, payload);
     fragment.slotCount += 1;
     return fragment;
}

export function spawnFragmentEntities(dimension, minecart, renderState) {
     const rideable = minecart.getComponent("minecraft:rideable");
     if (!rideable || !renderState) {
          if (renderState) {
               renderState.collectorId = null;
          }
          return;
     }

     const collector = dimension.spawnEntity(FRAGMENT_COLLECTOR_TYPE, {
          x: minecart.location.x,
          y: minecart.location.y,
          z: minecart.location.z,
     });

     collector.addTag(minecart.id);
     collector.addTag("train_fragment_collector");
     collector.addTag("train_fragment_active");
     rideable.addRider(collector);
     renderState.collectorId = collector.id;

     const collectorRideable = collector.getComponent("minecraft:rideable");
     if (!collectorRideable || !renderState.fragments?.length) {
          spawnSimpleFragmentEntities(
               dimension,
               minecart,
               renderState,
               collectorRideable
          );
          return;
     }

     for (const fragment of renderState.fragments) {
          const entity = dimension.spawnEntity(FRAGMENT_ENTITY_TYPE, {
               x: minecart.location.x,
               y: minecart.location.y,
               z: minecart.location.z,
          });

          entity.addTag(minecart.id);
          entity.addTag("train_fragment");
          entity.addTag("train_fragment_active");
          entity.setDynamicProperty(FRAGMENT_STACK_PROPERTY, fragment.stack);
          collectorRideable.addRider(entity);
          fragment.entityId = entity.id;

          system.runTimeout(() => {
               if (!entity.isValid()) {
                    return;
               }

               entity.playAnimation(FRAGMENT_MOLANG_ANIMATION, {
                    stopExpression: createFragmentStopExpression(
                         fragment.stack
                    ),
               });
          }, 10);
     }

     spawnSimpleFragmentEntities(
          dimension,
          minecart,
          renderState,
          collectorRideable
     );
}
