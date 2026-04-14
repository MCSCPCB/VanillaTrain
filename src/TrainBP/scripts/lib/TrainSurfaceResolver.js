import { world } from "@minecraft/server";
import { loadTrainData } from "./DataStorage.js";
import {
     ensureTrainTransformData,
     quantizeCardinalYaw,
} from "./TrainTransform.js";

export const TRAIN_COLLISION_PROFILE = Object.freeze({
     NONE: "none",
     FULL: "full",
     SLAB_BOTTOM: "slab_bottom",
});

const COLLISION_PROFILE_TOP_OFFSET = Object.freeze({
     [TRAIN_COLLISION_PROFILE.NONE]: null,
     [TRAIN_COLLISION_PROFILE.FULL]: 1.0,
     [TRAIN_COLLISION_PROFILE.SLAB_BOTTOM]: 0.5,
});

const DEFAULT_HORIZONTAL_EPSILON = 1e-4;
const DEFAULT_MAX_DISTANCE_BELOW = 2.5;
const DEFAULT_MAX_DISTANCE_ABOVE = 0.25;

function rotateHorizontalByYaw(x, z, yaw) {
     const radians = (yaw ?? 0) * (Math.PI / 180);

     return {
          x: x * Math.cos(radians) - z * Math.sin(radians),
          z: x * Math.sin(radians) + z * Math.cos(radians),
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

function getLegacyRotationKeys(trainId) {
     return {
          firstMoveFlag: `hasInitialRotation_${trainId}`,
          initialRotationKey: `initialRotation_${trainId}`,
     };
}

function getLegacyRotationState(trainId, fallbackBuildYaw = 0) {
     const keys = getLegacyRotationKeys(trainId);
     const storedInitialRotation = world.getDynamicProperty(
          keys.initialRotationKey
     );

     return {
          hasInitialRotation: Boolean(world.getDynamicProperty(keys.firstMoveFlag)),
          initialRotation: Number.isFinite(storedInitialRotation)
               ? storedInitialRotation
               : quantizeCardinalYaw(fallbackBuildYaw),
     };
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

function createTrainSurfaceRuntimeContext(minecart) {
     const trainData = loadTrainData(minecart.id) || {};
     const rotation = minecart.getRotation();
     const { transform } = ensureTrainTransformData(
          trainData,
          rotation.y
     );
     const buildRailDirection = getBuildRailDirection(
          trainData,
          transform.buildYaw
     );

     return {
          buildRailDirection,
          pitchRadians: ((rotation.x ?? 0) * Math.PI) / 180,
          runtimeYaw: getLegacyRuntimeYaw(
               buildRailDirection,
               rotation.y,
               getLegacyRotationState(minecart.id, transform.buildYaw)
          ),
     };
}

export function getTrainCollisionProfile(entry) {
     if (!entry || entry.isVirtual) {
          return TRAIN_COLLISION_PROFILE.NONE;
     }

     return entry.collisionProfile ?? TRAIN_COLLISION_PROFILE.FULL;
}

export function getTrainCollisionTopOffset(profile) {
     return COLLISION_PROFILE_TOP_OFFSET[profile] ?? null;
}

// 统一计算列车槽位的世界坐标，碰撞、绑定和垂直运动都基于这套结果
export function calculateTrainActualPosition(
     minecart,
     offset,
     runtimeContext = null
) {
     const resolvedRuntimeContext =
          runtimeContext ?? createTrainSurfaceRuntimeContext(minecart);
     const rotatedOffset = rotateHorizontalByYaw(
          offset?.x ?? 0,
          offset?.z ?? 0,
          resolvedRuntimeContext.runtimeYaw
     );
     const centeredHalfOffset = rotateHorizontalByYaw(
          0.5,
          0.5,
          resolvedRuntimeContext.runtimeYaw
     );

     return {
          x: minecart.location.x + rotatedOffset.x + centeredHalfOffset.x,
          y:
               minecart.location.y +
               (offset?.y ?? 0) +
               rotatedOffset.z *
                    Math.sin(resolvedRuntimeContext.pitchRadians),
          z:
               minecart.location.z +
               rotatedOffset.z *
                    Math.cos(resolvedRuntimeContext.pitchRadians) +
               centeredHalfOffset.z,
     };
}

export function createTrainSurfaceResolverCache(
     minecart,
     entries,
     runtimeContext = null
) {
     if (!minecart?.isValid() || !Array.isArray(entries) || !entries.length) {
          return [];
     }

     const resolvedRuntimeContext =
          runtimeContext ?? createTrainSurfaceRuntimeContext(minecart);
     const surfaces = [];

     for (const entry of entries) {
          const profile = getTrainCollisionProfile(entry);
          const topOffset = getTrainCollisionTopOffset(profile);
          if (topOffset === null) {
               continue;
          }

          const surfacePosition = calculateTrainActualPosition(
               minecart,
               entry.offset,
               resolvedRuntimeContext
          );

          surfaces.push({
               entry,
               profile,
               surfacePosition,
               surfaceY: surfacePosition.y + topOffset,
          });
     }

     return surfaces;
}

function isPointWithinSurfaceFootprint(
     location,
     surfacePosition,
     horizontalEpsilon
) {
     return (
          Math.abs(location.x - surfacePosition.x) <= 0.5 + horizontalEpsilon &&
          Math.abs(location.z - surfacePosition.z) <= 0.5 + horizontalEpsilon
     );
}

export function resolveTrainSurfaceAtLocation(
     minecart,
     entries,
     location,
     options = {}
) {
     if (!minecart?.isValid() || !Array.isArray(entries) || !location) {
          return null;
     }

     const horizontalEpsilon =
          options.horizontalEpsilon ?? DEFAULT_HORIZONTAL_EPSILON;
     const maxDistanceBelow =
          options.maxDistanceBelow ?? DEFAULT_MAX_DISTANCE_BELOW;
     const maxDistanceAbove =
          options.maxDistanceAbove ?? DEFAULT_MAX_DISTANCE_ABOVE;
     const surfaceCache = Array.isArray(options.surfaceCache)
          ? options.surfaceCache
          : createTrainSurfaceResolverCache(
                 minecart,
                 entries,
                 options.runtimeContext
            );

     let bestMatch = null;

     for (const surface of surfaceCache) {
          if (
               !isPointWithinSurfaceFootprint(
                    location,
                    surface.surfacePosition,
                    horizontalEpsilon
               )
          ) {
               continue;
          }

          const verticalGap = location.y - surface.surfaceY;
          if (
               verticalGap < -maxDistanceAbove ||
               verticalGap > maxDistanceBelow
          ) {
               continue;
          }

          if (
               !bestMatch ||
               surface.surfaceY > bestMatch.surfaceY ||
               (surface.surfaceY === bestMatch.surfaceY &&
                    verticalGap < bestMatch.verticalGap)
          ) {
               bestMatch = {
                    entry: surface.entry,
                    profile: surface.profile,
                    surfacePosition: surface.surfacePosition,
                    surfaceY: surface.surfaceY,
                    verticalGap,
               };
          }
     }

     return bestMatch;
}

export function hasTrainSupportAtLocation(
     minecart,
     entries,
     location,
     options = {}
) {
     return !!resolveTrainSurfaceAtLocation(minecart, entries, location, options);
}
