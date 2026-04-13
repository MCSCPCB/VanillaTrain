import { system, world } from "@minecraft/server";

import {
     hasActiveTrainConsists,
     loadTrainConsistData,
     loadTrainData,
     minecartRegistry,
} from "./DataStorage";
import { BLOCK_MODEL_MAP, getBlockModelType } from "../map/BlockMap.js";
import { getActiveDriveCommand } from "./TrainDriveManager";
import {
     getStraightRigidPairTargetGap,
     isStraightRigidPairLocked,
} from "./TrainLinkManager";
import {
     getOverworldDimension,
     getRailDirectionAtLocation,
     isHorizontalRailDirection,
} from "./shared.js";

const DEFAULT_MINECART_TYPE = "minecraft:minecart";
const UPDATE_INTERVAL = 1;

const STRAIGHT_X_RAIL_DIRECTION = 1;
const STRAIGHT_Z_RAIL_DIRECTION = 0;

const AIR_BLOCK_ID = "minecraft:air";
const LIGHT_BLOCK_ID = "minecraft:light_block";
const MINECART_BODY_HALF_EXTENT = 0.25;
const CONTACT_GAP = 0.02;
const MIN_SPEED_EPSILON = 0.001;
const POSITION_EPSILON = 0.0001;
const SOLVER_PASSES = 4;

const COLLISION_IMPULSE_FACTOR = 0.16;
const MIN_COLLISION_IMPULSE = 0.01;
const MAX_COLLISION_IMPULSE = 0.05;
const CONTROLLER_CHAIN_PUSH_SPEED = 0.04;

const runtimeStates = new Map();
const rigidLinkSigns = new Map();
const STRAIGHT_RAIL_PASS_THROUGH_MODEL_TYPES = new Set([
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

function clamp(value, min, max) {
     return Math.max(min, Math.min(max, value));
}

function cloneLocation(location) {
     return {
          x: location.x,
          y: location.y,
          z: location.z,
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

function getFallbackHalfLength(trainData) {
     const primary = trainData?.radii?.primary;
     return Number.isFinite(primary) && primary > 0 ? primary : 0.5;
}

function getAxisBounds(trainData, axis) {
     const hardBounds = trainData?.hardBounds;
     const fallbackHalfLength = getFallbackHalfLength(trainData);

     const negative =
          axis === "x" ? hardBounds?.negX : hardBounds?.negZ;
     const positive =
          axis === "x" ? hardBounds?.posX : hardBounds?.posZ;

     return {
          negative: Math.max(
               Number.isFinite(negative) ? negative : fallbackHalfLength,
               MINECART_BODY_HALF_EXTENT,
          ),
          positive: Math.max(
               Number.isFinite(positive) ? positive : fallbackHalfLength,
               MINECART_BODY_HALF_EXTENT,
          ),
     };
}

function getTrainMass(bounds) {
     return Math.max(1, bounds.negative + bounds.positive);
}

function getObservedScalarSpeed(minecartId, axis, scalarPosition) {
     const runtimeState = runtimeStates.get(minecartId);

     if (
          !runtimeState ||
          runtimeState.axis !== axis ||
          !Number.isFinite(runtimeState.scalarPosition)
     ) {
          return 0;
     }

     return scalarPosition - runtimeState.scalarPosition;
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

     return command.direction * CONTROLLER_CHAIN_PUSH_SPEED;
}

function getLinkPairKey(frontMinecartId, rearMinecartId) {
     return `${frontMinecartId}->${rearMinecartId}`;
}

function getStoredRigidLinkSign(frontMinecartId, rearMinecartId) {
     return rigidLinkSigns.get(getLinkPairKey(frontMinecartId, rearMinecartId));
}

function setStoredRigidLinkSign(frontMinecartId, rearMinecartId, sign) {
     rigidLinkSigns.set(getLinkPairKey(frontMinecartId, rearMinecartId), sign);
}

function resolveRigidLinkSign(frontState, rearState, fallbackSign = null) {
     const positionDelta = frontState.scalarPosition - rearState.scalarPosition;
     if (Math.abs(positionDelta) > POSITION_EPSILON) {
          return positionDelta >= 0 ? 1 : -1;
     }

     const speedDelta = frontState.scalarSpeed - rearState.scalarSpeed;
     if (Math.abs(speedDelta) > MIN_SPEED_EPSILON) {
          return speedDelta >= 0 ? 1 : -1;
     }

     const storedSign = getStoredRigidLinkSign(frontState.id, rearState.id);
     if (storedSign === 1 || storedSign === -1) {
          return storedSign;
     }

     if (fallbackSign === 1 || fallbackSign === -1) {
          return fallbackSign;
     }

     return 1;
}

function clearMinecartVelocity(minecart) {
     minecart.teleport(cloneLocation(minecart.location), {
          dimension: minecart.dimension,
          keepVelocity: false,
          checkForBlocks: false,
          rotation: minecart.getRotation(),
     });
}

function teleportAlongAxis(minecart, axis, scalarPosition, keepVelocity = false) {
     const currentLocation = minecart.location;
     const targetLocation = {
          x: axis === "x" ? scalarPosition : currentLocation.x,
          y: currentLocation.y,
          z: axis === "z" ? scalarPosition : currentLocation.z,
     };

     if (
          Math.abs(targetLocation.x - currentLocation.x) <= POSITION_EPSILON &&
          Math.abs(targetLocation.z - currentLocation.z) <= POSITION_EPSILON
     ) {
          return false;
     }

     minecart.teleport(targetLocation, {
          dimension: minecart.dimension,
          keepVelocity,
          checkForBlocks: false,
          rotation: minecart.getRotation(),
     });
     return true;
}

function applyAxisImpulse(minecart, axis, scalarSpeed) {
     if (Math.abs(scalarSpeed) <= MIN_SPEED_EPSILON) {
          return;
     }

     const impulse = clamp(
          Math.abs(scalarSpeed) * COLLISION_IMPULSE_FACTOR,
          MIN_COLLISION_IMPULSE,
          MAX_COLLISION_IMPULSE,
     );

     minecart.applyImpulse({
          x: axis === "x" ? Math.sign(scalarSpeed) * impulse : 0,
          y: 0,
          z: axis === "z" ? Math.sign(scalarSpeed) * impulse : 0,
     });
}

function syncBodiesFromResolvedTrainStates(bodies) {
     for (const body of bodies) {
          if (body.members.length !== 1) {
               continue;
          }

          const trainState = body.members[0].trainState;
          body.resolvedAnchor = trainState.resolvedPosition;
          body.resolvedSpeed = trainState.resolvedSpeed;
          body.touchedCollision = trainState.touchedCollision;
     }
}

function getRailBlockPosition(location) {
     return {
          x: Math.floor(location.x),
          y: Math.floor(location.y),
          z: Math.floor(location.z),
     };
}

function getNextRailBlockPosition(trainState, direction) {
     const railBlockPosition = getRailBlockPosition(trainState.minecart.location);
     return {
          x: railBlockPosition.x + (trainState.axis === "x" ? direction : 0),
          y: railBlockPosition.y,
          z: railBlockPosition.z + (trainState.axis === "z" ? direction : 0),
     };
}

function isPassThroughStraightRailBlock(block) {
     if (!block) {
          return true;
     }

     if (
          block.typeId === AIR_BLOCK_ID ||
          block.typeId === LIGHT_BLOCK_ID ||
          block.hasTag("rail")
     ) {
          return true;
     }

     return STRAIGHT_RAIL_PASS_THROUGH_MODEL_TYPES.has(
          getBlockModelType(block),
     );
}

function getStraightRailBlockStopPosition(trainState, direction) {
     const nextRailBlockPosition = getNextRailBlockPosition(trainState, direction);
     const nextBlock = trainState.minecart.dimension.getBlock(nextRailBlockPosition);

     if (isPassThroughStraightRailBlock(nextBlock)) {
          return null;
     }

     const currentRailBlockPosition = getRailBlockPosition(trainState.minecart.location);
     const boundaryCoordinate =
          currentRailBlockPosition[trainState.axis] + (direction > 0 ? 1 : 0);

     return (
          boundaryCoordinate -
          direction * (MINECART_BODY_HALF_EXTENT + CONTACT_GAP)
     );
}

function applyStraightRailBlockGuard(bodies) {
     for (const body of bodies) {
          const direction = Math.sign(body.resolvedSpeed);
          if (direction === 0) {
               continue;
          }

          let guardedAnchor = body.resolvedAnchor;
          let blocked = false;

          for (const member of body.members) {
               const stopPosition = getStraightRailBlockStopPosition(
                    member.trainState,
                    direction,
               );
               if (!Number.isFinite(stopPosition)) {
                    continue;
               }

               const stopAnchor = stopPosition - member.offset;
               if (
                    direction > 0 &&
                    guardedAnchor > stopAnchor + POSITION_EPSILON
               ) {
                    guardedAnchor = stopAnchor;
                    blocked = true;
               } else if (
                    direction < 0 &&
                    guardedAnchor < stopAnchor - POSITION_EPSILON
               ) {
                    guardedAnchor = stopAnchor;
                    blocked = true;
               }
          }

          if (!blocked) {
               continue;
          }

          body.resolvedAnchor = guardedAnchor;
          body.resolvedSpeed = 0;
          body.touchedCollision = true;
     }
}

function createSingleTrainBody(trainState) {
     return {
          members: [
               {
                    trainState,
                    offset: 0,
               },
          ],
          mass: trainState.mass,
          resolvedAnchor: trainState.scalarPosition,
          resolvedSpeed: trainState.scalarSpeed,
          minOffset: -trainState.bounds.negative,
          maxOffset: trainState.bounds.positive,
          touchedCollision: false,
     };
}

function createRigidTrainBody(chainIds, trainStatesById, lanePairs) {
     const members = [];
     const offsets = new Map();
     let totalMass = 0;
     let currentOffset = 0;
     let chainSign = null;

     offsets.set(chainIds[0], 0);

     for (let index = 0; index < chainIds.length - 1; index++) {
          const frontId = chainIds[index];
          const rearId = chainIds[index + 1];
          const frontState = trainStatesById.get(frontId);
          const rearState = trainStatesById.get(rearId);
          const lanePair = lanePairs.get(frontId);

          if (!frontState || !rearState || !lanePair || lanePair.rearId !== rearId) {
               continue;
          }

          const pairSign = resolveRigidLinkSign(frontState, rearState, chainSign);
          setStoredRigidLinkSign(frontId, rearId, pairSign);
          chainSign = pairSign;
          currentOffset -=
               pairSign *
               getStraightRigidPairTargetGap(
                    frontId,
                    rearId,
                    frontState.axis,
                    pairSign,
               );
          offsets.set(rearId, currentOffset);
     }

     let weightedAnchorSum = 0;
     let weightedSpeedSum = 0;
     let strongestDriveHintSpeed = 0;
     let dominantAnchor = null;
     let dominantSpeed = 0;
     let dominantScore = -1;
     let minOffset = Infinity;
     let maxOffset = -Infinity;

     for (const trainId of chainIds) {
          const trainState = trainStatesById.get(trainId);
          if (!trainState) {
               continue;
          }

          const offset = offsets.get(trainId) ?? 0;
          members.push({
               trainState,
               offset,
          });
          totalMass += trainState.mass;
          weightedAnchorSum += trainState.mass * (trainState.scalarPosition - offset);
          weightedSpeedSum += trainState.mass * trainState.scalarSpeed;
          minOffset = Math.min(minOffset, offset - trainState.bounds.negative);
          maxOffset = Math.max(maxOffset, offset + trainState.bounds.positive);

          const driveHintSpeed = getDriveHintScalarSpeed(trainId, trainState.axis);
          const candidateSpeed = trainState.scalarSpeed;
          const candidateScore =
               Math.abs(driveHintSpeed) > MIN_SPEED_EPSILON
                    ? 1000 + Math.abs(candidateSpeed)
                    : Math.abs(candidateSpeed);

          if (candidateScore > dominantScore) {
               dominantScore = candidateScore;
               dominantAnchor = trainState.scalarPosition - offset;
               dominantSpeed = candidateSpeed;
          }

          if (Math.abs(driveHintSpeed) > Math.abs(strongestDriveHintSpeed)) {
               strongestDriveHintSpeed = driveHintSpeed;
          }
     }

     const averageSpeed = totalMass > 0 ? weightedSpeedSum / totalMass : 0;
     const averageAnchor = totalMass > 0 ? weightedAnchorSum / totalMass : 0;
     const resolvedSpeed =
          dominantScore >= 0
               ? dominantSpeed
               : Math.abs(strongestDriveHintSpeed) > Math.abs(averageSpeed)
                 ? strongestDriveHintSpeed
                 : averageSpeed;

     return {
          members,
          mass: totalMass,
          resolvedAnchor:
               Number.isFinite(dominantAnchor) ? dominantAnchor : averageAnchor,
          resolvedSpeed,
          minOffset,
          maxOffset,
          touchedCollision: false,
     };
}

function getBodyMin(body) {
     return body.resolvedAnchor + body.minOffset;
}

function getBodyMax(body) {
     return body.resolvedAnchor + body.maxOffset;
}

function resolveBodyCollisions(bodies) {
     for (let pass = 0; pass < SOLVER_PASSES; pass++) {
          let hasChanges = false;
          bodies.sort((left, right) => getBodyMin(left) - getBodyMin(right));

          for (let index = 0; index < bodies.length - 1; index++) {
               const left = bodies[index];
               const right = bodies[index + 1];

               const gap = getBodyMin(right) - getBodyMax(left);
               const relativeClosingSpeed =
                    left.resolvedSpeed - right.resolvedSpeed;
               const requiresSeparation = gap < CONTACT_GAP - POSITION_EPSILON;
               const willCrossThisTick =
                    relativeClosingSpeed > MIN_SPEED_EPSILON &&
                    gap - relativeClosingSpeed <= CONTACT_GAP;

               if (!requiresSeparation && !willCrossThisTick) {
                    continue;
               }

               const totalMass = left.mass + right.mass;
               const sharedSpeed =
                    (left.resolvedSpeed * left.mass +
                         right.resolvedSpeed * right.mass) /
                    totalMass;

               if (
                    Math.abs(left.resolvedSpeed - sharedSpeed) >
                         MIN_SPEED_EPSILON ||
                    Math.abs(right.resolvedSpeed - sharedSpeed) >
                         MIN_SPEED_EPSILON
               ) {
                    hasChanges = true;
               }

               left.resolvedSpeed = sharedSpeed;
               right.resolvedSpeed = sharedSpeed;
               left.touchedCollision = true;
               right.touchedCollision = true;

               if (requiresSeparation) {
                    const correction = CONTACT_GAP - gap;
                    left.resolvedAnchor -=
                         correction * (right.mass / totalMass);
                    right.resolvedAnchor +=
                         correction * (left.mass / totalMass);
                    hasChanges = true;
               }
          }

          if (!hasChanges) {
               break;
          }
     }
}

function applyResolvedBodyStates(bodies) {
     for (const body of bodies) {
          for (const member of body.members) {
               const { trainState, offset } = member;
               const resolvedPosition = body.resolvedAnchor + offset;
               const positionChanged =
                    Math.abs(resolvedPosition - trainState.scalarPosition) >
                    POSITION_EPSILON;
               const speedChanged =
                    Math.abs(body.resolvedSpeed - trainState.scalarSpeed) >
                    MIN_SPEED_EPSILON;

               trainState.resolvedPosition = resolvedPosition;
               trainState.resolvedSpeed = body.resolvedSpeed;
               trainState.constraintAdjusted = positionChanged || speedChanged;

               if (body.touchedCollision) {
                    trainState.touchedCollision = true;
               }
          }
     }
}

function buildLaneBodies(trains) {
     const trainStatesById = new Map(
          trains.map((trainState) => [trainState.id, trainState]),
     );
     const lanePairs = new Map();
     const visited = new Set();
     const bodies = [];

     for (const trainState of trains) {
          const consistData = loadTrainConsistData(trainState.id);
          const rearId = consistData.rearId;

          if (!rearId || !trainStatesById.has(rearId)) {
               continue;
          }

          if (loadTrainConsistData(rearId).frontId !== trainState.id) {
               continue;
          }

          if (!isStraightRigidPairLocked(trainState.id, rearId)) {
               continue;
          }

          lanePairs.set(trainState.id, {
               rearId,
          });
     }

     function collectChain(startId) {
          const chainIds = [];
          let currentId = startId;

          while (
               currentId &&
               !visited.has(currentId) &&
               trainStatesById.has(currentId)
          ) {
               chainIds.push(currentId);
               visited.add(currentId);
               currentId = lanePairs.get(currentId)?.rearId ?? null;
          }

          return chainIds;
     }

     for (const trainState of trains) {
          if (visited.has(trainState.id)) {
               continue;
          }

          const frontId = loadTrainConsistData(trainState.id).frontId;
          if (frontId && trainStatesById.has(frontId)) {
               continue;
          }

          const chainIds = collectChain(trainState.id);
          if (chainIds.length > 1) {
               bodies.push(
                    createRigidTrainBody(chainIds, trainStatesById, lanePairs),
               );
               continue;
          }

          if (chainIds.length === 1) {
               bodies.push(createSingleTrainBody(trainState));
          }
     }

     for (const trainState of trains) {
          if (visited.has(trainState.id)) {
               continue;
          }

          const chainIds = collectChain(trainState.id);
          if (chainIds.length > 1) {
               bodies.push(
                    createRigidTrainBody(chainIds, trainStatesById, lanePairs),
               );
               continue;
          }

          if (chainIds.length === 1) {
               bodies.push(createSingleTrainBody(trainState));
          }
     }

     return bodies;
}

function createTrainState(minecart, axis) {
     const trainData = loadTrainData(minecart.id);
     const bounds = getAxisBounds(trainData, axis);
     const scalarPosition = getScalarCoordinate(minecart.location, axis);
     const observedScalarSpeed = getObservedScalarSpeed(
          minecart.id,
          axis,
          scalarPosition,
     );
     const actualScalarSpeed = getActualScalarSpeed(minecart, axis);
     const driveHintScalarSpeed = getDriveHintScalarSpeed(minecart.id, axis);
     let scalarSpeed =
          Math.abs(actualScalarSpeed) > Math.abs(observedScalarSpeed)
               ? actualScalarSpeed
               : observedScalarSpeed;

     if (Math.abs(driveHintScalarSpeed) > Math.abs(scalarSpeed)) {
          scalarSpeed = driveHintScalarSpeed;
     }

     return {
          minecart,
          id: minecart.id,
          axis,
          laneKey: getLaneKey(minecart.location, axis),
          scalarPosition,
          resolvedPosition: scalarPosition,
          scalarSpeed,
          resolvedSpeed: scalarSpeed,
          bounds,
          mass: getTrainMass(bounds),
          touchedCollision: false,
          constraintAdjusted: false,
     };
}

function resolveLaneCollisions(trains) {
     for (let pass = 0; pass < SOLVER_PASSES; pass++) {
          let hasChanges = false;
          trains.sort(
               (left, right) => left.resolvedPosition - right.resolvedPosition,
          );

          for (let index = 0; index < trains.length - 1; index++) {
               const left = trains[index];
               const right = trains[index + 1];

               const gap =
                    (right.resolvedPosition - right.bounds.negative) -
                    (left.resolvedPosition + left.bounds.positive);
               const relativeClosingSpeed =
                    left.resolvedSpeed - right.resolvedSpeed;
               const requiresSeparation = gap < CONTACT_GAP - POSITION_EPSILON;
               const willCrossThisTick =
                    relativeClosingSpeed > MIN_SPEED_EPSILON &&
                    gap - relativeClosingSpeed <= CONTACT_GAP;

               if (!requiresSeparation && !willCrossThisTick) {
                    continue;
               }

               const totalMass = left.mass + right.mass;
               const sharedSpeed =
                    (left.resolvedSpeed * left.mass +
                         right.resolvedSpeed * right.mass) /
                    totalMass;

               if (
                    Math.abs(left.resolvedSpeed - sharedSpeed) > MIN_SPEED_EPSILON ||
                    Math.abs(right.resolvedSpeed - sharedSpeed) > MIN_SPEED_EPSILON
               ) {
                    hasChanges = true;
               }

               left.resolvedSpeed = sharedSpeed;
               right.resolvedSpeed = sharedSpeed;
               left.touchedCollision = true;
               right.touchedCollision = true;

               if (requiresSeparation) {
                    const correction = CONTACT_GAP - gap;
                    left.resolvedPosition -=
                         correction * (right.mass / totalMass);
                    right.resolvedPosition +=
                         correction * (left.mass / totalMass);
                    hasChanges = true;
               }
          }

          if (!hasChanges) {
               break;
          }
     }
}

function applyResolvedTrainState(trainState) {
     const currentScalar = getScalarCoordinate(
          trainState.minecart.location,
          trainState.axis,
     );
     const needsTeleport =
          Math.abs(trainState.resolvedPosition - currentScalar) > POSITION_EPSILON;
     const keepVelocityDuringCorrection =
          trainState.constraintAdjusted && !trainState.touchedCollision;
     const actualScalarSpeed = getActualScalarSpeed(
          trainState.minecart,
          trainState.axis,
     );
     const needsSpeedSync =
          trainState.constraintAdjusted &&
          !trainState.touchedCollision &&
          Math.abs(trainState.resolvedSpeed - actualScalarSpeed) >
               MIN_SPEED_EPSILON;

     if (
          !trainState.touchedCollision &&
          !trainState.constraintAdjusted &&
          !needsTeleport
     ) {
          runtimeStates.set(trainState.id, {
               axis: trainState.axis,
               scalarPosition: currentScalar,
          });
          return;
     }

     if (trainState.touchedCollision) {
          clearMinecartVelocity(trainState.minecart);
     }

     if (needsTeleport) {
          teleportAlongAxis(
               trainState.minecart,
               trainState.axis,
               trainState.resolvedPosition,
               keepVelocityDuringCorrection,
          );
     }

     if (needsSpeedSync) {
          applyAxisImpulse(
               trainState.minecart,
               trainState.axis,
               trainState.resolvedSpeed - actualScalarSpeed,
          );
     }

     if (trainState.touchedCollision) {
          applyAxisImpulse(
               trainState.minecart,
               trainState.axis,
               trainState.resolvedSpeed,
          );
     }

     runtimeStates.set(trainState.id, {
          axis: trainState.axis,
          scalarPosition: trainState.resolvedPosition,
     });
}

export class TrainStraightCollisionManager {
     constructor() {
          this.updateInterval = system.runInterval(() => {
               const hasLinkedConsists = hasActiveTrainConsists();
               const lanes = new Map();
               const activeMinecartIds = new Set();

               for (const minecartId of minecartRegistry.getAll()) {
                    const minecart = getValidMinecartEntity(minecartId);
                    if (!minecart) {
                         runtimeStates.delete(minecartId);
                         continue;
                    }

                    let railDirection = null;
                    try {
                         railDirection = getRailDirectionAtLocation(
                              minecart.location,
                              minecart.dimension ?? getOverworldDimension(),
                         );
                    } catch {
                         runtimeStates.delete(minecartId);
                         continue;
                    }

                    if (!isHorizontalRailDirection(railDirection)) {
                         runtimeStates.delete(minecartId);
                         continue;
                    }

                    const axis = getRailAxis(railDirection);
                    if (!axis) {
                         runtimeStates.delete(minecartId);
                         continue;
                    }

                    const trainState = createTrainState(minecart, axis);
                    activeMinecartIds.add(minecartId);

                    if (!lanes.has(trainState.laneKey)) {
                         lanes.set(trainState.laneKey, []);
                    }

                    lanes.get(trainState.laneKey).push(trainState);
               }

               for (const [minecartId] of runtimeStates) {
                    if (!activeMinecartIds.has(minecartId)) {
                         runtimeStates.delete(minecartId);
                    }
               }

               for (const trains of lanes.values()) {
                    const bodies = hasLinkedConsists
                         ? buildLaneBodies(trains)
                         : trains.map((trainState) =>
                                createSingleTrainBody(trainState)
                           );
                    if (trains.length >= 2 && bodies.length === trains.length) {
                         resolveLaneCollisions(trains);
                         syncBodiesFromResolvedTrainStates(bodies);
                         applyStraightRailBlockGuard(bodies);
                         applyResolvedBodyStates(bodies);
                    } else {
                         if (trains.length >= 2) {
                              resolveBodyCollisions(bodies);
                         }

                         applyStraightRailBlockGuard(bodies);
                         applyResolvedBodyStates(bodies);
                    }

                    trains.forEach((trainState) => {
                         applyResolvedTrainState(trainState);
                    });
               }
          }, UPDATE_INTERVAL);
     }
}
