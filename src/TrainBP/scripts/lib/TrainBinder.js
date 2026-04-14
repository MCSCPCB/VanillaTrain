import * as mc from "@minecraft/server";

import { loadTrainData, minecartRegistry } from "./DataStorage";
import {
     EntityWithPlayer,
     EntityWithPlayerStop,
     retargetPlayerBinding,
} from "./system-core";
import { hasTrainSupportAtLocation } from "./TrainSurfaceResolver.js";
import { findRegisteredMinecartTag, hasSolidBlockBelowFeet } from "./shared.js";

const CHECK_INTERVAL = 1;
const MINECART_DISCOVERY_INTERVAL = 5;
const INITIAL_SCAN_DELAY = 100;
const DEFAULT_PRIMARY_RADIUS = 16.0;
const DEFAULT_SECONDARY_RADIUS = 16.0;
const DEFAULT_SECONDARY_RADIUS_Y = 16.0;
const DIRECT_SURFACE_RANGE = 0.6;
const ENTER_STABLE_TICKS = 4;
const SWITCH_STABLE_TICKS = 3;
const LEAVE_STABLE_TICKS = 4;
const MAX_BIND_VERTICAL_SPEED = 0.12;
const BINDER_SUPPORT_OPTIONS = Object.freeze({
     maxDistanceBelow: 1.5,
     maxDistanceAbove: 0.35,
});

function getTrackedTrainRadii(trainId) {
     const radii = loadTrainData(trainId)?.radii;

     return {
          primary: radii?.primary || DEFAULT_PRIMARY_RADIUS,
          secondary: radii?.secondary || DEFAULT_SECONDARY_RADIUS,
          secondaryY: radii?.secondaryY || DEFAULT_SECONDARY_RADIUS_Y,
     };
}

function getTrackedSurfaceEntries(trainId) {
     const trainData = loadTrainData(trainId);
     return Array.isArray(trainData?.entities) ? trainData.entities : [];
}

function resolveSurfaceMinecartId(entity) {
     if (!entity?.isValid()) {
          return null;
     }

     if (entity.typeId === "minecraft:minecart" && minecartRegistry.has(entity.id)) {
          return entity.id;
     }

     if (entity.typeId === "train:entity_block") {
          return findRegisteredMinecartTag(entity) ?? null;
     }

     return null;
}

// 自动绑定器负责判断玩家是否站在列车上，并决定何时启动或停止跟车系统
export class AutoBinder {
     constructor(targetMinecart, targetPlayer) {
          this.minecart = targetMinecart;
          this.player = targetPlayer;
          this.trackedMinecarts = new Map();
          this.playerStates = new Map();
          this.playerTransitions = new Map();
          this.initSystems();
          this.leaveSubscription = mc.world.afterEvents.playerSpawn.subscribe(
               ({ player }) => {
                    this.handleLeave(player);
                    player.runCommand(`kill @e[type=train:temp_seat,r=0.0001]`);
               }
          );
     }

     initSystems() {
          // 延迟启动扫描，避开进世界初期的实体加载波动
          mc.system.runTimeout(() => {
               let minecartDiscoveryCountdown = 0;
               mc.system.runInterval(() => {
                    if (minecartDiscoveryCountdown <= 0) {
                         this.getMinecart();
                         minecartDiscoveryCountdown = MINECART_DISCOVERY_INTERVAL;
                    } else {
                         minecartDiscoveryCountdown -= 1;
                    }

                    if (!this.trackedMinecarts.size && !this.playerStates.size) {
                         return;
                    }

                    this.updateMinecartPositions();
                    this.scanPlayers();
               }, CHECK_INTERVAL);
          }, INITIAL_SCAN_DELAY);
     }

     trackMinecart(minecart) {
          if (this.trackedMinecarts.has(minecart.id)) {
               return;
          }

          const radii = getTrackedTrainRadii(minecart.id);

          this.trackedMinecarts.set(minecart.id, {
               entity: minecart,
               lastPos: minecart.location,
               radii,
               surfaceEntries: getTrackedSurfaceEntries(minecart.id),
               primaryAABB: this.createAABB(
                    minecart.location,
                    radii.primary,
                    radii.secondaryY
               ),
               secondaryAABB: this.createAABB(
                    minecart.location,
                    radii.secondary,
                    radii.secondaryY
               ),
          });
     }

     getMinecart() {
          for (const minecartId of minecartRegistry.getAll()) {
               const minecart = mc.world.getEntity(minecartId);
               if (
                    minecart?.isValid() &&
                    minecart.typeId === "minecraft:minecart"
               ) {
                    this.trackMinecart(minecart);
               }
          }
     }

     scanPlayers() {
          // 每刻检查玩家是否仍站在列车表面，据此决定绑定或解绑
          for (const player of mc.world.getAllPlayers()) {
               const hasGroundSupport = hasSolidBlockBelowFeet(player);
               const currentMinecart = this.checkPlayerPosition(player);
               const lastMinecartId = this.playerStates.get(player.id);
               const transition = this.getTransitionState(player.id);

               if (currentMinecart) {
                    this.markTransitionCandidate(transition, currentMinecart.id);
                    transition.leaveTicks = 0;

                    const requiredTicks = lastMinecartId
                         ? currentMinecart.id === lastMinecartId
                              ? 0
                              : SWITCH_STABLE_TICKS
                         : ENTER_STABLE_TICKS;

                    if (
                         lastMinecartId !== currentMinecart.id &&
                         transition.candidateTicks >= requiredTicks &&
                         this.isPlayerStableForBind(player)
                    ) {
                         if (!lastMinecartId) {
                              if (!hasGroundSupport) {
                                   this.handleEnter(player, currentMinecart);
                              }
                         } else {
                              this.handleSwitch(player, currentMinecart);
                         }
                    }
                    continue;
               }

               this.markTransitionCandidate(transition, null);

               if (lastMinecartId && hasGroundSupport) {
                    transition.leaveTicks += 1;
                    if (transition.leaveTicks >= LEAVE_STABLE_TICKS) {
                         this.handleLeave(player);
                         transition.leaveTicks = 0;
                    }
                    continue;
               }

               transition.leaveTicks = 0;
          }
     }

     checkPlayerPosition(player) {
          const playerPosition = player.location;
          const boundMinecartId = this.playerStates.get(player.id);
          const directMinecartId = this.getDirectSurfaceMinecartId(player);

          if (directMinecartId && directMinecartId !== boundMinecartId) {
               const minecartData = this.trackedMinecarts.get(directMinecartId);
               if (
                    minecartData &&
                    this.isInAABB(playerPosition, minecartData.primaryAABB) &&
                    this.hasValidSupport(player, minecartData)
               ) {
                    return minecartData.entity;
               }
          }

          if (boundMinecartId) {
               const minecartData = this.trackedMinecarts.get(boundMinecartId);
               // 已绑定玩家使用更宽松的次级范围，允许在车内走动而不被误解绑
               const positionValid =
                    minecartData &&
                    this.isInAABB(playerPosition, minecartData.secondaryAABB);

               return positionValid &&
                    this.hasValidSupport(player, minecartData)
                    ? minecartData.entity
                    : null;
          }

          for (const [, data] of this.trackedMinecarts) {
               if (
                    this.isInAABB(playerPosition, data.primaryAABB) &&
                    this.hasValidSupport(player, data)
               ) {
                    return data.entity;
               }
          }

          return null;
     }

     getDirectSurfaceMinecartId(player) {
          const footLocation = {
               x: player.location.x,
               y: Math.floor(player.location.y) - 1,
               z: player.location.z,
          };
          const entities = player.dimension.getEntities({
               location: footLocation,
               maxDistance: DIRECT_SURFACE_RANGE,
               minDistance: 0,
          });

          let bestMinecartId = null;
          let bestY = -Infinity;
          let bestHorizontalDistance = Infinity;

          for (const entity of entities) {
               const minecartId = resolveSurfaceMinecartId(entity);
               if (!minecartId) {
                    continue;
               }

               const horizontalDistance = Math.hypot(
                    entity.location.x - player.location.x,
                    entity.location.z - player.location.z,
               );

               if (
                    entity.location.y > bestY + 0.001 ||
                    (Math.abs(entity.location.y - bestY) <= 0.001 &&
                         horizontalDistance < bestHorizontalDistance)
               ) {
                    bestMinecartId = minecartId;
                    bestY = entity.location.y;
                    bestHorizontalDistance = horizontalDistance;
               }
          }

          return bestMinecartId;
     }

     getTransitionState(playerId) {
          if (!this.playerTransitions.has(playerId)) {
               this.playerTransitions.set(playerId, {
                    candidateId: null,
                    candidateTicks: 0,
                    leaveTicks: 0,
               });
          }

          return this.playerTransitions.get(playerId);
     }

     markTransitionCandidate(transition, candidateId) {
          if (transition.candidateId !== candidateId) {
               transition.candidateId = candidateId;
               transition.candidateTicks = candidateId ? 1 : 0;
               return;
          }

          if (candidateId) {
               transition.candidateTicks += 1;
          } else {
               transition.candidateTicks = 0;
          }
     }

     isPlayerStableForBind(player) {
          return Math.abs(player.getVelocity().y) <= MAX_BIND_VERTICAL_SPEED;
     }

     hasValidSupport(player, minecartData) {
          if (!player || !minecartData?.entity?.isValid()) {
               return false;
          }

          if (!Array.isArray(minecartData.surfaceEntries)) {
               minecartData.surfaceEntries = getTrackedSurfaceEntries(
                    minecartData.entity.id
               );
          }

          return hasTrainSupportAtLocation(
               minecartData.entity,
               minecartData.surfaceEntries,
               player.location,
               BINDER_SUPPORT_OPTIONS
          );
     }

     createAABB(center, radius, radiusY) {
          return {
               min: {
                    x: center.x - radius,
                    y: center.y - radiusY - 0.5,
                    z: center.z - radius,
               },
               max: {
                    x: center.x + radius,
                    y: center.y + radiusY + 0.5,
                    z: center.z + radius,
               },
          };
     }

     updateMinecartPositions() {
          for (const [id, data] of this.trackedMinecarts) {
               if (!data.entity.isValid()) {
                    this.trackedMinecarts.delete(id);
                    continue;
               }

               const currentLocation = data.entity.location;
               const currentRadii = getTrackedTrainRadii(id);
               const currentSurfaceEntries = getTrackedSurfaceEntries(id);
               const hasMoved =
                    currentLocation.x !== data.lastPos.x ||
                    currentLocation.y !== data.lastPos.y ||
                    currentLocation.z !== data.lastPos.z;
               const radiiChanged =
                    currentRadii.primary !== data.radii.primary ||
                    currentRadii.secondary !== data.radii.secondary ||
                    currentRadii.secondaryY !== data.radii.secondaryY;

               data.surfaceEntries = currentSurfaceEntries;

               if (!hasMoved && !radiiChanged) {
                    continue;
               }

               data.lastPos = currentLocation;
               data.radii = currentRadii;
               data.primaryAABB = this.createAABB(
                    currentLocation,
                    currentRadii.primary,
                    currentRadii.secondaryY
               );
               data.secondaryAABB = this.createAABB(
                    currentLocation,
                    currentRadii.secondary,
                    currentRadii.secondaryY
               );
          }
     }

     isInAABB(point, aabb) {
          return (
               point.x >= aabb.min.x &&
               point.x <= aabb.max.x &&
               point.y >= aabb.min.y &&
               point.y <= aabb.max.y &&
               point.z >= aabb.min.z &&
               point.z <= aabb.max.z
          );
     }

     handleEnter(player, minecart) {
          // 进入列车后创建隐藏座位，让玩家开始跟随这辆车移动
          if (this.playerStates.has(player.id)) {
               this.handleLeave(player);
          }

          try {
               new EntityWithPlayer(minecart, player).movePlayer(1);
               this.playerStates.set(player.id, minecart.id);
          } catch (error) {
               console.error("绑定失败:", error);
          }
     }

     handleSwitch(player, minecart) {
          try {
               if (!this.playerStates.has(player.id)) {
                    this.handleEnter(player, minecart);
                    return;
               }

               if (retargetPlayerBinding(player, minecart)) {
                    this.playerStates.set(player.id, minecart.id);
                    return;
               }

               this.handleLeave(player);
               new EntityWithPlayer(minecart, player).movePlayer(1);
               this.playerStates.set(player.id, minecart.id);
          } catch (error) {
               console.error("换绑失败:", error);
          }
     }

     handleLeave(player) {
          try {
               if (!this.playerStates.has(player.id)) {
                    return;
               }

               const boundMinecartId = this.playerStates.get(player.id);
               const minecartData = this.trackedMinecarts.get(boundMinecartId);
               if (!this.hasValidSupport(player, minecartData)) {
                    new EntityWithPlayerStop(player).stopPlayerMoving();
                    this.playerStates.delete(player.id);
                    this.playerTransitions.delete(player.id);
                    return;
               }

               const transition = this.playerTransitions.get(player.id);
               if (transition) {
                    transition.leaveTicks = 0;
               }
          } catch (error) {
               console.warn("解绑失败:", error);
          }
     }

     unbindPlayer(player) {
          if (!this.playerStates.has(player.id)) {
               return false;
          }

          try {
               new EntityWithPlayerStop(player).stopPlayerMoving();
               this.playerStates.delete(player.id);
               this.playerTransitions.delete(player.id);
               return true;
          } catch (error) {
               console.warn("安全解绑失败:", error);
               return false;
          }
     }

     unbindAllPlayers() {
          // 列车拆回方块前先把所有还在跟车的玩家安全放下
          const playerIds = Array.from(this.playerStates.keys());

          for (const playerId of playerIds) {
               const player = mc.world
                    .getAllPlayers()
                    .find((currentPlayer) => currentPlayer.id === playerId);

               if (player) {
                    this.unbindPlayer(player);
               }
          }
     }
}
