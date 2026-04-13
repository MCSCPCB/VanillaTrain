import { ItemStack, system, world } from "@minecraft/server";

import {
     getOverworldDimension,
     getRailDirectionAtLocation,
     isHorizontalRailDirection,
     standardizeHorizontalEntityPosition,
} from "./shared.js";

const CONNECT_CORE_ITEM_ID = "train:connect_core";
const CONNECT_CORE_BLOCK_ID = "train:connect_core";
const DEFAULT_MINECART_TYPE = "minecraft:minecart";
const TRAIN_MINECART_BLOCK_TYPE = "train:minecart_block";
const WRENCH_ITEM_ID = "train:wrench";

function showActionBar(player, rawtext) {
     player.onScreenDisplay.setActionBar(rawtext);
}

function getInvalidRailDirectionMessage() {
     return {
          rawtext: [{ text: "§m§l" }, { translate: "error.state" }],
     };
}

function getTrainAlreadyBuiltMessage() {
     return {
          rawtext: [{ text: "§p§l" }, { translate: "error.isTrain" }],
     };
}

function getBuildCompleteMessage() {
     return {
          rawtext: [{ text: "§p§l" }, { translate: "text.finish" }],
     };
}

// 负责把普通矿车转换成列车核心，并处理建造期核心的回收。
export class TrainBuild {
     constructor() {
          this.setupPlaceListener();
          this.setupBreakListener();
     }

     setupPlaceListener() {
          // 玩家拿核心物品点矿车时，进入列车建造流程。
          world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
               const { itemStack, player, target: entity } = event;

               if (
                    itemStack?.typeId !== CONNECT_CORE_ITEM_ID ||
                    entity.typeId !== DEFAULT_MINECART_TYPE
               ) {
                    return;
               }

               if (entity.hasTag("train_type")) {
                    showActionBar(player, getTrainAlreadyBuiltMessage());
                    return;
               }

               // 建造入口只允许放在平直轨道上，避免初始朝向错误。
               const railDirection = getRailDirectionAtLocation(
                    entity.location,
                    getOverworldDimension()
               );

               if (!isHorizontalRailDirection(railDirection)) {
                    const invalidRailMessage = getInvalidRailDirectionMessage();
                    system.runTimeout(() => {
                         showActionBar(player, invalidRailMessage);
                    }, 0);
                    return;
               }

               const { dimension, location } = entity;

               // 延后一拍替换矿车，避开交互当帧的实体冲突。
               system.runTimeout(() => {
                    if (!entity.hasTag("default_type")) {
                         return;
                    }

                    entity.dimension.runCommand(
                         `setblock ${location.x} ${location.y + 1} ${location.z} ${CONNECT_CORE_BLOCK_ID} destroy`
                    );
                    entity.remove();

                    const newMinecart = dimension.spawnEntity(
                         DEFAULT_MINECART_TYPE,
                         location
                    );

                    if (!newMinecart) {
                         return;
                    }

                    system.runTimeout(() => {
                         standardizeHorizontalEntityPosition(newMinecart);
                         newMinecart.triggerEvent("train_type");
                         showActionBar(player, getBuildCompleteMessage());
                    }, 10);
               }, 0);
          });
     }

     setupBreakListener() {
          // 核心方块被破坏时，把对应的核心矿车一并清掉，避免残留半成品列车。
          world.beforeEvents.playerBreakBlock.subscribe((event) => {
               const { block } = event;

               if (block.typeId !== CONNECT_CORE_BLOCK_ID) {
                    return;
               }

               const { dimension } = block;
               const belowLocation = {
                    x: block.location.x,
                    y: block.location.y - 1,
                    z: block.location.z,
               };

               for (const entity of dimension.getEntities({
                    location: belowLocation,
                    maxDistance: 1,
               })) {
                    if (entity.typeId === TRAIN_MINECART_BLOCK_TYPE) {
                         system.runTimeout(() => {
                              entity.remove();
                         }, 0);
                    }

                    if (
                         entity.hasTag("train_type") &&
                         entity.typeId === DEFAULT_MINECART_TYPE
                    ) {
                         const minecartItem = new ItemStack(
                              DEFAULT_MINECART_TYPE,
                              1
                         );

                         system.runTimeout(() => {
                              entity.remove();
                              dimension.spawnItem(minecartItem, belowLocation);
                         }, 0);
                    }
               }
          });

          // 扳手点建造期核心时，把核心和占位实体拆回普通矿车物品。
          world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
               const { itemStack, target: entity } = event;

               if (
                    itemStack?.typeId !== WRENCH_ITEM_ID ||
                    entity.typeId !== TRAIN_MINECART_BLOCK_TYPE ||
                    entity
                         .getComponent("minecraft:riding")
                         .entityRidingOn.getComponent("minecraft:rideable")
                         .getRiders().length !== 1
               ) {
                    return;
               }

               event.cancel = true;

               const { dimension, location } = entity;

               for (const nearbyEntity of dimension.getEntities({
                    location,
                    maxDistance: 1,
               })) {
                    if (
                         (nearbyEntity.hasTag("train_type") &&
                              nearbyEntity.typeId === DEFAULT_MINECART_TYPE) ||
                         nearbyEntity.typeId === TRAIN_MINECART_BLOCK_TYPE
                    ) {
                         system.runTimeout(() => {
                              nearbyEntity.remove();
                         }, 0);
                    }
               }

               const minecartItem = new ItemStack(DEFAULT_MINECART_TYPE, 1);
               system.runTimeout(() => {
                    dimension.spawnItem(minecartItem, location);
               }, 0);
          });
     }
}
