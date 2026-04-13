import { ItemStack, system, world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

import {
     loadTrainConsistData,
     loadTrainData,
     minecartRegistry,
} from "./DataStorage";
import {
     getRailDirectionAtLocation,
     getOverworldDimension,
     isCurveRailDirection,
} from "./shared.js";

const DEFAULT_MINECART_TYPE = "minecraft:minecart";
const X_CONTROLLER_POSITIVE_ITEM_ID = "train:x_controller_positive";
const X_CONTROLLER_NEGATIVE_ITEM_ID = "train:x_controller_negative";
const Z_CONTROLLER_POSITIVE_ITEM_ID = "train:z_controller_positive";
const Z_CONTROLLER_NEGATIVE_ITEM_ID = "train:z_controller_negative";
const CONTROLLER_BIND_ID_PROPERTY = "train:drive_minecart_id";
const CONTROLLER_BIND_NAME_PROPERTY = "train:drive_minecart_name";
const DRIVE_UPDATE_INTERVAL = 1;
const ACTIVE_ACCELERATION_IMPULSE = 0.018;
const ACTIVE_BRAKING_IMPULSE = 0.03;
const PASSIVE_BRAKING_IMPULSE = 0.01;
const MAX_ACTIVE_SPEED = 0.28;
const MIN_SPEED_EPSILON = 0.01;

const CONTROLLER_ITEM_CONFIG = Object.freeze({
     [X_CONTROLLER_POSITIVE_ITEM_ID]: {
          axis: "x",
          direction: 1,
          opposite: X_CONTROLLER_NEGATIVE_ITEM_ID,
     },
     [X_CONTROLLER_NEGATIVE_ITEM_ID]: {
          axis: "x",
          direction: -1,
          opposite: X_CONTROLLER_POSITIVE_ITEM_ID,
     },
     [Z_CONTROLLER_POSITIVE_ITEM_ID]: {
          axis: "z",
          direction: 1,
          opposite: Z_CONTROLLER_NEGATIVE_ITEM_ID,
     },
     [Z_CONTROLLER_NEGATIVE_ITEM_ID]: {
          axis: "z",
          direction: -1,
          opposite: Z_CONTROLLER_POSITIVE_ITEM_ID,
     },
});

const driveStates = new Map();
const activeDriveCommands = new Map();

function createRawtext(text = null, translate = null) {
     const rawtext = [];

     if (text !== null) {
          rawtext.push({ text });
     }

     if (translate !== null) {
          rawtext.push({ translate });
     }

     return { rawtext };
}

function setActionBar(player, rawtext) {
     player.onScreenDisplay.setActionBar(rawtext);
}

function buildMinecartNameMap(dimension) {
     const nameToMinecarts = new Map();
     const minecarts = dimension
          .getEntities({ type: DEFAULT_MINECART_TYPE })
          .filter((entity) => entity.typeId === DEFAULT_MINECART_TYPE);

     for (const minecart of minecarts) {
          if (!minecartRegistry.has(minecart.id)) {
               continue;
          }

          if (loadTrainConsistData(minecart.id).frontId) {
               continue;
          }

          const trainData = loadTrainData(minecart.id);
          const name = trainData?.minecartName;
          if (!name) {
               continue;
          }

          if (!nameToMinecarts.has(name)) {
               nameToMinecarts.set(name, []);
          }

          nameToMinecarts.get(name).push(minecart);
     }

     return nameToMinecarts;
}

function getPlayerInventoryContainer(player) {
     return player.getComponent("inventory")?.container ?? null;
}

function getSelectedSlotIndex(player) {
     return typeof player.selectedSlotIndex === "number"
          ? player.selectedSlotIndex
          : 0;
}

function getHeldItem(player) {
     const container = getPlayerInventoryContainer(player);
     if (!container) {
          return null;
     }

     return container.getItem(getSelectedSlotIndex(player));
}

function setInventoryItem(player, slot, itemStack) {
     const container = getPlayerInventoryContainer(player);
     if (!container) {
          return false;
     }

     container.setItem(slot, itemStack);
     return true;
}

function isControllerItem(itemTypeId) {
     return !!CONTROLLER_ITEM_CONFIG[itemTypeId];
}

function buildControllerNameTag(itemTypeId, binding = null) {
     if (!isControllerItem(itemTypeId)) {
          return undefined;
     }

     const keyPrefix = itemTypeId.replace("train:", "");
     if (!binding?.minecartName) {
          return undefined;
     }

     return `%${keyPrefix}.name1\n%${keyPrefix}.name2\n%${keyPrefix}.name3§f${binding.minecartName}\n%${keyPrefix}.name4`;
}

function getControllerBinding(itemStack) {
     if (!itemStack || !isControllerItem(itemStack.typeId)) {
          return null;
     }

     const minecartId = itemStack.getDynamicProperty(
          CONTROLLER_BIND_ID_PROPERTY
     );
     const minecartName = itemStack.getDynamicProperty(
          CONTROLLER_BIND_NAME_PROPERTY
     );

     if (!minecartId || !minecartName) {
          return null;
     }

     return {
          minecartId,
          minecartName,
     };
}

function syncControllerDisplay(itemStack) {
     if (!itemStack || !isControllerItem(itemStack.typeId)) {
          return itemStack;
     }

     itemStack.nameTag = buildControllerNameTag(
          itemStack.typeId,
          getControllerBinding(itemStack),
     );

     if (typeof itemStack.setLore === "function") {
          itemStack.setLore([]);
     }

     return itemStack;
}

function applyControllerBinding(itemStack, minecartId, minecartName) {
     itemStack.setDynamicProperty(CONTROLLER_BIND_ID_PROPERTY, minecartId);
     itemStack.setDynamicProperty(CONTROLLER_BIND_NAME_PROPERTY, minecartName);
     return syncControllerDisplay(itemStack);
}

function clearControllerBinding(itemStack) {
     itemStack.setDynamicProperty(CONTROLLER_BIND_ID_PROPERTY, undefined);
     itemStack.setDynamicProperty(CONTROLLER_BIND_NAME_PROPERTY, undefined);
     return syncControllerDisplay(itemStack);
}

function createControllerItem(itemTypeId, binding = null) {
     const itemStack = new ItemStack(itemTypeId, 1);

     if (binding?.minecartId && binding?.minecartName) {
          applyControllerBinding(
               itemStack,
               binding.minecartId,
               binding.minecartName
          );

          return itemStack;
     }

     return syncControllerDisplay(itemStack);
}

function getRailAxis(railDirection) {
     if (railDirection === 1 || railDirection === 2 || railDirection === 3) {
          return "x";
     }

     if (railDirection === 0 || railDirection === 4 || railDirection === 5) {
          return "z";
     }

     return null;
}

function getHorizontalSpeedMagnitude(velocity) {
     return Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
}

function getMinecartRailDirection(minecart) {
     try {
          return getRailDirectionAtLocation(minecart.location, minecart.dimension);
     } catch {
          return null;
     }
}

function isMinecartBindingValid(minecartId) {
     const minecart = world.getEntity(minecartId);
     return (
          minecartRegistry.has(minecartId) &&
          minecart?.isValid() &&
          minecart.typeId === DEFAULT_MINECART_TYPE &&
          !!loadTrainData(minecartId)
     );
}

export function getActiveDriveCommand(minecartId) {
     const command = activeDriveCommands.get(minecartId);

     return command
          ? {
                 axis: command.axis,
                 direction: command.direction,
            }
          : null;
}

export function clearDriveBindingsForMinecart(minecartId) {
     driveStates.delete(minecartId);
     activeDriveCommands.delete(minecartId);

     for (const player of world.getAllPlayers()) {
          const container = getPlayerInventoryContainer(player);
          if (!container) {
               continue;
          }

          for (let slot = 0; slot < container.size; slot++) {
               const itemStack = container.getItem(slot);
               if (!itemStack || !isControllerItem(itemStack.typeId)) {
                    continue;
               }

               const binding = getControllerBinding(itemStack);
               if (!binding || binding.minecartId !== minecartId) {
                    continue;
               }

               const clearedItem = clearControllerBinding(
                    createControllerItem(itemStack.typeId)
               );
               container.setItem(slot, clearedItem);
          }
     }
}

export class TrainDriveManager {
     constructor() {
          this.setupItemUseListener();
          this.startDriveLoop();
     }

     setupItemUseListener() {
          world.afterEvents.itemUse.subscribe((event) => {
               const { itemStack, source: player } = event;
               if (!isControllerItem(itemStack?.typeId)) {
                    return;
               }

               const slotIndex = getSelectedSlotIndex(player);

               system.run(() => {
                    const heldItem = getHeldItem(player);
                    if (!heldItem || heldItem.typeId !== itemStack.typeId) {
                         return;
                    }

                    syncControllerDisplay(heldItem);
                    setInventoryItem(player, slotIndex, heldItem);

                    if (getControllerBinding(heldItem)) {
                         this.toggleControllerDirection(player, slotIndex, heldItem);
                         return;
                    }

                    this.showBindForm(player, slotIndex, heldItem.typeId);
               });
          });
     }

     async showBindForm(player, slotIndex, itemTypeId) {
          const nameToMinecarts = buildMinecartNameMap(getOverworldDimension());

          if (nameToMinecarts.size === 0) {
               setActionBar(
                    player,
                    createRawtext("§c§l", "error.noMinecart.driveForm")
               );
               return;
          }

          const form = new ModalFormData();
          form.title(createRawtext(null, "title.driveForm"));
          form.textField(
               createRawtext("§i§l", "textField1.driveForm"),
               createRawtext("§i§l", "textField2.driveForm")
          );
          form.submitButton(createRawtext("§j§l", "yes.form"));

          const response = await form.show(player);
          if (response.canceled) {
               return;
          }

          const [rawMinecartName] = response.formValues;
          const minecartName = `${rawMinecartName ?? ""}`.trim();
          const targetMinecarts = nameToMinecarts.get(minecartName) || [];

          if (targetMinecarts.length > 1) {
               setActionBar(
                    player,
                    createRawtext("§c§l", "error.duplicateName.driveForm")
               );
               return;
          }

          const minecart = targetMinecarts[0];
          if (!minecart) {
               setActionBar(
                    player,
                    createRawtext("§c§l", "error.minecartNotFound.driveForm")
               );
               return;
          }

          const currentItem = getPlayerInventoryContainer(player)?.getItem(slotIndex);
          if (!currentItem || currentItem.typeId !== itemTypeId) {
               return;
          }

          const boundItem = createControllerItem(itemTypeId, {
               minecartId: minecart.id,
               minecartName,
          });

          if (!setInventoryItem(player, slotIndex, boundItem)) {
               return;
          }

          setActionBar(player, {
               rawtext: [
                    { text: "§2§l" },
                    { translate: "confirm.driveForm" },
                    { text: ` ${minecartName}` },
               ],
          });
     }

     toggleControllerDirection(player, slotIndex, itemStack) {
          const controllerConfig = CONTROLLER_ITEM_CONFIG[itemStack.typeId];
          const binding = getControllerBinding(itemStack);

          if (!controllerConfig || !binding) {
               return;
          }

          if (!isMinecartBindingValid(binding.minecartId)) {
               const clearedItem = clearControllerBinding(
                    createControllerItem(itemStack.typeId)
               );
               setInventoryItem(player, slotIndex, clearedItem);
               setActionBar(
                    player,
                    createRawtext("§c§l", "error.controllerMissing.driveForm")
               );
               return;
          }

          const toggledItem = createControllerItem(
               controllerConfig.opposite,
               binding
          );
          setInventoryItem(player, slotIndex, toggledItem);

          const messageKey =
               CONTROLLER_ITEM_CONFIG[controllerConfig.opposite].direction > 0
                    ? "togglePositive.driveForm"
                    : "toggleNegative.driveForm";
          setActionBar(player, createRawtext("§p§l", messageKey));
     }

     startDriveLoop() {
          this.driveInterval = system.runInterval(() => {
               activeDriveCommands.clear();
               const activeCommands = new Map();

               for (const player of world.getAllPlayers()) {
                    const heldItem = getHeldItem(player);
                    if (!heldItem || !isControllerItem(heldItem.typeId)) {
                         continue;
                    }

                    const binding = getControllerBinding(heldItem);
                    if (!binding) {
                         continue;
                    }

                    if (!isMinecartBindingValid(binding.minecartId)) {
                         const slotIndex = getSelectedSlotIndex(player);
                         const clearedItem = clearControllerBinding(
                              createControllerItem(heldItem.typeId)
                         );
                         setInventoryItem(player, slotIndex, clearedItem);
                         setActionBar(
                              player,
                              createRawtext(
                                   "§c§l",
                                   "error.controllerMissing.driveForm"
                              )
                         );
                         continue;
                    }

                    activeCommands.set(binding.minecartId, {
                         axis: CONTROLLER_ITEM_CONFIG[heldItem.typeId].axis,
                         direction:
                              CONTROLLER_ITEM_CONFIG[heldItem.typeId].direction,
                    });

                    if (!driveStates.has(binding.minecartId)) {
                         driveStates.set(binding.minecartId, {});
                    }
               }

               for (const [minecartId, command] of activeCommands) {
                    const minecart = world.getEntity(minecartId);
                    if (!minecart?.isValid()) {
                         driveStates.delete(minecartId);
                         continue;
                    }

                    driveStates.set(minecartId, {
                         axis: command.axis,
                         direction: command.direction,
                    });
                    if (this.applyActiveDrive(minecart, command)) {
                         activeDriveCommands.set(minecartId, command);
                    }
               }

               for (const [minecartId] of driveStates) {
                    if (activeCommands.has(minecartId)) {
                         continue;
                    }

                    const minecart = world.getEntity(minecartId);
                    if (!minecart?.isValid() || !minecartRegistry.has(minecartId)) {
                         driveStates.delete(minecartId);
                         continue;
                    }

                    if (!this.applyPassiveBrake(minecart)) {
                         driveStates.delete(minecartId);
                    }
               }
          }, DRIVE_UPDATE_INTERVAL);
     }

     applyActiveDrive(minecart, command) {
          const railDirection = getMinecartRailDirection(minecart);
          const railAxis = getRailAxis(railDirection);
          const isCurveRail = isCurveRailDirection(railDirection);

          if (!isCurveRail && railAxis && railAxis !== command.axis) {
               return false;
          }

          if (!isCurveRail && !railAxis) {
               return false;
          }

          const velocity = minecart.getVelocity();
          const axisSpeed = velocity[command.axis];

          if (axisSpeed * command.direction < -MIN_SPEED_EPSILON) {
               minecart.applyImpulse({
                    x:
                         command.axis === "x"
                              ? command.direction * ACTIVE_BRAKING_IMPULSE
                              : 0,
                    y: 0,
                    z:
                         command.axis === "z"
                              ? command.direction * ACTIVE_BRAKING_IMPULSE
                              : 0,
               });
               return true;
          }

          if (Math.abs(axisSpeed) >= MAX_ACTIVE_SPEED) {
               return false;
          }

          minecart.applyImpulse({
               x:
                    command.axis === "x"
                         ? command.direction * ACTIVE_ACCELERATION_IMPULSE
                         : 0,
               y: 0,
               z:
                    command.axis === "z"
                         ? command.direction * ACTIVE_ACCELERATION_IMPULSE
                         : 0,
          });
          return true;
     }

     applyPassiveBrake(minecart) {
          const velocity = minecart.getVelocity();
          const horizontalSpeed = getHorizontalSpeedMagnitude(velocity);

          if (horizontalSpeed <= MIN_SPEED_EPSILON) {
               return false;
          }

          const brakeScale = Math.min(PASSIVE_BRAKING_IMPULSE, horizontalSpeed);
          minecart.applyImpulse({
               x: -(velocity.x / horizontalSpeed) * brakeScale,
               y: 0,
               z: -(velocity.z / horizontalSpeed) * brakeScale,
          });

          return true;
     }
}
