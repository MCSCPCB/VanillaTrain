import { system } from "@minecraft/server";

import {
     ANIMATION_REFRESH_INTERVAL,
     BLOCK_DEFINITIONS,
     COLLECTOR_TYPE,
     FRAGMENT_ANIMATION,
     FRAGMENT_SLOT_COUNT,
     FRAGMENT_TYPE,
     FRAGMENTS_PER_COLLECTOR,
     PLUGIN_ACTIVE_TAG,
     PLUGIN_BUILD_TAG,
     PLUGIN_COLLECTOR_TAG,
     PLUGIN_FRAGMENT_TAG,
     PLUGIN_NAME,
     PLUGIN_NAMESPACE,
     PLUGIN_SIMPLE_FRAGMENT_TAG,
     PLUGIN_SOURCE_NAMESPACE,
     SIMPLE_FRAGMENT_ANIMATION,
     SIMPLE_FRAGMENT_SLOT_COUNT,
     SIMPLE_FRAGMENT_TYPE,
} from "./generated/pluginRegistry.js";

const TRAIN_PLUGIN_DISCOVER_EVENT_ID = "train:plugin_registry_discover";
const TRAIN_PLUGIN_READY_EVENT_ID = "train:plugin_registry_ready";
const TRAIN_PLUGIN_REQUEST_EVENT_ID = "train:plugin_registry_request";
const TRAIN_PLUGIN_CHUNK_EVENT_ID = "train:plugin_registry_chunk";
const TRAIN_PLUGIN_REGISTRY_VERSION = 1;
const TRAIN_PLUGIN_REGISTRY_CHUNK_SIZE = 1800;
const TRAIN_PLUGIN_REGISTRY_CHUNKS_PER_TICK = 4;

let activeChunkStreamRunId = undefined;

function splitIntoChunks(value, chunkSize) {
     const chunks = [];

     for (let index = 0; index < value.length; index += chunkSize) {
          chunks.push(value.substring(index, index + chunkSize));
     }

     return chunks;
}

function createRegistryPayload() {
     return {
          version: TRAIN_PLUGIN_REGISTRY_VERSION,
          ownerKey: PLUGIN_SOURCE_NAMESPACE,
          pluginName: PLUGIN_NAME,
          runtimeNamespace: PLUGIN_NAMESPACE,
          buildTag: PLUGIN_BUILD_TAG,
          activeTag: PLUGIN_ACTIVE_TAG,
          collectorTag: PLUGIN_COLLECTOR_TAG,
          fragmentTag: PLUGIN_FRAGMENT_TAG,
          simpleFragmentTag: PLUGIN_SIMPLE_FRAGMENT_TAG,
          collectorType: COLLECTOR_TYPE,
          fragmentType: FRAGMENT_TYPE,
          simpleFragmentType: SIMPLE_FRAGMENT_TYPE,
          fragmentAnimation: FRAGMENT_ANIMATION,
          simpleFragmentAnimation: SIMPLE_FRAGMENT_ANIMATION,
          fragmentSlotCount: FRAGMENT_SLOT_COUNT,
          simpleFragmentSlotCount: SIMPLE_FRAGMENT_SLOT_COUNT,
          fragmentsPerCollector: FRAGMENTS_PER_COLLECTOR,
          animationRefreshInterval: ANIMATION_REFRESH_INTERVAL,
          blockDefinitions: BLOCK_DEFINITIONS,
     };
}

const REGISTRY_CHUNKS = splitIntoChunks(
     JSON.stringify(createRegistryPayload()),
     TRAIN_PLUGIN_REGISTRY_CHUNK_SIZE
);
const REGISTRY_CHUNK_COUNT = REGISTRY_CHUNKS.length;

function createReadyMessage(chunkCount) {
     return `${PLUGIN_SOURCE_NAMESPACE}\n${PLUGIN_BUILD_TAG}\n${chunkCount}`;
}

function createChunkMessage(chunkCount, chunkIndex, chunk) {
     return `${PLUGIN_SOURCE_NAMESPACE}\n${PLUGIN_BUILD_TAG}\n${chunkCount}\n${chunkIndex}\n${chunk}`;
}

function sendReadyEvent() {
     system.sendScriptEvent(
          TRAIN_PLUGIN_READY_EVENT_ID,
          createReadyMessage(REGISTRY_CHUNK_COUNT)
     );
}

function stopChunkStream() {
     if (activeChunkStreamRunId === undefined) {
          return;
     }

     system.clearRun(activeChunkStreamRunId);
     activeChunkStreamRunId = undefined;
}

function startChunkStream() {
     stopChunkStream();

     if (REGISTRY_CHUNK_COUNT === 0) {
          return;
     }

     let nextChunkIndex = 0;
     activeChunkStreamRunId = system.runInterval(() => {
          for (
               let sentCount = 0;
               sentCount < TRAIN_PLUGIN_REGISTRY_CHUNKS_PER_TICK &&
               nextChunkIndex < REGISTRY_CHUNK_COUNT;
               sentCount += 1
          ) {
               system.sendScriptEvent(
                    TRAIN_PLUGIN_CHUNK_EVENT_ID,
                    createChunkMessage(
                         REGISTRY_CHUNK_COUNT,
                         nextChunkIndex,
                         REGISTRY_CHUNKS[nextChunkIndex] ?? ""
                    )
               );
               nextChunkIndex += 1;
          }

          if (nextChunkIndex >= REGISTRY_CHUNK_COUNT) {
               stopChunkStream();
          }
     }, 1);
}

function parseRequestMessage(message) {
     if (typeof message !== "string" || message.length === 0) {
          return null;
     }

     const lineBreakIndex = message.indexOf("\n");
     if (lineBreakIndex === -1) {
          return {
               ownerKey: message,
               buildTag: "",
          };
     }

     const ownerKey = message.substring(0, lineBreakIndex);
     const buildTag = message.substring(lineBreakIndex + 1);

     return ownerKey
          ? {
                 ownerKey,
                 buildTag,
            }
          : null;
}

function handleScriptEvent(event) {
     if (event.id === TRAIN_PLUGIN_DISCOVER_EVENT_ID) {
          sendReadyEvent();
          return;
     }

     if (event.id !== TRAIN_PLUGIN_REQUEST_EVENT_ID) {
          return;
     }

     const requestPayload = parseRequestMessage(event.message);
     if (!requestPayload || requestPayload.ownerKey !== PLUGIN_SOURCE_NAMESPACE) {
          return;
     }

     sendReadyEvent();
     startChunkStream();
}

system.run(() => {
     system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent, {
          namespaces: ["train"],
     });

     sendReadyEvent();
});
