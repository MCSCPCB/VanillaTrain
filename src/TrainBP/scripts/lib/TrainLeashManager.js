import { system, world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

import { loadTrainData } from "./DataStorage";
import {
     connectMinecartConsist,
     detachMinecartFrontLink,
} from "./TrainConsistManager";
import { getOverworldDimension } from "./shared.js";

const LEAD_ITEM_ID = "train:lead";
const DEFAULT_MINECART_TYPE = "minecraft:minecart";
const HARD_TAG_COUNT = 10;

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

function clearHardDistanceTags(entity) {
     for (let index = 1; index <= HARD_TAG_COUNT; index++) {
          const tag = `hard${index}`;
          if (entity.hasTag(tag)) {
               entity.removeTag(tag);
          }
     }
}

function clearLegacyLeash(entity) {
     try {
          entity?.getComponent("leashable")?.unleash();
     } catch {
          // 没有原版拴绳连接时直接忽略
     }
}

function buildMinecartNameMap(dimension) {
     const nameToMinecarts = new Map();
     const minecarts = dimension
          .getEntities({ type: DEFAULT_MINECART_TYPE })
          .filter((entity) => entity.typeId === DEFAULT_MINECART_TYPE);

     // 建立名称到矿车的映射，供重名校验和目标查找复用
     for (const minecart of minecarts) {
          const trainData = loadTrainData(minecart.id) || {};
          const name = trainData.minecartName;

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

export class TrainLeashManager {
     constructor() {
          this.setupLeadInteractListener();
     }

     setupLeadInteractListener() {
          world.afterEvents.itemUse.subscribe((event) => {
               const { itemStack, source: player } = event;
               if (itemStack?.typeId !== LEAD_ITEM_ID) {
                    return;
               }

               system.run(() => {
                    this.showManagementForm(player);
               });
          });
     }

     showManagementForm(player) {
          const form = new ModalFormData();
          form.title(createRawtext(null, "title.leadForm"));
          form.textField(
               createRawtext("§i§l", "textField1.leadForm"),
               createRawtext("§i§l", "textField3.leadForm")
          );
          form.textField(
               createRawtext("§i§l", "textField2.leadForm"),
               createRawtext("§i§l", "textField3.leadForm")
          );
          form.slider(createRawtext("§i§l", "sliderText.leadForm"), 1, 10, 1, 1);
          form.toggle(createRawtext("§i§l", "toggleText.leadForm"), false);
          form.submitButton(createRawtext("§j§l", "yes.form"));

          form.show(player)
               .then((response) => {
                    if (response.canceled) {
                         setActionBar(
                              player,
                              createRawtext("§f§l", "cancel.coordinate")
                         );
                         return;
                    }

                    const [
                         minecartName1,
                         minecartName2,
                         hardDis,
                         allowEntity,
                    ] = response.formValues;
                    const dimension = getOverworldDimension();
                    const nameToMinecarts = buildMinecartNameMap(dimension);
                    const minecarts2 = nameToMinecarts.get(minecartName2) || [];

                    if (minecarts2.length > 1) {
                         setActionBar(player, {
                              rawtext: [
                                   { text: "§c§l" },
                                   { text: `${minecartName2} ` },
                                   {
                                        translate:
                                             "error.duplicateName.leadForm",
                                   },
                              ],
                         });
                         return;
                    }

                    const minecart2 = minecarts2[0];
                    if (!minecart2) {
                         setActionBar(player, {
                              rawtext: [
                                   { text: "§c§l" },
                                   { text: `${minecartName2} ` },
                                   {
                                        translate:
                                             "error.minecartNotFound.leadForm",
                                   },
                              ],
                         });
                         return;
                    }

                    try {
                         if (allowEntity) {
                              const hardTag = `hard${hardDis}`;
                              clearHardDistanceTags(minecart2);
                              minecart2.addTag(hardTag);

                              if (!minecart2.hasComponent("leashable")) {
                                   setActionBar(
                                        player,
                                        createRawtext(
                                             "§c§l",
                                             "error.noLeashableComponent"
                                        )
                                   );
                                   return;
                              }

                              const entities = dimension
                                   .getEntities({ name: minecartName1 })
                                   .filter((entity) => entity.id !== minecart2.id);

                              if (entities.length === 0) {
                                   setActionBar(player, {
                                        rawtext: [
                                             { text: "§c§l" },
                                             { text: `${minecartName1} ` },
                                             {
                                                  translate:
                                                       "error.entityNotFound.leadForm",
                                             },
                                        ],
                                   });
                                   return;
                              }

                              if (entities.length > 1) {
                                   setActionBar(player, {
                                        rawtext: [
                                             { text: "§c§l" },
                                             { text: `${minecartName1} ` },
                                             {
                                                  translate:
                                                       "error.duplicateEntityName.leadForm",
                                             },
                                        ],
                                   });
                                   return;
                              }

                              detachMinecartFrontLink(minecart2.id);
                              clearLegacyLeash(minecart2);
                              minecart2
                                   .getComponent("leashable")
                                   .leashTo(entities[0]);
                              setActionBar(
                                   player,
                                   createRawtext("§2§l", "confirm.leadForm")
                              );
                              return;
                         }

                         const minecarts1 = nameToMinecarts.get(minecartName1) || [];
                         if (minecarts1.length > 1) {
                              setActionBar(player, {
                                   rawtext: [
                                        { text: "§c§l" },
                                        { text: `${minecartName1} ` },
                                        {
                                             translate:
                                                  "error.duplicateName.leadForm",
                                        },
                                   ],
                              });
                              return;
                         }

                         const minecart1 = minecarts1[0];
                         if (!minecart1) {
                              setActionBar(player, {
                                   rawtext: [
                                        { text: "§c§l" },
                                        { text: `${minecartName1} ` },
                                        {
                                             translate:
                                                  "error.minecartNotFound.leadForm",
                                        },
                                   ],
                              });
                              return;
                         }

                         if (minecart1.id === minecart2.id) {
                              setActionBar(player, {
                                   rawtext: [
                                        { text: "§c§l" },
                                        {
                                             translate:
                                                  "error.sameMinecart.leadForm",
                                        },
                                   ],
                              });
                              return;
                         }

                         clearHardDistanceTags(minecart1);
                         clearHardDistanceTags(minecart2);
                         clearLegacyLeash(minecart1);
                         clearLegacyLeash(minecart2);

                         const connectResult = connectMinecartConsist(
                              minecart1.id,
                              minecart2.id,
                              hardDis
                         );

                         if (!connectResult.success) {
                              const errorKey =
                                   connectResult.reason === "cycle"
                                        ? "error.circularConsist.leadForm"
                                        : "error.sameMinecart.leadForm";

                              setActionBar(player, {
                                   rawtext: [
                                        { text: "§c§l" },
                                        {
                                             translate: errorKey,
                                        },
                                   ],
                              });
                              return;
                         }

                         setActionBar(
                              player,
                              createRawtext("§2§l", "confirm.leadForm")
                         );
                    } catch (error) {
                         console.error(error, error.stack);
                    }
               })
               .catch((error) => {
                    console.error(error, error.stack);
               });
     }
}
