export const PLUGIN_NAME = "Template Train Render Plugin";
export const PLUGIN_SOURCE_NAMESPACE = "template_plugin";
export const PLUGIN_NAMESPACE = "template_plugin_bmni1tmc5";
export const PLUGIN_BUILD_TAG = "bmni1tmc5";
export const COLLECTOR_TYPE = "template_plugin_bmni1tmc5:train_plugin_collector";
export const FRAGMENT_TYPE = "template_plugin_bmni1tmc5:train_fragment";
export const SIMPLE_FRAGMENT_TYPE = "template_plugin_bmni1tmc5:train_simple_fragment";
export const PLUGIN_COLLECTOR_FAMILY = "template_plugin_bmni1tmc5_train_plugin_collector";
export const FRAGMENT_FAMILY = "template_plugin_bmni1tmc5_train_plugin_fragment";
export const SIMPLE_FRAGMENT_FAMILY = "template_plugin_bmni1tmc5_train_plugin_simple_fragment";
export const PLUGIN_TAG_PREFIX = "template_plugin_bmni1tmc5_train_plugin";
export const PLUGIN_ACTIVE_TAG = `${PLUGIN_TAG_PREFIX}_active`;
export const PLUGIN_COLLECTOR_TAG = `${PLUGIN_TAG_PREFIX}_collector`;
export const PLUGIN_FRAGMENT_TAG = `${PLUGIN_TAG_PREFIX}_fragment`;
export const PLUGIN_SIMPLE_FRAGMENT_TAG = `${PLUGIN_TAG_PREFIX}_simple_fragment`;
export const PLUGIN_OWNER_TAG_PREFIX = `${PLUGIN_TAG_PREFIX}_owner_`;
export const PLUGIN_KEY_TAG_PREFIX = `${PLUGIN_TAG_PREFIX}_key_`;
export const PLUGIN_COLLECTOR_INDEX_TAG_PREFIX = `${PLUGIN_TAG_PREFIX}_collector_index_`;
export const TRAIN_PLUGIN_ATTACHED_TAG = "train_plugin_attached";
export const FRAGMENT_SLOT_COUNT = 16;
export const SIMPLE_FRAGMENT_SLOT_COUNT = 256;
export const FRAGMENTS_PER_COLLECTOR = 64;
export const ANIMATION_REFRESH_INTERVAL = 20;
export const FRAGMENT_ANIMATION = "animation.template_plugin_bmni1tmc5.train_fragment.update";
export const SIMPLE_FRAGMENT_ANIMATION = "animation.template_plugin_bmni1tmc5.train_simple_fragment.update";
const BLOCK_DATA = {
    "atlas": [],
    "custom": []
};
export const ATLAS_BLOCK_DEFINITIONS = BLOCK_DATA.atlas;
export const CUSTOM_BLOCK_DEFINITIONS = BLOCK_DATA.custom;
export const BLOCK_DEFINITIONS = [...ATLAS_BLOCK_DEFINITIONS, ...CUSTOM_BLOCK_DEFINITIONS];
export const BLOCK_REGISTRY = new Map(BLOCK_DEFINITIONS.map((entry) => [entry.blockId, entry]));
