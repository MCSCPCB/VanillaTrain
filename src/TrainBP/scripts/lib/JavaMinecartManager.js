import { system, world } from "@minecraft/server";

import { minecartRegistry } from "./DataStorage.js";
import { getRailDirectionAtLocation } from "./shared.js";

const DEFAULT_MINECART_TYPE = "minecraft:minecart";
const UPDATE_INTERVAL = 1;
const DISCOVERY_INTERVAL = 10;
const DIMENSION_IDS = ["overworld"]; // "nether", "the_end"
const JAVA_NAME = "java";
const MIN_HORIZONTAL_DELTA = 0.01;
const MIN_VERTICAL_DELTA = 0.001;
const RAIL_SAMPLE_COUNT = 4;
const REFERENCE_TRACK_SPEED = 0.57;
const REFERENCE_HORIZONTAL_RANGE = 5.21;
const REFERENCE_APEX_HEIGHT = 2.25;
const AIRBORNE_GRAVITY = 0.08;
const AIRBORNE_HORIZONTAL_RAIL_ATTACH_HEIGHT = 0.05;
const MAX_SPEED_FACTOR = 2.0;
const MAX_HORIZONTAL_CORRECTION = 1.0;
const MAX_VERTICAL_CORRECTION = 1.0;
const MAX_AIRBORNE_TICKS = 24;

const REFERENCE_VERTICAL_LAUNCH_SPEED = Math.sqrt(
     2 * AIRBORNE_GRAVITY * REFERENCE_APEX_HEIGHT
);
const REFERENCE_AIR_TIME =
     (2 * REFERENCE_VERTICAL_LAUNCH_SPEED) / AIRBORNE_GRAVITY;
const REFERENCE_HORIZONTAL_LAUNCH_SPEED =
     REFERENCE_HORIZONTAL_RANGE / REFERENCE_AIR_TIME;

function cloneLocation(location) {
     return {
          x: location.x,
          y: location.y,
          z: location.z,
     };
}

function stripFormatting(text = "") {
     return `${text}`.replace(/§./g, "");
}

function normalizeMinecartNameTag(nameTag) {
     return stripFormatting(nameTag).trim().toLowerCase();
}

function isJavaMinecart(minecart) {
     return normalizeMinecartNameTag(minecart?.nameTag) === JAVA_NAME;
}

function isSlopeRailDirection(railDirection) {
     return railDirection >= 2 && railDirection <= 5;
}

function isHorizontalRailDirection(railDirection) {
     return railDirection === 0 || railDirection === 1;
}

function getSafeRailDirection(minecart) {
     try {
          const railDirection = getRailDirectionAtLocation(
               minecart.location,
               minecart.dimension
          );
          return Number.isInteger(railDirection) ? railDirection : null;
     } catch {
          return null;
     }
}

function clamp(value, min, max) {
     return Math.min(Math.max(value, min), max);
}

function getHorizontalMagnitude(vector) {
     return Math.hypot(vector.x, vector.z);
}

function getVectorMagnitude(vector) {
     return Math.hypot(vector.x, vector.y, vector.z);
}

function normalizeHorizontalVector(vector) {
     const magnitude = getHorizontalMagnitude(vector);
     if (magnitude <= MIN_HORIZONTAL_DELTA) {
          return null;
     }

     return {
          x: vector.x / magnitude,
          z: vector.z / magnitude,
     };
}

function createRuntimeState(minecart) {
     return {
          lastLocation: cloneLocation(minecart.location),
          wasOnRail: false,
          lastRailDirection: null,
          railMotionSamples: [],
          airborneState: null,
     };
}

function resetAirborneState(runtimeState) {
     runtimeState.airborneState = null;
}

function clearRailMotionSamples(runtimeState) {
     runtimeState.railMotionSamples.length = 0;
}

function pushRailMotionSample(runtimeState, observedDelta) {
     runtimeState.railMotionSamples.push({
          x: observedDelta.x,
          y: observedDelta.y,
          z: observedDelta.z,
     });

     if (runtimeState.railMotionSamples.length > RAIL_SAMPLE_COUNT) {
          runtimeState.railMotionSamples.shift();
     }
}

function getWeightedRailMotionSample(runtimeState, observedDelta) {
     if (!runtimeState.railMotionSamples.length) {
          return {
               x: observedDelta.x,
               y: observedDelta.y,
               z: observedDelta.z,
          };
     }

     let weightedX = 0;
     let weightedY = 0;
     let weightedZ = 0;
     let totalWeight = 0;

     for (let i = 0; i < runtimeState.railMotionSamples.length; i++) {
          const sample = runtimeState.railMotionSamples[i];
          const weight = i + 1;
          weightedX += sample.x * weight;
          weightedY += sample.y * weight;
          weightedZ += sample.z * weight;
          totalWeight += weight;
     }

     return {
          x: weightedX / totalWeight,
          y: weightedY / totalWeight,
          z: weightedZ / totalWeight,
     };
}

function createAirborneState(runtimeState, observedDelta) {
     const launchSample = getWeightedRailMotionSample(runtimeState, observedDelta);
     const launchDirection = normalizeHorizontalVector(launchSample);
     if (!launchDirection) {
          return null;
     }

     const railSpeed = getVectorMagnitude(launchSample);
     if (railSpeed <= MIN_HORIZONTAL_DELTA) {
          return null;
     }

     const speedFactor = clamp(railSpeed / REFERENCE_TRACK_SPEED, 0, MAX_SPEED_FACTOR);
     const horizontalSpeed = REFERENCE_HORIZONTAL_LAUNCH_SPEED * speedFactor;
     const verticalDirection =
          Math.abs(launchSample.y) > MIN_VERTICAL_DELTA
               ? Math.sign(launchSample.y)
               : 1;

     return {
          ticks: 0,
          horizontalVelocity: {
               x: launchDirection.x * horizontalSpeed,
               z: launchDirection.z * horizontalSpeed,
          },
          verticalVelocity:
               REFERENCE_VERTICAL_LAUNCH_SPEED * speedFactor * verticalDirection,
     };
}

function shouldStopAirborneState(runtimeState, observedDelta) {
     if (!runtimeState.airborneState || runtimeState.airborneState.ticks < 2) {
          return false;
     }

     return (
          getHorizontalMagnitude(observedDelta) <= MIN_HORIZONTAL_DELTA &&
          Math.abs(observedDelta.y) <= MIN_VERTICAL_DELTA
     );
}

function applyAirborneTrajectoryCorrection(
     minecart,
     runtimeState,
     observedDelta
) {
     const airborneState = runtimeState.airborneState;
     if (!airborneState) {
          return;
     }

     if (
          airborneState.ticks >= MAX_AIRBORNE_TICKS ||
          shouldStopAirborneState(runtimeState, observedDelta)
     ) {
          resetAirborneState(runtimeState);
          return;
     }

     const desiredVelocity = {
          x: airborneState.horizontalVelocity.x,
          y: airborneState.verticalVelocity,
          z: airborneState.horizontalVelocity.z,
     };
     const correction = {
          x: clamp(
               desiredVelocity.x - observedDelta.x,
               -MAX_HORIZONTAL_CORRECTION,
               MAX_HORIZONTAL_CORRECTION
          ),
          y: clamp(
               desiredVelocity.y - observedDelta.y,
               -MAX_VERTICAL_CORRECTION,
               MAX_VERTICAL_CORRECTION
          ),
          z: clamp(
               desiredVelocity.z - observedDelta.z,
               -MAX_HORIZONTAL_CORRECTION,
               MAX_HORIZONTAL_CORRECTION
          ),
     };

     if (
          getHorizontalMagnitude(correction) > MIN_HORIZONTAL_DELTA ||
          Math.abs(correction.y) > MIN_VERTICAL_DELTA
     ) {
          minecart.applyImpulse({
               x: correction.x,
               y: correction.y,
               z: correction.z,
          });
     }

     airborneState.verticalVelocity -= AIRBORNE_GRAVITY;
     airborneState.ticks += 1;
}

export class JavaMinecartManager {
     constructor() {
          this.runtimeStates = new Map();
          this.activeMinecartIds = new Set();
          this.discoveryCooldown = 0;

          system.runInterval(() => {
               this.update();
          }, UPDATE_INTERVAL);
     }

     updateMinecart(minecart) {
          let runtimeState = this.runtimeStates.get(minecart.id);
          if (!runtimeState) {
               runtimeState = createRuntimeState(minecart);
               this.runtimeStates.set(minecart.id, runtimeState);
          }

          const currentLocation = cloneLocation(minecart.location);
          const observedDelta = {
               x: currentLocation.x - runtimeState.lastLocation.x,
               y: currentLocation.y - runtimeState.lastLocation.y,
               z: currentLocation.z - runtimeState.lastLocation.z,
          };
          const horizontalDelta = Math.hypot(observedDelta.x, observedDelta.z);
          const currentRailDirection = getSafeRailDirection(minecart);
          let isOnRail = currentRailDirection !== null;

          if (
               isOnRail &&
               runtimeState.airborneState &&
               isHorizontalRailDirection(currentRailDirection) &&
               currentLocation.y >
                    Math.floor(currentLocation.y) +
                         AIRBORNE_HORIZONTAL_RAIL_ATTACH_HEIGHT
          ) {
               isOnRail = false;
          }

          if (
               runtimeState.wasOnRail &&
               isSlopeRailDirection(runtimeState.lastRailDirection) &&
               !isOnRail &&
               horizontalDelta > MIN_HORIZONTAL_DELTA
          ) {
               runtimeState.airborneState = createAirborneState(
                    runtimeState,
                    observedDelta
               );
          }

          if (!isOnRail && runtimeState.airborneState) {
               applyAirborneTrajectoryCorrection(
                    minecart,
                    runtimeState,
                    observedDelta
               );
          } else if (isOnRail) {
               resetAirborneState(runtimeState);
          }

          if (isOnRail && isSlopeRailDirection(currentRailDirection)) {
               if (horizontalDelta > MIN_HORIZONTAL_DELTA) {
                    pushRailMotionSample(runtimeState, observedDelta);
               } else {
                    clearRailMotionSamples(runtimeState);
               }
          } else {
               clearRailMotionSamples(runtimeState);
          }

          runtimeState.lastLocation = currentLocation;
          runtimeState.wasOnRail = isOnRail;
          runtimeState.lastRailDirection = currentRailDirection;
     }

     discoverJavaMinecarts() {
          const discoveredMinecartIds = new Set();

          for (const dimensionId of DIMENSION_IDS) {
               const dimension = world.getDimension(dimensionId);
               const minecarts = dimension.getEntities({
                    type: DEFAULT_MINECART_TYPE,
               });

               for (const minecart of minecarts) {
                    if (
                         !minecart?.isValid() ||
                         minecart.typeId !== DEFAULT_MINECART_TYPE ||
                         minecartRegistry.has(minecart.id) ||
                         !isJavaMinecart(minecart)
                    ) {
                         continue;
                    }

                    discoveredMinecartIds.add(minecart.id);
               }
          }

          this.activeMinecartIds = discoveredMinecartIds;

          for (const [minecartId] of this.runtimeStates) {
               if (!discoveredMinecartIds.has(minecartId)) {
                    this.runtimeStates.delete(minecartId);
               }
          }
     }

     update() {
          if (this.discoveryCooldown <= 0) {
               this.discoverJavaMinecarts();
               this.discoveryCooldown = DISCOVERY_INTERVAL;
          } else {
               this.discoveryCooldown -= 1;
          }

          for (const minecartId of [...this.activeMinecartIds]) {
               const minecart = world.getEntity(minecartId);
               if (
                    !minecart?.isValid() ||
                    minecart.typeId !== DEFAULT_MINECART_TYPE ||
                    minecartRegistry.has(minecartId) ||
                    !isJavaMinecart(minecart)
               ) {
                    this.activeMinecartIds.delete(minecartId);
                    this.runtimeStates.delete(minecartId);
                    continue;
               }

               this.updateMinecart(minecart);
          }
     }
}
