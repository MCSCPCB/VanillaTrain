import { world } from "@minecraft/server";

const MINECART_LIST_KEY = "MinecartList";
const TRAIN_DATA_PREFIX = "train_data_";
const TRAIN_LIGHT_PREFIX = "train_light_";
const TRAIN_CONSIST_PREFIX = "train_consist_";
const MAX_CHUNK_SIZE = 30000;
const EMPTY_TRAIN_CONSIST_DATA = Object.freeze({
     frontId: null,
     rearId: null,
     frontSpacing: null,
     rearSpacing: null,
});

function getTrainDataCountKey(trainId) {
     return `${TRAIN_DATA_PREFIX}${trainId}_count`;
}

function getTrainDataChunkKey(trainId, index) {
     return `${TRAIN_DATA_PREFIX}${trainId}_${index}`;
}

function getTrainLightCountKey(trainId) {
     return `${TRAIN_LIGHT_PREFIX}${trainId}_count`;
}

function getTrainLightChunkKey(trainId, index) {
     return `${TRAIN_LIGHT_PREFIX}${trainId}_${index}`;
}

function getTrainConsistKey(trainId) {
     return `${TRAIN_CONSIST_PREFIX}${trainId}`;
}

function normalizeTrainConsistData(data) {
     return {
          frontId: typeof data?.frontId === "string" ? data.frontId : null,
          rearId: typeof data?.rearId === "string" ? data.rearId : null,
          frontSpacing:
               Number.isFinite(data?.frontSpacing) && data.frontSpacing > 0
                    ? data.frontSpacing
                    : null,
          rearSpacing:
               Number.isFinite(data?.rearSpacing) && data.rearSpacing > 0
                    ? data.rearSpacing
                    : null,
     };
}

function isEmptyTrainConsistData(data) {
     return (
          !data.frontId &&
          !data.rearId &&
          data.frontSpacing === null &&
          data.rearSpacing === null
     );
}

function splitIntoChunks(value, chunkSize) {
     const chunks = [];

     for (let index = 0; index < value.length; index += chunkSize) {
          chunks.push(value.substring(index, index + chunkSize));
     }

     return chunks;
}

function saveChunkedJson(countKey, chunkKeyFactory, data) {
     const chunks = splitIntoChunks(JSON.stringify(data), MAX_CHUNK_SIZE);

     world.setDynamicProperty(countKey, chunks.length);

     chunks.forEach((chunk, index) => {
          world.setDynamicProperty(chunkKeyFactory(index), chunk);
     });
}

function loadChunkedJson(countKey, chunkKeyFactory) {
     const chunkCount = world.getDynamicProperty(countKey);
     if (chunkCount === undefined || chunkCount === null) {
          return null;
     }

     let combinedData = "";

     for (let index = 0; index < chunkCount; index++) {
          const chunk = world.getDynamicProperty(chunkKeyFactory(index));

          if (chunk) {
               combinedData += chunk;
          }
     }

     return combinedData ? JSON.parse(combinedData) : null;
}

function deleteChunkedJson(countKey, chunkKeyFactory) {
     const chunkCount = world.getDynamicProperty(countKey);

     if (chunkCount === undefined || chunkCount === null) {
          return;
     }

     for (let index = 0; index < chunkCount; index++) {
          world.setDynamicProperty(chunkKeyFactory(index), undefined);
     }

     world.setDynamicProperty(countKey, undefined);
}

// 记录所有已组装列车的矿车 id，供其他模块快速判断目标类型。
class MinecartRegistry {
     constructor() {
          this._world = world;
          this._storageKey = MINECART_LIST_KEY;
          this._list = this._loadFromStorage();
          // 数组保留写入顺序，Set 用于加速查询。
          this._set = new Set(this._list);
     }

     _loadFromStorage() {
          const rawData = this._world.getDynamicProperty(this._storageKey);
          return rawData ? JSON.parse(rawData) : [];
     }

     _saveToStorage() {
          this._world.setDynamicProperty(
               this._storageKey,
               JSON.stringify(this._list)
          );
     }

     add(minecartId) {
          if (this.has(minecartId)) {
               return false;
          }

          this._list.push(minecartId);
          this._set.add(minecartId);
          this._saveToStorage();
          return true;
     }

     has(minecartId) {
          return this._set.has(minecartId);
     }

     remove(minecartId) {
          const initialLength = this._list.length;
          this._list = this._list.filter((id) => id !== minecartId);

          if (this._list.length === initialLength) {
               return false;
          }

          this._set.delete(minecartId);
          this._saveToStorage();
          return true;
     }

     getAll() {
          return [...this._list];
     }

     clear() {
          this._list = [];
          this._set.clear();
          this._saveToStorage();
     }
}

class TrainConsistStore {
     constructor() {
          this._world = world;
          this._cache = new Map();
          this._activeTrainIds = new Set();
          this._hydrateActiveTrainIds();
     }

     _getStorageKey(trainId) {
          return getTrainConsistKey(trainId);
     }

     _hydrateActiveTrainIds() {
          for (const trainId of minecartRegistry.getAll()) {
               if (this._world.getDynamicProperty(this._getStorageKey(trainId))) {
                    this._activeTrainIds.add(trainId);
               }
          }
     }

     get(trainId) {
          if (!this._cache.has(trainId)) {
               const rawData = this._world.getDynamicProperty(
                    this._getStorageKey(trainId)
               );
               const parsedData = rawData
                    ? normalizeTrainConsistData(JSON.parse(rawData))
                    : { ...EMPTY_TRAIN_CONSIST_DATA };

               this._cache.set(trainId, parsedData);
          }

          return { ...this._cache.get(trainId) };
     }

     save(trainId, data) {
          const normalizedData = normalizeTrainConsistData(data);

          this._cache.set(trainId, normalizedData);

          if (isEmptyTrainConsistData(normalizedData)) {
               this._activeTrainIds.delete(trainId);
               this._world.setDynamicProperty(
                    this._getStorageKey(trainId),
                    undefined
               );
          } else {
               this._activeTrainIds.add(trainId);
               this._world.setDynamicProperty(
                    this._getStorageKey(trainId),
                    JSON.stringify(normalizedData)
               );
          }

          return { ...normalizedData };
     }

     delete(trainId) {
          this._cache.delete(trainId);
          this._activeTrainIds.delete(trainId);
          this._world.setDynamicProperty(this._getStorageKey(trainId), undefined);
     }

     hasAny() {
          return this._activeTrainIds.size > 0;
     }

     getActiveTrainIds() {
          return [...this._activeTrainIds];
     }
}

export const minecartRegistry = new MinecartRegistry();
const trainConsistStore = new TrainConsistStore();
const trainDataCache = new Map();
const trainLightDataCache = new Map();
// 记录仍被隐藏座位占用的实体块，更新器回收时需要跳过。
export const activePlayerSeats = new Map();

// 列车数据在脚本运行期走内存缓存，避免每次读取都重新拼接并解析 JSON。
export function saveTrainData(trainId, data) {
     trainDataCache.set(trainId, data);
     saveChunkedJson(
          getTrainDataCountKey(trainId),
          (index) => getTrainDataChunkKey(trainId, index),
          data
     );
}

// 同一运行期里直接复用缓存，真正缺失时才回退到动态属性读取。
export function loadTrainData(trainId) {
     if (trainDataCache.has(trainId)) {
          return trainDataCache.get(trainId);
     }

     const trainData = loadChunkedJson(
          getTrainDataCountKey(trainId),
          (index) => getTrainDataChunkKey(trainId, index)
     );

     if (trainData) {
          trainDataCache.set(trainId, trainData);
     }

     return trainData;
}

// 删除列车数据时，同时清理与旋转补丁相关的动态属性。
export function deleteTrainData(trainId) {
     trainDataCache.delete(trainId);
     deleteChunkedJson(
          getTrainDataCountKey(trainId),
          (index) => getTrainDataChunkKey(trainId, index)
     );
     world.setDynamicProperty(`initialRotation_${trainId}`, undefined);
     world.setDynamicProperty(`hasInitialRotation_${trainId}`, undefined);
     world.setDynamicProperty(`delayedInitialRotation_${trainId}`, undefined);
}

export function saveTrainLightData(trainId, data) {
     trainLightDataCache.set(trainId, data);
     saveChunkedJson(
          getTrainLightCountKey(trainId),
          (index) => getTrainLightChunkKey(trainId, index),
          data
     );
}

export function loadTrainLightData(trainId) {
     if (trainLightDataCache.has(trainId)) {
          return trainLightDataCache.get(trainId);
     }

     const trainLightData = loadChunkedJson(
          getTrainLightCountKey(trainId),
          (index) => getTrainLightChunkKey(trainId, index)
     );

     if (trainLightData) {
          trainLightDataCache.set(trainId, trainLightData);
     }

     return trainLightData;
}

export function deleteTrainLightData(trainId) {
     trainLightDataCache.delete(trainId);
     deleteChunkedJson(
          getTrainLightCountKey(trainId),
          (index) => getTrainLightChunkKey(trainId, index)
     );
}

export function loadTrainConsistData(trainId) {
     return trainConsistStore.get(trainId);
}

export function saveTrainConsistData(trainId, data) {
     return trainConsistStore.save(trainId, data);
}

export function deleteTrainConsistData(trainId) {
     trainConsistStore.delete(trainId);
}

export function hasActiveTrainConsists() {
     return trainConsistStore.hasAny();
}

export function getActiveTrainConsistIds() {
     return trainConsistStore.getActiveTrainIds();
}
