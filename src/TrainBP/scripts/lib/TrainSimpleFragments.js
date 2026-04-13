import { system } from "@minecraft/server";

import {
     BLOCK_MODEL_MAP,
     getFragmentTypeIndex,
     getBlockModelType,
     getBlockRenderOffset,
     getBlockRotation,
     isSimpleFragmentBlock,
} from "../map/BlockMap.js";

export const SIMPLE_FRAGMENT_SLOT_COUNT = 256;
export const SIMPLE_FRAGMENT_ENTITY_TYPE = "train:simple_fragment";
export const SIMPLE_FRAGMENT_FAMILY = "simple_fragment";
export const SIMPLE_FRAGMENT_STACK_PROPERTY = "train:stack";
export const SIMPLE_FRAGMENT_MOLANG_ANIMATION =
     "animation.simple_fragment.update";

const AIR_BLOCK_ID = "minecraft:air";
const TIMBER_FRAME_BLOCK_ID = "train:timber_frame";

const SIMPLE_MODEL_MAP = {
     [BLOCK_MODEL_MAP.DEFAULT]: 0,
     [BLOCK_MODEL_MAP.SLAB_BOTTOM]: 1,
     [BLOCK_MODEL_MAP.SLAB_TOP]: 2,
     [BLOCK_MODEL_MAP.CARPET]: 3,
};

export function createSimpleFragmentStopExpression(stack) {
     return `${stack}return !${Math.random()};`;
}

function createSimpleSlotAssignment(slotIndex, payload) {
     return [
          `v.b${slotIndex}_type=${payload.typeIndex};`,
          `v.b${slotIndex}_model=${payload.modelType};`,
          `v.b${slotIndex}px=${payload.px};`,
          `v.b${slotIndex}py=${payload.py};`,
          `v.b${slotIndex}pz=${payload.pz};`,
          `v.b${slotIndex}rx=${payload.rx};`,
          `v.b${slotIndex}ry=${payload.ry};`,
          `v.b${slotIndex}rz=${payload.rz};`,
          `v.b${slotIndex}v=${payload.visible};`,
     ].join("");
}

function getSimpleModelType(block) {
     const modelType = getBlockModelType(block);
     return SIMPLE_MODEL_MAP[modelType] ?? -1;
}

export function createSimpleFragmentSlotPayload(
     block,
     minecartLocation,
     location
) {
     if (
          !block ||
          block.typeId === AIR_BLOCK_ID ||
          block.typeId === TIMBER_FRAME_BLOCK_ID ||
          block.hasTag("rail") ||
          !isSimpleFragmentBlock(block)
     ) {
          return null;
     }

     const typeIndex = getFragmentTypeIndex(block.typeId);
     if (typeIndex <= 0) {
          return null;
     }

     const modelType = getSimpleModelType(block);
     if (modelType < 0) {
          return null;
     }

     const rotation = getBlockRotation(block);
     const renderOffset = getBlockRenderOffset(block);

     return {
          typeIndex,
          modelType,
          px: location.x + 0.5 + renderOffset.x - minecartLocation.x,
          py: location.y + renderOffset.y - minecartLocation.y,
          pz: -(location.z + 0.5 + renderOffset.z - minecartLocation.z),
          rx: rotation.rx,
          ry: rotation.ry,
          rz: rotation.rz,
          visible: 1,
     };
}

export function appendSimpleFragmentSlot(renderState, payload) {
     if (!renderState.simpleFragments) {
          renderState.simpleFragments = [];
     }

     let fragment =
          renderState.simpleFragments[renderState.simpleFragments.length - 1];
     if (!fragment || fragment.slotCount >= SIMPLE_FRAGMENT_SLOT_COUNT) {
          fragment = {
               entityId: null,
               slotCount: 0,
               stack: "",
          };
          renderState.simpleFragments.push(fragment);
     }

     fragment.stack += createSimpleSlotAssignment(fragment.slotCount, payload);
     fragment.slotCount += 1;
     return fragment;
}

export function spawnSimpleFragmentEntities(
     dimension,
     minecart,
     renderState,
     collectorRideable
) {
     if (!collectorRideable || !renderState?.simpleFragments?.length) {
          return;
     }

     for (const fragment of renderState.simpleFragments) {
          const entity = dimension.spawnEntity(SIMPLE_FRAGMENT_ENTITY_TYPE, {
               x: minecart.location.x,
               y: minecart.location.y,
               z: minecart.location.z,
          });

          entity.addTag(minecart.id);
          entity.addTag("train_simple_fragment");
          entity.addTag("train_fragment_active");
          entity.setDynamicProperty(
               SIMPLE_FRAGMENT_STACK_PROPERTY,
               fragment.stack
          );
          collectorRideable.addRider(entity);
          fragment.entityId = entity.id;

          system.runTimeout(() => {
               if (!entity.isValid()) {
                    return;
               }

               entity.playAnimation(SIMPLE_FRAGMENT_MOLANG_ANIMATION, {
                    stopExpression: createSimpleFragmentStopExpression(
                         fragment.stack
                    ),
               });
          }, 10);
     }
}
