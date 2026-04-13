import { system, world } from "@minecraft/server";

export const TRAIN_PLUGIN_ATTACHED_TAG = "train_plugin_attached";

const TRAIN_PLUGIN_EVENT_NAMESPACE = "train";
const TRAIN_PLUGIN_READY_EVENT_ID =
     `${TRAIN_PLUGIN_EVENT_NAMESPACE}:plugin_registry_ready`;
const TRAIN_PLUGIN_DISCOVER_EVENT_ID =
     `${TRAIN_PLUGIN_EVENT_NAMESPACE}:plugin_registry_discover`;
const TRAIN_PLUGIN_REQUEST_EVENT_ID =
     `${TRAIN_PLUGIN_EVENT_NAMESPACE}:plugin_registry_request`;
const TRAIN_PLUGIN_CHUNK_EVENT_ID =
     `${TRAIN_PLUGIN_EVENT_NAMESPACE}:plugin_registry_chunk`;
const TRAIN_PLUGIN_REGISTRY_VERSION = 1;
const TRAIN_PLUGIN_DISCOVERY_TICKS = 80;
const TRAIN_PLUGIN_STARTUP_RECOVERY_DELAY = 5;

const publishedRegistries = new Map();
const pendingRegistryAssemblies = new Map();
const pendingRegistryRequests = new Map();

let pluginProtocolInitialized = false;
let pluginProtocolActivated = false;
let pluginDiscoveryStarted = false;
let cachedBlockRegistry = new Map();
let isBlockRegistryDirty = true;

function startPluginDiscovery() {
     if (pluginDiscoveryStarted) {
          return;
     }

     pluginDiscoveryStarted = true;

     for (
          let tickOffset = 0;
          tickOffset < TRAIN_PLUGIN_DISCOVERY_TICKS;
          tickOffset += 1
     ) {
          system.runTimeout(() => {
               broadcastRegistryDiscover();
          }, tickOffset);
     }
}

function activatePluginProtocol() {
     if (pluginProtocolActivated) {
          return;
     }

     pluginProtocolActivated = true;
     system.afterEvents.scriptEventReceive.subscribe(handlePluginScriptEvent, {
          namespaces: [TRAIN_PLUGIN_EVENT_NAMESPACE],
     });
     startPluginDiscovery();
}

function handleInitialPlayerSpawn(event) {
     if (!event.initialSpawn || pluginDiscoveryStarted) {
          return;
     }

     world.afterEvents.playerSpawn.unsubscribe(handleInitialPlayerSpawn);
     activatePluginProtocol();
}

function recoverPluginProtocolFromOnlinePlayers() {
     system.runTimeout(() => {
          if (pluginDiscoveryStarted || world.getAllPlayers().length === 0) {
               return;
          }

          world.afterEvents.playerSpawn.unsubscribe(handleInitialPlayerSpawn);
          activatePluginProtocol();
     }, TRAIN_PLUGIN_STARTUP_RECOVERY_DELAY);
}

function normalizeNumber(value, fallback = 0) {
     return Number.isFinite(value) ? value : fallback;
}

function normalizePositiveNumber(value, fallback = 1) {
     return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeRotation(rotation) {
     if (!Array.isArray(rotation) || rotation.length !== 3) {
          return null;
     }

     return rotation.map((value) => normalizeNumber(value, 0));
}

function normalizeRotationRule(rule) {
     const rotation = normalizeRotation(rule?.rotation);
     if (!rotation) {
          return null;
     }

     const tests = Array.isArray(rule?.tests)
          ? rule.tests
               .filter((test) => {
                    return (
                         typeof test?.stateName === "string" &&
                         test.stateName.length > 0 &&
                         (typeof test.value === "string" ||
                              typeof test.value === "number" ||
                              typeof test.value === "boolean")
                    );
               })
               .map((test) => ({
                    stateName: test.stateName,
                    value: test.value,
               }))
          : [];

     return {
          rotation,
          tests,
     };
}

function normalizeOffsetPx(offsetPx) {
     if (!Array.isArray(offsetPx) || offsetPx.length !== 3) {
          return [0, 0, 0];
     }

     return offsetPx.map((value) => normalizeNumber(value, 0));
}

function normalizeRenderMode(renderMode) {
     return renderMode === "custom_model" ? "custom_model" : "atlas";
}

function normalizeSpecialInteraction(value) {
     if (value === "door" || value === "slab_bottom") {
          return value;
     }

     return null;
}

function normalizeCollisionProfile(value, specialInteraction) {
     if (
          value === "none" ||
          value === "full" ||
          value === "slab_bottom"
     ) {
          return value;
     }

     return specialInteraction === "slab_bottom" ? "slab_bottom" : "full";
}

function normalizeBlockDefinition(entry) {
     if (!entry || typeof entry.blockId !== "string") {
          return null;
     }

     const specialInteraction = normalizeSpecialInteraction(
          entry.specialInteraction
     );
     const renderMode = normalizeRenderMode(entry.renderMode);

     const normalizedEntry = {
          blockId: entry.blockId,
          renderMode,
          specialInteraction,
          collisionProfile: normalizeCollisionProfile(
               entry.collisionProfile,
               specialInteraction
          ),
          offsetPx: normalizeOffsetPx(entry.offsetPx),
          scale: normalizePositiveNumber(entry.scale, 1),
          rotationRules: Array.isArray(entry.rotationRules)
               ? entry.rotationRules
                    .map(normalizeRotationRule)
                    .filter(Boolean)
               : [],
          materialIndex: normalizeNumber(entry.materialIndex, 0),
     };

     if (renderMode === "custom_model") {
          normalizedEntry.geometryIndex = normalizeNumber(
               entry.geometryIndex,
               0
          );
          normalizedEntry.textureIndex = normalizeNumber(
               entry.textureIndex,
               0
          );
          return normalizedEntry;
     }

     normalizedEntry.typeIndex = normalizeNumber(entry.typeIndex, 0);
     normalizedEntry.modelIndex = normalizeNumber(entry.modelIndex, -1);
     return normalizedEntry;
}

function normalizeRegistryPayload(payload) {
     if (!payload || payload.version !== TRAIN_PLUGIN_REGISTRY_VERSION) {
          return null;
     }

     if (typeof payload.ownerKey !== "string" || payload.ownerKey.length === 0) {
          return null;
     }

     if (
          typeof payload.collectorType !== "string" ||
          typeof payload.fragmentType !== "string" ||
          typeof payload.simpleFragmentType !== "string" ||
          typeof payload.fragmentAnimation !== "string" ||
          typeof payload.simpleFragmentAnimation !== "string"
     ) {
          return null;
     }

     const blockDefinitions = Array.isArray(payload.blockDefinitions)
          ? payload.blockDefinitions
               .map(normalizeBlockDefinition)
               .filter(Boolean)
          : [];

     return {
          version: TRAIN_PLUGIN_REGISTRY_VERSION,
          ownerKey: payload.ownerKey,
          pluginName:
               typeof payload.pluginName === "string" ? payload.pluginName : "",
          runtimeNamespace:
               typeof payload.runtimeNamespace === "string"
                    ? payload.runtimeNamespace
                    : "",
          buildTag:
               typeof payload.buildTag === "string" ? payload.buildTag : "",
          activeTag:
               typeof payload.activeTag === "string" ? payload.activeTag : "",
          collectorTag:
               typeof payload.collectorTag === "string"
                    ? payload.collectorTag
                    : "",
          fragmentTag:
               typeof payload.fragmentTag === "string"
                    ? payload.fragmentTag
                    : "",
          simpleFragmentTag:
               typeof payload.simpleFragmentTag === "string"
                    ? payload.simpleFragmentTag
                    : "",
          collectorType: payload.collectorType,
          fragmentType: payload.fragmentType,
          simpleFragmentType: payload.simpleFragmentType,
          fragmentAnimation: payload.fragmentAnimation,
          simpleFragmentAnimation: payload.simpleFragmentAnimation,
          fragmentSlotCount: Math.max(
               1,
               Math.floor(normalizeNumber(payload.fragmentSlotCount, 16))
          ),
          simpleFragmentSlotCount: Math.max(
               1,
               Math.floor(normalizeNumber(payload.simpleFragmentSlotCount, 256))
          ),
          fragmentsPerCollector: Math.max(
               1,
               Math.floor(normalizeNumber(payload.fragmentsPerCollector, 64))
          ),
          animationRefreshInterval: Math.max(
               1,
               Math.floor(normalizeNumber(payload.animationRefreshInterval, 20))
          ),
          blockDefinitions,
     };
}

function setBlockRegistryDirty() {
     isBlockRegistryDirty = true;
}

function parseCount(value) {
     const parsed = Number(value);
     return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseReadyMessage(message) {
     const firstBreak = message.indexOf("\n");
     const secondBreak = message.indexOf("\n", firstBreak + 1);

     if (firstBreak === -1 || secondBreak === -1) {
          return null;
     }

     const ownerKey = message.substring(0, firstBreak);
     const buildTag = message.substring(firstBreak + 1, secondBreak);
     const chunkCount = parseCount(message.substring(secondBreak + 1));

     if (!ownerKey || !buildTag || chunkCount === null) {
          return null;
     }

     return {
          ownerKey,
          buildTag,
          chunkCount,
     };
}

function parseChunkMessage(message) {
     const firstBreak = message.indexOf("\n");
     if (firstBreak === -1) {
          return null;
     }

     const secondBreak = message.indexOf("\n", firstBreak + 1);
     if (secondBreak === -1) {
          return null;
     }

     const thirdBreak = message.indexOf("\n", secondBreak + 1);
     if (thirdBreak === -1) {
          return null;
     }

     const fourthBreak = message.indexOf("\n", thirdBreak + 1);
     if (fourthBreak === -1) {
          return null;
     }

     const ownerKey = message.substring(0, firstBreak);
     const buildTag = message.substring(firstBreak + 1, secondBreak);
     const chunkCount = parseCount(message.substring(secondBreak + 1, thirdBreak));
     const chunkIndex = Number(message.substring(thirdBreak + 1, fourthBreak));
     const chunk = message.substring(fourthBreak + 1);

     if (
          !ownerKey ||
          !buildTag ||
          chunkCount === null ||
          !Number.isInteger(chunkIndex) ||
          chunkIndex < 0 ||
          chunkIndex >= chunkCount
     ) {
          return null;
     }

     return {
          ownerKey,
          buildTag,
          chunkCount,
          chunkIndex,
          chunk,
     };
}

function broadcastRegistryDiscover() {
     system.sendScriptEvent(TRAIN_PLUGIN_DISCOVER_EVENT_ID, "");
}

function requestPluginRegistry(ownerKey, buildTag) {
     pendingRegistryRequests.set(ownerKey, buildTag);
     system.sendScriptEvent(
          TRAIN_PLUGIN_REQUEST_EVENT_ID,
          `${ownerKey}\n${buildTag}`
     );
}

function finalizeRegistryAssembly(ownerKey, assembly) {
     const payloadString = assembly.chunks.join("");

     let payload = null;
     try {
          payload = JSON.parse(payloadString);
     } catch {
          pendingRegistryAssemblies.delete(ownerKey);
          pendingRegistryRequests.delete(ownerKey);
          return;
     }

     const normalizedPayload = normalizeRegistryPayload(payload);
     if (!normalizedPayload) {
          pendingRegistryAssemblies.delete(ownerKey);
          pendingRegistryRequests.delete(ownerKey);
          return;
     }

     publishedRegistries.set(ownerKey, normalizedPayload);
     pendingRegistryAssemblies.delete(ownerKey);
     pendingRegistryRequests.delete(ownerKey);
     setBlockRegistryDirty();
}

function handlePluginReady(message) {
     const readyPayload = parseReadyMessage(message);
     if (!readyPayload) {
          return;
     }

     const publishedRegistry = publishedRegistries.get(readyPayload.ownerKey);
     if (publishedRegistry?.buildTag === readyPayload.buildTag) {
          return;
     }

     if (
          pendingRegistryRequests.get(readyPayload.ownerKey) ===
          readyPayload.buildTag
     ) {
          return;
     }

     pendingRegistryAssemblies.delete(readyPayload.ownerKey);
     requestPluginRegistry(readyPayload.ownerKey, readyPayload.buildTag);
}

function handlePluginChunk(message) {
     const chunkPayload = parseChunkMessage(message);
     if (!chunkPayload) {
          return;
     }

     const publishedRegistry = publishedRegistries.get(chunkPayload.ownerKey);
     if (publishedRegistry?.buildTag === chunkPayload.buildTag) {
          pendingRegistryAssemblies.delete(chunkPayload.ownerKey);
          pendingRegistryRequests.delete(chunkPayload.ownerKey);
          return;
     }

     let assembly = pendingRegistryAssemblies.get(chunkPayload.ownerKey);
     if (
          !assembly ||
          assembly.buildTag !== chunkPayload.buildTag ||
          assembly.chunkCount !== chunkPayload.chunkCount
     ) {
          assembly = {
               buildTag: chunkPayload.buildTag,
               chunkCount: chunkPayload.chunkCount,
               chunks: Array(chunkPayload.chunkCount).fill(""),
               receivedCount: 0,
          };
          pendingRegistryAssemblies.set(chunkPayload.ownerKey, assembly);
     }

     if (assembly.chunks[chunkPayload.chunkIndex] === "") {
          assembly.receivedCount += 1;
     }

     assembly.chunks[chunkPayload.chunkIndex] = chunkPayload.chunk;

     if (assembly.receivedCount === assembly.chunkCount) {
          finalizeRegistryAssembly(chunkPayload.ownerKey, assembly);
     }
}

function handlePluginScriptEvent(event) {
     if (event.id === TRAIN_PLUGIN_READY_EVENT_ID) {
          handlePluginReady(event.message);
          return;
     }

     if (event.id === TRAIN_PLUGIN_CHUNK_EVENT_ID) {
          handlePluginChunk(event.message);
     }
}

function rebuildBlockRegistry() {
     const blockRegistry = new Map();

     for (const registry of publishedRegistries.values()) {
          for (const blockDefinition of registry.blockDefinitions) {
               blockRegistry.set(blockDefinition.blockId, {
                    ownerKey: registry.ownerKey,
                    pluginName: registry.pluginName,
                    runtimeNamespace: registry.runtimeNamespace,
                    buildTag: registry.buildTag,
                    activeTag: registry.activeTag,
                    collectorTag: registry.collectorTag,
                    fragmentTag: registry.fragmentTag,
                    simpleFragmentTag: registry.simpleFragmentTag,
                    collectorType: registry.collectorType,
                    fragmentType: registry.fragmentType,
                    simpleFragmentType: registry.simpleFragmentType,
                    fragmentAnimation: registry.fragmentAnimation,
                    simpleFragmentAnimation: registry.simpleFragmentAnimation,
                    fragmentSlotCount: registry.fragmentSlotCount,
                    simpleFragmentSlotCount: registry.simpleFragmentSlotCount,
                    fragmentsPerCollector: registry.fragmentsPerCollector,
                    animationRefreshInterval:
                         registry.animationRefreshInterval,
                    ...blockDefinition,
               });
          }
     }

     cachedBlockRegistry = blockRegistry;
     isBlockRegistryDirty = false;
}

export function initializeTrainPluginRegistry() {
     if (pluginProtocolInitialized) {
          return;
     }

     pluginProtocolInitialized = true;
     pluginProtocolActivated = false;
     pluginDiscoveryStarted = false;
     publishedRegistries.clear();
     pendingRegistryAssemblies.clear();
     pendingRegistryRequests.clear();
     setBlockRegistryDirty();

     world.afterEvents.playerSpawn.subscribe(handleInitialPlayerSpawn);
     recoverPluginProtocolFromOnlinePlayers();
}

export function loadPublishedTrainPluginRegistries() {
     return new Map(publishedRegistries);
}

// 建车时只需要按方块 id 快速定位插件定义，因此这里提供扁平映射。
export function loadTrainPluginBlockRegistry() {
     if (isBlockRegistryDirty) {
          rebuildBlockRegistry();
     }

     return cachedBlockRegistry;
}
