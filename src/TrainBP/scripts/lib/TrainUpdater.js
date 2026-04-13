import { BlockPermutation, world, system } from "@minecraft/server";
import {
     deleteTrainData,
     minecartRegistry,
     saveTrainData,
     loadTrainData,
     activePlayerSeats,
} from "./DataStorage";
import {
     getOverworldDimension,
     getRailDirectionAtLocation,
     isCurveRailDirection,
} from "./shared.js";
import {
     FRAGMENT_MOLANG_ANIMATION,
     FRAGMENT_COLLECTOR_TYPE,
     FRAGMENT_ENTITY_TYPE,
     FRAGMENT_STACK_PROPERTY,
     createFragmentStopExpression,
} from "./TrainRenderFragments.js";
import {
     SIMPLE_FRAGMENT_MOLANG_ANIMATION,
     SIMPLE_FRAGMENT_STACK_PROPERTY,
     createSimpleFragmentStopExpression,
} from "./TrainSimpleFragments.js";
import { TRAIN_PLUGIN_ATTACHED_TAG } from "./TrainPluginProtocol.js";
import {
     cleanupTrainPluginRuntime,
     hasKnownTrainPluginSnapshots,
     updateTrainPluginDoorRenderState,
     updateTrainPluginRuntime,
} from "./TrainPluginRuntime.js";
import {
     clearTrainDynamicLights,
     updateTrainDynamicLights,
} from "./TrainDynamicLights.js";
import {
     ensureTrainTransformData,
     getTrainStructureRotationDegrees,
     quantizeCardinalYaw,
} from "./TrainTransform.js";
import {
     createTrainSurfaceResolverCache,
     resolveTrainSurfaceAtLocation,
} from "./TrainSurfaceResolver.js";
import { clearMinecartConsist } from "./TrainConsistManager.js";
import { clearDriveBindingsForMinecart } from "./TrainDriveManager.js";
import { cleanupMinecartPlayerBindings } from "./system-core.js";

const CHECK_INTERVAL = 20;
const INITIAL_INVALIDATION_GRACE_SCANS = 6;
const INVALIDATION_CONFIRM_SCANS = 3;
const MOLANG_UPDATE_INTERVAL = 1;
const LIGHT_UPDATE_INTERVAL = 1;
const LIGHT_UPDATE_DELAY = 1;
const FRAGMENT_STACK_REFRESH_INTERVAL = 20;
const PARTICLE_UPDATE_INTERVAL = 5;
const INTERACT_UPDATE_INTERVAL = 1;
const ENTITY_UPDATE_INTERVAL = 1;
const ENTITY_BLOCK_TYPE = "train:entity_block";
const DEFAULT_MINECART_TYPE = "minecraft:minecart";
const CAMPFIRE_PARTICLE_ID = "minecraft:campfire_smoke_particle";
const BASIC_SMOKE_PARTICLE_ID = "minecraft:basic_smoke_particle";
const BASIC_FLAME_PARTICLE_ID = "minecraft:basic_flame_particle";
const BLUE_FLAME_PARTICLE_ID = "minecraft:blue_flame_particle";
const REDSTONE_TORCH_PARTICLE_ID = "minecraft:redstone_torch_dust_particle";
const END_ROD_PARTICLE_ID = "minecraft:endrod";
const BELL_SOUND_ID = "block.bell.hit";
const LOCAL_PARTICLE_PLAYER_RANGE = 16;
const ENTITY_BIND_RANGE = 16;
const SLOT_RELEASE_DISTANCE = 2.0;
const BOUND_ENTITY_Y_OFFSET = 0.85;
const ENTITY_BIND_SUPPORT_OPTIONS = Object.freeze({
     maxDistanceBelow: 1.5,
     maxDistanceAbove: 0.35,
});
const STRAIGHT_YAW_CONFIRM_TICKS = 2;
const STRAIGHT_YAW_TOLERANCE = 35;
const DOOR_SPECIAL_BLOCK_TYPE = "door";
const DOOR_OPEN_EVENT = "AABB_INTERACT_ONLY";
const DEFAULT_DOOR_OPEN_SOUND_ID = "open.wooden_door";
const DEFAULT_DOOR_CLOSE_SOUND_ID = "close.wooden_door";
const IRON_DOOR_OPEN_SOUND_ID = "open.iron_door";
const IRON_DOOR_CLOSE_SOUND_ID = "close.iron_door";
const COPPER_DOOR_OPEN_SOUND_ID = "open_door.copper";
const COPPER_DOOR_CLOSE_SOUND_ID = "close_door.copper";
const BAMBOO_DOOR_OPEN_SOUND_ID = "open.bamboo_wood_door";
const BAMBOO_DOOR_CLOSE_SOUND_ID = "close.bamboo_wood_door";
const CHERRY_DOOR_OPEN_SOUND_ID = "open.cherry_wood_door";
const CHERRY_DOOR_CLOSE_SOUND_ID = "close.cherry_wood_door";
const NETHER_WOOD_DOOR_OPEN_SOUND_ID = "open.nether_wood_door";
const NETHER_WOOD_DOOR_CLOSE_SOUND_ID = "close.nether_wood_door";
const PARTICLE_SPECIAL_BLOCK_TYPES = new Set([
     "campfire",
     "soul_campfire",
     "torch",
     "copper_torch",
     "soul_torch",
     "redstone_torch",
     "lit_furnace",
     "lit_blast_furnace",
     "lit_smoker",
     "end_rod",
]);
const INTERACT_SPECIAL_BLOCK_TYPES = new Set(["bell", "door"]);

let activeTrainUpdaterInstance = null;

export function getTrainUpdaterInstance() {
     return activeTrainUpdaterInstance;
}

function getCollisionEventName(collisionProfile) {
     if (collisionProfile === "none") {
          return DOOR_OPEN_EVENT;
     }

     return collisionProfile === "slab_bottom" ? "AABB_SLAB_BOTTOM" : "AABB";
}

function getPermutationStates(permutation) {
     try {
          return permutation.getAllStates();
     } catch {
          return {};
     }
}

function isTaggedTrainCleanupEntity(entity) {
     return (
          entity.typeId === ENTITY_BLOCK_TYPE ||
          entity.typeId === FRAGMENT_COLLECTOR_TYPE ||
          entity.typeId === FRAGMENT_ENTITY_TYPE ||
          entity.hasTag(TRAIN_PLUGIN_ATTACHED_TAG)
     );
}

function removeEntitySilently(entity) {
     try {
          if (entity?.isValid()) {
               entity.remove();
          }
     } catch {}
}

function clearRunEntry(store, key) {
     const runId = store.get(key);
     if (runId === undefined) {
          return;
     }

     system.clearRun(runId);
     store.delete(key);
}

function replayRenderStacks(
     fragments,
     animationId,
     stackPropertyName,
     createStopExpression
) {
     if (!fragments?.length) {
          return;
     }

     fragments.forEach((fragment) => {
          if (!fragment?.entityId || !fragment.stack) {
               return;
          }

          const fragmentEntity = world.getEntity(fragment.entityId);
          if (!fragmentEntity?.isValid()) {
               return;
          }

          if (stackPropertyName) {
               fragmentEntity.setDynamicProperty(
                    stackPropertyName,
                    fragment.stack
               );
          }

          fragmentEntity.playAnimation(animationId, {
               stopExpression: createStopExpression(fragment.stack),
          });
     });
}

function getOffsetKey(offset) {
     return `${offset.x}:${offset.y}:${offset.z}`;
}

function isDoorSpecialBlock(specialBlock) {
     return specialBlock?.type === DOOR_SPECIAL_BLOCK_TYPE && specialBlock?.offset;
}

function getDoorSoundId(specialBlock, isOpen) {
     const blockId = specialBlock?.blockId ?? "";

     if (blockId === "minecraft:iron_door") {
          return isOpen ? IRON_DOOR_OPEN_SOUND_ID : IRON_DOOR_CLOSE_SOUND_ID;
     }

     if (blockId.includes("copper_door")) {
          return isOpen
               ? COPPER_DOOR_OPEN_SOUND_ID
               : COPPER_DOOR_CLOSE_SOUND_ID;
     }

     if (blockId === "minecraft:bamboo_door") {
          return isOpen
               ? BAMBOO_DOOR_OPEN_SOUND_ID
               : BAMBOO_DOOR_CLOSE_SOUND_ID;
     }

     if (blockId === "minecraft:cherry_door") {
          return isOpen
               ? CHERRY_DOOR_OPEN_SOUND_ID
               : CHERRY_DOOR_CLOSE_SOUND_ID;
     }

     if (
          blockId === "minecraft:crimson_door" ||
          blockId === "minecraft:warped_door"
     ) {
          return isOpen
               ? NETHER_WOOD_DOOR_OPEN_SOUND_ID
               : NETHER_WOOD_DOOR_CLOSE_SOUND_ID;
     }

     return isOpen ? DEFAULT_DOOR_OPEN_SOUND_ID : DEFAULT_DOOR_CLOSE_SOUND_ID;
}

function setFragmentSlotDataValue(stack, slotIndex, value) {
     if (!stack || !Number.isInteger(slotIndex)) {
          return stack;
     }

     return stack.replace(
          new RegExp(`v\\.b${slotIndex}data=[^;]*;`),
          `v.b${slotIndex}data=${value};`
     );
}

function needsRuntimeEntitySync(currentEntries, runtimeEntries) {
     if (!Array.isArray(currentEntries)) {
          return true;
     }

     if (currentEntries.length !== runtimeEntries.length) {
          return true;
     }

     for (let index = 0; index < runtimeEntries.length; index++) {
          const currentEntry = currentEntries[index];
          const runtimeEntry = runtimeEntries[index];
          const currentOffset = currentEntry?.offset;
          const runtimeOffset = runtimeEntry?.offset;

          if (
               currentEntry?.entityId !== runtimeEntry?.entityId ||
               currentEntry?.railDirection !== runtimeEntry?.railDirection ||
               currentEntry?.isVirtual !== runtimeEntry?.isVirtual ||
               currentEntry?.collisionProfile !== runtimeEntry?.collisionProfile ||
               currentOffset?.x !== runtimeOffset?.x ||
               currentOffset?.y !== runtimeOffset?.y ||
               currentOffset?.z !== runtimeOffset?.z
          ) {
               return true;
          }
     }

     return false;
}

function hasRenderableFragments(trainData) {
     return Boolean(
          trainData?.render?.fragments?.length ||
               trainData?.render?.simpleFragments?.length
     );
}

function hasParticleSpecialBlocks(trainData) {
     return Array.isArray(trainData?.specialBlocks)
          ? trainData.specialBlocks.some((specialBlock) =>
                 PARTICLE_SPECIAL_BLOCK_TYPES.has(specialBlock?.type)
            )
          : false;
}

function hasInteractSpecialBlocks(trainData) {
     return Array.isArray(trainData?.specialBlocks)
          ? trainData.specialBlocks.some((specialBlock) =>
                 INTERACT_SPECIAL_BLOCK_TYPES.has(specialBlock?.type)
            )
          : false;
}

function hasKnownDynamicLightSources(trainData) {
     if (!Array.isArray(trainData?.lightSources)) {
          return null;
     }

     return trainData.lightSources.length > 0;
}

function createStructureLocalPosition(trainData, offset) {
     if (!trainData?.coreOffset || !offset) {
          return null;
     }

     return {
          x: trainData.coreOffset.x + offset.x,
          y: trainData.coreOffset.y + offset.y,
          z: trainData.coreOffset.z + offset.z,
     };
}

function updateDoorStructureState(minecart, trainData, specialBlock, isOpen) {
     if (specialBlock?.runtimeOnly) {
          return;
     }

     const structure = world.structureManager.get(
          `mystructure:structure_${minecart.id}_AABB`
     );
     if (!structure || !isDoorSpecialBlock(specialBlock)) {
          return;
     }

     for (const offset of [specialBlock.offset, specialBlock.upperOffset]) {
          const localPosition = createStructureLocalPosition(trainData, offset);
          if (!localPosition) {
               continue;
          }

          const permutation = structure.getBlockPermutation(localPosition);
          if (!permutation) {
               continue;
          }

          structure.setBlockPermutation(
               localPosition,
               BlockPermutation.resolve(permutation.type.id, {
                    ...getPermutationStates(permutation),
                    open_bit: isOpen,
               })
          );
     }
}

function updateDoorCollisionEntries(minecart, trainData, specialBlock, isOpen) {
     if (!Array.isArray(trainData?.entities) || !isDoorSpecialBlock(specialBlock)) {
          return;
     }

     const targetOffsets = new Set(
          [specialBlock.offset, specialBlock.upperOffset]
               .filter(Boolean)
               .map((offset) => getOffsetKey(offset))
     );

     trainData.entities = trainData.entities.map((entry) => {
          if (!targetOffsets.has(getOffsetKey(entry?.offset))) {
               return entry;
          }

          const nextEntry = {
               ...entry,
               isVirtual: false,
               collisionProfile: isOpen ? "none" : "full",
          };

          const entity = nextEntry.entityId
               ? world.getEntity(nextEntry.entityId)
               : null;
          if (entity?.isValid()) {
               entity.runCommand(
                    `event entity @s ${getCollisionEventName(
                         nextEntry.collisionProfile
                    )}`
               );
          }

          return nextEntry;
     });
}

function updateDoorRenderState(trainData, specialBlock, isOpen) {
     const renderState = trainData?.render;
     const fragment =
          renderState?.fragments?.[specialBlock?.renderFragmentIndex];
     if (!fragment) {
          return;
     }

     fragment.stack = setFragmentSlotDataValue(
          fragment.stack,
          specialBlock.renderSlotIndex,
          isOpen ? 1 : 0
     );

     replayRenderStacks(
          [fragment],
          FRAGMENT_MOLANG_ANIMATION,
          FRAGMENT_STACK_PROPERTY,
          createFragmentStopExpression
     );
}

function findDoorSpecialBlockByEntity(trainData, entityId) {
     const entityEntry = trainData?.entities?.find(
          (entry) => entry?.entityId === entityId
     );
     if (!entityEntry) {
          return null;
     }

     const offsetKey = getOffsetKey(entityEntry.offset);
     return (
          trainData?.specialBlocks?.find(
               (specialBlock) =>
                    isDoorSpecialBlock(specialBlock) &&
                    (getOffsetKey(specialBlock.offset) === offsetKey ||
                         getOffsetKey(specialBlock.upperOffset) === offsetKey)
          ) ?? null
     );
}

function toggleDoorSpecialBlock(minecart, trainData, specialBlock) {
     if (!specialBlock) {
          return null;
     }

     const isOpen = specialBlock.data !== 1;
     specialBlock.data = isOpen ? 1 : 0;
     updateDoorRenderState(trainData, specialBlock, isOpen);
     updateTrainPluginDoorRenderState(
          minecart.id,
          trainData,
          specialBlock,
          isOpen
     );
     updateDoorCollisionEntries(minecart, trainData, specialBlock, isOpen);
     updateDoorStructureState(minecart, trainData, specialBlock, isOpen);
     saveTrainData(minecart.id, trainData);
     return isOpen;
}

function getDistance(left, right) {
     const dx = left.x - right.x;
     const dy = left.y - right.y;
     const dz = left.z - right.z;
     return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getRotationSignature(rotation) {
     return `${rotation?.x ?? 0}:${rotation?.y ?? 0}:${rotation?.z ?? 0}`;
}

function hasNearbyPlayer(players, position, maxDistance) {
     const maxDistanceSquared = maxDistance * maxDistance;

     return players.some((player) => {
          const dx = player.location.x - position.x;
          const dy = player.location.y - position.y;
          const dz = player.location.z - position.z;
          return dx * dx + dy * dy + dz * dz <= maxDistanceSquared;
     });
}

function offsetPosition(position, x = 0, y = 0, z = 0) {
     return {
          x: position.x + x,
          y: position.y + y,
          z: position.z + z,
     };
}

function getCardinalFacingOffset(rotationY = 0) {
     const normalizedRotation = ((rotationY % 4) + 4) % 4;

     if (normalizedRotation === 1) {
          return { x: -1, z: 0 };
     }

     if (normalizedRotation === 2) {
          return { x: 0, z: -1 };
     }

     if (normalizedRotation === 3) {
          return { x: 1, z: 0 };
     }

     return { x: 0, z: 1 };
}

function getTorchParticlePosition(worldPos, specialBlock) {
     if (specialBlock?.data === 1) {
          const facing = getCardinalFacingOffset(specialBlock?.rotation?.ry ?? 0);
          return offsetPosition(worldPos, facing.x * 0.12, 0.38, facing.z * 0.12);
     }

     return offsetPosition(worldPos, 0, 0.58, 0);
}

function getFrontBlockParticlePosition(worldPos, specialBlock) {
     const facing = getCardinalFacingOffset(specialBlock?.rotation?.ry ?? 0);
     return offsetPosition(worldPos, facing.x * 0.32, 0.35, facing.z * 0.32);
}

function getEndRodParticlePosition(worldPos, specialBlock) {
     const rotation = specialBlock?.rotation ?? {};

     if (rotation.rz === 1) {
          return offsetPosition(worldPos, 0.28, 0, 0);
     }

     if (rotation.rz === 3) {
          return offsetPosition(worldPos, -0.28, 0, 0);
     }

     if (rotation.rx === 1) {
          return offsetPosition(worldPos, 0, 0, -0.28);
     }

     if (rotation.rx === 3) {
          return offsetPosition(worldPos, 0, 0, 0.28);
     }

     if (rotation.rx === 2) {
          return offsetPosition(worldPos, 0, -0.28, 0);
     }

     return offsetPosition(worldPos, 0, 0.28, 0);
}

function normalizeAngleDifference(angle) {
     let normalized = (((angle ?? 0) + 180) % 360 + 360) % 360 - 180;
     if (normalized === -180) {
          normalized = 180;
     }
     return normalized;
}

function normalizeRuntimeYaw(yaw) {
     return (((yaw ?? 0) + 180) % 360 + 360) % 360 - 180;
}

function rotateHorizontalByYaw(x, z, yaw) {
     const radians = (yaw ?? 0) * (Math.PI / 180);

     return {
          x: x * Math.cos(radians) - z * Math.sin(radians),
          z: x * Math.sin(radians) + z * Math.cos(radians),
     };
}

function getLegacyRotationKeys(trainId) {
     return {
          firstMoveFlag: `hasInitialRotation_${trainId}`,
          initialRotationKey: `initialRotation_${trainId}`,
          delayedInitialRotationKey: `delayedInitialRotation_${trainId}`,
     };
}

function getLegacyRotationState(trainId, fallbackBuildYaw = 0) {
     const keys = getLegacyRotationKeys(trainId);
     const storedInitialRotation = world.getDynamicProperty(
          keys.initialRotationKey
     );
     const storedDelayedInitialRotation = world.getDynamicProperty(
          keys.delayedInitialRotationKey
     );

     return {
          hasInitialRotation: Boolean(world.getDynamicProperty(keys.firstMoveFlag)),
          initialRotation: Number.isFinite(storedInitialRotation)
               ? storedInitialRotation
               : quantizeCardinalYaw(fallbackBuildYaw),
          delayedInitialRotation: Number.isFinite(storedDelayedInitialRotation)
               ? storedDelayedInitialRotation
               : null,
     };
}

function updateLegacyRotationState(
     minecart,
     lastPosition,
     fallbackBuildYaw = 0,
     previousState = null
) {
     const keys = getLegacyRotationKeys(minecart.id);
     const currentRotationY = minecart.getRotation().y;
     const velocity = minecart.getVelocity();
     let hasInitialRotation = previousState?.hasInitialRotation;
     if (typeof hasInitialRotation !== "boolean") {
          hasInitialRotation = Boolean(
               world.getDynamicProperty(keys.firstMoveFlag)
          );
     }
     let initialRotation = Number.isFinite(previousState?.initialRotation)
          ? previousState.initialRotation
          : world.getDynamicProperty(keys.initialRotationKey);
     let delayedInitialRotation = Number.isFinite(
          previousState?.delayedInitialRotation
     )
          ? previousState.delayedInitialRotation
          : world.getDynamicProperty(keys.delayedInitialRotationKey);

     if (
          !hasInitialRotation &&
          (Math.abs(velocity.x) > 0.0001 || Math.abs(velocity.z) > 0.0001) &&
          Math.abs(currentRotationY) > 0.0001
     ) {
          if (initialRotation !== currentRotationY) {
               world.setDynamicProperty(keys.initialRotationKey, currentRotationY);
          }
          world.setDynamicProperty(keys.firstMoveFlag, true);
          hasInitialRotation = true;
          initialRotation = currentRotationY;
     } else if (!Number.isFinite(initialRotation)) {
          initialRotation = quantizeCardinalYaw(fallbackBuildYaw);
          world.setDynamicProperty(keys.initialRotationKey, initialRotation);
     }

     const deltaX = minecart.location.x - lastPosition.x;
     if (Math.abs(deltaX) > 0.001) {
          const nextDelayedInitialRotation = deltaX > 0 ? -90 : 90;
          if (delayedInitialRotation !== nextDelayedInitialRotation) {
               world.setDynamicProperty(
                    keys.delayedInitialRotationKey,
                    nextDelayedInitialRotation
               );
               delayedInitialRotation = nextDelayedInitialRotation;
          }
     }

     return {
          hasInitialRotation,
          initialRotation: Number.isFinite(initialRotation)
               ? initialRotation
               : quantizeCardinalYaw(fallbackBuildYaw),
          delayedInitialRotation: Number.isFinite(delayedInitialRotation)
               ? delayedInitialRotation
               : null,
     };
}

function getBuildRailDirection(trainData, buildYaw) {
     const entityRailDirection = trainData?.entities?.find(
          (entry) => entry?.railDirection === 0 || entry?.railDirection === 1
     )?.railDirection;

     if (entityRailDirection === 0 || entityRailDirection === 1) {
          return entityRailDirection;
     }

     return Math.abs(quantizeCardinalYaw(buildYaw)) === 90 ? 1 : 0;
}

function getLegacyRuntimeYaw(buildRailDirection, rawYaw, legacyRotationState) {
     if (buildRailDirection === 0 && legacyRotationState?.hasInitialRotation) {
          if (legacyRotationState.initialRotation === 90) {
               return (rawYaw ?? 0) - 90;
          }

          if (legacyRotationState.initialRotation === -90) {
               return (rawYaw ?? 0) + 90;
          }
     }

     return rawYaw ?? 0;
}

function calculateLegacyRuntimeWorldPosition(
     minecart,
     offset,
     buildRailDirection,
     legacyRotationState,
     rotation = minecart.getRotation()
) {
     const runtimeYaw = getLegacyRuntimeYaw(
          buildRailDirection,
          rotation?.y,
          legacyRotationState
     );
     const rotatedOffset = rotateHorizontalByYaw(
          offset?.x ?? 0,
          offset?.z ?? 0,
          runtimeYaw
     );
     const centeredHalfOffset = rotateHorizontalByYaw(0.5, 0.5, runtimeYaw);
     const pitchRadians = ((rotation?.x ?? 0) * Math.PI) / 180;

     return {
          x: minecart.location.x + rotatedOffset.x + centeredHalfOffset.x,
          y:
               minecart.location.y +
               (offset?.y ?? 0) +
               rotatedOffset.z * Math.sin(pitchRadians),
          z:
               minecart.location.z +
               rotatedOffset.z * Math.cos(pitchRadians) +
               centeredHalfOffset.z,
     };
}

function getLegacyRuntimeRotation(
     rotation,
     buildRailDirection,
     legacyRotationState,
     rollDegrees = 0
) {
     return {
          x: rotation?.x ?? 0,
          y: normalizeRuntimeYaw(
               getLegacyRuntimeYaw(
                    buildRailDirection,
                    rotation?.y,
                    legacyRotationState
               )
          ),
          z: rollDegrees,
     };
}

function getStraightCandidateYaw(railDirection, rawYaw) {
     const candidates =
          railDirection === 1 ? [-90, 90] : railDirection === 0 ? [0, 180] : [];

     if (!candidates.length) {
          return null;
     }

     let bestCandidate = candidates[0];
     let bestDistance = Infinity;

     for (const candidate of candidates) {
          const distance = Math.abs(
               normalizeAngleDifference(rawYaw - candidate)
          );
          if (distance < bestDistance) {
               bestDistance = distance;
               bestCandidate = candidate;
          }
     }

     return bestCandidate;
}

function isStraightYawStable(rawYaw, candidateYaw) {
     if (candidateYaw === null) {
          return false;
     }

     return (
          Math.abs(normalizeAngleDifference(rawYaw - candidateYaw)) <=
          STRAIGHT_YAW_TOLERANCE
     );
}

function cloneLocation(location) {
     return {
          x: location.x,
          y: location.y,
          z: location.z,
     };
}

function cloneRotation(rotation = null) {
     return {
          x: rotation?.x ?? 0,
          y: rotation?.y ?? 0,
          z: rotation?.z ?? 0,
     };
}

function normalizeSnapshot(snapshot) {
     if (!snapshot?.location) {
          return null;
     }

     return {
          location: cloneLocation(snapshot.location),
          rotation: cloneRotation(snapshot.rotation),
     };
}

function getStructureRotationName(rotationDegrees) {
     if (rotationDegrees === 90) {
          return "Rotate90";
     }

     if (rotationDegrees === 180) {
          return "Rotate180";
     }

     if (rotationDegrees === 270) {
          return "Rotate270";
     }

     return "None";
}

function calculateStructurePlacePosition(minecartLocation, coreOffset, rotationDegrees) {
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

// 列车运行期间的碰撞、渲染、特效和附着实体同步都在这里处理。
export class TrainUpdater {
     constructor() {
          activeTrainUpdaterInstance = this;
          this.activeUpdaters = new Map();
          this.molangDataReaders = new Map();
          this.particleGenerators = new Map();
          this.interactListeners = new Map();
          this.interactGenerators = new Map();
          this.pendingDoorToggles = new Map();
          this.entityIntervals = new Map();
          this.boundEntities = new Map();
          this.minecartSnapshots = new Map();
          this.missingMinecartScanCounts = new Map();
          this.recoveringMinecartIds = new Set();
          this.invalidationGraceScans = INITIAL_INVALIDATION_GRACE_SCANS;

          // 定期扫描世界里的列车矿车，给新出现或刚加载进来的列车补上更新器。
          this.checkInterval = system.runInterval(() => {
               if (this.invalidationGraceScans > 0) {
                    this.invalidationGraceScans -= 1;
               } else {
                    for (const minecartId of minecartRegistry.getAll()) {
                         const trackedMinecart = world.getEntity(minecartId);
                         if (
                              trackedMinecart?.isValid() &&
                              trackedMinecart.typeId === DEFAULT_MINECART_TYPE
                         ) {
                              this.missingMinecartScanCounts.delete(minecartId);
                              continue;
                         }

                         const missingScanCount =
                              (this.missingMinecartScanCounts.get(minecartId) ??
                                   0) + 1;
                         if (missingScanCount < INVALIDATION_CONFIRM_SCANS) {
                              this.missingMinecartScanCounts.set(
                                   minecartId,
                                   missingScanCount
                              );
                              continue;
                         }

                         this.missingMinecartScanCounts.delete(minecartId);
                         this.handleMinecartInvalidation(minecartId);
                    }
               }

               getOverworldDimension()
                    .getEntities({
                         type: DEFAULT_MINECART_TYPE,
                    })
                    .forEach((minecart) => {
                         const id = minecart.id;

                         this.updateMinecartSnapshot(
                              id,
                              minecart.location,
                              minecart.getRotation()
                         );

                         if (minecartRegistry.has(id)) {
                              this.missingMinecartScanCounts.delete(id);
                         }

                         if (
                              minecartRegistry.has(id) &&
                              !this.activeUpdaters.has(id)
                         ) {
                              this.startUpdater(minecart);
                              this.startMolangDataPlayer(minecart);
                         }
                    });
          }, CHECK_INTERVAL);
     }

     queueDoorToggle(minecartId, offsetKey) {
          const queue = this.pendingDoorToggles.get(minecartId) || [];
          queue.push(offsetKey);
          this.pendingDoorToggles.set(minecartId, queue);
     }

     consumeDoorToggleQueue(minecartId) {
          const queue = this.pendingDoorToggles.get(minecartId) || [];
          this.pendingDoorToggles.delete(minecartId);
          return queue;
     }

     updateMinecartSnapshot(minecartId, location, rotation = null) {
          if (!minecartId || !location) {
               return;
          }

          this.minecartSnapshots.set(minecartId, {
               location: cloneLocation(location),
               rotation: cloneRotation(rotation),
          });
     }

     inferMinecartSnapshot(minecartId, trainData) {
          const knownSnapshot = normalizeSnapshot(
               this.minecartSnapshots.get(minecartId)
          );
          if (knownSnapshot) {
               return knownSnapshot;
          }

          const collectorId = trainData?.render?.collectorId;
          const collector =
               collectorId && world.getEntity(collectorId)?.isValid()
                    ? world.getEntity(collectorId)
                    : getOverworldDimension()
                           .getEntities({ tags: [`${minecartId}`] })
                           .find(
                                (entity) =>
                                     entity.typeId === FRAGMENT_COLLECTOR_TYPE
                           );

          if (collector?.isValid()) {
               const snapshot = {
                    location: cloneLocation(collector.location),
                    rotation: cloneRotation(collector.getRotation()),
               };
               this.minecartSnapshots.set(minecartId, snapshot);
               return snapshot;
          }

          if (!Array.isArray(trainData?.entities)) {
               return null;
          }

          for (const entry of trainData.entities) {
               if (!entry?.entityId || !entry?.offset) {
                    continue;
               }

               const entity = world.getEntity(entry.entityId);
               if (!entity?.isValid()) {
                    continue;
               }

               const rotation = cloneRotation(entity.getRotation());
               const runtimeYaw = rotation.y;
               const rotatedOffset = rotateHorizontalByYaw(
                    entry.offset.x ?? 0,
                    entry.offset.z ?? 0,
                    runtimeYaw
               );
               const centeredHalfOffset = rotateHorizontalByYaw(
                    0.5,
                    0.5,
                    runtimeYaw
               );
               const pitchRadians = (rotation.x * Math.PI) / 180;
               const cosPitch = Math.cos(pitchRadians);
               const snapshot = {
                    location: {
                         x:
                              entity.location.x -
                              rotatedOffset.x -
                              centeredHalfOffset.x,
                         y:
                              entity.location.y -
                              (entry.offset.y ?? 0) -
                              rotatedOffset.z * Math.sin(pitchRadians),
                         z:
                              entity.location.z -
                              rotatedOffset.z * cosPitch -
                              centeredHalfOffset.z,
                    },
                    rotation,
               };

               this.minecartSnapshots.set(minecartId, snapshot);
               return snapshot;
          }

          return null;
     }

     restoreInvalidMinecartToBlocks(minecartId, trainData, snapshot = null) {
          if (!trainData?.coreOffset) {
               return false;
          }

          const resolvedSnapshot =
               snapshot ?? this.inferMinecartSnapshot(minecartId, trainData);
          if (!resolvedSnapshot?.location) {
               return false;
          }

          const structureAABBId = `mystructure:structure_${minecartId}_AABB`;
          const { transform } = ensureTrainTransformData(
               trainData,
               resolvedSnapshot.rotation?.y ?? 0
          );
          const rotationDegrees = getTrainStructureRotationDegrees({
               ...transform,
               logicalYaw: quantizeCardinalYaw(resolvedSnapshot.rotation?.y ?? 0),
          });
          const placePosition = calculateStructurePlacePosition(
               resolvedSnapshot.location,
               trainData.coreOffset,
               rotationDegrees
          );

          try {
               world.structureManager.place(
                    structureAABBId,
                    getOverworldDimension(),
                    placePosition,
                    {
                         rotation: getStructureRotationName(rotationDegrees),
                    }
               );
               return true;
          } catch (error) {
               console.warn(`异常恢复列车 ${minecartId} 失败: ${error}`);
               return false;
          }
     }

     cleanupTaggedTrainEntities(minecartId) {
          for (const entity of getOverworldDimension().getEntities({
               tags: [`${minecartId}`],
          })) {
               if (isTaggedTrainCleanupEntity(entity)) {
                    removeEntitySilently(entity);
               }
          }
     }

     cleanupOrphanTempSeats(trainData, snapshot = null) {
          const resolvedSnapshot = snapshot;
          if (!resolvedSnapshot?.location) {
               return;
          }

          const maxDistance = Math.max(trainData?.radii?.primary ?? 0, 2) + 2;
          for (const seat of getOverworldDimension().getEntities({
               type: "train:temp_seat",
               location: resolvedSnapshot.location,
               maxDistance,
          })) {
               try {
                    const riders =
                         seat.getComponent("minecraft:rideable")?.getRiders() ??
                         [];
                    if (riders.length) {
                         continue;
                    }

                    activePlayerSeats.delete(seat.id);
                    removeEntitySilently(seat);
               } catch {}
          }
     }

     handleMinecartInvalidation(minecartId) {
          if (
               !minecartId ||
               this.recoveringMinecartIds.has(minecartId) ||
               !minecartRegistry.has(minecartId)
          ) {
               return;
          }

          this.recoveringMinecartIds.add(minecartId);

          try {
               const trainData = loadTrainData(minecartId);
               const snapshot =
                    trainData && this.inferMinecartSnapshot(minecartId, trainData);

               this.stopUpdaterById(minecartId);
               if (!trainData) {
                    cleanupMinecartPlayerBindings(minecartId);
                    clearTrainDynamicLights(minecartId);
                    this.cleanupTaggedTrainEntities(minecartId);
                    clearMinecartConsist(minecartId, { deleteSelf: true });
                    clearDriveBindingsForMinecart(minecartId);
                    minecartRegistry.remove(minecartId);
                    deleteTrainData(minecartId);
                    this.minecartSnapshots.delete(minecartId);
                    this.missingMinecartScanCounts.delete(minecartId);
                    return;
               }

               if (
                    !this.restoreInvalidMinecartToBlocks(
                         minecartId,
                         trainData,
                         snapshot
                    )
               ) {
                    return;
               }

               cleanupMinecartPlayerBindings(minecartId);
               this.cleanupOrphanTempSeats(trainData, snapshot);
               clearTrainDynamicLights(minecartId);
               this.cleanupTaggedTrainEntities(minecartId);
               clearMinecartConsist(minecartId, { deleteSelf: true });
               clearDriveBindingsForMinecart(minecartId);
               minecartRegistry.remove(minecartId);
               deleteTrainData(minecartId);
               this.minecartSnapshots.delete(minecartId);
               this.missingMinecartScanCounts.delete(minecartId);

               try {
                    world.structureManager.delete(
                         `mystructure:structure_${minecartId}_AABB`
                    );
               } catch {}
          } finally {
               this.recoveringMinecartIds.delete(minecartId);
          }
     }

     startMolangDataPlayer(minecart) {
          if (!hasRenderableFragments(loadTrainData(minecart.id))) {
               return;
          }

          // 定期重播 fragment 动画栈，减少客户端丢失动态状态后的空渲染。
          const intervalId = system.runInterval(() => {
               if (!minecart.isValid()) {
                    this.stopMolangDataPlayer(minecart);
                    return;
               }

               const trainData = loadTrainData(minecart.id);
               if (!trainData) return;

               try {
                    const renderState = trainData.render;
                    if (
                         renderState?.fragments?.length ||
                         renderState?.simpleFragments?.length
                    ) {
                         replayRenderStacks(
                              renderState.fragments,
                              FRAGMENT_MOLANG_ANIMATION,
                              FRAGMENT_STACK_PROPERTY,
                              createFragmentStopExpression
                         );
                         replayRenderStacks(
                              renderState.simpleFragments,
                              SIMPLE_FRAGMENT_MOLANG_ANIMATION,
                              SIMPLE_FRAGMENT_STACK_PROPERTY,
                              createSimpleFragmentStopExpression
                         );
                    }
               } catch (e) {
                    console.error("解析 trainEntitiesData 失败:", e);
               }
          }, FRAGMENT_STACK_REFRESH_INTERVAL);

          this.molangDataReaders.set(minecart.id, intervalId);
     }

     stopMolangDataPlayer(minecart) {
          clearRunEntry(this.molangDataReaders, minecart.id);
     }

     startParticleGenerator(minecart, calculateActualPosition) {
          if (!hasParticleSpecialBlocks(loadTrainData(minecart.id))) {
               return;
          }

          // 一些方块不会只靠模型表达，这里补运行时粒子效果。
          const generatorId = system.runInterval(() => {
               if (!minecart.isValid()) {
                    this.stopParticleGenerator(minecart);
                    return;
               }

               const trainData = loadTrainData(minecart.id);
               if (!trainData?.specialBlocks) return;

               const players = world.getPlayers();

               trainData.specialBlocks.forEach((specialBlock) => {
                    const blockPos = calculateActualPosition(
                         minecart,
                         specialBlock.offset
                    );

                    if (
                         specialBlock.type === "campfire" ||
                         specialBlock.type === "soul_campfire"
                    ) {
                         getOverworldDimension().spawnParticle(
                              CAMPFIRE_PARTICLE_ID,
                              offsetPosition(blockPos, 0, 0.3, 0)
                         );

                         if (specialBlock.type === "soul_campfire") {
                              if (
                                   hasNearbyPlayer(
                                        players,
                                        blockPos,
                                        LOCAL_PARTICLE_PLAYER_RANGE
                                   )
                              ) {
                                   getOverworldDimension().spawnParticle(
                                        BLUE_FLAME_PARTICLE_ID,
                                        offsetPosition(blockPos, 0, 0.38, 0)
                                   );
                              }
                         }

                         return;
                    }

                    if (
                         !hasNearbyPlayer(
                              players,
                              blockPos,
                              LOCAL_PARTICLE_PLAYER_RANGE
                         )
                    ) {
                         return;
                    }

                    if (
                         specialBlock.type === "torch" ||
                         specialBlock.type === "copper_torch" ||
                         specialBlock.type === "soul_torch"
                    ) {
                         const torchPos = getTorchParticlePosition(
                              blockPos,
                              specialBlock
                         );

                         getOverworldDimension().spawnParticle(
                              BASIC_SMOKE_PARTICLE_ID,
                              offsetPosition(torchPos, 0, 0.02, 0)
                         );
                         getOverworldDimension().spawnParticle(
                              specialBlock.type === "soul_torch"
                                   ? BLUE_FLAME_PARTICLE_ID
                                   : BASIC_FLAME_PARTICLE_ID,
                              torchPos
                         );
                         return;
                    }

                    if (specialBlock.type === "redstone_torch") {
                         getOverworldDimension().spawnParticle(
                              REDSTONE_TORCH_PARTICLE_ID,
                              getTorchParticlePosition(blockPos, specialBlock)
                         );
                         return;
                    }

                    if (
                         specialBlock.type === "lit_furnace" ||
                         specialBlock.type === "lit_blast_furnace" ||
                         specialBlock.type === "lit_smoker"
                    ) {
                         const frontPos = getFrontBlockParticlePosition(
                              blockPos,
                              specialBlock
                         );

                         getOverworldDimension().spawnParticle(
                              BASIC_SMOKE_PARTICLE_ID,
                              offsetPosition(frontPos, 0, 0.08, 0)
                         );

                         if (specialBlock.type !== "lit_smoker") {
                              getOverworldDimension().spawnParticle(
                                   BASIC_FLAME_PARTICLE_ID,
                                   frontPos
                              );
                         }

                         return;
                    }

                    if (specialBlock.type === "end_rod") {
                         getOverworldDimension().spawnParticle(
                              END_ROD_PARTICLE_ID,
                              getEndRodParticlePosition(blockPos, specialBlock)
                         );
                    }
               });
          }, PARTICLE_UPDATE_INTERVAL);

          this.particleGenerators.set(minecart.id, generatorId);
     }

     stopParticleGenerator(minecart) {
          clearRunEntry(this.particleGenerators, minecart.id);
     }

     startInteract(minecart, calculateActualPosition) {
          if (this.interactListeners.has(minecart.id)) return;
          if (!hasInteractSpecialBlocks(loadTrainData(minecart.id))) {
               return;
          }

          // 特殊方块的交互由碰撞实体代接，这里处理铃铛与门的点击。
          const listenerId =
               world.beforeEvents.playerInteractWithEntity.subscribe((data) => {
                    const entity = data.target;

                    if (
                         entity.typeId !== ENTITY_BLOCK_TYPE ||
                         !entity.hasTag(minecart.id)
                    ) {
                         return;
                    }

                    if (entity.hasTag("bell")) {
                         data.cancel = true;

                         const dimension = entity.dimension;
                         const loc = entity.location;
                         system.runTimeout(() => {
                              dimension.playSound(BELL_SOUND_ID, loc, {
                                   volume: 1,
                                   pitch: 1,
                              });
                         }, 0);
                         return;
                    }

                    const trainData = loadTrainData(minecart.id);
                    const clickedDoor = findDoorSpecialBlockByEntity(
                         trainData,
                         entity.id
                    );
                    if (!clickedDoor) {
                         return;
                    }

                    data.cancel = true;
                    this.queueDoorToggle(
                         minecart.id,
                         getOffsetKey(clickedDoor.offset)
                    );
               });

          this.interactListeners.set(minecart.id, { id: listenerId });

          // 持续给对应的实体块打上特殊标签，供交互监听识别。
          const generatorId = system.runInterval(() => {
               if (!minecart.isValid()) {
                    this.stopInteract(minecart);
                    return;
               }

               const trainData = loadTrainData(minecart.id);
               if (!trainData?.specialBlocks) return;

               trainData.specialBlocks.forEach((specialBlock) => {
                    if (specialBlock.type === "bell") {
                         const worldPos = calculateActualPosition(
                              minecart,
                              specialBlock.offset
                         );

                         const entities = getOverworldDimension().getEntities({
                                   type: ENTITY_BLOCK_TYPE,
                                   location: worldPos,
                                   maxDistance: 1,
                              });

                         entities.forEach((entity) => {
                              if (!entity.hasTag("bell")) {
                                   entity.addTag("bell");
                              }
                         });
                    }
               });
          }, INTERACT_UPDATE_INTERVAL);

          this.interactGenerators.set(minecart.id, generatorId);
     }

     stopInteract(minecart) {
          const listenerData = this.interactListeners.get(minecart.id);
          if (listenerData) {
               world.beforeEvents.playerInteractWithEntity.unsubscribe(
                    listenerData.id
               );
               this.interactListeners.delete(minecart.id);
          }

          clearRunEntry(this.interactGenerators, minecart.id);
     }

     startUpdater(minecart) {
          const PLAYER_RANGE = 2;
          const Y_RANGE = 4;
          const overworld = getOverworldDimension();
          let isCurveSequenceActive = false;
          let pendingStraightYaw = null;
          let straightYawConfirmTicks = 0;
          this.updateMinecartSnapshot(
               minecart.id,
               minecart.location,
               minecart.getRotation()
          );
          let currentTrainData = loadTrainData(minecart.id) || {};
          let {
               transform: currentStoredTransform,
               wasChanged: didInitTransform,
          } =
               ensureTrainTransformData(
                    currentTrainData,
                    minecart.getRotation().y
               );
          let currentBuildRailDirection = getBuildRailDirection(
               currentTrainData,
               currentStoredTransform.buildYaw
          );
          let currentLegacyRotationState = getLegacyRotationState(
               minecart.id,
               currentStoredTransform.buildYaw
          );

          if (didInitTransform) {
               saveTrainData(minecart.id, currentTrainData);
          }

          let currentPositionCache = new Map();
          let lastFragmentRotationSignature = "";
          let lastRenderState = null;
          let cachedFragmentEntityIds = [];

          const clearCurrentPositionCache = () => {
               currentPositionCache.clear();
          };

          const getFragmentEntityIds = (renderState) => {
               if (renderState !== lastRenderState) {
                    lastRenderState = renderState;
                    cachedFragmentEntityIds = renderState
                         ? [
                                renderState.collectorId,
                                ...(renderState.fragments || []).map(
                                     ({ entityId }) => entityId
                                ),
                                ...(renderState.simpleFragments || []).map(
                                     ({ entityId }) => entityId
                                ),
                           ].filter(Boolean)
                         : [];
               }

               return cachedFragmentEntityIds;
          };

          const getCurrentMinecartActualPosition = (offset) => {
               const key = getOffsetKey(offset);
               const cachedPosition = currentPositionCache.get(key);
               if (cachedPosition) {
                    return cachedPosition;
               }

               const actualPosition = calculateLegacyRuntimeWorldPosition(
                    minecart,
                    offset,
                    currentBuildRailDirection,
                    currentLegacyRotationState
               );
               currentPositionCache.set(key, actualPosition);
               return actualPosition;
          };

          const getNearbyPlayerLocations = (players, trainData) => {
               const horizontalRange =
                    Math.max(
                         trainData?.radii?.primary ?? 0,
                         trainData?.radii?.secondary ?? 0
                    ) + PLAYER_RANGE;
               const verticalRange =
                    (trainData?.radii?.secondaryY ?? 0) + Y_RANGE;

               return players
                    .filter((player) => {
                         const playerPosition = player.location;
                         return (
                              Math.abs(playerPosition.x - minecart.location.x) <=
                                   horizontalRange &&
                              Math.abs(playerPosition.z - minecart.location.z) <=
                                   horizontalRange &&
                              Math.abs(playerPosition.y - minecart.location.y) <=
                                   verticalRange
                         );
                    })
                    .map((player) => player.location);
          };

          // 统一列车相关实体的位置计算，避免碰撞层和渲染层错位。
          const calculateActualPosition = (minecartEntity, offset) => {
               if (minecartEntity.id === minecart.id) {
                    return getCurrentMinecartActualPosition(offset);
               }

               const runtimeTrainData = loadTrainData(minecartEntity.id) || {};
               const { transform } = ensureTrainTransformData(
                    runtimeTrainData,
                    minecartEntity.getRotation().y
               );

               return calculateLegacyRuntimeWorldPosition(
                    minecartEntity,
                    offset,
                    getBuildRailDirection(runtimeTrainData, transform.buildYaw),
                    getLegacyRotationState(
                         minecartEntity.id,
                         transform.buildYaw
                    )
               );
          };

          // 按玩家距离按需生成或回收碰撞实体，避免整列车的实体块始终常驻。
          const loadTrainEntities = (trainData) => {
               if (!trainData || !Array.isArray(trainData.entities)) {
                    return [];
               }

               const players = world.getPlayers();
               const activeSeatBlocks = new Set(activePlayerSeats.values());
               const nearbyPlayerLocations = getNearbyPlayerLocations(
                    players,
                    trainData
               );

               if (!nearbyPlayerLocations.length) {
                    return trainData.entities.map((entry) => {
                         if (entry.isVirtual || !entry.entityId) {
                              return entry;
                         }

                         if (activeSeatBlocks.has(entry.entityId)) {
                              return entry;
                         }

                         removeEntitySilently(world.getEntity(entry.entityId));

                         return {
                              ...entry,
                              entityId: null,
                         };
                    });
               }

               return trainData.entities.map((entry) => {
                    const actualPos = getCurrentMinecartActualPosition(
                         entry.offset
                    );

                    const inRange = nearbyPlayerLocations.some((playerPos) => {
                         return (
                              Math.abs(actualPos.x - playerPos.x) <=
                                   PLAYER_RANGE &&
                              Math.abs(actualPos.z - playerPos.z) <=
                                   PLAYER_RANGE &&
                              Math.abs(actualPos.y - playerPos.y) <= Y_RANGE
                         );
                    });

                    if (!inRange && entry.entityId) {
                         if (entry.isVirtual) {
                              return entry;
                         }

                         // 正在给隐藏座位当附着点的实体块不能提前回收。
                         if (activeSeatBlocks.has(entry.entityId)) {
                              return entry;
                         }
                         removeEntitySilently(world.getEntity(entry.entityId));
                         return {
                              ...entry,
                              entityId: null,
                         };
                    }

                    if (inRange && !entry.entityId) {
                         if (entry.isVirtual) {
                              return entry;
                         }
                         const entity = overworld.spawnEntity(
                              ENTITY_BLOCK_TYPE,
                              actualPos
                         );

                         entity.runCommand(
                              `event entity @s ${getCollisionEventName(
                                   entry.collisionProfile
                              )}`
                         );
                         entity.addTag(`${minecart.id}`);

                         return {
                              ...entry,
                              entityId: entity.id,
                         };
                    }

                    return entry;
               });
          };

          let blockEntities = loadTrainEntities(currentTrainData);
          let lastPosition = { ...minecart.location };
          let lightUpdateCooldown = 0;
          let lightUpdatePending = false;
          let lightUpdateScheduled = false;
          let dynamicLightsSuppressed = false;
          let pluginRuntimeSuppressed = false;

          const refreshDynamicLights = () => {
               if (lightUpdateScheduled) {
                    return;
               }

               lightUpdateScheduled = true;
               lightUpdateCooldown = Math.max(0, LIGHT_UPDATE_INTERVAL - 1);
               system.runTimeout(() => {
                    lightUpdateScheduled = false;

                    if (!minecart.isValid()) {
                         return;
                    }

                    const latestTrainData = loadTrainData(minecart.id);
                    if (hasKnownDynamicLightSources(latestTrainData) === false) {
                         clearTrainDynamicLights(minecart.id);
                         dynamicLightsSuppressed = true;
                         lightUpdatePending = false;
                         lightUpdateCooldown = 0;
                         return;
                    }

                    clearCurrentPositionCache();
                    updateTrainDynamicLights(
                         minecart,
                         calculateActualPosition
                    );
                    lightUpdatePending = false;
               }, LIGHT_UPDATE_DELAY);
          };

          if (hasKnownDynamicLightSources(currentTrainData) === false) {
               clearTrainDynamicLights(minecart.id);
               dynamicLightsSuppressed = true;
          } else {
               refreshDynamicLights();
          }

          const intervalId = system.runInterval(() => {
               if (!minecart.isValid()) {
                    this.handleMinecartInvalidation(minecart.id);
                    return;
               }

               const currentLoc = minecart.location;
               const currentRot = minecart.getRotation();
               clearCurrentPositionCache();
               this.updateMinecartSnapshot(minecart.id, currentLoc, currentRot);
               currentTrainData = loadTrainData(minecart.id) || {};
               const pendingDoorToggleKeys =
                    this.consumeDoorToggleQueue(minecart.id);
               if (pendingDoorToggleKeys.length) {
                    pendingDoorToggleKeys.forEach((offsetKey) => {
                         const door =
                              currentTrainData?.specialBlocks?.find(
                                   (specialBlock) =>
                                        isDoorSpecialBlock(specialBlock) &&
                                        getOffsetKey(specialBlock.offset) ===
                                             offsetKey
                              ) ?? null;
                         if (door) {
                              const isOpen = toggleDoorSpecialBlock(
                                   minecart,
                                   currentTrainData,
                                   door
                              );
                              if (isOpen !== null) {
                                   minecart.dimension.playSound(
                                        getDoorSoundId(door, isOpen),
                                        calculateActualPosition(
                                             minecart,
                                             door.offset
                                        ),
                                        {
                                             volume: 1,
                                             pitch: 1,
                                        }
                                   );
                              }
                         }
                    });
               }
               const ensuredTransform = ensureTrainTransformData(
                    currentTrainData,
                    currentRot.y
               );
               currentStoredTransform = ensuredTransform.transform;
               currentBuildRailDirection = getBuildRailDirection(
                    currentTrainData,
                    currentStoredTransform.buildYaw
               );
               currentLegacyRotationState = updateLegacyRotationState(
                    minecart,
                    lastPosition,
                    currentStoredTransform.buildYaw,
                    currentLegacyRotationState
               );

               let currentRailDirection = null;
               try {
                    currentRailDirection = getRailDirectionAtLocation(
                         minecart.location,
                         minecart.dimension
                    );
               } catch {}

               if (isCurveRailDirection(currentRailDirection)) {
                    isCurveSequenceActive = true;
                    pendingStraightYaw = null;
                    straightYawConfirmTicks = 0;
               } else if (isCurveSequenceActive) {
                    const candidateYaw = getStraightCandidateYaw(
                         currentRailDirection,
                         currentRot.y
                    );

                    if (isStraightYawStable(currentRot.y, candidateYaw)) {
                         if (pendingStraightYaw === candidateYaw) {
                              straightYawConfirmTicks += 1;
                         } else {
                              pendingStraightYaw = candidateYaw;
                              straightYawConfirmTicks = 1;
                         }
                    } else {
                         pendingStraightYaw = null;
                         straightYawConfirmTicks = 0;
                    }

                    if (
                         pendingStraightYaw !== null &&
                         straightYawConfirmTicks >=
                              STRAIGHT_YAW_CONFIRM_TICKS
                    ) {
                         currentStoredTransform.logicalYaw =
                              pendingStraightYaw;
                         pendingStraightYaw = null;
                         straightYawConfirmTicks = 0;
                         isCurveSequenceActive = false;
                    }
               }

               clearCurrentPositionCache();
               const currentBlockEntities = loadTrainEntities(currentTrainData);
               const blockEntityByOffset = new Map(
                    blockEntities.map((entry) => [
                         getOffsetKey(entry.offset),
                         entry,
                    ])
               );
               blockEntities = currentBlockEntities.map((newEntry) => {
                    const oldEntry = blockEntityByOffset.get(
                         getOffsetKey(newEntry.offset)
                    );

                    if (oldEntry?.entityId) {
                         const oldEntity = world.getEntity(oldEntry.entityId);
                         if (oldEntity?.isValid()) {
                              return {
                                   ...newEntry,
                                   entityId: oldEntry.entityId,
                              };
                         }
                    }

                    return newEntry;
               });

               if (
                    needsRuntimeEntitySync(
                         currentTrainData.entities,
                         blockEntities
                    )
               ) {
                    // 运行期直接更新缓存中的列车数据，避免每刻把整包实体状态重写回动态属性。
                    currentTrainData.entities = blockEntities.map(
                         ({
                              entityId,
                              offset,
                              railDirection,
                              isVirtual,
                              collisionProfile,
                         }) => ({
                              entityId,
                              offset,
                              railDirection,
                              isVirtual,
                              collisionProfile,
                         })
                    );
               }

               const currentOffsets = new Set(
                    currentBlockEntities.map((entry) =>
                         getOffsetKey(entry.offset)
                    )
               );
               blockEntities = blockEntities.filter((entry) =>
                    currentOffsets.has(getOffsetKey(entry.offset))
               );

               const hasPositionChanged =
                    currentLoc.x !== lastPosition.x ||
                    currentLoc.y !== lastPosition.y ||
                    currentLoc.z !== lastPosition.z;

               const fragmentRotation = getLegacyRuntimeRotation(
                    currentRot,
                    currentBuildRailDirection,
                    currentLegacyRotationState
               );
               const fragmentRotationSignature =
                    getRotationSignature(fragmentRotation);
               const renderState = currentTrainData.render;
               const knownPluginSnapshotState =
                    hasKnownTrainPluginSnapshots(currentTrainData);
               if (knownPluginSnapshotState === false) {
                    if (!pluginRuntimeSuppressed) {
                         cleanupTrainPluginRuntime(minecart.id);
                         pluginRuntimeSuppressed = true;
                    }
               } else {
                    pluginRuntimeSuppressed = false;
                    updateTrainPluginRuntime(
                         minecart,
                         currentTrainData,
                         fragmentRotation
                    );
               }

               const knownDynamicLightState =
                    hasKnownDynamicLightSources(currentTrainData);
               if (knownDynamicLightState === false) {
                    if (!dynamicLightsSuppressed) {
                         clearTrainDynamicLights(minecart.id);
                         dynamicLightsSuppressed = true;
                    }
                    lightUpdatePending = false;
                    lightUpdateCooldown = 0;
               } else {
                    if (dynamicLightsSuppressed) {
                         dynamicLightsSuppressed = false;
                         refreshDynamicLights();
                    }

                    if (hasPositionChanged) {
                         lightUpdatePending = true;
                    }
               }

               // 仅在位置变化后同步碰撞实体和渲染朝向。
               if (
                    currentLoc.x === lastPosition.x &&
                    currentLoc.y === lastPosition.y &&
                    currentLoc.z === lastPosition.z
               ) {
                    lastFragmentRotationSignature = fragmentRotationSignature;
                    return;
               }

               const stableRotation = getLegacyRuntimeRotation(
                    currentRot,
                    currentBuildRailDirection,
                    currentLegacyRotationState,
                    0
               );

               blockEntities.forEach(
                    ({
                         entityId,
                         offset,
                         isVirtual,
                    }) => {
                         if (isVirtual) return;
                         if (entityId === null) return;
                         const entity = world.getEntity(entityId);
                         if (!entity?.isValid()) return;

                         const actualPos = calculateActualPosition(
                              minecart,
                              offset
                         );

                         entity.teleport(
                              actualPos,
                              {
                                   dimension: overworld,
                                   checkForBlocks: false,
                                   rotation: stableRotation,
                              }
                         );
                    }
               );

               if (
                    renderState &&
                    fragmentRotationSignature !== lastFragmentRotationSignature
               ) {
                    getFragmentEntityIds(renderState).forEach((entityId) => {
                         const entity = world.getEntity(entityId);
                         if (entity?.isValid()) {
                              entity.setRotation(fragmentRotation);
                         }
                    });
               }

               lastFragmentRotationSignature = fragmentRotationSignature;

               if (lightUpdatePending) {
                    if (lightUpdateCooldown <= 0) {
                         refreshDynamicLights();
                    } else {
                         lightUpdateCooldown -= 1;
                    }
               } else if (lightUpdateCooldown > 0) {
                    lightUpdateCooldown -= 1;
               }

               lastPosition = { ...currentLoc };
          }, MOLANG_UPDATE_INTERVAL);

          this.activeUpdaters.set(minecart.id, intervalId);

          this.startParticleGenerator(minecart, calculateActualPosition);
          this.startInteract(minecart, calculateActualPosition);

          // 让靠近列车内部的普通实体跟着车体走，避免被车体甩下。
          const entityInterval = system.runInterval(() => {
               if (!minecart.isValid()) return;

               const trainData = loadTrainData(minecart.id);
               if (!trainData || !trainData.entities) return;
               const { transform } = ensureTrainTransformData(
                    trainData,
                    minecart.getRotation().y
               );
               currentBuildRailDirection = getBuildRailDirection(
                    trainData,
                    transform.buildYaw
               );
               clearCurrentPositionCache();

               const allEntities = overworld.getEntities({
                    location: minecart.location,
                    maxDistance: ENTITY_BIND_RANGE,
               });
               const surfaceCache = createTrainSurfaceResolverCache(
                    minecart,
                    trainData.entities
               );

               const entities = allEntities.filter((entity) => {
                    const typeId = entity.typeId;
                    return (
                         typeId !== "minecraft:player" &&
                         typeId !== DEFAULT_MINECART_TYPE &&
                         !typeId.startsWith("train:") &&
                         !entity.hasTag(TRAIN_PLUGIN_ATTACHED_TAG)
                    );
               });

               for (const entity of entities) {
                    if (this.boundEntities.has(entity.id)) continue;

                    const surfaceMatch = resolveTrainSurfaceAtLocation(
                         minecart,
                         trainData.entities,
                         entity.location,
                         {
                              ...ENTITY_BIND_SUPPORT_OPTIONS,
                              surfaceCache,
                         }
                    );

                    if (surfaceMatch?.entry?.offset) {
                         // 记录实体绑定到哪一个车体槽位，供偏移同步逻辑直接读取。
                         this.boundEntities.set(entity.id, {
                              minecartId: minecart.id,
                              offset: surfaceMatch.entry.offset,
                              railDirection: surfaceMatch.entry.railDirection,
                         });
                    }
               }

               for (const [entityId, data] of this.boundEntities) {
                    if (data.minecartId !== minecart.id) {
                         continue;
                    }

                    const entity = world.getEntity(entityId);
                    if (!entity || !entity.isValid()) {
                         this.boundEntities.delete(entityId);
                         continue;
                    }

                    const calcPos = calculateActualPosition(
                         minecart,
                         data.offset
                    );
                    const targetPos = {
                         x: calcPos.x,
                         y: calcPos.y + BOUND_ENTITY_Y_OFFSET,
                         z: calcPos.z,
                    };

                    entity.teleport(targetPos, {
                         dimension: overworld,
                         keepVelocity: false,
                              rotation: entity.getRotation(),
                         });
               }

               // 实体离车体太远后解除绑定，恢复普通移动。
               for (const [entityId, data] of this.boundEntities) {
                    if (data.minecartId !== minecart.id) {
                         continue;
                    }

                    const entity = world.getEntity(entityId);
                    if (!entity || !entity.isValid()) {
                         this.boundEntities.delete(entityId);
                         continue;
                    }

                    const slotPos = calculateActualPosition(
                         minecart,
                         data.offset
                    );

                    const distance = getDistance(entity.location, slotPos);

                    if (distance > SLOT_RELEASE_DISTANCE) {
                         this.boundEntities.delete(entityId);
                    }
               }
          }, ENTITY_UPDATE_INTERVAL);

          this.entityIntervals.set(minecart.id, entityInterval);
     }

     stopUpdaterById(minecartId) {
          cleanupTrainPluginRuntime(minecartId);

          if (!this.activeUpdaters.has(minecartId)) {
               this.pendingDoorToggles.delete(minecartId);
               return;
          }

          // 列车失效后把它挂的所有定时器和缓存一起清掉。
          clearRunEntry(this.activeUpdaters, minecartId);
          this.stopMolangDataPlayer({ id: minecartId });
          this.stopParticleGenerator({ id: minecartId });
          this.stopInteract({ id: minecartId });
          clearRunEntry(this.entityIntervals, minecartId);

          for (const [entityId, data] of this.boundEntities) {
               if (data.minecartId === minecartId) {
                    this.boundEntities.delete(entityId);
               }
          }

          this.pendingDoorToggles.delete(minecartId);
     }

}
