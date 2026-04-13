import { system, world } from "@minecraft/server";

import {
     getActiveTrainConsistIds,
     hasActiveTrainConsists,
     loadTrainData,
     loadTrainConsistData,
     minecartRegistry,
     saveTrainConsistData,
} from "./DataStorage";
import { getActiveDriveCommand } from "./TrainDriveManager";
import {
     getRailDirectionAtLocation,
     isHorizontalRailDirection,
} from "./shared.js";

const DEFAULT_MINECART_TYPE = "minecraft:minecart";
const UPDATE_INTERVAL = 1;
const CLEANUP_INTERVAL = 20;
const STRAIGHT_X_RAIL_DIRECTION = 1;
const STRAIGHT_Z_RAIL_DIRECTION = 0;
const MIN_HALF_LENGTH = 0.5;
const MINECART_ENTITY_MIN_CENTER_GAP = 1.12;

const MOTION_EPSILON = 0.004;
const FOLLOW_SPEED_EPSILON = 0.002;
const FOLLOW_IMPULSE_BASE = 0.004;
const FOLLOW_IMPULSE_GAIN = 0.26;
const MAX_FOLLOW_IMPULSE = 0.02;
const CONTROLLER_SOURCE_SPEED = 0.05;
const MOTION_HOLD_TICKS = 3;
const MOTION_DECAY = 0.85;
const STRAIGHT_LINK_GAP_EPSILON = 0.02;
const STRAIGHT_LINK_RELATIVE_SPEED_EPSILON = 0.001;
const STRAIGHT_LINK_TARGET_RELATIVE_GAIN = 0.5;
const STRAIGHT_LINK_MAX_TARGET_RELATIVE_SPEED = 0.2;
const STRAIGHT_LINK_IMPULSE_BASE = 0.003;
const STRAIGHT_LINK_IMPULSE_GAIN = 0.2;
const STRAIGHT_LINK_MAX_IMPULSE = 0.03;
const STRAIGHT_LINK_DRIVE_HINT_SPEED = 0.04;
const STRAIGHT_RIGID_LOCK_GAP_EPSILON = 0.08;
const STRAIGHT_RIGID_LOCK_RELATIVE_SPEED_EPSILON = 0.01;
const STRAIGHT_RIGID_LOCK_CONFIRM_TICKS = 4;
const STRAIGHT_SHORT_LINK_LOCK_EXTRA_GAP = 1;
const STRAIGHT_SHORT_LINK_LOCK_GAP_EPSILON = 0.25;
const STRAIGHT_SHORT_LINK_LOCK_RELATIVE_SPEED_EPSILON = 0.08;
const STRAIGHT_SHORT_LINK_LOCK_CONFIRM_TICKS = 2;

const lastHorizontalPositions = new Map();
const groupMotionStates = new Map();
const pairRuntimeStates = new Map();

function clamp(value, min, max) {
     return Math.max(min, Math.min(max, value));
}

function cloneHorizontalLocation(location) {
     return {
          x: location.x,
          y: location.y,
          z: location.z,
     };
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
     if (length <= MOTION_EPSILON) {
          return null;
     }

     return {
          x: vector.x / length,
          z: vector.z / length,
     };
}

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

function getRailAxis(railDirection) {
     if (railDirection === STRAIGHT_X_RAIL_DIRECTION) {
          return "x";
     }

     if (railDirection === STRAIGHT_Z_RAIL_DIRECTION) {
          return "z";
     }

     return null;
}

function getScalarCoordinate(location, axis) {
     return axis === "x" ? location.x : location.z;
}

function getPerpendicularCoordinate(location, axis) {
     return axis === "x" ? location.z : location.x;
}

function roundLaneCoordinate(value) {
     return Math.round(value * 2) / 2;
}

function getLaneKey(location, axis) {
     return `${axis}:${roundLaneCoordinate(
          getPerpendicularCoordinate(location, axis),
     )}:${roundLaneCoordinate(location.y)}`;
}

function getObservedScalarSpeed(delta, axis) {
     return axis === "x" ? delta.x : delta.z;
}

function getActualScalarSpeed(minecart, axis) {
     const velocity = minecart.getVelocity();
     return axis === "x" ? velocity.x : velocity.z;
}

function getDriveHintScalarSpeed(minecartId, axis) {
     const command = getActiveDriveCommand(minecartId);
     if (!command || command.axis !== axis) {
          return 0;
     }

     return command.direction * STRAIGHT_LINK_DRIVE_HINT_SPEED;
}

function getPairRuntimeKey(frontMinecartId, rearMinecartId) {
     return `${frontMinecartId}->${rearMinecartId}`;
}

function getPairRuntimeState(frontMinecartId, rearMinecartId) {
     const key = getPairRuntimeKey(frontMinecartId, rearMinecartId);

     if (!pairRuntimeStates.has(key)) {
          pairRuntimeStates.set(key, {
               sign: null,
               axis: null,
               laneKey: null,
               stableTicks: 0,
               locked: false,
          });
     }

     return pairRuntimeStates.get(key);
}

function clearPairRuntimeState(frontMinecartId, rearMinecartId) {
     pairRuntimeStates.delete(getPairRuntimeKey(frontMinecartId, rearMinecartId));
}

function clearPairRuntimeStatesForMinecart(minecartId) {
     for (const key of [...pairRuntimeStates.keys()]) {
          if (key.startsWith(`${minecartId}->`) || key.endsWith(`->${minecartId}`)) {
               pairRuntimeStates.delete(key);
          }
     }
}

function resetPairStraightRigidLock(frontMinecartId, rearMinecartId) {
     const runtimeState = pairRuntimeStates.get(
          getPairRuntimeKey(frontMinecartId, rearMinecartId),
     );
     if (!runtimeState) {
          return;
     }

     runtimeState.axis = null;
     runtimeState.laneKey = null;
     runtimeState.stableTicks = 0;
     runtimeState.locked = false;
}

function isStraightAlignedGroup(groupIds, observedStates) {
     if (groupIds.length < 2) {
          return false;
     }

     let axis = null;
     let laneKey = null;

     for (const minecartId of groupIds) {
          const observedState = observedStates.get(minecartId);
          if (!observedState?.minecart || !observedState.axis || !observedState.laneKey) {
               return false;
          }

          if (axis === null) {
               axis = observedState.axis;
               laneKey = observedState.laneKey;
               continue;
          }

          if (
               observedState.axis !== axis ||
               observedState.laneKey !== laneKey
          ) {
               return false;
          }
     }

     return true;
}

export function isStraightRigidPairLocked(frontMinecartId, rearMinecartId) {
     return (
          pairRuntimeStates.get(getPairRuntimeKey(frontMinecartId, rearMinecartId))
               ?.locked === true
     );
}

function clearFrontLink(minecartId) {
     const consistData = loadTrainConsistData(minecartId);
     if (!consistData.frontId && consistData.frontSpacing === null) {
          return;
     }

     if (consistData.frontId) {
          clearPairRuntimeState(consistData.frontId, minecartId);
     }

     saveTrainConsistData(minecartId, {
          ...consistData,
          frontId: null,
          frontSpacing: null,
     });
}

function clearRearLink(minecartId) {
     const consistData = loadTrainConsistData(minecartId);
     if (!consistData.rearId && consistData.rearSpacing === null) {
          return;
     }

     if (consistData.rearId) {
          clearPairRuntimeState(minecartId, consistData.rearId);
     }

     saveTrainConsistData(minecartId, {
          ...consistData,
          rearId: null,
          rearSpacing: null,
     });
}

function cleanupBrokenConsists() {
     for (const minecartId of getActiveTrainConsistIds()) {
          const consistData = loadTrainConsistData(minecartId);

          if (consistData.frontId) {
               const frontMinecart = getValidMinecartEntity(consistData.frontId);
               const frontData = loadTrainConsistData(consistData.frontId);

               if (!frontMinecart || frontData.rearId !== minecartId) {
                    clearFrontLink(minecartId);
               }
          }

          if (consistData.rearId) {
               const rearMinecart = getValidMinecartEntity(consistData.rearId);
               const rearData = loadTrainConsistData(consistData.rearId);

               if (!rearMinecart || rearData.frontId !== minecartId) {
                    clearRearLink(minecartId);
               }
          }
     }
}

function getPairTargetGap(frontMinecartId, rearMinecartId) {
     const frontData = loadTrainConsistData(frontMinecartId);
     const rearData = loadTrainConsistData(rearMinecartId);

     return frontData.rearSpacing ?? rearData.frontSpacing ?? 1;
}

function getFallbackHalfLength(trainData) {
     const primaryRadius = trainData?.radii?.primary;
     return Number.isFinite(primaryRadius) && primaryRadius > 0
          ? primaryRadius
          : MIN_HALF_LENGTH;
}

function getAxisBounds(trainData, axis) {
     const hardBounds = trainData?.hardBounds;
     const fallbackRadius = getFallbackHalfLength(trainData);

     const negative = axis === "x" ? hardBounds?.negX : hardBounds?.negZ;
     const positive = axis === "x" ? hardBounds?.posX : hardBounds?.posZ;

     return {
          negative: Number.isFinite(negative) ? negative : fallbackRadius,
          positive: Number.isFinite(positive) ? positive : fallbackRadius,
     };
}

function getStraightPairMinimumGap(frontMinecartId, rearMinecartId, axis, sign) {
     if ((axis !== "x" && axis !== "z") || (sign !== 1 && sign !== -1)) {
          return MINECART_ENTITY_MIN_CENTER_GAP;
     }

     const frontBounds = getAxisBounds(loadTrainData(frontMinecartId), axis);
     const rearBounds = getAxisBounds(loadTrainData(rearMinecartId), axis);

     const hardGap =
          sign > 0
               ? frontBounds.negative + rearBounds.positive
               : frontBounds.positive + rearBounds.negative;

     return Math.max(hardGap, MINECART_ENTITY_MIN_CENTER_GAP);
}

export function getStraightRigidPairTargetGap(
     frontMinecartId,
     rearMinecartId,
     axis,
     sign,
) {
     return Math.max(
          getPairTargetGap(frontMinecartId, rearMinecartId),
          getStraightPairMinimumGap(frontMinecartId, rearMinecartId, axis, sign),
     );
}

function getConsistHeadId(minecartId) {
     let currentMinecartId = minecartId;
     const visited = new Set();

     while (currentMinecartId && !visited.has(currentMinecartId)) {
          visited.add(currentMinecartId);
          const frontId = loadTrainConsistData(currentMinecartId).frontId;

          if (!frontId || !minecartRegistry.has(frontId)) {
               return currentMinecartId;
          }

          currentMinecartId = frontId;
     }

     return minecartId;
}

function getConsistGroupFromHead(headMinecartId) {
     const groupIds = [];
     const visited = new Set();
     let currentMinecartId = headMinecartId;

     while (
          currentMinecartId &&
          !visited.has(currentMinecartId) &&
          minecartRegistry.has(currentMinecartId)
     ) {
          const minecart = getValidMinecartEntity(currentMinecartId);
          if (!minecart) {
               break;
          }

          groupIds.push(currentMinecartId);
          visited.add(currentMinecartId);
          currentMinecartId = loadTrainConsistData(currentMinecartId).rearId;
     }

     return groupIds;
}

function buildConsistGroups(activeMinecartIds = getActiveTrainConsistIds()) {
     const groups = [];
     const visited = new Set();

     for (const minecartId of activeMinecartIds) {
          if (visited.has(minecartId)) {
               continue;
          }

          const consistData = loadTrainConsistData(minecartId);
          if (!consistData.frontId && !consistData.rearId) {
               visited.add(minecartId);
               continue;
          }

          const headMinecartId = getConsistHeadId(minecartId);
          const groupIds = getConsistGroupFromHead(headMinecartId);

          for (const groupMinecartId of groupIds) {
               visited.add(groupMinecartId);
          }

          if (groupIds.length > 1) {
               groups.push(groupIds);
          }
     }

     return groups;
}

function resolveControllerMotionSource(groupIds, observedStates) {
     for (const minecartId of groupIds) {
          const activeCommand = getActiveDriveCommand(minecartId);
          if (!activeCommand) {
               continue;
          }

          const direction =
               activeCommand.axis === "x"
                    ? { x: activeCommand.direction, z: 0 }
                    : { x: 0, z: activeCommand.direction };
          const observedState = observedStates.get(minecartId);
          const observedSpeedAlongDirection = observedState
               ? observedState.delta.x * direction.x +
                 observedState.delta.z * direction.z
               : 0;

          return {
               direction,
               speed: Math.max(
                    CONTROLLER_SOURCE_SPEED,
                    Math.abs(observedSpeedAlongDirection),
               ),
               sourceId: minecartId,
          };
     }

     return null;
}

function resolveObservedMotionSource(groupIds, observedStates) {
     let bestSource = null;

     for (const minecartId of groupIds) {
          const observedState = observedStates.get(minecartId);
          if (!observedState || observedState.speed <= MOTION_EPSILON) {
               continue;
          }

          if (!bestSource || observedState.speed > bestSource.speed) {
               bestSource = {
                    sourceId: minecartId,
                    speed: observedState.speed,
                    direction: normalizeHorizontalVector(observedState.delta),
               };
          }
     }

     return bestSource?.direction ? bestSource : null;
}

function resolveGroupMotion(groupIds, observedStates, groupKey) {
     const controllerSource = resolveControllerMotionSource(
          groupIds,
          observedStates,
     );
     if (controllerSource) {
          groupMotionStates.set(groupKey, {
               ...controllerSource,
               ttl: MOTION_HOLD_TICKS,
          });
          return controllerSource;
     }

     const observedSource = resolveObservedMotionSource(groupIds, observedStates);
     if (observedSource) {
          groupMotionStates.set(groupKey, {
               ...observedSource,
               ttl: MOTION_HOLD_TICKS,
          });
          return observedSource;
     }

     const previousState = groupMotionStates.get(groupKey);
     if (!previousState || previousState.ttl <= 0) {
          groupMotionStates.delete(groupKey);
          return null;
     }

     const heldState = {
          direction: previousState.direction,
          speed: previousState.speed * MOTION_DECAY,
          sourceId: previousState.sourceId ?? null,
     };

     if (heldState.speed <= MOTION_EPSILON) {
          groupMotionStates.delete(groupKey);
          return null;
     }

     groupMotionStates.set(groupKey, {
          ...heldState,
          ttl: previousState.ttl - 1,
     });
     return heldState;
}

function applyFollowImpulse(minecart, direction, speedDelta) {
     const impulseMagnitude = clamp(
          FOLLOW_IMPULSE_BASE + speedDelta * FOLLOW_IMPULSE_GAIN,
          FOLLOW_IMPULSE_BASE,
          MAX_FOLLOW_IMPULSE,
     );

     minecart.applyImpulse({
          x: direction.x * impulseMagnitude,
          y: 0,
          z: direction.z * impulseMagnitude,
     });
}

function applyAxisScalarImpulse(minecart, axis, scalarDelta, sign = 1) {
     if (Math.abs(scalarDelta) <= STRAIGHT_LINK_RELATIVE_SPEED_EPSILON) {
          return;
     }

     const impulseMagnitude = clamp(
          STRAIGHT_LINK_IMPULSE_BASE +
               Math.abs(scalarDelta) * STRAIGHT_LINK_IMPULSE_GAIN,
          STRAIGHT_LINK_IMPULSE_BASE,
          STRAIGHT_LINK_MAX_IMPULSE,
     );
     const direction = Math.sign(scalarDelta) * sign;

     minecart.applyImpulse({
          x: axis === "x" ? direction * impulseMagnitude : 0,
          y: 0,
          z: axis === "z" ? direction * impulseMagnitude : 0,
     });
}

function processStraightFixedPair(
     frontMinecartId,
     rearMinecartId,
     observedStates,
) {
     const frontState = observedStates.get(frontMinecartId);
     const rearState = observedStates.get(rearMinecartId);

     if (!frontState?.minecart || !rearState?.minecart) {
          clearPairRuntimeState(frontMinecartId, rearMinecartId);
          return false;
     }

     if (
          !frontState.axis ||
          !rearState.axis ||
          frontState.axis !== rearState.axis ||
          frontState.laneKey !== rearState.laneKey
     ) {
          resetPairStraightRigidLock(frontMinecartId, rearMinecartId);
          return false;
     }

     const runtimeState = getPairRuntimeState(frontMinecartId, rearMinecartId);
     runtimeState.axis = frontState.axis;
     runtimeState.laneKey = frontState.laneKey;

     if (runtimeState.sign !== 1 && runtimeState.sign !== -1) {
          runtimeState.sign =
               frontState.scalarPosition >= rearState.scalarPosition ? 1 : -1;
     }

     const minimumGap = getStraightPairMinimumGap(
          frontMinecartId,
          rearMinecartId,
          frontState.axis,
          runtimeState.sign,
     );
     const targetGap = getStraightRigidPairTargetGap(
          frontMinecartId,
          rearMinecartId,
          frontState.axis,
          runtimeState.sign,
     );
     const gap =
          (frontState.scalarPosition - rearState.scalarPosition) *
          runtimeState.sign;
     const gapError = gap - targetGap;
     const frontSpeed = frontState.scalarSpeed * runtimeState.sign;
     const rearSpeed = rearState.scalarSpeed * runtimeState.sign;
     const relativeSpeed = frontSpeed - rearSpeed;
     const targetRelativeSpeed = clamp(
          -gapError * STRAIGHT_LINK_TARGET_RELATIVE_GAIN,
          -STRAIGHT_LINK_MAX_TARGET_RELATIVE_SPEED,
          STRAIGHT_LINK_MAX_TARGET_RELATIVE_SPEED,
     );
     const relativeCorrection = targetRelativeSpeed - relativeSpeed;
     const isStableForRigidLock =
          Math.abs(gapError) <= STRAIGHT_RIGID_LOCK_GAP_EPSILON &&
          Math.abs(relativeSpeed) <= STRAIGHT_RIGID_LOCK_RELATIVE_SPEED_EPSILON;
     const canUseShortLinkFastLock =
          targetGap <= minimumGap + STRAIGHT_SHORT_LINK_LOCK_EXTRA_GAP;
     const isStableForShortLinkLock =
          canUseShortLinkFastLock &&
          Math.abs(gapError) <= STRAIGHT_SHORT_LINK_LOCK_GAP_EPSILON &&
          Math.abs(relativeSpeed) <=
               STRAIGHT_SHORT_LINK_LOCK_RELATIVE_SPEED_EPSILON;

     if (isStableForShortLinkLock || isStableForRigidLock) {
          runtimeState.stableTicks += 1;
          const requiredStableTicks = isStableForShortLinkLock
               ? STRAIGHT_SHORT_LINK_LOCK_CONFIRM_TICKS
               : STRAIGHT_RIGID_LOCK_CONFIRM_TICKS;
          if (runtimeState.stableTicks >= requiredStableTicks) {
               runtimeState.locked = true;
          }
     } else {
          runtimeState.stableTicks = 0;
          runtimeState.locked = false;
     }

     if (runtimeState.locked) {
          return true;
     }

     if (
          Math.abs(gapError) <= STRAIGHT_LINK_GAP_EPSILON &&
          Math.abs(relativeCorrection) <= STRAIGHT_LINK_RELATIVE_SPEED_EPSILON
     ) {
          return true;
     }

     const frontCorrection = relativeCorrection * 0.5;
     const rearCorrection = -relativeCorrection * 0.5;

     applyAxisScalarImpulse(
          frontState.minecart,
          frontState.axis,
          frontCorrection,
          runtimeState.sign,
     );
     applyAxisScalarImpulse(
          rearState.minecart,
          rearState.axis,
          rearCorrection,
          runtimeState.sign,
     );

     return true;
}

function canUseStraightRigidLinkSolver(groupIds, observedStates) {
     if (!isStraightAlignedGroup(groupIds, observedStates)) {
          return false;
     }

     for (let index = 0; index < groupIds.length - 1; index++) {
          if (!isStraightRigidPairLocked(groupIds[index], groupIds[index + 1])) {
               return false;
          }
     }

     return true;
}

function applyGroupMotionToFollowers(groupIds, observedStates, groupMotion) {
     for (const minecartId of groupIds) {
          if (minecartId === groupMotion.sourceId) {
               continue;
          }

          const observedState = observedStates.get(minecartId);
          if (!observedState?.minecart) {
               continue;
          }

          const speedAlongDirection =
               observedState.delta.x * groupMotion.direction.x +
               observedState.delta.z * groupMotion.direction.z;
          const speedDelta = groupMotion.speed - speedAlongDirection;

          if (speedDelta <= FOLLOW_SPEED_EPSILON) {
               continue;
          }

          applyFollowImpulse(
               observedState.minecart,
               groupMotion.direction,
               speedDelta,
          );
     }
}

function processConsistGroup(groupIds, observedStates) {
     const groupKey = groupIds[0];
     if (canUseStraightRigidLinkSolver(groupIds, observedStates)) {
          groupMotionStates.delete(groupKey);
          return;
     }

     if (isStraightAlignedGroup(groupIds, observedStates)) {
          const groupMotion = resolveGroupMotion(
               groupIds,
               observedStates,
               groupKey,
          );

          if (groupMotion) {
               applyGroupMotionToFollowers(
                    groupIds,
                    observedStates,
                    groupMotion,
               );
          }

          for (let index = 0; index < groupIds.length - 1; index++) {
               processStraightFixedPair(
                    groupIds[index],
                    groupIds[index + 1],
                    observedStates,
               );
          }
          return;
     }

     for (let index = 0; index < groupIds.length - 1; index++) {
          resetPairStraightRigidLock(groupIds[index], groupIds[index + 1]);
     }

      const groupMotion = resolveGroupMotion(groupIds, observedStates, groupKey);
     if (!groupMotion) {
          for (let index = 0; index < groupIds.length - 1; index++) {
               processStraightFixedPair(
                    groupIds[index],
                    groupIds[index + 1],
                    observedStates,
               );
          }
          return;
     }

     applyGroupMotionToFollowers(groupIds, observedStates, groupMotion);

     for (let index = 0; index < groupIds.length - 1; index++) {
          processStraightFixedPair(
               groupIds[index],
               groupIds[index + 1],
               observedStates,
          );
     }
}

function buildObservedStates(targetMinecartIds = getActiveTrainConsistIds()) {
     const observedStates = new Map();
     const activeMinecartIds = new Set();

     for (const minecartId of targetMinecartIds) {
          const minecart = getValidMinecartEntity(minecartId);
          if (!minecart) {
               lastHorizontalPositions.delete(minecartId);
               clearPairRuntimeStatesForMinecart(minecartId);
               continue;
          }

          activeMinecartIds.add(minecartId);

          const currentPosition = cloneHorizontalLocation(minecart.location);
          const lastPosition = lastHorizontalPositions.get(minecartId);
          const delta = lastPosition
               ? getHorizontalDelta(lastPosition, currentPosition)
               : { x: 0, z: 0 };
          let railDirection = null;

          try {
               railDirection = getRailDirectionAtLocation(
                    minecart.location,
                    minecart.dimension,
               );
          } catch {}

          const axis = isHorizontalRailDirection(railDirection)
               ? getRailAxis(railDirection)
               : null;
          const scalarPosition = axis
               ? getScalarCoordinate(minecart.location, axis)
               : null;
          const observedScalarSpeed = axis
               ? getObservedScalarSpeed(delta, axis)
               : 0;
          const actualScalarSpeed = axis
               ? getActualScalarSpeed(minecart, axis)
               : 0;
          const driveHintScalarSpeed = axis
               ? getDriveHintScalarSpeed(minecartId, axis)
               : 0;
          let scalarSpeed =
               Math.abs(actualScalarSpeed) > Math.abs(observedScalarSpeed)
                    ? actualScalarSpeed
                    : observedScalarSpeed;

          if (Math.abs(driveHintScalarSpeed) > Math.abs(scalarSpeed)) {
               scalarSpeed = driveHintScalarSpeed;
          }

          observedStates.set(minecartId, {
               minecart,
               currentPosition,
               delta,
               speed: getHorizontalLength(delta),
               railDirection,
               axis,
               laneKey:
                    axis && scalarPosition !== null
                         ? getLaneKey(minecart.location, axis)
                         : null,
               scalarPosition,
               scalarSpeed,
          });
     }

     for (const minecartId of [...lastHorizontalPositions.keys()]) {
          if (!activeMinecartIds.has(minecartId)) {
               lastHorizontalPositions.delete(minecartId);
          }
     }

     return observedStates;
}

function persistObservedStates(observedStates) {
     for (const [minecartId, observedState] of observedStates) {
          lastHorizontalPositions.set(minecartId, observedState.currentPosition);
     }
}

export class TrainLinkManager {
     constructor() {
          this.cleanupCounter = 0;
          this.updateInterval = system.runInterval(() => {
               if (!hasActiveTrainConsists()) {
                    if (groupMotionStates.size) {
                         groupMotionStates.clear();
                    }
                    if (pairRuntimeStates.size) {
                         pairRuntimeStates.clear();
                    }
                    return;
               }

               this.cleanupCounter += 1;

               if (this.cleanupCounter >= CLEANUP_INTERVAL) {
                    this.cleanupCounter = 0;
                    cleanupBrokenConsists();
               }

               const activeConsistMinecartIds = getActiveTrainConsistIds();
               const observedStates = buildObservedStates(activeConsistMinecartIds);
               const consistGroups = buildConsistGroups(activeConsistMinecartIds);
               const activeGroupKeys = new Set();

               for (const groupIds of consistGroups) {
                    processConsistGroup(groupIds, observedStates);
                    activeGroupKeys.add(groupIds[0]);
               }

               for (const groupKey of [...groupMotionStates.keys()]) {
                    if (!activeGroupKeys.has(groupKey)) {
                         groupMotionStates.delete(groupKey);
                    }
               }

               persistObservedStates(observedStates);
          }, UPDATE_INTERVAL);
     }
}
