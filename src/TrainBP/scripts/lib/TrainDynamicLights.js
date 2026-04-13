import { BLOCK_ID_MAP } from "../map/BlockMap.js";
import {
     deleteTrainLightData,
     loadTrainData,
     loadTrainLightData,
     saveTrainLightData,
} from "./DataStorage.js";
import { getOverworldDimension } from "./shared.js";

const AIR_BLOCK_ID = "minecraft:air";
const LIGHT_BLOCK_ID = "minecraft:light_block";
const TRACKED_LIGHT_LEVELS = [6, 7, 10, 13, 14, 15];

// 记录列车系统中会生成移动光源的方块亮度。
const LIGHT_LEVEL_BY_TYPE_INDEX = new Map([
     [10, 15], // campfire
     [37, 10], // soul_campfire
     [127, 15], // glowstone
     [128, 6], // magma
     [215, 15], // shroomlight
     [216, 15], // sea_lantern
     [265, 15], // pearlescent_froglight
     [266, 15], // verdant_froglight
     [267, 15], // ochre_froglight
     [273, 13], // lit_furnace
     [275, 13], // lit_blast_furnace
     [277, 13], // lit_smoker
     [283, 15], // lit_redstone_lamp
     [309, 15], // lantern
     [310, 10], // soul_lantern
     [311, 14], // torch
     [312, 10], // soul_torch
     [313, 14], // end_rod
     [350, 7], // redstone_torch
     [352, 14], // copper_torch
     [353, 15], // copper_lantern
     [354, 15], // exposed_copper_lantern
     [355, 15], // weathered_copper_lantern
     [356, 15], // oxidized_copper_lantern
     [384, 15], // lit_pumpkin
     [427, 15], // beacon
]);

function getTrainBlockTypeIndex(block) {
     if (!block?.typeId) {
          return 0;
     }

     const typeKey = block.typeId.split(":")[1];
     return BLOCK_ID_MAP.get(typeKey) ?? 0;
}

function isExtinguishedCampfire(block, typeIndex) {
     if (typeIndex !== 10 && typeIndex !== 37) {
          return false;
     }

     try {
          return Boolean(block.permutation.getState("extinguished"));
     } catch {
          return false;
     }
}

function getTrainBlockLightLevel(block) {
     const typeIndex = getTrainBlockTypeIndex(block);
     if (!typeIndex) {
          return 0;
     }

     if (isExtinguishedCampfire(block, typeIndex)) {
          return 0;
     }

     return LIGHT_LEVEL_BY_TYPE_INDEX.get(typeIndex) ?? 0;
}

function createPositionKey(position) {
     return `${position.x}:${position.y}:${position.z}`;
}

function normalizeLightEntry(entry) {
     if (!entry) {
          return null;
     }

     return {
          x: Math.floor(entry.x),
          y: Math.floor(entry.y),
          z: Math.floor(entry.z),
          level: Math.max(0, Math.min(15, Math.floor(entry.level ?? 0))),
     };
}

function getTrackedLightEntries(trainId) {
     const rawEntries = loadTrainLightData(trainId);
     if (!Array.isArray(rawEntries)) {
          return [];
     }

     return rawEntries
          .map(normalizeLightEntry)
          .filter((entry) => entry && entry.level > 0);
}

function clearLightEntries(entries) {
     if (!entries.length) {
          return [];
     }

     const dimension = getOverworldDimension();
     const unresolvedEntries = [];

     for (const entry of entries) {
          const block = dimension.getBlock(entry);
          if (!block) {
               unresolvedEntries.push(entry);
               continue;
          }

          let hasCommandError = false;
          const { x, y, z } = entry;

          for (const level of TRACKED_LIGHT_LEVELS) {
               try {
                    dimension.runCommand(
                         `fill ${x} ${y} ${z} ${x} ${y} ${z} air [] replace light_block [\"block_light_level\"=${level}]`
                    );
               } catch (error) {
                    console.warn(`清理列车动态光源失败: ${error}`);
                    hasCommandError = true;
                    break;
               }
          }

          if (hasCommandError) {
               unresolvedEntries.push(entry);
          }
     }

     return unresolvedEntries;
}

function buildDesiredLightEntries(minecart, lightSources, calculateActualPosition) {
     const desiredEntries = new Map();

     for (const source of lightSources) {
          const actualPosition = calculateActualPosition(
               minecart,
               source.offset,
               source.railDirection
          );
          const blockPosition = {
               x: Math.floor(actualPosition.x),
               y: Math.floor(actualPosition.y + 0.0001),
               z: Math.floor(actualPosition.z),
               level: source.level,
          };
          const key = createPositionKey(blockPosition);
          const existing = desiredEntries.get(key);

          if (!existing || existing.level < blockPosition.level) {
               desiredEntries.set(key, blockPosition);
          }
     }

     return desiredEntries;
}

function tryPlaceLightBlock(block, lightEntry) {
     try {
          block.dimension.runCommand(
               `fill ${lightEntry.x} ${lightEntry.y} ${lightEntry.z} ${lightEntry.x} ${lightEntry.y} ${lightEntry.z} light_block [\"block_light_level\"=${lightEntry.level}] replace air`
          );
          return true;
     } catch (error) {
          console.warn(`放置列车动态光源失败: ${error}`);
          return false;
     }
}

export function createTrainLightSource(
     block,
     minecartLocation,
     location,
     railDirection
) {
     const level = getTrainBlockLightLevel(block);
     if (level <= 0) {
          return null;
     }

     return {
          offset: {
               x: location.x - minecartLocation.x,
               y: location.y - minecartLocation.y,
               z: location.z - minecartLocation.z,
          },
          railDirection,
          level,
     };
}

export function updateTrainDynamicLights(minecart, calculateActualPosition) {
     const trainData = loadTrainData(minecart.id);
     const lightSources = Array.isArray(trainData?.lightSources)
          ? trainData.lightSources
          : [];

     if (!lightSources.length) {
          clearTrainDynamicLights(minecart.id);
          return;
     }

     const previousEntries = getTrackedLightEntries(minecart.id);
     const desiredEntries = buildDesiredLightEntries(
          minecart,
          lightSources,
          calculateActualPosition
     );
     const dimension = getOverworldDimension();
     const staleEntries = clearLightEntries(previousEntries);

     const appliedEntries = [];

     for (const entry of desiredEntries.values()) {
          const block = dimension.getBlock(entry);
          if (!block) {
               continue;
          }

          const canPlaceInAir = block.typeId === AIR_BLOCK_ID;
          const canReuseTrackedLight = block.typeId === LIGHT_BLOCK_ID;

          // 只在空气或已追踪的 light_block 上写入，避免覆盖世界原有光源方块。
          if (!canPlaceInAir && !canReuseTrackedLight) {
               continue;
          }

          if (tryPlaceLightBlock(block, entry)) {
               appliedEntries.push(entry);
          }
     }

     if (appliedEntries.length || staleEntries.length) {
          saveTrainLightData(minecart.id, [...staleEntries, ...appliedEntries]);
          return;
     }

     deleteTrainLightData(minecart.id);
}

export function clearTrainDynamicLights(trainId) {
     const trackedEntries = getTrackedLightEntries(trainId);
     const unresolvedEntries = clearLightEntries(trackedEntries);

     if (unresolvedEntries.length) {
          saveTrainLightData(trainId, unresolvedEntries);
          return;
     }

     deleteTrainLightData(trainId);
}
