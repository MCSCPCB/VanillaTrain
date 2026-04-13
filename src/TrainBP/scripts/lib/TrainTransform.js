const CARDINAL_YAWS = Object.freeze([0, 90, 180, -90]);
const MOTION_YAW_THRESHOLD = 0.001;

function normalizeSignedYaw(yaw) {
     const normalized = ((((yaw ?? 0) + 180) % 360) + 360) % 360 - 180;
     return normalized === -180 ? 180 : normalized;
}

function getCardinalYawDistance(left, right) {
     return Math.abs(normalizeSignedYaw(left - right));
}

export function quantizeCardinalYaw(yaw) {
     const normalizedYaw = normalizeSignedYaw(yaw);
     let bestYaw = CARDINAL_YAWS[0];
     let bestDistance = Infinity;

     for (const candidate of CARDINAL_YAWS) {
          const distance = getCardinalYawDistance(normalizedYaw, candidate);
          if (distance < bestDistance) {
               bestDistance = distance;
               bestYaw = candidate;
          }
     }

     return bestYaw;
}

function rotateHorizontalByYaw(x, z, yaw, quantize = false) {
     const resolvedYaw = quantize ? quantizeCardinalYaw(yaw) : yaw ?? 0;
     const radians = resolvedYaw * (Math.PI / 180);

     return {
          x: x * Math.cos(radians) - z * Math.sin(radians),
          z: x * Math.sin(radians) + z * Math.cos(radians),
     };
}

export function createTrainTransform(rawYaw = 0) {
     const yaw = quantizeCardinalYaw(rawYaw);
     return {
          buildYaw: yaw,
          logicalYaw: yaw,
     };
}

export function ensureTrainTransformData(trainData, fallbackRawYaw = 0) {
     const fallbackYaw = quantizeCardinalYaw(fallbackRawYaw);
     let wasChanged = false;

     if (!trainData.transform || typeof trainData.transform !== "object") {
          trainData.transform = createTrainTransform(fallbackYaw);
          return {
               transform: trainData.transform,
               wasChanged: true,
          };
     }

     const normalizedBuildYaw = quantizeCardinalYaw(
          trainData.transform.buildYaw ?? fallbackYaw
     );
     const normalizedLogicalYaw = quantizeCardinalYaw(
          trainData.transform.logicalYaw ?? normalizedBuildYaw
     );

     if (trainData.transform.buildYaw !== normalizedBuildYaw) {
          trainData.transform.buildYaw = normalizedBuildYaw;
          wasChanged = true;
     }

     if (trainData.transform.logicalYaw !== normalizedLogicalYaw) {
          trainData.transform.logicalYaw = normalizedLogicalYaw;
          wasChanged = true;
     }

     return {
          transform: trainData.transform,
          wasChanged,
     };
}

export function setTrainLogicalYaw(trainData, rawYaw) {
     const normalizedYaw = quantizeCardinalYaw(rawYaw);
     const { transform } = ensureTrainTransformData(trainData, normalizedYaw);

     if (transform.logicalYaw === normalizedYaw) {
          return false;
     }

     transform.logicalYaw = normalizedYaw;
     return true;
}

export function inferTrainYawFromMovement(deltaX, deltaZ) {
     const absDeltaX = Math.abs(deltaX);
     const absDeltaZ = Math.abs(deltaZ);

     if (
          absDeltaX <= MOTION_YAW_THRESHOLD &&
          absDeltaZ <= MOTION_YAW_THRESHOLD
     ) {
          return null;
     }

     if (absDeltaX >= absDeltaZ) {
          return deltaX >= 0 ? -90 : 90;
     }

     return deltaZ >= 0 ? 0 : 180;
}

export function getTrainRotationDelta(transform) {
     return quantizeCardinalYaw(transform.logicalYaw - transform.buildYaw);
}

export function getTrainStructureRotationDegrees(transform) {
     switch (getTrainRotationDelta(transform)) {
          case 90:
               return 90;
          case -90:
               return 270;
          case 180:
               return 180;
          default:
               return 0;
     }
}

function getCenteredOffset(offset) {
     return {
          x: offset.x + 0.5,
          y: offset.y,
          z: offset.z + 0.5,
     };
}

export function calculateTrainWorldPosition(
     minecart,
     offset,
     transform,
     pitchDegrees = minecart.getRotation().x
) {
     const centeredOffset = getCenteredOffset(offset);
     const localOffset = rotateHorizontalByYaw(
          centeredOffset.x,
          centeredOffset.z,
          -transform.buildYaw,
          true
     );
     const pitchRadians = pitchDegrees * (Math.PI / 180);
     const pitchedOffset = {
          x: localOffset.x,
          y: centeredOffset.y + localOffset.z * Math.sin(pitchRadians),
          z: localOffset.z * Math.cos(pitchRadians),
     };
     const worldYaw =
          Number.isFinite(transform.runtimeYaw)
               ? transform.runtimeYaw
               : transform.logicalYaw;
     const worldOffset = rotateHorizontalByYaw(
          pitchedOffset.x,
          pitchedOffset.z,
          worldYaw,
          false
     );

     return {
          x: minecart.location.x + worldOffset.x,
          y: minecart.location.y + pitchedOffset.y,
          z: minecart.location.z + worldOffset.z,
     };
}

export function getTrainStableRotation(
     transform,
     pitchDegrees = 0,
     rollDegrees = 0
) {
     const worldYaw =
          Number.isFinite(transform.runtimeYaw)
               ? transform.runtimeYaw
               : transform.logicalYaw;

     return {
          x: pitchDegrees,
          y: normalizeSignedYaw(worldYaw - transform.buildYaw),
          z: rollDegrees,
     };
}
