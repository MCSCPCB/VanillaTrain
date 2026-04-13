import { BlockVolume, system, world } from "@minecraft/server";

import { saveTrainData } from "./DataStorage.js";
import {
     loadTrainPluginBlockRegistry,
     TRAIN_PLUGIN_ATTACHED_TAG,
} from "./TrainPluginProtocol.js";
import { getOverworldDimension } from "./shared.js";

const PLUGIN_RENDER_VERSION = 1;
const DOOR_SPECIAL_BLOCK_TYPE = "door";
const PLUGIN_ATTACHMENT_VALIDATION_INTERVAL = 5;

const pluginRuntimeStates = new Map();

export function createEmptyTrainPluginRenderState() {
     return {
          version: PLUGIN_RENDER_VERSION,
          plugins: [],
     };
}

// 仅在缓存快照是当前版本且插件列表已明确写入时，返回是否存在插件渲染。
// 返回 null 表示当前数据不足以安全跳过运行时构建逻辑。
export function hasKnownTrainPluginSnapshots(trainData) {
     const pluginRender = trainData?.pluginRender;
     if (
          pluginRender?.version !== PLUGIN_RENDER_VERSION ||
          !Array.isArray(pluginRender.plugins)
     ) {
          return null;
     }

     return pluginRender.plugins.length > 0;
}

function formatMolangNumber(value) {
     if (!Number.isFinite(value)) {
          return "0";
     }

     const rounded = Math.round(value * 1000) / 1000;
     return Object.is(rounded, -0) ? "0" : `${rounded}`;
}

function normalizeNumber(value, fallback = 0) {
     return Number.isFinite(value) ? value : fallback;
}

function normalizePositiveNumber(value, fallback = 1) {
     return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getPermutationState(permutation, stateName) {
     try {
          return permutation?.getState(stateName);
     } catch {
          return undefined;
     }
}

function cloneRotationArray(rotation = null) {
     return [
          normalizeNumber(rotation?.[0], 0),
          normalizeNumber(rotation?.[1], 0),
          normalizeNumber(rotation?.[2], 0),
     ];
}

function areRotationsEqual(left, right) {
     return (
          Array.isArray(left) &&
          Array.isArray(right) &&
          left.length === right.length &&
          left.every((value, index) => value === right[index])
     );
}

function cloneEntry(entry) {
     const clonedEntry = {
          ...entry,
          offsetPx: Array.isArray(entry?.offsetPx)
               ? entry.offsetPx.map((value) => normalizeNumber(value, 0))
               : [0, 0, 0],
          rotation: cloneRotationArray(entry?.rotation),
          scale: normalizePositiveNumber(entry?.scale, 1),
          materialIndex: normalizeNumber(entry?.materialIndex, 0),
     };

     if (entry?.closedRotation) {
          clonedEntry.closedRotation = cloneRotationArray(entry.closedRotation);
     }

     if (entry?.openRotation) {
          clonedEntry.openRotation = cloneRotationArray(entry.openRotation);
     }

     return clonedEntry;
}

function matchesRotationRuleTest(permutation, test) {
     if (!test || typeof test.stateName !== "string") {
          return false;
     }

     const actualValue = getPermutationState(permutation, test.stateName);
     const expectedValue = test.value;

     if (typeof expectedValue === "string") {
          return (
               typeof actualValue === "string" &&
               actualValue.toLowerCase() === expectedValue
          );
     }

     return actualValue === expectedValue;
}

function getMatchedDeclaredRotationRule(definition, permutation) {
     const rules = Array.isArray(definition?.rotationRules)
          ? definition.rotationRules
          : [];

     let matchedRule = null;
     for (const rule of rules) {
          const rotation = rule?.rotation;
          if (!Array.isArray(rotation) || rotation.length !== 3) {
               continue;
          }

          const tests = Array.isArray(rule?.tests) ? rule.tests : [];
          if (!tests.every((test) => matchesRotationRuleTest(permutation, test))) {
               continue;
          }

          matchedRule = rule;
     }

     return matchedRule;
}

function ruleReferencesAnyState(rule, stateNames) {
     const tests = Array.isArray(rule?.tests) ? rule.tests : [];
     return tests.some(
          (test) =>
               typeof test?.stateName === "string" &&
               stateNames.includes(test.stateName)
     );
}

function getCardinalDirectionRotation(direction) {
     const rotation = [0, 0, 0];

     if (direction === "west") {
          rotation[1] = 1;
     } else if (direction === "north") {
          rotation[1] = 2;
     } else if (direction === "east") {
          rotation[1] = 3;
     }

     return rotation;
}

function getFirstStringPermutationState(permutation, stateNames) {
     for (const stateName of stateNames) {
          const value = getPermutationState(permutation, stateName);
          if (typeof value === "string") {
               return value;
          }
     }

     return undefined;
}

function getFirstNumberPermutationState(permutation, stateNames) {
     for (const stateName of stateNames) {
          const value = getPermutationState(permutation, stateName);
          if (typeof value === "number") {
               return value;
          }
     }

     return undefined;
}

function getHorizontalFacingDirectionRotation(direction) {
     const rotation = [0, 0, 0];

     if (direction === 3) {
          rotation[1] = 2;
     } else if (direction === 4) {
          rotation[1] = 1;
     } else if (direction === 5) {
          rotation[1] = 3;
     }

     return rotation;
}

function getDirectionRotation(direction) {
     const rotation = [0, 0, 0];

     rotation[1] = direction ?? 0;
     if (direction === 1) {
          rotation[1] = 2;
     } else if (direction === 2) {
          rotation[1] = 1;
     }

     return rotation;
}

function getBasicHorizontalRotation(permutation) {
     const cardinalDirection = getFirstStringPermutationState(permutation, [
          "minecraft:cardinal_direction",
          "cardinal_direction",
          "facing",
          "facing_direction",
          "minecraft:facing_direction",
          "direction",
          "minecraft:direction",
     ]);
     if (typeof cardinalDirection === "string") {
          return getCardinalDirectionRotation(cardinalDirection);
     }

     const facingDirection = getFirstNumberPermutationState(permutation, [
          "facing_direction",
          "minecraft:facing_direction",
     ]);
     if (
          typeof facingDirection === "number" &&
          facingDirection >= 2 &&
          facingDirection <= 5
     ) {
          return getHorizontalFacingDirectionRotation(facingDirection);
     }

     const direction = getFirstNumberPermutationState(permutation, [
          "direction",
          "minecraft:direction",
     ]);
     if (typeof direction === "number" && direction >= 0 && direction <= 3) {
          return getDirectionRotation(direction);
     }

     return [0, 0, 0];
}

function getDoorRotation(permutation, isOpen, declaredRotationRule = null) {
     const declaredRotation = Array.isArray(declaredRotationRule?.rotation)
          ? cloneRotationArray(declaredRotationRule.rotation)
          : null;
     const rotation = declaredRotation ?? [0, 0, 0];

     if (!declaredRotation) {
          const cardinalDirection = getFirstStringPermutationState(permutation, [
               "direction",
               "minecraft:direction",
               "facing",
               "facing_direction",
               "minecraft:facing_direction",
               "minecraft:cardinal_direction",
               "cardinal_direction",
          ]);
          if (typeof cardinalDirection === "string") {
               rotation[1] = getCardinalDirectionRotation(cardinalDirection)[1];
          }

          const direction = getFirstNumberPermutationState(permutation, [
               "direction",
               "minecraft:direction",
          ]);
          if (typeof direction === "number" && direction >= 0 && direction <= 3) {
               rotation[1] = direction;
          } else if (cardinalDirection === undefined) {
               rotation[1] = getBasicHorizontalRotation(permutation)[1];
          }
     }

     if (!isOpen) {
          return rotation;
     }

     if (
          declaredRotationRule &&
          ruleReferencesAnyState(declaredRotationRule, [
               "open",
               "open_bit",
               "ff:open_bit",
               "minecraft:open_bit",
          ])
     ) {
          return rotation;
     }

     const hingeBit = Boolean(getPermutationState(permutation, "door_hinge_bit"));
     rotation[1] = (rotation[1] + (hingeBit ? 1 : 3)) % 4;
     return rotation;
}

function normalizeQuarterTurn(value) {
     return (((value ?? 0) % 4) + 4) % 4;
}

function adjustCustomModelHorizontalRotation(rotation) {
     const adjustedRotation = cloneRotationArray(rotation);
     adjustedRotation[1] = normalizeQuarterTurn(2 - adjustedRotation[1]);
     return adjustedRotation;
}

function getDefinitionRotation(definition, permutation, isDoorOpen) {
     const declaredRotationRule = getMatchedDeclaredRotationRule(
          definition,
          permutation
     );

     let rotation = null;
     if (definition?.specialInteraction === DOOR_SPECIAL_BLOCK_TYPE) {
          rotation = getDoorRotation(
               permutation,
               isDoorOpen,
               declaredRotationRule
          );
     } else if (declaredRotationRule) {
          rotation = cloneRotationArray(declaredRotationRule.rotation);
     } else {
          rotation = getBasicHorizontalRotation(permutation);
     }

     if (definition?.renderMode === "custom_model") {
          return adjustCustomModelHorizontalRotation(rotation);
     }

     return rotation;
}

function createOffsetKey(offset) {
     return [
          formatMolangNumber(offset?.x),
          formatMolangNumber(offset?.y),
          formatMolangNumber(offset?.z),
     ].join("|");
}

function createPluginPositionFromMinecartOffset(offset) {
     return {
          px: normalizeNumber(offset?.x, 0) + 0.5,
          py: normalizeNumber(offset?.y, 0),
          pz: -(normalizeNumber(offset?.z, 0) + 0.5),
     };
}

function createPluginPositionFromStructureLocation(location, coreOffset) {
     return {
          px: normalizeNumber(location?.x, 0) + 0.5 - normalizeNumber(coreOffset?.x, 0),
          py: normalizeNumber(location?.y, 0) - normalizeNumber(coreOffset?.y, 0),
          pz:
               -(
                    normalizeNumber(location?.z, 0) +
                    0.5 -
                    normalizeNumber(coreOffset?.z, 0)
               ),
     };
}

function createPluginSnapshot(definition) {
     return {
          ownerKey: definition.ownerKey,
          pluginName: definition.pluginName,
          runtimeNamespace: definition.runtimeNamespace,
          buildTag: definition.buildTag,
          activeTag: definition.activeTag,
          collectorTag: definition.collectorTag,
          fragmentTag: definition.fragmentTag,
          simpleFragmentTag: definition.simpleFragmentTag,
          collectorType: definition.collectorType,
          fragmentType: definition.fragmentType,
          simpleFragmentType: definition.simpleFragmentType,
          fragmentAnimation: definition.fragmentAnimation,
          simpleFragmentAnimation: definition.simpleFragmentAnimation,
          fragmentSlotCount: Math.max(1, Math.floor(definition.fragmentSlotCount ?? 16)),
          simpleFragmentSlotCount: Math.max(
               1,
               Math.floor(definition.simpleFragmentSlotCount ?? 256)
          ),
          fragmentsPerCollector: Math.max(
               1,
               Math.floor(definition.fragmentsPerCollector ?? 64)
          ),
          animationRefreshInterval: Math.max(
               1,
               Math.floor(definition.animationRefreshInterval ?? 20)
          ),
          atlasEntries: [],
          customEntries: [],
          hasDynamicDoors: false,
     };
}

function createPluginBaseEntry(definition, position, permutation, isDoorOpen) {
     return {
          px: normalizeNumber(position?.px, 0),
          py: normalizeNumber(position?.py, 0),
          pz: normalizeNumber(position?.pz, 0),
          offsetPx: Array.isArray(definition?.offsetPx)
               ? definition.offsetPx.map((value) => normalizeNumber(value, 0))
               : [0, 0, 0],
          rotation: getDefinitionRotation(definition, permutation, isDoorOpen),
          scale: normalizePositiveNumber(definition?.scale, 1),
          materialIndex: normalizeNumber(definition?.materialIndex, 0),
     };
}

function appendDoorEntryState(entry, definition, permutation, offset, isDoorOpen) {
     const offsetKey = createOffsetKey(offset);
     entry.doorOffsetKey = offsetKey;
     entry.defaultDoorOpen = Boolean(isDoorOpen);
     entry.closedRotation = cloneRotationArray(
          getDefinitionRotation(definition, permutation, false)
     );
     entry.openRotation = cloneRotationArray(
          getDefinitionRotation(definition, permutation, true)
     );
     entry.rotation = cloneRotationArray(
          isDoorOpen ? entry.openRotation : entry.closedRotation
     );
}

function appendPluginBlockEntry(
     pluginSnapshot,
     definition,
     permutation,
     position,
     offset,
     isDoorOpen
) {
     const entry = createPluginBaseEntry(
          definition,
          position,
          permutation,
          isDoorOpen
     );

     if (definition.specialInteraction === DOOR_SPECIAL_BLOCK_TYPE) {
          pluginSnapshot.hasDynamicDoors = true;
          appendDoorEntryState(
               entry,
               definition,
               permutation,
               offset,
               isDoorOpen
          );
     }

     if (definition.renderMode === "custom_model") {
          entry.geometryIndex = normalizeNumber(definition.geometryIndex, 0);
          entry.textureIndex = normalizeNumber(definition.textureIndex, 0);
          pluginSnapshot.customEntries.push(entry);
          return;
     }

     entry.typeIndex = normalizeNumber(definition.typeIndex, 0);
     entry.modelIndex = normalizeNumber(definition.modelIndex, -1);
     pluginSnapshot.atlasEntries.push(entry);
}

export class TrainPluginRenderBuilder {
     constructor() {
          this.pluginSnapshots = new Map();
     }

     appendBlock(block, offset, definition, isDoorOpen = false) {
          if (!block?.permutation || !definition?.ownerKey) {
               return false;
          }

          if (
               definition.specialInteraction === DOOR_SPECIAL_BLOCK_TYPE &&
               Boolean(getPermutationState(block.permutation, "upper_block_bit"))
          ) {
               return false;
          }

          let pluginSnapshot = this.pluginSnapshots.get(definition.ownerKey);
          if (!pluginSnapshot) {
               pluginSnapshot = createPluginSnapshot(definition);
               this.pluginSnapshots.set(definition.ownerKey, pluginSnapshot);
          }

          appendPluginBlockEntry(
               pluginSnapshot,
               definition,
               block.permutation,
               createPluginPositionFromMinecartOffset(offset),
               offset,
               isDoorOpen
          );

          return true;
     }

     build() {
          return {
               version: PLUGIN_RENDER_VERSION,
               plugins: [...this.pluginSnapshots.values()].filter((snapshot) => {
                    return (
                         snapshot.atlasEntries.length > 0 ||
                         snapshot.customEntries.length > 0
                    );
               }),
          };
     }
}

function createCustomSlotReset(slotIndex) {
     return [
          `v.b${slotIndex}_model=0;`,
          `v.b${slotIndex}_texture=0;`,
          `v.b${slotIndex}px=0;`,
          `v.b${slotIndex}py=0;`,
          `v.b${slotIndex}pz=0;`,
          `v.b${slotIndex}ox=0;`,
          `v.b${slotIndex}oy=0;`,
          `v.b${slotIndex}oz=0;`,
          `v.b${slotIndex}rx=0;`,
          `v.b${slotIndex}ry=0;`,
          `v.b${slotIndex}rz=0;`,
          `v.b${slotIndex}s=1;`,
          `v.b${slotIndex}material=0;`,
          `v.b${slotIndex}v=0;`,
     ].join("");
}

function createSimpleSlotReset(slotIndex) {
     return [
          `v.b${slotIndex}_type=0;`,
          `v.b${slotIndex}_model=-1;`,
          `v.b${slotIndex}px=0;`,
          `v.b${slotIndex}py=0;`,
          `v.b${slotIndex}pz=0;`,
          `v.b${slotIndex}ox=0;`,
          `v.b${slotIndex}oy=0;`,
          `v.b${slotIndex}oz=0;`,
          `v.b${slotIndex}rx=0;`,
          `v.b${slotIndex}ry=0;`,
          `v.b${slotIndex}rz=0;`,
          `v.b${slotIndex}s=1;`,
          `v.b${slotIndex}material=0;`,
          `v.b${slotIndex}v=0;`,
     ].join("");
}

function buildSlotResetStack(slotCount, createSlotReset) {
     let stack = "";

     for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
          stack += createSlotReset(slotIndex);
     }

     return stack;
}

const customResetStackCache = new Map();
const simpleResetStackCache = new Map();

function getCustomResetStack(slotCount) {
     if (!customResetStackCache.has(slotCount)) {
          customResetStackCache.set(
               slotCount,
               buildSlotResetStack(slotCount, createCustomSlotReset)
          );
     }

     return customResetStackCache.get(slotCount);
}

function getSimpleResetStack(slotCount) {
     if (!simpleResetStackCache.has(slotCount)) {
          simpleResetStackCache.set(
               slotCount,
               buildSlotResetStack(slotCount, createSimpleSlotReset)
          );
     }

     return simpleResetStackCache.get(slotCount);
}

function createCustomSlotAssignment(slotIndex, entry) {
     return [
          `v.b${slotIndex}_model=${normalizeNumber(entry?.geometryIndex, 0)};`,
          `v.b${slotIndex}_texture=${normalizeNumber(entry?.textureIndex, 0)};`,
          `v.b${slotIndex}px=${formatMolangNumber(entry?.px)};`,
          `v.b${slotIndex}py=${formatMolangNumber(entry?.py)};`,
          `v.b${slotIndex}pz=${formatMolangNumber(entry?.pz)};`,
          `v.b${slotIndex}ox=${formatMolangNumber(entry?.offsetPx?.[0])};`,
          `v.b${slotIndex}oy=${formatMolangNumber(entry?.offsetPx?.[1])};`,
          `v.b${slotIndex}oz=${formatMolangNumber(entry?.offsetPx?.[2])};`,
          `v.b${slotIndex}rx=${formatMolangNumber(entry?.rotation?.[0])};`,
          `v.b${slotIndex}ry=${formatMolangNumber(entry?.rotation?.[1])};`,
          `v.b${slotIndex}rz=${formatMolangNumber(entry?.rotation?.[2])};`,
          `v.b${slotIndex}s=${formatMolangNumber(entry?.scale)};`,
          `v.b${slotIndex}material=${normalizeNumber(entry?.materialIndex, 0)};`,
          `v.b${slotIndex}v=1;`,
     ].join("");
}

function createSimpleSlotAssignment(slotIndex, entry) {
     return [
          `v.b${slotIndex}_type=${normalizeNumber(entry?.typeIndex, 0)};`,
          `v.b${slotIndex}_model=${normalizeNumber(entry?.modelIndex, -1)};`,
          `v.b${slotIndex}px=${formatMolangNumber(entry?.px)};`,
          `v.b${slotIndex}py=${formatMolangNumber(entry?.py)};`,
          `v.b${slotIndex}pz=${formatMolangNumber(entry?.pz)};`,
          `v.b${slotIndex}ox=${formatMolangNumber(entry?.offsetPx?.[0])};`,
          `v.b${slotIndex}oy=${formatMolangNumber(entry?.offsetPx?.[1])};`,
          `v.b${slotIndex}oz=${formatMolangNumber(entry?.offsetPx?.[2])};`,
          `v.b${slotIndex}rx=${formatMolangNumber(entry?.rotation?.[0])};`,
          `v.b${slotIndex}ry=${formatMolangNumber(entry?.rotation?.[1])};`,
          `v.b${slotIndex}rz=${formatMolangNumber(entry?.rotation?.[2])};`,
          `v.b${slotIndex}s=${formatMolangNumber(entry?.scale)};`,
          `v.b${slotIndex}material=${normalizeNumber(entry?.materialIndex, 0)};`,
          `v.b${slotIndex}v=1;`,
     ].join("");
}

function createCustomFragmentStopExpression(entries, slotCount) {
     let stack = getCustomResetStack(slotCount);

     entries.forEach((entry, slotIndex) => {
          stack += createCustomSlotAssignment(slotIndex, entry);
     });

     return `${stack}return 0;`;
}

function createSimpleFragmentStopExpression(entries, slotCount) {
     let stack = getSimpleResetStack(slotCount);

     entries.forEach((entry, slotIndex) => {
          stack += createSimpleSlotAssignment(slotIndex, entry);
     });

     return `${stack}return 0;`;
}

function buildGroups(snapshot, atlasEntries, customEntries) {
     const groups = [];
     const simpleSlotCount = Math.max(1, snapshot?.simpleFragmentSlotCount ?? 256);
     const customSlotCount = Math.max(1, snapshot?.fragmentSlotCount ?? 16);

     for (
          let offset = 0, groupIndex = 0;
          offset < atlasEntries.length;
          offset += simpleSlotCount, groupIndex += 1
     ) {
          const slice = atlasEntries.slice(offset, offset + simpleSlotCount);
          groups.push({
               key: `simple_${groupIndex}`,
               entityType: snapshot.simpleFragmentType,
               animationId: snapshot.simpleFragmentAnimation,
               stack: createSimpleFragmentStopExpression(slice, simpleSlotCount),
          });
     }

     for (
          let offset = 0, groupIndex = 0;
          offset < customEntries.length;
          offset += customSlotCount, groupIndex += 1
     ) {
          const slice = customEntries.slice(offset, offset + customSlotCount);
          groups.push({
               key: `custom_${groupIndex}`,
               entityType: snapshot.fragmentType,
               animationId: snapshot.fragmentAnimation,
               stack: createCustomFragmentStopExpression(slice, customSlotCount),
          });
     }

     return groups;
}

function createRuntimeDoorStateSnapshot(trainData) {
     const doorStateMap = new Map();
     const signatureParts = [];

     if (!Array.isArray(trainData?.specialBlocks)) {
          return {
               map: doorStateMap,
               signature: "",
          };
     }

     trainData.specialBlocks.forEach((specialBlock) => {
          if (
               specialBlock?.type !== DOOR_SPECIAL_BLOCK_TYPE ||
               !specialBlock?.runtimeOnly ||
               !specialBlock?.offset
          ) {
               return;
          }

          const offsetKey = createOffsetKey(specialBlock.offset);
          const isOpen = specialBlock.data === 1;
          doorStateMap.set(offsetKey, isOpen);
          signatureParts.push(`${offsetKey}:${isOpen ? 1 : 0}`);
     });

     signatureParts.sort();
     return {
          map: doorStateMap,
          signature: signatureParts.join(";"),
     };
}

function haveGroupsChanged(previousGroups, nextGroups) {
     return (
          previousGroups.length !== nextGroups.length ||
          nextGroups.some(
               (group, index) =>
                    previousGroups[index]?.stack !== group.stack ||
                    previousGroups[index]?.entityType !== group.entityType
          )
     );
}

function applyRuntimeDoorStateToEntries(entries, runtimeDoorStateMap) {
     let changed = false;

     for (const entry of entries) {
          if (!entry?.doorOffsetKey) {
               continue;
          }

          const isOpen = runtimeDoorStateMap?.has(entry.doorOffsetKey)
               ? Boolean(runtimeDoorStateMap.get(entry.doorOffsetKey))
               : Boolean(entry.defaultDoorOpen);
          const targetRotation = isOpen
               ? entry.openRotation
               : entry.closedRotation;

          if (areRotationsEqual(entry.rotation, targetRotation)) {
               continue;
          }

          entry.rotation = cloneRotationArray(targetRotation);
          changed = true;
     }

     return changed;
}

function createPluginRuntimeState(snapshot) {
     return {
          snapshotRef: snapshot,
          collectors: new Map(),
          collectorRefs: new Map(),
          renderEntities: new Map(),
          renderEntityRefs: new Map(),
          atlasEntries: snapshot.atlasEntries.map(cloneEntry),
          customEntries: snapshot.customEntries.map(cloneEntry),
          groups: [],
          groupsDirty: true,
          runtimeDoorSignature: "",
          forceDoorRefresh: true,
          animationRefreshCountdown: 0,
          pendingAnimationRefresh: true,
          validationCountdown: 0,
          lastRotationSignature: "",
     };
}

function rehydratePluginRuntimeState(state, snapshot) {
     state.snapshotRef = snapshot;
     state.atlasEntries = snapshot.atlasEntries.map(cloneEntry);
     state.customEntries = snapshot.customEntries.map(cloneEntry);
     state.groups = [];
     state.groupsDirty = true;
     state.runtimeDoorSignature = "";
     state.forceDoorRefresh = true;
     state.animationRefreshCountdown = 0;
     state.pendingAnimationRefresh = true;
     state.validationCountdown = 0;
     state.lastRotationSignature = "";
}

function rebuildGroupsFromEntries(state, snapshot) {
     const nextGroups = buildGroups(snapshot, state.atlasEntries, state.customEntries);
     state.groupsDirty = haveGroupsChanged(state.groups, nextGroups);
     state.groups = nextGroups;
}

function removeEntityById(entityId) {
     if (!entityId) {
          return;
     }

     const entity = world.getEntity(entityId);
     if (entity?.isValid()) {
          entity.remove();
     }
}

function cleanupPluginRuntimeState(state) {
     for (const collectorId of state.collectors.values()) {
          removeEntityById(collectorId);
     }

     for (const renderState of state.renderEntities.values()) {
          removeEntityById(renderState.id);
     }

     state.collectors.clear();
     state.collectorRefs.clear();
     state.renderEntities.clear();
     state.renderEntityRefs.clear();
}

export function cleanupTrainPluginRuntime(minecartId) {
     const runtimeState = pluginRuntimeStates.get(minecartId);
     if (runtimeState) {
          for (const pluginState of runtimeState.plugins.values()) {
               cleanupPluginRuntimeState(pluginState);
          }
          pluginRuntimeStates.delete(minecartId);
     }

     if (!minecartId) {
          return;
     }

     for (const entity of getOverworldDimension().getEntities({
          tags: [minecartId],
     })) {
          if (entity.hasTag(TRAIN_PLUGIN_ATTACHED_TAG)) {
               entity.remove();
          }
     }
}

export function cleanupTrainPluginRuntimeResidue() {
     for (const entity of getOverworldDimension().getEntities({
          tags: [TRAIN_PLUGIN_ATTACHED_TAG],
     })) {
          entity.remove();
     }

     pluginRuntimeStates.clear();
}

function ensureMinecartRuntimeState(minecartId) {
     let runtimeState = pluginRuntimeStates.get(minecartId);
     if (!runtimeState) {
          runtimeState = {
               plugins: new Map(),
               doorStateDirty: true,
          };
          pluginRuntimeStates.set(minecartId, runtimeState);
     }

     return runtimeState;
}

function getCachedEntity(cache, key, entityId) {
     const cached = cache.get(key);
     if (cached?.isValid() && cached.id === entityId) {
          return cached;
     }

     cache.delete(key);
     if (!entityId) {
          return null;
     }

     const entity = world.getEntity(entityId);
     if (!entity?.isValid()) {
          return null;
     }

     cache.set(key, entity);
     return entity;
}

function isRidingEntity(entity, targetId) {
     const riding = entity?.getComponent("minecraft:riding");
     return riding?.entityRidingOn?.id === targetId;
}

function tickAnimationRefresh(state) {
     if (state.groupsDirty || state.pendingAnimationRefresh) {
          return;
     }

     if (state.animationRefreshCountdown <= 0) {
          state.pendingAnimationRefresh = true;
          return;
     }

     state.animationRefreshCountdown -= 1;
}

function consumeAnimationRefresh(state, refreshInterval) {
     if (!state.groupsDirty && !state.pendingAnimationRefresh) {
          return false;
     }

     state.pendingAnimationRefresh = false;
     state.animationRefreshCountdown = Math.max(1, refreshInterval);
     return true;
}

function applyRenderState(entity, group) {
     entity.playAnimation(group.animationId, {
          stopExpression: group.stack,
     });
}

function syncAttachedEntityRotations(state, fragmentRotation) {
     for (const [index, collectorId] of state.collectors.entries()) {
          const collector = getCachedEntity(state.collectorRefs, index, collectorId);
          if (collector?.isValid()) {
               collector.setRotation(fragmentRotation);
          }
     }

     for (const [key, renderState] of state.renderEntities.entries()) {
          const renderEntity = getCachedEntity(
               state.renderEntityRefs,
               key,
               renderState.id
          );
          if (renderEntity?.isValid()) {
               renderEntity.setRotation(fragmentRotation);
          }
     }
}

function refreshPluginDoorState(state, snapshot, trainData, runtimeState) {
     if (!snapshot.hasDynamicDoors) {
          return;
     }

     const doorState = createRuntimeDoorStateSnapshot(trainData);
     if (
          !runtimeState.doorStateDirty &&
          !state.forceDoorRefresh &&
          doorState.signature === state.runtimeDoorSignature
     ) {
          return;
     }

     const atlasChanged = applyRuntimeDoorStateToEntries(
          state.atlasEntries,
          doorState.map
     );
     const customChanged = applyRuntimeDoorStateToEntries(
          state.customEntries,
          doorState.map
     );

     state.runtimeDoorSignature = doorState.signature;
     state.forceDoorRefresh = false;

     if (!atlasChanged && !customChanged) {
          return;
     }

     rebuildGroupsFromEntries(state, snapshot);
     state.pendingAnimationRefresh = true;
     state.validationCountdown = 0;
}

function ensureCollectors(
     state,
     snapshot,
     minecart,
     fragmentRotation,
     validateAttachments
) {
     const collectorEntities = new Map();
     const desiredCount = Math.ceil(
          state.groups.length / Math.max(1, snapshot.fragmentsPerCollector)
     );

     for (const [index, collectorId] of state.collectors.entries()) {
          const collector = getCachedEntity(state.collectorRefs, index, collectorId);
          if (
               index >= desiredCount ||
               !collector?.isValid() ||
               (validateAttachments && !isRidingEntity(collector, minecart.id))
          ) {
               removeEntityById(collectorId);
               state.collectorRefs.delete(index);
               state.collectors.delete(index);
               continue;
          }

          collectorEntities.set(index, collector);
     }

     const minecartRideable = minecart.getComponent("minecraft:rideable");
     if (!minecartRideable) {
          return collectorEntities;
     }

     for (let index = 0; index < desiredCount; index += 1) {
          const existing = collectorEntities.get(index);
          if (existing?.isValid()) {
               continue;
          }

          const collector = getOverworldDimension().spawnEntity(
               snapshot.collectorType,
               minecart.location
          );
          if (snapshot.activeTag) {
               collector.addTag(snapshot.activeTag);
          }
          if (snapshot.collectorTag) {
               collector.addTag(snapshot.collectorTag);
          }
          collector.addTag(TRAIN_PLUGIN_ATTACHED_TAG);
          collector.addTag(minecart.id);
          minecartRideable.addRider(collector);
          collector.setRotation(fragmentRotation);
          state.collectors.set(index, collector.id);
          state.collectorRefs.set(index, collector);
          collectorEntities.set(index, collector);
     }

     return collectorEntities;
}

function spawnRenderEntity(collector, minecart, group, snapshot, state, fragmentRotation) {
     const entity = getOverworldDimension().spawnEntity(group.entityType, minecart.location);

     if (snapshot.activeTag) {
          entity.addTag(snapshot.activeTag);
     }

     const entityTag =
          group.entityType === snapshot.fragmentType
               ? snapshot.fragmentTag
               : snapshot.simpleFragmentTag;
     if (entityTag) {
          entity.addTag(entityTag);
     }

     entity.addTag(TRAIN_PLUGIN_ATTACHED_TAG);
     entity.addTag(minecart.id);
     collector.getComponent("minecraft:rideable")?.addRider(entity);
     entity.setRotation(fragmentRotation);
     state.renderEntities.set(group.key, {
          id: entity.id,
          stack: group.stack,
          entityType: group.entityType,
     });
     state.renderEntityRefs.set(group.key, entity);

     system.runTimeout(() => {
          const delayed = world.getEntity(entity.id);
          if (!delayed?.isValid()) {
               return;
          }

          delayed.setRotation(fragmentRotation);
          applyRenderState(delayed, group);
     }, 5);
}

function syncPluginRenderEntities(
     state,
     snapshot,
     minecart,
     fragmentRotation,
     validateAttachments
) {
     const collectorEntities = ensureCollectors(
          state,
          snapshot,
          minecart,
          fragmentRotation,
          validateAttachments
     );
     const desiredKeys = new Set(state.groups.map((group) => group.key));

     for (const [key, renderState] of state.renderEntities.entries()) {
          if (desiredKeys.has(key)) {
               continue;
          }

          removeEntityById(renderState.id);
          state.renderEntities.delete(key);
          state.renderEntityRefs.delete(key);
     }

     const shouldRefreshAnimation = consumeAnimationRefresh(
          state,
          snapshot.animationRefreshInterval
     );

     state.groups.forEach((group, groupIndex) => {
          const collectorIndex = Math.floor(
               groupIndex / Math.max(1, snapshot.fragmentsPerCollector)
          );
          const collector = collectorEntities.get(collectorIndex) ?? null;
          if (!collector?.isValid()) {
               return;
          }

          const renderState = state.renderEntities.get(group.key);
          const existing = renderState
               ? getCachedEntity(state.renderEntityRefs, group.key, renderState.id)
               : null;

          if (
               !existing?.isValid() ||
               existing.typeId !== group.entityType ||
               (validateAttachments && !isRidingEntity(existing, collector.id))
          ) {
               removeEntityById(renderState?.id);
               state.renderEntities.delete(group.key);
               state.renderEntityRefs.delete(group.key);
               spawnRenderEntity(
                    collector,
                    minecart,
                    group,
                    snapshot,
                    state,
                    fragmentRotation
               );
               return;
          }

          if (renderState.stack !== group.stack || shouldRefreshAnimation) {
               applyRenderState(existing, group);
               renderState.stack = group.stack;
               renderState.entityType = group.entityType;
          }
     });

     state.groupsDirty = false;
}

function getOrCreatePluginSnapshot(pluginSnapshots, definition) {
     let pluginSnapshot = pluginSnapshots.get(definition.ownerKey);
     if (!pluginSnapshot) {
          pluginSnapshot = createPluginSnapshot(definition);
          pluginSnapshots.set(definition.ownerKey, pluginSnapshot);
     }

     return pluginSnapshot;
}

function buildTrainPluginRenderStateFromStructureInternal(
     minecartId,
     trainData,
     pluginBlockRegistry
) {
     if (!trainData?.coreOffset || !(pluginBlockRegistry instanceof Map)) {
          return null;
     }

     const structure = world.structureManager.get(`mystructure:structure_${minecartId}_AABB`);
     if (!structure) {
          return null;
     }

     const pluginSnapshots = new Map();
     const volume = new BlockVolume(
          { x: 0, y: 0, z: 0 },
          {
               x: structure.size.x - 1,
               y: structure.size.y - 1,
               z: structure.size.z - 1,
          }
     );
     const runtimeDoorState = createRuntimeDoorStateSnapshot(trainData).map;

     for (const location of volume.getBlockLocationIterator()) {
          const permutation = structure.getBlockPermutation(location);
          const definition = pluginBlockRegistry.get(permutation?.type?.id);
          if (!definition) {
               continue;
          }

          if (
               definition.specialInteraction === DOOR_SPECIAL_BLOCK_TYPE &&
               Boolean(getPermutationState(permutation, "upper_block_bit"))
          ) {
               continue;
          }

          const offset = {
               x: normalizeNumber(location.x, 0) - normalizeNumber(trainData.coreOffset.x, 0),
               y: normalizeNumber(location.y, 0) - normalizeNumber(trainData.coreOffset.y, 0),
               z: normalizeNumber(location.z, 0) - normalizeNumber(trainData.coreOffset.z, 0),
          };
          const offsetKey = createOffsetKey(offset);
          const isDoorOpen =
               definition.specialInteraction === DOOR_SPECIAL_BLOCK_TYPE
                    ? runtimeDoorState.has(offsetKey)
                         ? Boolean(runtimeDoorState.get(offsetKey))
                         : Boolean(getPermutationState(permutation, "open_bit"))
                    : false;

          appendPluginBlockEntry(
               getOrCreatePluginSnapshot(pluginSnapshots, definition),
               definition,
               permutation,
               createPluginPositionFromStructureLocation(location, trainData.coreOffset),
               offset,
               isDoorOpen
          );
     }

     return {
          version: PLUGIN_RENDER_VERSION,
          plugins: [...pluginSnapshots.values()].filter((snapshot) => {
               return (
                    snapshot.atlasEntries.length > 0 ||
                    snapshot.customEntries.length > 0
               );
          }),
     };
}

function ensureTrainPluginRenderSnapshot(minecartId, trainData) {
     const pluginRender = trainData?.pluginRender;
     if (
          pluginRender?.version === PLUGIN_RENDER_VERSION &&
          Array.isArray(pluginRender.plugins)
     ) {
          return pluginRender;
     }

     const pluginBlockRegistry = loadTrainPluginBlockRegistry();
     if (pluginBlockRegistry.size === 0) {
          return null;
     }

     const rebuiltPluginRender = buildTrainPluginRenderStateFromStructureInternal(
          minecartId,
          trainData,
          pluginBlockRegistry
     );
     if (!rebuiltPluginRender) {
          return null;
     }

     trainData.pluginRender = rebuiltPluginRender;
     saveTrainData(minecartId, trainData);
     return rebuiltPluginRender;
}

function getPluginRotationSignature(fragmentRotation) {
     return [
          formatMolangNumber(fragmentRotation?.x),
          formatMolangNumber(fragmentRotation?.y),
          formatMolangNumber(fragmentRotation?.z),
     ].join("|");
}

function cleanupMissingPluginStates(runtimeState, desiredOwnerKeys) {
     for (const [ownerKey, pluginState] of runtimeState.plugins.entries()) {
          if (desiredOwnerKeys.has(ownerKey)) {
               continue;
          }

          cleanupPluginRuntimeState(pluginState);
          runtimeState.plugins.delete(ownerKey);
     }
}

function ensurePluginRuntimeState(runtimeState, snapshot) {
     let pluginState = runtimeState.plugins.get(snapshot.ownerKey);
     if (!pluginState) {
          pluginState = createPluginRuntimeState(snapshot);
          runtimeState.plugins.set(snapshot.ownerKey, pluginState);
          rebuildGroupsFromEntries(pluginState, snapshot);
          return pluginState;
     }

     if (pluginState.snapshotRef !== snapshot) {
          cleanupPluginRuntimeState(pluginState);
          rehydratePluginRuntimeState(pluginState, snapshot);
          rebuildGroupsFromEntries(pluginState, snapshot);
     }

     return pluginState;
}

export function updateTrainPluginDoorRenderState(
     minecartId,
     trainData,
     specialBlock
) {
     if (
          !minecartId ||
          !trainData?.pluginRender ||
          specialBlock?.type !== DOOR_SPECIAL_BLOCK_TYPE ||
          !specialBlock?.runtimeOnly
     ) {
          return;
     }

     const runtimeState = pluginRuntimeStates.get(minecartId);
     if (runtimeState) {
          runtimeState.doorStateDirty = true;
     }
}

export function updateTrainPluginRuntime(minecart, trainData, fragmentRotation) {
     const minecartId = minecart?.id;
     if (!minecartId || !minecart?.isValid()) {
          return;
     }

     const pluginRender = ensureTrainPluginRenderSnapshot(minecartId, trainData);
     const pluginSnapshots = Array.isArray(pluginRender?.plugins)
          ? pluginRender.plugins
          : [];

     if (pluginSnapshots.length === 0) {
          cleanupTrainPluginRuntime(minecartId);
          return;
     }

     const runtimeState = ensureMinecartRuntimeState(minecartId);
     const desiredOwnerKeys = new Set();
     const rotationSignature = getPluginRotationSignature(fragmentRotation);

     for (const snapshot of pluginSnapshots) {
          desiredOwnerKeys.add(snapshot.ownerKey);

          if (
               snapshot.atlasEntries.length === 0 &&
               snapshot.customEntries.length === 0
          ) {
               continue;
          }

          const pluginState = ensurePluginRuntimeState(runtimeState, snapshot);
          refreshPluginDoorState(pluginState, snapshot, trainData, runtimeState);
          tickAnimationRefresh(pluginState);

          if (
               pluginState.groups.length === 0 &&
               pluginState.atlasEntries.length === 0 &&
               pluginState.customEntries.length === 0
          ) {
               cleanupPluginRuntimeState(pluginState);
               runtimeState.plugins.delete(snapshot.ownerKey);
               continue;
          }

          const validateAttachments =
               pluginState.groupsDirty ||
               pluginState.pendingAnimationRefresh ||
               pluginState.validationCountdown <= 0;

          if (validateAttachments) {
               syncPluginRenderEntities(
                    pluginState,
                    snapshot,
                    minecart,
                    fragmentRotation,
                    pluginState.validationCountdown <= 0
               );
               pluginState.validationCountdown =
                    PLUGIN_ATTACHMENT_VALIDATION_INTERVAL - 1;
          } else {
               pluginState.validationCountdown -= 1;
          }

          if (rotationSignature !== pluginState.lastRotationSignature) {
               syncAttachedEntityRotations(pluginState, fragmentRotation);
               pluginState.lastRotationSignature = rotationSignature;
          }
     }

     cleanupMissingPluginStates(runtimeState, desiredOwnerKeys);
     runtimeState.doorStateDirty = false;

     if (runtimeState.plugins.size === 0) {
          pluginRuntimeStates.delete(minecartId);
     }
}
