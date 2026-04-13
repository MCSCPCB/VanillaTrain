import { system, world } from "@minecraft/server";

import { RegionSelector } from "./lib/RegionSelector";
import { AutoBinder } from "./lib/TrainBinder";
import { TrainBuild } from "./lib/TrainBuild";
import { TrainDriveManager } from "./lib/TrainDriveManager";
import { TrainLeashManager } from "./lib/TrainLeashManager";
import { TrainLinkManager } from "./lib/TrainLinkManager";
import { JavaMinecartManager } from "./lib/JavaMinecartManager";
import { TrainStraightCollisionManager } from "./lib/TrainStraightCollisionManager";
import { TrainStructureManager } from "./lib/TrainStructureManager";
import { initializeTrainPluginRegistry } from "./lib/TrainPluginProtocol";
import { cleanupTrainPluginRuntimeResidue } from "./lib/TrainPluginRuntime.js";
import { TrainUpdater } from "./lib/TrainUpdater";

const INPUT_PERMISSION_CATEGORY = 2;
const IMMEDIATE_BLEND_OUT = 0;
const PERSISTENT_BLEND_OUT = 999999999999999;
const TEMP_SEAT_TYPE = "train:temp_seat";
const PLAYER_OFFSET_ANIMATION = "animation.player_train_offset";
const RIDING_STATE_CHECK_INTERVAL = 1;

initializeTrainPluginRegistry();
cleanupTrainPluginRuntimeResidue();

// 启动列车相关模块，入口文件本身不承载业务逻辑。
new RegionSelector();
const binder = new AutoBinder();
new TrainBuild();
new TrainDriveManager();
new JavaMinecartManager();
new TrainLinkManager();
new TrainStraightCollisionManager();
new TrainUpdater();
new TrainStructureManager(binder);
new TrainLeashManager();

// 读取玩家当前骑乘的实体类型，用于切换隐藏座位的外观动画。
function getCurrentRideType(player) {
     const ridingComponent = player.getComponent("riding");
     return ridingComponent?.entityRidingOn?.typeId ?? null;
}

// 隐藏座位只保留 offset 动画，原版骑乘姿势交给资源包控制器处理。
function syncSeatOffsetAnimation(player, currentRideType) {
     if (currentRideType === TEMP_SEAT_TYPE) {
          player.playAnimation(PLAYER_OFFSET_ANIMATION, {
               blendOutTime: PERSISTENT_BLEND_OUT,
          });
          return;
     }

     player.playAnimation(PLAYER_OFFSET_ANIMATION, {
          blendOutTime: IMMEDIATE_BLEND_OUT,
     });
}

for (const player of world.getAllPlayers()) {
     player.inputPermissions.setPermissionCategory(
          INPUT_PERMISSION_CATEGORY,
          true,
     );
}

// 仅在骑乘目标变化时重播动画，减少无效调用。
const playerRidingStates = new Map();

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
     playerRidingStates.delete(playerId);
});

// 根据骑乘目标切换隐藏座位的 offset 表现。
system.runInterval(() => {
     for (const player of world.getAllPlayers()) {
          const currentRideType = getCurrentRideType(player);
          const previousRideType = playerRidingStates.get(player.id);

          if (currentRideType === previousRideType) {
               continue;
          }

          playerRidingStates.set(player.id, currentRideType);
          syncSeatOffsetAnimation(player, currentRideType);
     }
}, RIDING_STATE_CHECK_INTERVAL);
