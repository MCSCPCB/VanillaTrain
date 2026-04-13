import { world } from "@minecraft/server";

import {
     deleteTrainConsistData,
     loadTrainConsistData,
     loadTrainData,
     minecartRegistry,
     saveTrainConsistData,
} from "./DataStorage";

const DEFAULT_MINECART_TYPE = "minecraft:minecart";
const MIN_HALF_LENGTH = 0.5;
const MINECART_ENTITY_MIN_CENTER_GAP = 1.12;

function getValidMinecartEntity(minecartId) {
     const minecart = world.getEntity(minecartId);

     if (
          !minecart?.isValid() ||
          minecart.typeId !== DEFAULT_MINECART_TYPE ||
          !minecartRegistry.has(minecartId)
     ) {
          return null;
     }

     return minecart;
}

function getHorizontalDelta(from, to) {
     return {
          x: to.x - from.x,
          z: to.z - from.z,
     };
}

function getHorizontalLength(vector) {
     return Math.hypot(vector.x, vector.z);
}

function normalizeHorizontalVector(vector) {
     const length = getHorizontalLength(vector);
     if (length <= 0.01) {
          return null;
     }

     return {
          x: vector.x / length,
          z: vector.z / length,
     };
}

function negateHorizontal(vector) {
     return {
          x: -vector.x,
          z: -vector.z,
     };
}

function getPairDirection(frontMinecart, rearMinecart) {
     return (
          normalizeHorizontalVector(
               getHorizontalDelta(rearMinecart.location, frontMinecart.location),
          ) ?? { x: 1, z: 0 }
     );
}

function getMinecartHalfLength(minecartId) {
     const primaryRadius = loadTrainData(minecartId)?.radii?.primary;

     if (Number.isFinite(primaryRadius) && primaryRadius > 0) {
          return primaryRadius;
     }

     return MIN_HALF_LENGTH;
}

function getMinecartHardBounds(minecartId) {
     const hardBounds = loadTrainData(minecartId)?.hardBounds;

     if (
          Number.isFinite(hardBounds?.posX) &&
          Number.isFinite(hardBounds?.negX) &&
          Number.isFinite(hardBounds?.posZ) &&
          Number.isFinite(hardBounds?.negZ)
     ) {
          return hardBounds;
     }

     const fallbackRadius = getMinecartHalfLength(minecartId);
     return {
          posX: fallbackRadius,
          negX: fallbackRadius,
          posZ: fallbackRadius,
          negZ: fallbackRadius,
     };
}

function getSupportDistance(bounds, direction) {
     return (
          (direction.x >= 0
               ? direction.x * bounds.posX
               : -direction.x * bounds.negX) +
          (direction.z >= 0
               ? direction.z * bounds.posZ
               : -direction.z * bounds.negZ)
     );
}

function getHardCenterGap(frontMinecartId, rearMinecartId, direction = null) {
     if (!direction) {
          return (
               getMinecartHalfLength(frontMinecartId) +
               getMinecartHalfLength(rearMinecartId)
          );
     }

     return (
          getSupportDistance(
               getMinecartHardBounds(frontMinecartId),
               negateHorizontal(direction),
          ) +
          getSupportDistance(getMinecartHardBounds(rearMinecartId), direction)
     );
}

function getMinimumCenterGap(
     frontMinecartId,
     rearMinecartId,
     spacing,
     direction = null,
) {
     const bodyCenterGap = Math.max(
          getHardCenterGap(frontMinecartId, rearMinecartId, direction),
          MINECART_ENTITY_MIN_CENTER_GAP,
     );

     if (!Number.isFinite(spacing)) {
          return bodyCenterGap;
     }

     return Math.max(spacing, bodyCenterGap);
}

function detachRearLink(frontMinecartId) {
     const frontData = loadTrainConsistData(frontMinecartId);
     const rearMinecartId = frontData.rearId;

     if (!rearMinecartId) {
          return false;
     }

     const rearData = loadTrainConsistData(rearMinecartId);

     saveTrainConsistData(frontMinecartId, {
          ...frontData,
          rearId: null,
          rearSpacing: null,
     });

     if (rearData.frontId === frontMinecartId) {
          saveTrainConsistData(rearMinecartId, {
               ...rearData,
               frontId: null,
               frontSpacing: null,
          });
     }

     return true;
}

function hasRearPathToTarget(startMinecartId, targetMinecartId) {
     const visited = new Set();
     let currentMinecartId = startMinecartId;

     while (currentMinecartId) {
          if (currentMinecartId === targetMinecartId) {
               return true;
          }

          if (visited.has(currentMinecartId)) {
               return true;
          }

          visited.add(currentMinecartId);
          currentMinecartId = loadTrainConsistData(currentMinecartId).rearId;
     }

     return false;
}

export function connectMinecartConsist(
     frontMinecartId,
     rearMinecartId,
     spacing = 1,
) {
     if (frontMinecartId === rearMinecartId) {
          return {
               success: false,
               reason: "same",
          };
     }

     if (hasRearPathToTarget(rearMinecartId, frontMinecartId)) {
          return {
               success: false,
               reason: "cycle",
          };
     }

     const frontMinecart = getValidMinecartEntity(frontMinecartId);
     const rearMinecart = getValidMinecartEntity(rearMinecartId);
     const pairAxis =
          frontMinecart && rearMinecart
               ? getPairDirection(frontMinecart, rearMinecart)
               : null;
     const minimumCenterGap = getMinimumCenterGap(
          frontMinecartId,
          rearMinecartId,
          spacing,
          pairAxis,
     );
     const frontData = loadTrainConsistData(frontMinecartId);
     const rearData = loadTrainConsistData(rearMinecartId);

     if (frontData.rearId && frontData.rearId !== rearMinecartId) {
          detachRearLink(frontMinecartId);
     }

     if (rearData.frontId && rearData.frontId !== frontMinecartId) {
          detachMinecartFrontLink(rearMinecartId);
     }

     saveTrainConsistData(frontMinecartId, {
          ...loadTrainConsistData(frontMinecartId),
          rearId: rearMinecartId,
          rearSpacing: minimumCenterGap,
     });

     saveTrainConsistData(rearMinecartId, {
          ...loadTrainConsistData(rearMinecartId),
          frontId: frontMinecartId,
          frontSpacing: minimumCenterGap,
     });

     return {
          success: true,
     };
}

export function detachMinecartFrontLink(minecartId) {
     const rearData = loadTrainConsistData(minecartId);
     const frontMinecartId = rearData.frontId;

     if (!frontMinecartId) {
          return false;
     }

     const frontData = loadTrainConsistData(frontMinecartId);

     saveTrainConsistData(minecartId, {
          ...rearData,
          frontId: null,
          frontSpacing: null,
     });

     if (frontData.rearId === minecartId) {
          saveTrainConsistData(frontMinecartId, {
               ...frontData,
               rearId: null,
               rearSpacing: null,
          });
     }

     return true;
}

export function clearMinecartConsist(minecartId, { deleteSelf = false } = {}) {
     const consistData = loadTrainConsistData(minecartId);

     if (consistData.frontId) {
          detachMinecartFrontLink(minecartId);
     }

     if (consistData.rearId) {
          detachRearLink(minecartId);
     }

     if (deleteSelf) {
          deleteTrainConsistData(minecartId);
     }
}
