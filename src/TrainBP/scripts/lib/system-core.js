import { system, world } from "@minecraft/server";

import { activePlayerSeats, loadTrainData, minecartRegistry } from "./DataStorage";
import {
     findFirstTrainSurface,
     findRegisteredMinecartTag,
     getOverworldDimension,
     hasSolidBlockBelowFeet,
} from "./shared.js";
import {
     createTrainSurfaceResolverCache,
     resolveTrainSurfaceAtLocation,
} from "./TrainSurfaceResolver.js";

const INPUT_PERMISSION_CATEGORY = 2;
const TEMP_SEAT_TYPE = "train:temp_seat";
const PLAYER_OFFSET_ANIMATION = "animation.player_train_offset";
const PLAYER_MOVE_ANIMATION = "animation.player_train_move";
const OFFSET_ANIMATION_BLEND_OUT = 999999999999999;
const MOVE_ANIMATION_STOP_EXPRESSION =
     "!query.is_riding_any_entity_of_type('train:temp_seat')";
const MOVEMENT_THRESHOLD = 0.5;
const MOVE_SPEED = 0.25;
const GROUND_SEAT_OFFSET = 1.0;
const JUMP_INITIAL_VELOCITY = 0.42;
const JUMP_GRAVITY = 0.08;
const FALL_GRAVITY_MULTIPLIER = 1.35;
const JUMP_CUT_VELOCITY = 0.2;
const MAX_FALL_SPEED = 1.5;
const MAX_VERTICAL_IMPULSE = 1.25;
const HORIZONTAL_MOTION_EPSILON = 0.001;
const UNBIND_VERTICAL_SPEED_EPSILON = 0.05;
const GROUND_CONTACT_EPSILON = 0.02;
const RISE_STALL_THRESHOLD = 0.005;
const RISE_STALL_FRAMES = 2;
const RAIL_ATTACH_EJECT_DELAY_MS = 1000;
const RAIL_ATTACH_RANGE = 1.5;
const SEAT_CENTER_RANGE = 0.92;
const FLOOR_QUERY_RANGE = 2.5;
const FLOOR_HORIZONTAL_RANGE = 0.55;
const FLOOR_ABOVE_TOLERANCE = 0.25;
const FLOOR_MISS_GRACE_TICKS = 2;
const FLOOR_ENTITY_QUERY_RADIUS = FLOOR_QUERY_RANGE + 0.25;
const FLOOR_SAMPLE_OFFSETS = [
     { x: 0, z: 0 },
     { x: 0.25, z: 0 },
     { x: -0.25, z: 0 },
     { x: 0, z: 0.25 },
     { x: 0, z: -0.25 },
];
const FLOOR_SUPPORT_OPTIONS = Object.freeze({
     maxDistanceBelow: FLOOR_QUERY_RANGE,
     maxDistanceAbove: FLOOR_ABOVE_TOLERANCE,
});
const RELEASE_SUPPORT_OPTIONS = Object.freeze({
     maxDistanceBelow: 8,
     maxDistanceAbove: FLOOR_ABOVE_TOLERANCE,
});
const RELEASE_GRAVITY_DELAY_TICKS = 6;
const activeBindingControllers = new Map();
const activeMoveAnimationPlayers = new Set();

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
     activeBindingControllers.delete(playerId);
     activeMoveAnimationPlayers.delete(playerId);
});

function setPlayerInputEnabled(player, enabled) {
     try {
          player.inputPermissions.setPermissionCategory(
               INPUT_PERMISSION_CATEGORY,
               enabled
          );
     } catch {}
}

// 把输入状态映射成局部方向，再按玩家朝向换算成世界坐标
const MOVEMENT_STATE_TO_VECTOR = new Map([
     ["Forward", { x: 0, z: 1 }],
     ["Backward", { x: 0, z: -1 }],
     ["Left", { x: -1, z: 0 }],
     ["Right", { x: 1, z: 0 }],
     ["Forward-left", { x: 0.707, z: 0.707 }],
     ["Forward-right", { x: -0.707, z: 0.707 }],
     ["Backward-left", { x: 0.707, z: -0.707 }],
     ["Backward-right", { x: -0.707, z: -0.707 }],
]);

// 把原始摇杆输入归一化成固定状态，避免细小抖动反复触发移动
function getPlayerControlMovement(player) {
     const movement = player.inputInfo.getMovementVector();
     const normalizedX =
          Math.abs(movement.x) >= MOVEMENT_THRESHOLD
               ? movement.x > 0
                    ? 1
                    : -1
               : 0;
     const normalizedY =
          Math.abs(movement.y) >= MOVEMENT_THRESHOLD
               ? movement.y > 0
                    ? 1
                    : -1
               : 0;

     if (normalizedX === 0 && normalizedY === 1) return "Forward";
     if (normalizedX === 0 && normalizedY === -1) return "Backward";
     if (normalizedX === 1 && normalizedY === 0) return "Left";
     if (normalizedX === -1 && normalizedY === 0) return "Right";
     if (normalizedX === 1 && normalizedY === 1) return "Forward-left";
     if (normalizedX === -1 && normalizedY === 1) return "Forward-right";
     if (normalizedX === 1 && normalizedY === -1) return "Backward-left";
     if (normalizedX === -1 && normalizedY === -1) return "Backward-right";
     if (normalizedX === 0 && normalizedY === 0) return "None";

     return "Unknown";
}

function startPlayerMoveAnimation(player) {
     if (!player || activeMoveAnimationPlayers.has(player.id)) {
          return;
     }

     player.playAnimation(PLAYER_MOVE_ANIMATION, {
          stopExpression: MOVE_ANIMATION_STOP_EXPRESSION,
     });
     activeMoveAnimationPlayers.add(player.id);
}

function stopPlayerMoveAnimation(player) {
     if (!player || !activeMoveAnimationPlayers.has(player.id)) {
          return;
     }

     activeMoveAnimationPlayers.delete(player.id);
     player.playAnimation(PLAYER_OFFSET_ANIMATION, {
          blendOutTime: OFFSET_ANIMATION_BLEND_OUT,
     });
}

function syncPlayerMoveAnimation(player, shouldPlay) {
     if (shouldPlay) {
          startPlayerMoveAnimation(player);
          return;
     }

     stopPlayerMoveAnimation(player);
}

// 把玩家视角下的前后左右换成世界坐标，并驱动隐藏座位同步移动
function applyDirectionalMovement(player, playerSeat, movementState) {
     const inputVector = MOVEMENT_STATE_TO_VECTOR.get(movementState);
     if (!inputVector) {
          return;
     }

     const yaw = (player.getRotation().y * Math.PI) / 180;
     const cosYaw = Math.cos(yaw);
     const sinYaw = Math.sin(yaw);
     const worldVector = {
          x: -(inputVector.x * cosYaw + inputVector.z * sinYaw),
          z: -inputVector.x * sinYaw + inputVector.z * cosYaw,
     };

     playerSeat.applyImpulse({
          x: worldVector.x * MOVE_SPEED,
          y: 0,
          z: worldVector.z * MOVE_SPEED,
     });

     return worldVector;
}

function clamp(value, min, max) {
     return Math.min(Math.max(value, min), max);
}

function getSign(value) {
     return value / Math.abs(value);
}

function cloneLocation(location) {
     return {
          x: location.x,
          y: location.y,
          z: location.z,
     };
}

function getHorizontalLength(vector) {
     return Math.hypot(vector.x, vector.z);
}

function hasHorizontalMotion(vector, epsilon = HORIZONTAL_MOTION_EPSILON) {
     return Math.abs(vector.x) > epsilon || Math.abs(vector.z) > epsilon;
}

function resolveEntityTransportVelocity(actualVelocity, observedVelocity) {
     if (
          getHorizontalLength(observedVelocity) >
          getHorizontalLength(actualVelocity) + 0.005
     ) {
          return {
               x: observedVelocity.x,
               y: actualVelocity.y,
               z: observedVelocity.z,
          };
     }

     return actualVelocity;
}

function getTrackedEntity(entity) {
     const ridingComponent = entity.getComponent("minecraft:riding");
     return ridingComponent?.entityRidingOn ?? entity;
}

function getTrainSurfaceFloorY(entity) {
     if (!entity?.isValid()) {
          return null;
     }

     if (entity.typeId === "minecraft:minecart") {
          const minecartTag = findRegisteredMinecartTag(entity);
          return minecartTag && minecartRegistry.has(minecartTag)
               ? entity.location.y
               : null;
     }

     if (entity.typeId === "train:entity_block") {
          const minecartTag = findRegisteredMinecartTag(entity);
          return minecartTag && minecartRegistry.has(minecartTag)
               ? entity.location.y
               : null;
     }

     return null;
}

function getTrackedSurfaceEntries(entity) {
     if (!entity?.isValid()) {
          return [];
     }

     const minecartId =
          entity.typeId === "minecraft:minecart"
               ? entity.id
               : findRegisteredMinecartTag(entity);
     if (!minecartId) {
          return [];
     }

     const trainData = loadTrainData(minecartId);
     return Array.isArray(trainData?.entities) ? trainData.entities : [];
}

function getResolvedFloorSurfaceInfo(
     entity,
     playerSeat,
     surfaceEntries,
     supportOptions = FLOOR_SUPPORT_OPTIONS,
     surfaceCache = null
) {
     if (!entity?.isValid() || !Array.isArray(surfaceEntries) || !surfaceEntries.length) {
          return null;
     }

     let bestCandidate = null;

     for (const offset of FLOOR_SAMPLE_OFFSETS) {
          const probeLocation = {
               x: playerSeat.location.x + offset.x,
               y: playerSeat.location.y,
               z: playerSeat.location.z + offset.z,
          };
          const candidate = resolveTrainSurfaceAtLocation(
               entity,
               surfaceEntries,
               probeLocation,
               {
                    ...supportOptions,
                    surfaceCache,
               }
          );
          if (!candidate) {
               continue;
          }

          const surfaceEntityId = candidate.entry?.entityId;
          const surfaceEntity = surfaceEntityId
               ? world.getEntity(surfaceEntityId)
               : null;

          const normalizedCandidate = {
               entity: surfaceEntity?.isValid() ? surfaceEntity : entity,
               floorY: candidate.surfaceY - GROUND_SEAT_OFFSET,
               support: candidate,
          };

          if (
               !bestCandidate ||
               normalizedCandidate.floorY > bestCandidate.floorY ||
               (normalizedCandidate.floorY === bestCandidate.floorY &&
                    candidate.verticalGap < bestCandidate.support.verticalGap)
          ) {
               bestCandidate = normalizedCandidate;
          }
     }

     return bestCandidate;
}

function getExtendedFloorSurfaceInfo(
     entity,
     playerSeat,
     surfaceEntries = getTrackedSurfaceEntries(entity),
     surfaceCache = null
) {
     return getResolvedFloorSurfaceInfo(
          entity,
          playerSeat,
          surfaceEntries,
          RELEASE_SUPPORT_OPTIONS,
          surfaceCache
     );
}

// 用固定探点取脚下最高有效表面，优先按列车槽位解析，缺省时再退回附近实体扫描
function getNearbyEntityFloorSurfaceInfo(
     playerSeat,
     dimension = getOverworldDimension()
) {
     const candidates = new Map();
     const nearbyEntities = dimension.getEntities({
          location: {
               x: playerSeat.location.x,
               y: playerSeat.location.y - GROUND_SEAT_OFFSET,
               z: playerSeat.location.z,
          },
          maxDistance: FLOOR_ENTITY_QUERY_RADIUS,
          minDistance: 0,
     });

     for (const entity of nearbyEntities) {
          const floorY = getTrainSurfaceFloorY(entity);
          if (floorY === null) {
               continue;
          }

          if (floorY > playerSeat.location.y + FLOOR_ABOVE_TOLERANCE) {
               continue;
          }

          const matchesProbe = FLOOR_SAMPLE_OFFSETS.some((offset) => {
               return (
                    Math.abs(
                         entity.location.x - (playerSeat.location.x + offset.x)
                    ) <= FLOOR_HORIZONTAL_RANGE &&
                    Math.abs(
                         entity.location.z - (playerSeat.location.z + offset.z)
                    ) <= FLOOR_HORIZONTAL_RANGE
               );
          });

          if (!matchesProbe) {
               continue;
          }

          const current = candidates.get(entity.id);
          if (!current || floorY > current.floorY) {
               candidates.set(entity.id, { entity, floorY });
          }
     }

     let bestCandidate = null;

     for (const candidate of candidates.values()) {
          if (!bestCandidate || candidate.floorY > bestCandidate.floorY) {
               bestCandidate = candidate;
          }
     }

     return bestCandidate;
}

function getFloorSurfaceInfo(
     entity,
     playerSeat,
     surfaceEntries = getTrackedSurfaceEntries(entity),
     surfaceCache = null,
     dimension = getOverworldDimension()
) {
     const resolvedFloor = getResolvedFloorSurfaceInfo(
          entity,
          playerSeat,
          surfaceEntries,
          FLOOR_SUPPORT_OPTIONS,
          surfaceCache
     );

     return resolvedFloor ?? getNearbyEntityFloorSurfaceInfo(playerSeat, dimension);
}

// 找到座位正下方最近的实体块，供过弯和上坡时临时附着
function getNearestBelowEntityBlock(
     playerSeat,
     dimension = getOverworldDimension()
) {
     const nearbyEntities = dimension.getEntities({
          location: playerSeat.location,
          maxDistance: RAIL_ATTACH_RANGE,
          minDistance: 0,
          type: "train:entity_block",
     });
     const belowBlocks = Array.from(nearbyEntities).filter(
          (block) => block.location.y < playerSeat.location.y
     );

     belowBlocks.sort((left, right) => right.location.y - left.location.y);
     return belowBlocks[0];
}

function ejectSeatFromAttachedBlock(playerSeat) {
     const nearbyBlockId = playerSeat.getDynamicProperty("nearbyBlockId");
     const nearbyBlock =
          nearbyBlockId && world.getEntity(nearbyBlockId)?.isValid()
               ? world.getEntity(nearbyBlockId)
               : null;

     if (nearbyBlock) {
          try {
               if (nearbyBlock.hasComponent("minecraft:rideable")) {
                    nearbyBlock
                         .getComponent("minecraft:rideable")
                         .ejectRider(playerSeat);
               }
          } catch (error) {
               console.error("脱离失败:", error);
          }
     }

     activePlayerSeats.delete(playerSeat.id);
     playerSeat.setDynamicProperty("nearbyBlockId", null);
}

function cleanupSeatEntity(seatEntity) {
     if (!seatEntity?.isValid()) {
          return false;
     }

     try {
          ejectSeatFromAttachedBlock(seatEntity);
     } catch {}

     try {
          seatEntity.getComponent("minecraft:rideable")?.ejectRiders();
     } catch {}

     try {
          seatEntity.remove();
          return true;
     } catch {}

     return false;
}

function clearPlayerSeatBinding(player, seatId = null) {
     if (!player) {
          return;
     }

     stopPlayerMoveAnimation(player);

     const stopToken = player.getDynamicProperty("stop");
     if (stopToken !== undefined && stopToken !== null) {
          system.clearRun(stopToken);
     }
     activeBindingControllers.delete(player.id);

     const resolvedSeatId = seatId ?? player.getDynamicProperty("entityRemove");
     player.setDynamicProperty("stop", undefined);
     player.setDynamicProperty("entityRemove", undefined);

     if (resolvedSeatId) {
          const seatEntity = world.getEntity(resolvedSeatId);
          if (!cleanupSeatEntity(seatEntity)) {
               activePlayerSeats.delete(resolvedSeatId);
          }
     }

     setPlayerInputEnabled(player, true);
}

function resolveControllerMinecartId(controller) {
     if (!controller?.entity) {
          return null;
     }

     if (controller.entity.id && minecartRegistry.has(controller.entity.id)) {
          return controller.entity.id;
     }

     const trackedEntity = getTrackedEntity(controller.entity);
     if (!trackedEntity?.isValid()) {
          return controller.entity.id ?? null;
     }

     if (
          trackedEntity.typeId === "minecraft:minecart" &&
          minecartRegistry.has(trackedEntity.id)
     ) {
          return trackedEntity.id;
     }

     return findRegisteredMinecartTag(trackedEntity) ?? controller.entity.id ?? null;
}

export class EntityWithPlayer {
     constructor(entity, player) {
          this.entity = entity;
          this.player = player;
          this.pendingRetarget = false;
     }

     retarget(minecart) {
          if (!minecart?.isValid()) {
               return false;
          }

          this.entity = minecart;
          this.pendingRetarget = true;
          return true;
     }

     movePlayer(interval) {
          // 跟车通过隐藏座位实现，玩家实际骑乘的是这个座位实体
          const overworld = getOverworldDimension();
          const playerSeat = this.player.dimension.spawnEntity(
               TEMP_SEAT_TYPE,
               this.player.location
          );
          playerSeat.getComponent("minecraft:rideable").addRider(this.player);
          setPlayerInputEnabled(this.player, false);

          let lastJumpState = "Released";
          let verticalState = "grounded";
          let floor = getTrainSurfaceFloorY(this.entity) ?? this.entity.location.y;
          let verticalOffset = 0;
          let verticalVelocity = 0;
          let airborneSeatY = floor + GROUND_SEAT_OFFSET;
          let riseStallFrames = 0;
          let missingFloorTicks = 0;
          let safeJump = true;
          let nearbyBlock = null;
          let hasConnected = false;
          let lastNonZeroVelocityTime = 0;
          let shouldEject = false;
          let seatReleased = false;
          let lastEntityLocation = cloneLocation(this.entity.location);

          const initialFloorInfo = getFloorSurfaceInfo(this.entity, playerSeat);
          if (initialFloorInfo) {
               floor = initialFloorInfo.floorY;
          }
          airborneSeatY = floor + GROUND_SEAT_OFFSET;

          playerSeat.teleport(
               {
                    x: playerSeat.location.x,
                    y: airborneSeatY,
                    z: playerSeat.location.z,
               },
               {
                    dimension: overworld,
                    checkForBlocks: false,
                    rotation: this.entity.getRotation(),
               }
          );

          let lastSeatY = playerSeat.location.y;

          // 主循环统一处理跟车、水平移动、跳跃和附着逻辑
          const playerMove = system.runInterval(() => {
               const entity = getTrackedEntity(this.entity);
               const player = this.player;

               if (!entity.isValid() || !playerSeat.isValid()) {
                    clearPlayerSeatBinding(player, playerSeat.id);
                    return;
               }

               const seatStartY = playerSeat.location.y;
               const actualSeatRise = seatStartY - lastSeatY;
               const currentJumpState =
                    player.inputInfo.getButtonState("Jump");
               const wasMoveAnimationPlaying = activeMoveAnimationPlayers.has(
                    player.id
               );

               if (seatReleased) {
                    lastJumpState = currentJumpState;
                    lastSeatY = seatStartY;
                    lastEntityLocation = cloneLocation(entity.location);
                    return;
               }

               if (this.pendingRetarget) {
                    ejectSeatFromAttachedBlock(playerSeat);
                    nearbyBlock = null;
                    hasConnected = false;
                    shouldEject = false;
                    lastNonZeroVelocityTime = 0;
                    safeJump = true;
                    floor = getTrainSurfaceFloorY(entity) ?? entity.location.y;
                    const retargetFloorInfo = getFloorSurfaceInfo(entity, playerSeat);
                    if (retargetFloorInfo) {
                         floor = retargetFloorInfo.floorY;
                    }
                    airborneSeatY = floor + GROUND_SEAT_OFFSET;
                    verticalOffset = 0;
                    verticalVelocity = 0;
                    verticalState = "grounded";
                    lastEntityLocation = cloneLocation(entity.location);
                    this.pendingRetarget = false;
               }

               // 每刻先清掉上一刻残留速度，再按列车状态和玩家输入重新计算
               playerSeat.clearVelocity();

               const observedVelocity = {
                    x: entity.location.x - lastEntityLocation.x,
                    y: entity.location.y - lastEntityLocation.y,
                    z: entity.location.z - lastEntityLocation.z,
               };
               const velocity = resolveEntityTransportVelocity(
                    entity.getVelocity(),
                    observedVelocity
               );
               const movingState = getPlayerControlMovement(player);
               const isJumpPressed = currentJumpState === "Pressed";
               const hasMovementInput =
                    movingState !== "None" && movingState !== "Unknown";
               let currentWorldVector = null;
               const hasXMotion = Math.abs(velocity.x) > HORIZONTAL_MOTION_EPSILON;
               const hasZMotion = Math.abs(velocity.z) > HORIZONTAL_MOTION_EPSILON;
               const isMovingHorizontally = hasXMotion || hasZMotion;
               let railDirection = null;
               if (isMovingHorizontally) {
                    railDirection = overworld
                         .getBlock({
                              x: entity.location.x,
                              y: entity.location.y,
                              z: entity.location.z,
                         })
                         .permutation.getState("rail_direction");
               }
               const isTurningOrSloped =
                    isMovingHorizontally &&
                    ((hasXMotion && hasZMotion) ||
                         (railDirection >= 6 && railDirection <= 9));
               const trackedSurfaceEntries = getTrackedSurfaceEntries(entity);
               const surfaceCache = createTrainSurfaceResolverCache(
                    entity,
                    trackedSurfaceEntries
               );

               let playerSeatCenter = null;
               safeJump = true;

               if (
                    !isTurningOrSloped &&
                    isMovingHorizontally &&
                    (isJumpPressed || hasMovementInput)
               ) {
                    playerSeatCenter = findFirstTrainSurface(
                         overworld.getEntities({
                              location: {
                                   x: playerSeat.location.x,
                                   y: playerSeat.location.y,
                                   z: playerSeat.location.z,
                              },
                              maxDistance: SEAT_CENTER_RANGE,
                              minDistance: 0,
                         })
                    );
                    safeJump = !playerSeatCenter;
               }

               const floorInfo = getFloorSurfaceInfo(
                    entity,
                    playerSeat,
                    trackedSurfaceEntries,
                    surfaceCache,
                    overworld
               );
               const retainedSupportInfo =
                    floorInfo ??
                    getExtendedFloorSurfaceInfo(
                         entity,
                         playerSeat,
                         trackedSurfaceEntries,
                         surfaceCache
                    );
               if (floorInfo) {
                    floor = floorInfo.floorY;
                    missingFloorTicks = 0;
               } else {
                    missingFloorTicks++;
               }
               const isJump =
                    isJumpPressed && lastJumpState !== "Pressed";
               const shouldPreserveMoveAnimation =
                    wasMoveAnimationPlaying &&
                    (isJump || verticalState !== "grounded");
               syncPlayerMoveAnimation(
                    player,
                    hasMovementInput || shouldPreserveMoveAnimation
               );

               if (
                    !retainedSupportInfo &&
                    missingFloorTicks > RELEASE_GRAVITY_DELAY_TICKS &&
                    verticalState !== "rising"
               ) {
                    ejectSeatFromAttachedBlock(playerSeat);
                    hasConnected = false;
                    shouldEject = false;
                    lastNonZeroVelocityTime = 0;
                    seatReleased = true;
                    playerSeat.triggerEvent("train:release");
                    playerSeat.applyImpulse({
                         x: velocity.x,
                         y: 0,
                         z: velocity.z,
                    });
                    lastJumpState = currentJumpState;
                    lastSeatY = seatStartY;
                    lastEntityLocation = cloneLocation(entity.location);
                    return;
               }

               currentWorldVector = applyDirectionalMovement(
                    player,
                    playerSeat,
                    movingState
               );
               let targetSeatY = floor + GROUND_SEAT_OFFSET;

               // 纵向运动使用显式状态机，便于区分站立、起跳和下落
               if (verticalState === "grounded") {
                    verticalOffset = 0;
                    verticalVelocity = 0;
                    airborneSeatY = floor + GROUND_SEAT_OFFSET;
                    targetSeatY = airborneSeatY;

                    if (isJump && safeJump && floorInfo) {
                         verticalState = "rising";
                         verticalVelocity = JUMP_INITIAL_VELOCITY;
                         airborneSeatY += verticalVelocity;
                         verticalOffset = verticalVelocity;
                         targetSeatY = airborneSeatY;
                    } else if (
                         !floorInfo &&
                         missingFloorTicks > FLOOR_MISS_GRACE_TICKS
                    ) {
                         verticalState = "falling";
                         airborneSeatY = playerSeat.location.y;
                         targetSeatY = airborneSeatY;
                    }
               } else {
                    const currentGroundSeatY = floor + GROUND_SEAT_OFFSET;

                    if (
                         verticalState === "rising" &&
                         !isJumpPressed &&
                         verticalVelocity > JUMP_CUT_VELOCITY
                    ) {
                         verticalVelocity = JUMP_CUT_VELOCITY;
                    }

                    if (
                         verticalState === "rising" &&
                         airborneSeatY - currentGroundSeatY >
                              GROUND_CONTACT_EPSILON
                    ) {
                         if (actualSeatRise <= RISE_STALL_THRESHOLD) {
                              riseStallFrames++;
                         } else {
                              riseStallFrames = 0;
                         }

                         if (riseStallFrames >= RISE_STALL_FRAMES) {
                              verticalVelocity = 0;
                              verticalState = "falling";
                              riseStallFrames = 0;
                         }
                    } else {
                         riseStallFrames = 0;
                    }

                    airborneSeatY += verticalVelocity;

                    const gravity =
                         verticalVelocity > 0
                              ? JUMP_GRAVITY
                              : JUMP_GRAVITY * FALL_GRAVITY_MULTIPLIER;
                    verticalVelocity = Math.max(
                         verticalVelocity - gravity,
                         -MAX_FALL_SPEED
                    );

                    if (verticalVelocity <= 0) {
                         verticalState = "falling";
                    }

                    if (
                         floorInfo &&
                         verticalVelocity <= 0 &&
                         airborneSeatY <=
                              currentGroundSeatY + GROUND_CONTACT_EPSILON
                    ) {
                         airborneSeatY = currentGroundSeatY;
                          verticalOffset = 0;
                          verticalVelocity = 0;
                          verticalState = "grounded";
                          targetSeatY = airborneSeatY;
                     } else {
                          verticalOffset = Math.max(
                               airborneSeatY - currentGroundSeatY,
                              0
                         );
                         targetSeatY = airborneSeatY;
                    }
               }

               const verticalImpulse = clamp(
                    targetSeatY - playerSeat.location.y,
                    -MAX_VERTICAL_IMPULSE,
                    MAX_VERTICAL_IMPULSE
               );

               playerSeat.applyImpulse({
                    x: velocity.x,
                    y: verticalImpulse,
                    z: velocity.z,
               });

               // 列车上坡时直接把座位对齐到目标高度，保持座位与坡面贴合
               if (
                    verticalState === "grounded" &&
                    playerSeat.getVelocity().y > 0 &&
                    velocity.y > 0
               ) {
                    nearbyBlock = getNearestBelowEntityBlock(
                         playerSeat,
                         overworld
                    ) || entity;

                    playerSeat.teleport(
                         {
                              x: nearbyBlock.location.x,
                              y: targetSeatY,
                              z: nearbyBlock.location.z,
                         },
                         {
                              dimension: overworld,
                              checkForBlocks: false,
                              keepVelocity: true,
                              rotation: entity.getRotation(),
                         }
                    );
               }

               // 过弯或斜向移动时，把座位临时挂到附近实体块上，减少急转抖动
               if (isTurningOrSloped) {
                    lastNonZeroVelocityTime = 0;
                    shouldEject = false;
                    nearbyBlock = getNearestBelowEntityBlock(
                         playerSeat,
                         overworld
                    );

                    if (!hasConnected && nearbyBlock) {
                         try {
                              if (
                                   nearbyBlock.hasComponent(
                                        "minecraft:rideable"
                                   )
                              ) {
                                   nearbyBlock
                                        .getComponent("minecraft:rideable")
                                        .addRider(playerSeat);
                                   playerSeat.setDynamicProperty(
                                        "nearbyBlockId",
                                        nearbyBlock.id
                                   );
                                   activePlayerSeats.set(
                                        playerSeat.id,
                                        nearbyBlock.id
                                   );
                                   hasConnected = true;
                              }
                         } catch (error) {
                              console.error("连接失败:", error);
                         }
                    }
               } else if (isMovingHorizontally) {
                    // 直线行驶时按延迟规则解除附着，并限制玩家逆着车头方向走出车外
                    if (lastNonZeroVelocityTime === 0) {
                         lastNonZeroVelocityTime = Date.now();
                    }

                    if (
                         Date.now() - lastNonZeroVelocityTime >=
                              RAIL_ATTACH_EJECT_DELAY_MS &&
                         hasConnected
                    ) {
                         shouldEject = true;
                    }

                    if (shouldEject) {
                         ejectSeatFromAttachedBlock(playerSeat);
                         shouldEject = false;
                         lastNonZeroVelocityTime = 0;
                         hasConnected = false;
                    }

                    if (playerSeatCenter) {
                         if (currentWorldVector) {
                              if (hasXMotion && !hasZMotion) {
                                   if (
                                         getSign(currentWorldVector.x) !==
                                         getSign(velocity.x)
                                   ) {
                                        playerSeat.applyImpulse({
                                             x:
                                                  -currentWorldVector.x *
                                                  MOVE_SPEED,
                                             y: 0,
                                             z: 0,
                                        });
                                   }
                              } else if (hasZMotion && !hasXMotion) {
                                   if (
                                         getSign(currentWorldVector.z) !==
                                         getSign(velocity.z)
                                   ) {
                                        playerSeat.applyImpulse({
                                             x: 0,
                                             y: 0,
                                             z:
                                                  -currentWorldVector.z *
                                                  MOVE_SPEED,
                                        });
                                   }
                              }
                         }
                    }
               } else {
                    if (
                         hasConnected &&
                         verticalState === "grounded" &&
                         floorInfo
                    ) {
                         ejectSeatFromAttachedBlock(playerSeat);
                         nearbyBlock = null;
                         hasConnected = false;
                    }

                    lastNonZeroVelocityTime = 0;
                    shouldEject = false;
               }

               lastJumpState = currentJumpState;
               lastSeatY = seatStartY;
               lastEntityLocation = cloneLocation(entity.location);
          }, interval);

          // 把循环 id 和座位实体 id 记录到玩家身上，解绑时可直接读取
          activeBindingControllers.set(this.player.id, this);
          this.player.setDynamicProperty("stop", playerMove);
          this.player.setDynamicProperty("entityRemove", playerSeat.id);
     }
}

export function retargetPlayerBinding(player, minecart) {
     const controller = activeBindingControllers.get(player?.id);
     return controller ? controller.retarget(minecart) : false;
}

export function cleanupMinecartPlayerBindings(minecartId) {
     if (!minecartId) {
          return;
     }

     for (const controller of Array.from(activeBindingControllers.values())) {
          const boundMinecartId = resolveControllerMinecartId(controller);
          if (boundMinecartId !== minecartId) {
               continue;
          }

          clearPlayerSeatBinding(controller.player);
     }
}

export class EntityWithPlayerStop {
     constructor(player) {
          this.player = player;
     }

     stopPlayerMoving() {
          // 解绑时先停止循环，再等待玩家落稳后移除隐藏座位
          stopPlayerMoveAnimation(this.player);
          system.clearRun(this.player.getDynamicProperty("stop"));
          activeBindingControllers.delete(this.player.id);

          const entityId = this.player.getDynamicProperty("entityRemove");

          this.player.setDynamicProperty("stop", undefined);
          this.player.setDynamicProperty("entityRemove", undefined);

          if (entityId && world.getEntity(entityId)?.isValid()) {
               const checkInterval = system.runInterval(() => {
                    const velocity = this.player.getVelocity();

                    if (
                         velocity.y === 0 ||
                         (Math.abs(velocity.y) <=
                              UNBIND_VERTICAL_SPEED_EPSILON &&
                              hasSolidBlockBelowFeet(this.player))
                    ) {
                         system.clearRun(checkInterval);
                        const entity = world.getEntity(entityId);

                        // 如果这个座位还挂在某个实体块上，也一并解除占用记录
                        cleanupSeatEntity(entity);

                        // 恢复输入权限，让玩家回到普通控制状态
                        setPlayerInputEnabled(this.player, true);
                   }
               }, 20);
          } else {
               setPlayerInputEnabled(this.player, true);
          }
     }
}
