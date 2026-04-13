from __future__ import annotations

import copy
import json
import math
import re
import shutil
import time
import uuid
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = ROOT.parent
CONFIG_PATH = ROOT / "plugin_blocks.json"
BUILD_IDENTITY_PATH = ROOT / ".internal" / "build_identity.json"

BUILD_DIR = ROOT / "build"
BP_DIR = BUILD_DIR / "BP"
RP_DIR = BUILD_DIR / "RP"
ASSETS_TEXTURE_DIR = ROOT / "assets" / "textures"
ASSETS_MODEL_DIR = ROOT / "assets" / "models"
RUNTIME_SCRIPT_TEMPLATE_PATH = ROOT / ".internal" / "runtime_index.js"
AUTO_SOURCE_DIR = ROOT / "auto"
AUTO_BP_BLOCK_DIR = AUTO_SOURCE_DIR / "BP" / "blocks"
AUTO_RP_MODEL_DIR = AUTO_SOURCE_DIR / "RP" / "models" / "blocks"
AUTO_RP_TEXTURE_ROOT = AUTO_SOURCE_DIR / "RP" / "textures"
AUTO_RP_TEXTURE_DIR = AUTO_RP_TEXTURE_ROOT / "blocks"
AUTO_RP_TERRAIN_TEXTURE_PATH = AUTO_RP_TEXTURE_ROOT / "terrain_texture.json"
AUTO_RP_BLOCKS_JSON_PATH = AUTO_SOURCE_DIR / "RP" / "blocks.json"

FRAGMENT_SLOT_COUNT = 16
SIMPLE_FRAGMENT_SLOT_COUNT = 256
FRAGMENTS_PER_COLLECTOR = 64
DEFAULT_FRAGMENT_Y_CORRECTION_PX = -12

TRAIN_BP_MANIFEST_PATH = WORKSPACE_ROOT / "TrainBP" / "manifest.json"
DEFAULT_TRAIN_BP_UUID = "6605dddd-00c3-4848-ad59-3bf4cf072cee"
DEFAULT_TRAIN_BP_VERSION = [1, 0, 0]

ATLAS_SHAPES = {"cube", "slab_bottom", "slab_top", "carpet", "cross"}
ATLAS_MODEL_ORDER = ("cube", "slab_bottom", "slab_top", "carpet", "cross")
ATLAS_FACES = ("north", "east", "south", "west", "up", "down")
ATLAS_FACE_ALIASES = {
    "top": "up",
    "bottom": "down",
}
ATLAS_FACE_LAYOUT = {
    "north": (0, 0),
    "east": (16, 0),
    "south": (32, 0),
    "west": (0, 16),
    "up": (16, 16),
    "down": (32, 16),
}
ATLAS_REGION_WIDTH = 48
ATLAS_REGION_HEIGHT = 32
GLOBAL_ROOT_BONE_NAME = "root"
RESAMPLING_NEAREST = getattr(getattr(Image, "Resampling", Image), "NEAREST")

MATERIAL_INDEX_MAP = {
    "default": 0,
    "glow": 1,
    "glass": 2,
    "slime_outer": 3,
    "redstone_torch": 4,
}
SPECIAL_INTERACTION_VALUES = {"slab_bottom", "door"}
UUID_FIELD_NAMES = (
    "bp_header_uuid",
    "bp_data_uuid",
    "bp_script_uuid",
    "rp_header_uuid",
    "rp_resources_uuid",
)
PACK_UUID_BUNDLES_KEY = "pack_uuid_bundles"
DEFAULT_AUTO_ATLAS_SHAPE = "cube"
MAX_PACK_ATLAS_BLOCKS = 192
MAX_PACK_CUSTOM_BLOCKS = 192
MAX_PACK_CUSTOM_GEOMETRIES = 96
MAX_PACK_COMPLEXITY = 512
ATLAS_BLOCK_COMPLEXITY = 1
CUSTOM_BLOCK_COMPLEXITY = 2
CUSTOM_GEOMETRY_COMPLEXITY = 2


class ConfigError(RuntimeError):
    pass


class DeferredTextureError(ConfigError):
    pass


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_json_allow_block_comments(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8")
    raw = re.sub(r"/\*.*?\*/", "", raw, flags=re.S)
    return json.loads(raw)


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=4)
    path.write_text(f"{text}\n", encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug or "entry"


def validate_namespace(namespace: str) -> None:
    if not re.fullmatch(r"[a-z0-9_]+", namespace or ""):
        raise ConfigError("plugin_namespace 只能包含小写字母、数字和下划线。")


def ensure_clean_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def base36_encode(value: int) -> str:
    alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
    if value == 0:
        return "0"
    sign = ""
    if value < 0:
        sign = "-"
        value = -value
    output = []
    while value:
        value, remainder = divmod(value, 36)
        output.append(alphabet[remainder])
    return sign + "".join(reversed(output))


def create_build_identity(plugin_namespace: str) -> dict:
    build_tag = f"b{base36_encode(int(time.time() * 1000))}"
    generated_namespace = f"{plugin_namespace}_{build_tag}"
    return {
        "plugin_namespace": plugin_namespace,
        "build_tag": build_tag,
        "generated_namespace": generated_namespace,
        "bp_header_uuid": "",
        "bp_data_uuid": "",
        "bp_script_uuid": "",
        "rp_header_uuid": "",
        "rp_resources_uuid": "",
    }


def load_or_create_build_identity(plugin_namespace: str) -> dict:
    if BUILD_IDENTITY_PATH.exists():
        try:
            identity = load_json(BUILD_IDENTITY_PATH)
            if (isinstance(identity, dict)
                    and identity.get("plugin_namespace") == plugin_namespace
                    and all(
                        isinstance(identity.get(key), str) for key in (
                            "build_tag",
                            "generated_namespace",
                            *UUID_FIELD_NAMES,
                        ))):
                return identity
        except Exception:
            pass

    identity = create_build_identity(plugin_namespace)
    write_json(BUILD_IDENTITY_PATH, identity)
    return identity


def create_uuid_bundle() -> dict:
    return {field_name: str(uuid.uuid4()) for field_name in UUID_FIELD_NAMES}


def has_saved_uuid_bundle(identity: dict) -> bool:
    return all(
        isinstance(identity.get(field_name), str) and identity.get(field_name)
        for field_name in UUID_FIELD_NAMES)


def is_valid_uuid_bundle(bundle: object) -> bool:
    return isinstance(bundle, dict) and all(
        isinstance(bundle.get(field_name), str) and bundle.get(field_name)
        for field_name in UUID_FIELD_NAMES)


def confirm_use_new_uuids() -> bool:
    prompt = "本次构建是否使用新的 UUID？[Y/n]: "
    try:
        choice = input(prompt).strip().lower()
    except EOFError:
        return True

    return choice not in {"n", "no"}


def finalize_build_identity(identity: dict) -> dict:
    if confirm_use_new_uuids() or not has_saved_uuid_bundle(identity):
        identity = {
            **identity,
            **create_uuid_bundle(),
        }
        write_json(BUILD_IDENTITY_PATH, identity)

    return identity


def finalize_pack_uuid_bundles(
        identity: dict, pack_keys: list[str]) -> tuple[dict, dict[str, dict]]:
    use_new_uuids = confirm_use_new_uuids()

    if len(pack_keys) == 1 and pack_keys[0] == "default":
        if use_new_uuids or not has_saved_uuid_bundle(identity):
            identity = {
                **identity,
                **create_uuid_bundle(),
            }
            write_json(BUILD_IDENTITY_PATH, identity)
        return identity, {
            "default": {
                field_name: identity[field_name]
                for field_name in UUID_FIELD_NAMES
            }
        }

    pack_uuid_bundles = identity.get(PACK_UUID_BUNDLES_KEY)
    if not isinstance(pack_uuid_bundles, dict) or use_new_uuids:
        pack_uuid_bundles = {}

    changed = False
    resolved_bundles: dict[str, dict] = {}
    for pack_key in pack_keys:
        bundle = pack_uuid_bundles.get(pack_key)
        if not is_valid_uuid_bundle(bundle):
            bundle = create_uuid_bundle()
            pack_uuid_bundles[pack_key] = bundle
            changed = True
        resolved_bundles[pack_key] = bundle

    if changed or use_new_uuids:
        identity = {
            **identity,
            PACK_UUID_BUNDLES_KEY: pack_uuid_bundles,
        }
        write_json(BUILD_IDENTITY_PATH, identity)

    return identity, resolved_bundles


def create_placeholder_texture(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGBA", (16, 16), (0, 0, 0, 0)).save(path)


def format_resource_path(path: Path, resource_root: Path = RP_DIR) -> str:
    relative = path.relative_to(resource_root).with_suffix("")
    return relative.as_posix()


def resolve_existing_path(
    raw_value: str | None,
    *,
    block_id: str,
    field_name: str,
    is_texture: bool,
) -> Path:
    if not raw_value:
        raise ConfigError(f"{block_id} 缺少字段 {field_name}。")

    raw_path = Path(raw_value)
    candidates: list[Path] = []

    if raw_path.is_absolute():
        candidates.append(raw_path)
    else:
        candidates.append((ROOT / raw_path).resolve())
        candidates.append((WORKSPACE_ROOT / raw_path).resolve())
        if is_texture:
            candidates.append((RP_DIR / raw_path).resolve())
            candidates.append((ROOT / "assets" / raw_path).resolve())
            candidates.append((ASSETS_TEXTURE_DIR / raw_path).resolve())
        else:
            candidates.append((ROOT / "assets" / raw_path).resolve())
            candidates.append((ASSETS_MODEL_DIR / raw_path).resolve())

    if is_texture and raw_path.suffix == "":
        candidates.extend(
            candidate.with_suffix(".png") for candidate in list(candidates))
    if not is_texture and raw_path.suffix == "":
        expanded = []
        for candidate in list(candidates):
            expanded.append(candidate.with_suffix(".json"))
            expanded.append(candidate.with_suffix(".geo.json"))
        candidates.extend(expanded)

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    if is_texture:
        raise DeferredTextureError(
            f"{block_id} 的 {field_name} 指向的贴图文件不存在: {raw_value}")
    raise ConfigError(f"{block_id} 的 {field_name} 指向的文件不存在: {raw_value}")


def read_texture_image(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGBA")


def normalize_offset(raw_value: object) -> list[float]:
    if raw_value is None:
        return [0.0, 0.0, 0.0]
    if (isinstance(raw_value, list) and len(raw_value) == 3
            and all(isinstance(item, (int, float)) for item in raw_value)):
        return [float(raw_value[0]), float(raw_value[1]), float(raw_value[2])]
    raise ConfigError("client_offset_px 必须是长度为 3 的数字数组。")


def normalize_scale(raw_value: object) -> float:
    if raw_value is None:
        return 1.0
    if isinstance(raw_value, (int, float)) and raw_value > 0:
        return float(raw_value)
    raise ConfigError("scale 必须是大于 0 的数字。")


def normalize_material(raw_value: object) -> str:
    if raw_value is None:
        return "default"
    if isinstance(raw_value, str) and raw_value in MATERIAL_INDEX_MAP:
        return raw_value
    raise ConfigError(f"material 只能是 {sorted(MATERIAL_INDEX_MAP.keys())} 之一。")


def normalize_special_interaction(
    raw_value: object,
    *,
    block_id: str,
    allow_door: bool,
) -> str | None:
    if raw_value is None or raw_value is False:
        return None

    if isinstance(raw_value, str):
        normalized = raw_value.strip().lower()
        if not normalized or normalized == "none":
            return None
        if normalized in {"slab", "slab_bottom", "bottom_slab"}:
            return "slab_bottom"
        if normalized == "door":
            if not allow_door:
                raise ConfigError(
                    f"{block_id} 的 special_interaction 不支持 door。")
            return "door"

    raise ConfigError(
        f"{block_id} 的 special_interaction 只能是 none、slab_bottom" +
        (" 或 door。" if allow_door else "。"))


def get_collision_profile_for_special_interaction(
        special_interaction: str | None) -> str:
    if special_interaction == "slab_bottom":
        return "slab_bottom"
    return "full"


def normalize_manual_model_type(raw_block: dict, block_id: str) -> str:
    raw_model_type = raw_block.get("model_type")
    if isinstance(raw_model_type, str):
        normalized = raw_model_type.strip().lower()
        if normalized in {"vanilla", "atlas"}:
            return "atlas"
        if normalized in {"custom", "custom_model"}:
            return "custom_model"
        raise ConfigError(f"{block_id} 的 model_type 只能是 vanilla 或 custom。")

    render_mode = raw_block.get("render_mode")
    if render_mode in {"atlas", "custom_model"}:
        return render_mode

    if raw_block.get("source_model") or raw_block.get("model_file"):
        return "custom_model"
    return "atlas"


def normalize_manual_vanilla_model(raw_value: object, block_id: str) -> str:
    if raw_value is None:
        return "cube"
    if not isinstance(raw_value, str):
        raise ConfigError(f"{block_id} 的 vanilla model 必须是字符串。")

    normalized = raw_value.strip().lower()
    alias_map = {
        "full_block": "cube",
        "block": "cube",
        "cube": "cube",
        "slab_bottom": "slab_bottom",
        "half_slab": "slab_bottom",
        "bottom_slab": "slab_bottom",
        "slab": "slab_bottom",
        "slab_top": "slab_top",
        "carpet": "carpet",
    }
    shape = alias_map.get(normalized)
    if shape not in ATLAS_SHAPES:
        raise ConfigError(
            f"{block_id} 的 vanilla model 只能是 full_block、slab_bottom 或 carpet。")
    return shape


def get_block_description(block_payload: dict) -> dict:
    return block_payload.get("minecraft:block", {}).get("description", {})


def get_block_components(block_payload: dict) -> dict:
    return block_payload.get("minecraft:block", {}).get("components", {})


def get_block_permutations(block_payload: dict) -> list[dict]:
    permutations = block_payload.get("minecraft:block",
                                     {}).get("permutations", [])
    return permutations if isinstance(permutations, list) else []


def get_permutation_components(permutation_payload: dict) -> dict:
    components = permutation_payload.get("components")
    return components if isinstance(components, dict) else {}


def extract_geometry_identifier(raw_geometry: object) -> str | None:
    if isinstance(raw_geometry, str):
        return raw_geometry
    if isinstance(raw_geometry, dict):
        identifier = raw_geometry.get("identifier")
        if isinstance(identifier, str):
            return identifier
    return None


def extract_material_instances(raw_value: object) -> dict:
    return raw_value if isinstance(raw_value, dict) else {}


def normalize_condition_text(raw_condition: object) -> str:
    if not isinstance(raw_condition, str):
        return ""
    return re.sub(r"\s+", "", raw_condition.lower())


def get_condition_state_references(state_name: str) -> tuple[str, ...]:
    normalized = state_name.lower()
    return (
        f"q.block_state('{normalized}')",
        f'q.block_state("{normalized}")',
        f"query.block_state('{normalized}')",
        f'query.block_state("{normalized}")',
    )


def condition_matches_state_value(
    normalized_condition: str,
    state_names: tuple[str, ...],
    expected: bool,
) -> bool:
    if not normalized_condition:
        return False

    for state_name in state_names:
        for reference in get_condition_state_references(state_name):
            is_false = f"!{reference}" in normalized_condition or (
                f"{reference}==false" in normalized_condition)
            if expected:
                if is_false:
                    continue
                if f"{reference}==true" in normalized_condition or reference in normalized_condition:
                    return True
            elif is_false:
                return True

    return False


def get_permutation_preference(permutation_payload: dict,
                               index: int) -> tuple[int, int]:
    condition = normalize_condition_text(permutation_payload.get("condition"))
    penalty = 0
    if condition_matches_state_value(
            condition,
        ("upper_block_bit", "ff:upper_block_bit", "minecraft:upper_block_bit"),
            True):
        penalty += 4
    if condition_matches_state_value(
            condition,
        ("open", "open_bit", "ff:open_bit", "minecraft:open_bit"), True):
        penalty += 2
    if condition_matches_state_value(
            condition, ("powered", "ff:powered", "minecraft:powered"), True):
        penalty += 1
    return penalty, index


def get_auto_component_candidates(block_payload: dict) -> list[dict]:
    candidates: list[dict] = []
    base_components = get_block_components(block_payload)
    if isinstance(base_components, dict):
        candidates.append(base_components)

    permutation_candidates: list[tuple[tuple[int, int], dict]] = []
    for index, permutation_payload in enumerate(
            get_block_permutations(block_payload)):
        if not isinstance(permutation_payload, dict):
            continue
        permutation_components = get_permutation_components(
            permutation_payload)
        if not permutation_components:
            continue
        permutation_candidates.append(
            (get_permutation_preference(permutation_payload,
                                        index), permutation_components))

    permutation_candidates.sort(key=lambda item: item[0])
    candidates.extend(components for _, components in permutation_candidates)
    return candidates


def get_first_component_value(component_candidates: list[dict],
                              component_key: str) -> object:
    for components in component_candidates:
        value = components.get(component_key)
        if value is not None:
            return value
    return None


def get_merged_candidate_material_instances(
        component_candidates: list[dict]) -> dict:
    merged: dict = {}
    for components in component_candidates:
        merged = merge_material_instances(
            merged,
            extract_material_instances(
                components.get("minecraft:material_instances")),
        )
    return merged


def get_effective_component_number(component_candidates: list[dict],
                                   component_key: str) -> float | int | None:
    resolved_value = None
    for components in component_candidates:
        value = components.get(component_key)
        if isinstance(value, (int, float)):
            if resolved_value is None or value > resolved_value:
                resolved_value = value
    return resolved_value


def normalize_quarter_turn_value(raw_value: object) -> int | None:
    if not isinstance(raw_value, (int, float)):
        return None

    quarter_turn = float(raw_value) / 90.0
    rounded = round(quarter_turn)
    if abs(quarter_turn - rounded) > 0.001:
        return None
    return rounded % 4


def extract_transformation_rotation(raw_value: object) -> list[int] | None:
    if not isinstance(raw_value, dict):
        return None

    rotation = raw_value.get("rotation")
    if not isinstance(rotation, list) or len(rotation) != 3:
        return None

    normalized = []
    for item in rotation:
        quarter_turn = normalize_quarter_turn_value(item)
        if quarter_turn is None:
            return None
        normalized.append(quarter_turn)

    return normalized


def parse_condition_literal(raw_value: str) -> str | int | float | bool | None:
    if raw_value == "true":
        return True
    if raw_value == "false":
        return False
    if re.fullmatch(r"-?\d+", raw_value):
        return int(raw_value)
    if re.fullmatch(r"-?(?:\d+\.\d+|\d+\.\d*|\.\d+)", raw_value):
        return float(raw_value)
    if len(raw_value) >= 2 and raw_value[0] in {
            '"', "'"
    } and raw_value[-1] == raw_value[0]:
        return raw_value[1:-1]
    return None


def parse_condition_tests(raw_condition: object) -> list[dict] | None:
    if raw_condition is None:
        return []
    if not isinstance(raw_condition, str):
        return None

    normalized_condition = normalize_condition_text(raw_condition)
    if not normalized_condition:
        return []
    if "||" in normalized_condition:
        return None

    tests = []
    for raw_term in normalized_condition.split("&&"):
        if not raw_term:
            continue

        match = re.fullmatch(
            r"(?P<neg>!)?(?:q|query)\.block_state\((?P<quote>['\"])(?P<state>.+?)(?P=quote)\)(?:==(?P<value>.+))?",
            raw_term,
        )
        if not match:
            return None

        value_text = match.group("value")
        if value_text is None:
            expected_value = not bool(match.group("neg"))
        else:
            if match.group("neg"):
                return None
            expected_value = parse_condition_literal(value_text)
            if expected_value is None:
                return None

        tests.append({
            "stateName": match.group("state"),
            "value": expected_value,
        })

    return tests


def extract_auto_rotation_rules(block_payload: dict) -> list[dict]:
    rules = []

    base_rotation = extract_transformation_rotation(
        get_block_components(block_payload).get("minecraft:transformation"))
    if base_rotation is not None:
        rules.append({
            "tests": [],
            "rotation": base_rotation,
        })

    for permutation_payload in get_block_permutations(block_payload):
        if not isinstance(permutation_payload, dict):
            continue

        permutation_components = get_permutation_components(
            permutation_payload)
        rotation = extract_transformation_rotation(
            permutation_components.get("minecraft:transformation"))
        if rotation is None:
            continue

        tests = parse_condition_tests(permutation_payload.get("condition"))
        if tests is None:
            continue

        rules.append({
            "tests": tests,
            "rotation": rotation,
        })

    return rules


def load_auto_blocks_json_texture_map() -> dict[str, object]:
    if not AUTO_RP_BLOCKS_JSON_PATH.exists():
        return {}

    payload = load_json(AUTO_RP_BLOCKS_JSON_PATH)
    if not isinstance(payload, dict):
        raise ConfigError(f"{AUTO_RP_BLOCKS_JSON_PATH} 不是标准的 blocks.json。")

    resolved = {}
    for block_id, entry in payload.items():
        if block_id == "format_version" or not isinstance(block_id, str):
            continue
        if not isinstance(entry, dict):
            continue
        textures = entry.get("textures")
        if isinstance(textures, (str, dict)):
            resolved[block_id] = textures
    return resolved


def create_blocks_json_material_instances(raw_value: object) -> dict:
    if isinstance(raw_value, str):
        return {"*": {"texture": raw_value}}
    if not isinstance(raw_value, dict):
        return {}

    face_aliases = {
        "top": "up",
        "bottom": "down",
    }
    material_instances = {}
    for raw_face, texture_name in raw_value.items():
        if not isinstance(raw_face, str) or not isinstance(texture_name, str):
            continue
        face_name = face_aliases.get(raw_face, raw_face)
        material_instances[face_name] = {"texture": texture_name}

    if "side" in material_instances:
        side_value = material_instances["side"]
        for face_name in ("north", "east", "south", "west"):
            material_instances.setdefault(face_name, side_value)

    return material_instances


def merge_material_instances(primary: dict, fallback: dict) -> dict:
    if not primary:
        return dict(fallback)
    if not fallback:
        return dict(primary)

    merged = dict(fallback)
    merged.update(primary)
    return merged


def get_auto_fallback_material_instances(
        block_id: str, blocks_json_texture_map: dict[str, object]) -> dict:
    exact_match = blocks_json_texture_map.get(block_id)
    if exact_match is not None:
        return create_blocks_json_material_instances(exact_match)

    short_block_id = block_id.split(":", 1)[-1]
    short_match = blocks_json_texture_map.get(short_block_id)
    if short_match is not None:
        return create_blocks_json_material_instances(short_match)

    return {}


def get_material_instance_texture_name(raw_value: object) -> str | None:
    if isinstance(raw_value, dict) and isinstance(raw_value.get("texture"),
                                                  str):
        return raw_value["texture"]
    return None


def resolve_auto_texture_path(texture_reference: str, block_id: str) -> Path:
    raw_path = Path(texture_reference)
    candidates: list[Path] = []

    if raw_path.is_absolute():
        candidates.append(raw_path)
    else:
        candidates.append((AUTO_SOURCE_DIR / "RP" / raw_path).resolve())
        candidates.append((AUTO_RP_TEXTURE_ROOT / raw_path).resolve())
        candidates.append((AUTO_RP_TEXTURE_DIR / raw_path).resolve())
        candidates.append((ROOT / raw_path).resolve())

    if raw_path.suffix == "":
        candidates.extend(
            candidate.with_suffix(".png") for candidate in list(candidates))

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    raise DeferredTextureError(f"{block_id} 自动模式找不到贴图文件: {texture_reference}")


def load_auto_texture_reference_map() -> dict[str, str]:
    if not AUTO_RP_TERRAIN_TEXTURE_PATH.exists():
        return {}

    payload = load_json(AUTO_RP_TERRAIN_TEXTURE_PATH)
    texture_data = payload.get("texture_data")
    if not isinstance(texture_data, dict):
        return {}

    resolved = {}
    for texture_name, entry in texture_data.items():
        if not isinstance(texture_name, str) or not isinstance(entry, dict):
            continue

        raw_textures = entry.get("textures")
        texture_reference = None
        if isinstance(raw_textures, str):
            texture_reference = raw_textures
        elif isinstance(raw_textures, list) and raw_textures:
            first_texture = raw_textures[0]
            if isinstance(first_texture, str):
                texture_reference = first_texture

        if texture_reference:
            resolved[texture_name] = texture_reference

    return resolved


def resolve_auto_texture_name_to_path(texture_name: str,
                                      texture_map: dict[str, str],
                                      block_id: str) -> Path:
    texture_reference = texture_map.get(texture_name)
    if not texture_reference:
        raise DeferredTextureError(
            f"{block_id} 在 terrain_texture.json 中找不到贴图短名: {texture_name}")
    return resolve_auto_texture_path(texture_reference, block_id)


def build_auto_geometry_index() -> dict[str, Path]:
    geometry_index: dict[str, Path] = {}
    if not AUTO_RP_MODEL_DIR.exists():
        return geometry_index

    for model_path in sorted(AUTO_RP_MODEL_DIR.rglob("*.json")):
        try:
            model_data = load_json(model_path)
        except Exception:
            continue

        geometries = model_data.get("minecraft:geometry")
        if not isinstance(geometries, list):
            continue

        for geometry in geometries:
            identifier = geometry.get("description", {}).get("identifier")
            if isinstance(identifier,
                          str) and identifier not in geometry_index:
                geometry_index[identifier] = model_path

    return geometry_index


def normalize_collision_box(
        raw_value: object) -> tuple[list[float], list[float]] | None:
    if not isinstance(raw_value, dict):
        return None

    origin = raw_value.get("origin")
    size = raw_value.get("size")
    if (not isinstance(origin, list) or len(origin) != 3
            or not isinstance(size, list) or len(size) != 3):
        return None
    if not all(isinstance(item, (int, float)) for item in origin + size):
        return None

    return ([float(origin[0]),
             float(origin[1]),
             float(origin[2])],
            [float(size[0]), float(size[1]),
             float(size[2])])


def looks_like_bottom_slab(
        collision_box: tuple[list[float], list[float]] | None) -> bool:
    if not collision_box:
        return False

    origin, size = collision_box
    return size == [16.0, 8.0, 16.0] and origin[1] >= 0


def looks_like_carpet(
        collision_box: tuple[list[float], list[float]] | None) -> bool:
    if not collision_box:
        return False

    origin, size = collision_box
    return size == [16.0, 1.0, 16.0] and origin[1] >= 0


def infer_auto_atlas_shape(collision_box: tuple[list[float], list[float]]
                           | None, special_interaction: str | None) -> str:
    if special_interaction == "slab_bottom" or looks_like_bottom_slab(
            collision_box):
        return "slab_bottom"
    if looks_like_carpet(collision_box):
        return "carpet"
    return DEFAULT_AUTO_ATLAS_SHAPE


def looks_like_runtime_door(block_id: str, block_payload: dict) -> bool:
    if "door" in block_id.split(":", 1)[1]:
        return True

    description = get_block_description(block_payload)
    states = description.get("states")
    if isinstance(states, dict):
        state_names = {
            name.split(":")[-1]
            for name in states.keys() if isinstance(name, str)
        }
        if {"open", "open_bit", "door_hinge_bit", "upper_block_bit"
            } & state_names:
            return True

    block_root = block_payload.get("minecraft:block", {})
    for permutation in block_root.get("permutations", []):
        if not isinstance(permutation, dict):
            continue
        condition = permutation.get("condition")
        if isinstance(condition, str) and "open" in condition.lower():
            return True

    return False


def get_primary_texture_name(material_instances: dict, block_id: str) -> str:
    preferred_keys = ("*", "up", "north", "south", "east", "west", "down")
    for key in preferred_keys:
        texture_name = get_material_instance_texture_name(
            material_instances.get(key))
        if texture_name:
            return texture_name

    for value in material_instances.values():
        texture_name = get_material_instance_texture_name(value)
        if texture_name:
            return texture_name

    raise DeferredTextureError(f"{block_id} 找不到可用的材质贴图短名。")


def resolve_auto_face_textures(material_instances: dict,
                               texture_map: dict[str, str],
                               block_id: str) -> dict[str, Path]:
    default_texture_name = get_material_instance_texture_name(
        material_instances.get("*"))
    resolved = {}

    for face in ATLAS_FACES:
        texture_name = get_material_instance_texture_name(
            material_instances.get(face))
        if texture_name is None:
            alias = next(
                (source for source, target in ATLAS_FACE_ALIASES.items()
                 if target == face),
                None,
            )
            if alias is not None:
                texture_name = get_material_instance_texture_name(
                    material_instances.get(alias))
        if texture_name is None:
            texture_name = default_texture_name
        if texture_name is None:
            raise DeferredTextureError(f"{block_id} 自动模式缺少 {face} 面贴图。")

        resolved[face] = resolve_auto_texture_name_to_path(
            texture_name, texture_map, block_id)

    return resolved


def infer_auto_material(components: dict, material_instances: dict) -> str:
    light_emission = components.get("minecraft:light_emission")
    if isinstance(light_emission, (int, float)) and light_emission > 0:
        return "glow"

    for material_instance in material_instances.values():
        if not isinstance(material_instance, dict):
            continue

        render_method = material_instance.get("render_method")
        if not isinstance(render_method, str):
            continue

        normalized = render_method.strip().lower()
        if normalized in {"blend", "alpha_blend"}:
            return "glass"

    return "default"


def normalize_manual_block(raw_block: dict) -> dict:
    block_id = raw_block.get("block_id")
    if not isinstance(block_id, str) or ":" not in block_id:
        raise ConfigError("每个方块都必须提供合法的 block_id。")

    model_type = normalize_manual_model_type(raw_block, block_id)
    offset_px = normalize_offset(raw_block.get("client_offset_px"))
    scale = normalize_scale(raw_block.get("scale"))
    material = normalize_material(raw_block.get("material"))
    slug = slugify(block_id)

    if model_type == "atlas":
        shape = normalize_manual_vanilla_model(
            raw_block.get("model") or raw_block.get("atlas_shape"),
            block_id,
        )
        special_interaction = normalize_special_interaction(
            raw_block.get("special_interaction"),
            block_id=block_id,
            allow_door=False,
        )
        face_textures = normalize_atlas_textures(raw_block, block_id)
        return {
            "blockId":
            block_id,
            "slug":
            slug,
            "shape":
            shape,
            "faceTextures":
            face_textures,
            "offsetPx":
            offset_px,
            "scale":
            scale,
            "material":
            material,
            "rotationRules": [],
            "specialInteraction":
            special_interaction,
            "collisionProfile":
            get_collision_profile_for_special_interaction(special_interaction),
            "renderMode":
            "atlas",
        }

    special_interaction = normalize_special_interaction(
        raw_block.get("special_interaction"),
        block_id=block_id,
        allow_door=True,
    )
    model_path = resolve_existing_path(
        raw_block.get("model") or raw_block.get("source_model")
        or raw_block.get("model_file"),
        block_id=block_id,
        field_name="model",
        is_texture=False,
    )
    texture_path = resolve_existing_path(
        raw_block.get("texture") or raw_block.get("source_texture")
        or raw_block.get("texture_file"),
        block_id=block_id,
        field_name="texture",
        is_texture=True,
    )
    return {
        "blockId":
        block_id,
        "slug":
        slug,
        "modelPath":
        model_path,
        "texturePath":
        texture_path,
        "geometryIdentifier":
        raw_block.get("geometry_identifier"),
        "offsetPx":
        offset_px,
        "scale":
        scale,
        "material":
        material,
        "rotationRules": [],
        "specialInteraction":
        special_interaction,
        "collisionProfile":
        get_collision_profile_for_special_interaction(special_interaction),
        "renderMode":
        "custom_model",
    }


def normalize_auto_block(block_path: Path, texture_map: dict[str, str],
                         geometry_index: dict[str, Path],
                         blocks_json_texture_map: dict[str, object]) -> dict:
    return finalize_auto_block(
        inspect_auto_block(block_path, geometry_index,
                           blocks_json_texture_map),
        texture_map,
    )


def inspect_auto_block(block_path: Path, geometry_index: dict[str, Path],
                       blocks_json_texture_map: dict[str, object]) -> dict:
    payload = load_json(block_path)
    block_root = payload.get("minecraft:block")
    if not isinstance(block_root, dict):
        raise ConfigError(f"{block_path} 不是标准的自定义方块文件。")

    description = get_block_description(payload)
    block_id = description.get("identifier")
    if not isinstance(block_id, str) or ":" not in block_id:
        raise ConfigError(f"{block_path} 缺少合法的 identifier。")

    component_candidates = get_auto_component_candidates(payload)
    components = get_block_components(payload)
    geometry_identifier = extract_geometry_identifier(
        get_first_component_value(component_candidates, "minecraft:geometry"))
    material_instances = get_merged_candidate_material_instances(
        component_candidates)
    material_instances = merge_material_instances(
        material_instances,
        get_auto_fallback_material_instances(block_id,
                                             blocks_json_texture_map),
    )
    effective_light_emission = get_effective_component_number(
        component_candidates, "minecraft:light_emission")
    if effective_light_emission is not None:
        components = dict(components)
        components["minecraft:light_emission"] = effective_light_emission
    collision_box = normalize_collision_box(
        get_first_component_value(component_candidates,
                                  "minecraft:collision_box"))
    special_interaction = None
    if looks_like_runtime_door(block_id, payload):
        special_interaction = "door"
    elif looks_like_bottom_slab(collision_box):
        special_interaction = "slab_bottom"

    base_payload = {
        "blockId":
        block_id,
        "slug":
        slugify(block_id),
        "offsetPx": [0.0, 0.0, 0.0],
        "scale":
        1.0,
        "material":
        infer_auto_material(components, material_instances),
        "rotationRules":
        extract_auto_rotation_rules(payload),
        "specialInteraction":
        special_interaction,
        "collisionProfile":
        get_collision_profile_for_special_interaction(special_interaction),
        "materialInstances":
        material_instances,
    }

    if not geometry_identifier:
        if material_instances:
            return {
                **base_payload,
                "shape":
                infer_auto_atlas_shape(collision_box, special_interaction),
                "renderMode":
                "atlas",
            }
        raise ConfigError(f"{block_id} 缺少 minecraft:geometry。")

    if geometry_identifier == "minecraft:geometry.full_block":
        return {
            **base_payload,
            "shape":
            infer_auto_atlas_shape(collision_box, special_interaction),
            "renderMode":
            "atlas",
        }

    if geometry_identifier == "minecraft:geometry.cross":
        return {
            **base_payload,
            "shape": "cross",
            "renderMode": "atlas",
        }

    model_path = geometry_index.get(geometry_identifier)
    if not model_path:
        raise ConfigError(
            f"{block_id} 自动模式找不到 geometry={geometry_identifier} 对应的模型文件。")

    return {
        **base_payload,
        "modelPath": model_path,
        "geometryIdentifier": geometry_identifier,
        "renderMode": "custom_model",
    }


def finalize_auto_block(inspected_block: dict, texture_map: dict[str,
                                                                 str]) -> dict:
    material_instances = inspected_block["materialInstances"]
    block_id = inspected_block["blockId"]
    base_payload = {
        key: value
        for key, value in inspected_block.items() if key != "materialInstances"
    }

    if inspected_block["renderMode"] == "atlas":
        return {
            **base_payload,
            "faceTextures":
            resolve_auto_face_textures(material_instances, texture_map,
                                       block_id),
        }

    texture_name = get_primary_texture_name(material_instances, block_id)
    return {
        **base_payload,
        "texturePath":
        resolve_auto_texture_name_to_path(texture_name, texture_map, block_id),
    }


def create_auto_placeholder_block(inspected_block: dict) -> dict:
    placeholder_block = {
        key: value
        for key, value in inspected_block.items() if key != "materialInstances"
    }
    placeholder_block["material"] = "default"
    placeholder_block["placeholder"] = True
    return placeholder_block


def inspect_auto_block_fallback(
        block_path: Path, blocks_json_texture_map: dict[str, object]) -> dict:
    payload = load_json(block_path)
    block_root = payload.get("minecraft:block")
    if not isinstance(block_root, dict):
        raise ConfigError(f"{block_path} 不是标准的自定义方块文件。")

    description = get_block_description(payload)
    block_id = description.get("identifier")
    if not isinstance(block_id, str) or ":" not in block_id:
        raise ConfigError(f"{block_path} 缺少合法的 identifier。")

    component_candidates = get_auto_component_candidates(payload)
    geometry_identifier = extract_geometry_identifier(
        get_first_component_value(component_candidates, "minecraft:geometry"))
    material_instances = get_merged_candidate_material_instances(
        component_candidates)
    material_instances = merge_material_instances(
        material_instances,
        get_auto_fallback_material_instances(block_id,
                                             blocks_json_texture_map),
    )
    collision_box = normalize_collision_box(
        get_first_component_value(component_candidates,
                                  "minecraft:collision_box"))
    special_interaction = None
    if looks_like_runtime_door(block_id, payload):
        special_interaction = "door"
    elif looks_like_bottom_slab(collision_box):
        special_interaction = "slab_bottom"

    base_payload = {
        "blockId":
        block_id,
        "slug":
        slugify(block_id),
        "offsetPx": [0.0, 0.0, 0.0],
        "scale":
        1.0,
        "material":
        "default",
        "rotationRules":
        extract_auto_rotation_rules(payload),
        "specialInteraction":
        special_interaction,
        "collisionProfile":
        get_collision_profile_for_special_interaction(special_interaction),
        "placeholder":
        True,
    }

    if not geometry_identifier or geometry_identifier == "minecraft:geometry.full_block":
        return {
            **base_payload,
            "shape":
            infer_auto_atlas_shape(collision_box, special_interaction),
            "renderMode":
            "atlas",
        }

    if geometry_identifier == "minecraft:geometry.cross":
        return {
            **base_payload,
            "shape": "cross",
            "renderMode": "atlas",
        }

    return {
        **base_payload,
        "geometryIdentifier": geometry_identifier,
        "renderMode": "custom_model",
    }


def normalize_auto_blocks(
    excluded_block_ids: set[str],
    manual_blocks_by_id: dict[str, dict],
) -> tuple[list[dict], list[dict], list[str], set[str]]:
    if not AUTO_BP_BLOCK_DIR.exists():
        return [], [], [], set()

    texture_map = load_auto_texture_reference_map()
    geometry_index = build_auto_geometry_index()
    blocks_json_texture_map = load_auto_blocks_json_texture_map()
    atlas_blocks: list[dict] = []
    custom_blocks: list[dict] = []
    texture_issue_block_ids: list[str] = []
    consumed_manual_block_ids: set[str] = set()

    for block_path in sorted(AUTO_BP_BLOCK_DIR.rglob("*.json")):
        try:
            inspected_block = inspect_auto_block(
                block_path,
                geometry_index,
                blocks_json_texture_map,
            )
            block_id = inspected_block["blockId"]
            manual_block = manual_blocks_by_id.get(block_id)
            if manual_block is not None:
                consumed_manual_block_ids.add(block_id)
                normalized_block = manual_block
            else:
                try:
                    normalized_block = finalize_auto_block(
                        inspected_block, texture_map)
                except DeferredTextureError:
                    texture_issue_block_ids.append(block_id)
                    normalized_block = create_auto_placeholder_block(
                        inspected_block)
        except ConfigError:
            normalized_block = inspect_auto_block_fallback(
                block_path,
                blocks_json_texture_map,
            )
            block_id = normalized_block["blockId"]
            manual_block = manual_blocks_by_id.get(block_id)
            if manual_block is not None:
                consumed_manual_block_ids.add(block_id)
                normalized_block = manual_block
            else:
                texture_issue_block_ids.append(block_id)

        if normalized_block["blockId"] in excluded_block_ids:
            continue

        excluded_block_ids.add(normalized_block["blockId"])
        if normalized_block["renderMode"] == "atlas":
            atlas_blocks.append(normalized_block)
        else:
            custom_blocks.append(normalized_block)

    return atlas_blocks, custom_blocks, texture_issue_block_ids, consumed_manual_block_ids


def normalize_manual_blocks(
    raw_blocks: list[dict], ) -> tuple[list[dict], dict[str, dict], list[str]]:
    normalized_blocks: list[dict] = []
    blocks_by_id: dict[str, dict] = {}
    texture_issue_reports: list[str] = []

    for raw_block in raw_blocks:
        if not isinstance(raw_block, dict):
            raise ConfigError("blocks 数组中的每一项都必须是对象。")

        raw_block_id = raw_block.get("block_id")
        try:
            normalized_block = normalize_manual_block(raw_block)
        except DeferredTextureError as error:
            if isinstance(raw_block_id, str) and ":" in raw_block_id:
                texture_issue_reports.append(f"{raw_block_id}: {error}")
            else:
                texture_issue_reports.append(str(error))
            continue

        block_id = normalized_block["blockId"]
        if block_id in blocks_by_id:
            raise ConfigError(f"block_id 重复: {block_id}")

        blocks_by_id[block_id] = normalized_block
        normalized_blocks.append(normalized_block)

    return normalized_blocks, blocks_by_id, texture_issue_reports


def get_slot_bone_name(slot_index: int) -> str:
    return f"b{slot_index}"


def get_slot_suffix(slot_index: int) -> str:
    return f"slot{slot_index}"


def pick_selected_geometry(
    model_path: Path,
    geometry_identifier: str | None,
) -> tuple[str, dict]:
    model_data = load_json(model_path)
    geometries = model_data.get("minecraft:geometry")
    if not isinstance(geometries, list) or not geometries:
        raise ConfigError(
            f"{model_path} 不是标准的 Bedrock geo 文件，缺少 minecraft:geometry。")

    selected = None
    for geometry in geometries:
        description = geometry.get("description", {})
        identifier = description.get("identifier")
        if geometry_identifier:
            if identifier == geometry_identifier:
                selected = geometry
                break
        elif selected is None:
            selected = geometry

    if selected is None:
        raise ConfigError(
            f"{model_path} 中找不到 geometry_identifier={geometry_identifier}。")

    return model_data.get("format_version", "1.12.0"), copy.deepcopy(selected)


def build_uv(face_tiles: dict[str, tuple[int, int]]) -> dict:
    return {
        face: {
            "uv": [face_tiles[face][0], face_tiles[face][1]],
            "uv_size": [16, 16]
        }
        for face in ATLAS_FACES
    }


def build_cross_uv(face_tile: tuple[int, int]) -> dict:
    tile_x, tile_y = face_tile
    return {
        "north": {
            "uv": [tile_x, tile_y],
            "uv_size": [16, 16]
        },
        "south": {
            "uv": [tile_x, tile_y],
            "uv_size": [16, 16]
        },
        "east": {
            "uv": [tile_x, tile_y],
            "uv_size": [1, 16]
        },
        "west": {
            "uv": [tile_x, tile_y],
            "uv_size": [1, 16]
        },
        "up": {
            "uv": [tile_x, tile_y],
            "uv_size": [16, 1]
        },
        "down": {
            "uv": [tile_x, tile_y],
            "uv_size": [16, 1]
        },
    }


def create_cross_mesh_bones(slot_bone_name: str, slot_index: int,
                            face_tile: tuple[int, int]) -> list[dict]:
    cross_uv = build_cross_uv(face_tile)
    base_cube = {
        "origin": [-8, 0, -0.5],
        "size": [16, 16, 1],
        "uv": cross_uv,
    }
    return [
        {
            "name": f"train_plugin_cross_a_{slot_index}",
            "parent": slot_bone_name,
            "pivot": [0, 0, 0],
            "rotation": [0, 45, 0],
            "cubes": [copy.deepcopy(base_cube)],
        },
        {
            "name": f"train_plugin_cross_b_{slot_index}",
            "parent": slot_bone_name,
            "pivot": [0, 0, 0],
            "rotation": [0, -45, 0],
            "cubes": [copy.deepcopy(base_cube)],
        },
    ]


def normalize_atlas_textures(raw_block: dict,
                             block_id: str) -> dict[str, Path]:
    atlas_textures = raw_block.get("textures")
    field_name_prefix = "textures"
    if not isinstance(atlas_textures, dict):
        atlas_textures = raw_block.get("atlas_textures")
        field_name_prefix = "atlas_textures"

    if not isinstance(atlas_textures, dict):
        raise ConfigError(
            f"{block_id} 的 vanilla 模式必须提供 textures，并且要明确填写 up/down/north/east/south/west 六个面。"
        )

    resolved = {}
    for face in ATLAS_FACES:
        raw_value = atlas_textures.get(face)
        if raw_value is None:
            alias = next(
                (source for source, target in ATLAS_FACE_ALIASES.items()
                 if target == face),
                None,
            )
            if alias is not None:
                raw_value = atlas_textures.get(alias)

        if not isinstance(raw_value, str):
            raise ConfigError(
                f"{block_id} 的 {field_name_prefix}.{face} 缺失或不是字符串。")

        resolved[face] = resolve_existing_path(
            raw_value,
            block_id=block_id,
            field_name=f"{field_name_prefix}.{face}",
            is_texture=True,
        )

    return resolved


def get_shape_spec(shape: str) -> tuple[list[int], list[int]]:
    if shape == "cube":
        return [-8, 0, -8], [16, 16, 16]
    if shape == "slab_bottom":
        return [-8, 0, -8], [16, 8, 16]
    if shape == "slab_top":
        return [-8, 8, -8], [16, 8, 16]
    if shape == "carpet":
        return [-8, 0, -8], [16, 1, 16]
    raise ConfigError(f"不支持的 atlas_shape: {shape}")


def create_placeholder_geometry(identifier: str, slot_index: int) -> dict:
    slot_bone_name = get_slot_bone_name(slot_index)
    return {
        "description": {
            "identifier": identifier,
            "texture_width": 16,
            "texture_height": 16,
            "visible_bounds_width": 4,
            "visible_bounds_height": 4,
            "visible_bounds_offset": [0, 1, 0],
        },
        "bones": [
            {
                "name": GLOBAL_ROOT_BONE_NAME,
                "pivot": [0, 0, 0],
            },
            {
                "name": slot_bone_name,
                "parent": GLOBAL_ROOT_BONE_NAME,
                "pivot": [0, 0, 0],
            },
        ],
    }


def create_atlas_geometry(
    identifier: str,
    atlas_width: int,
    atlas_height: int,
    shape: str,
    face_tiles: dict[str, tuple[int, int]],
    slot_index: int,
) -> dict:
    slot_bone_name = get_slot_bone_name(slot_index)
    bones = [
        {
            "name": GLOBAL_ROOT_BONE_NAME,
            "pivot": [0, 0, 0],
        },
        {
            "name": slot_bone_name,
            "parent": GLOBAL_ROOT_BONE_NAME,
            "pivot": [0, 0, 0],
        },
    ]

    if shape == "cross":
        bones.extend(
            create_cross_mesh_bones(slot_bone_name, slot_index,
                                    face_tiles["north"]))
    else:
        origin, size = get_shape_spec(shape)
        bones.append({
            "name":
            f"train_plugin_mesh_{slot_index}",
            "parent":
            slot_bone_name,
            "pivot": [0, 0, 0],
            "cubes": [{
                "origin": origin,
                "size": size,
                "uv": build_uv(face_tiles),
            }],
        })

    return {
        "description": {
            "identifier": identifier,
            "texture_width": atlas_width,
            "texture_height": atlas_height,
            "visible_bounds_width": 4,
            "visible_bounds_height": 4,
            "visible_bounds_offset": [0, 1, 0],
        },
        "bones": bones,
    }


def create_simple_atlas_geometry(
    identifier: str,
    atlas_width: int,
    atlas_height: int,
    shape: str,
    slot_index: int,
) -> dict:
    slot_bone_name = get_slot_bone_name(slot_index)
    bones = [
        {
            "name": GLOBAL_ROOT_BONE_NAME,
            "pivot": [0, 0, 0],
        },
        {
            "name": slot_bone_name,
            "parent": GLOBAL_ROOT_BONE_NAME,
            "pivot": [0, 0, 0],
        },
    ]

    if shape == "cross":
        bones.extend(
            create_cross_mesh_bones(slot_bone_name, slot_index,
                                    ATLAS_FACE_LAYOUT["north"]))
    else:
        origin, size = get_shape_spec(shape)
        bones[1]["cubes"] = [{
            "origin": origin,
            "size": size,
            "uv": build_uv(ATLAS_FACE_LAYOUT),
        }]

    return {
        "description": {
            "identifier": identifier,
            "texture_width": atlas_width,
            "texture_height": atlas_height,
            "visible_bounds_width": 64,
            "visible_bounds_height": 32,
            "visible_bounds_offset": [0, 8, 0],
        },
        "bones": bones,
    }


def create_custom_geometry(
    model_path: Path,
    geometry_identifier: str | None,
    generated_identifier: str,
    slot_index: int,
) -> tuple[str, dict]:
    format_version, geometry = pick_selected_geometry(model_path,
                                                      geometry_identifier)
    geometry.setdefault("description", {})
    geometry["description"]["identifier"] = generated_identifier

    bones = geometry.setdefault("bones", [])
    slot_bone_name = get_slot_bone_name(slot_index)
    slot_suffix = get_slot_suffix(slot_index)

    name_map: dict[str, str] = {}
    root_bone_names: list[str] = []
    for bone in bones:
        bone_name = bone.get("name")
        if not isinstance(bone_name, str) or not bone_name:
            raise ConfigError(f"{model_path} 中存在没有 name 的骨骼。")

        if "parent" not in bone:
            root_bone_names.append(bone_name)

        name_map[bone_name] = f"{bone_name}_{slot_suffix}"

    for bone in bones:
        old_name = bone["name"]
        bone["name"] = name_map[old_name]

        parent_name = bone.get("parent")
        if isinstance(parent_name, str) and parent_name in name_map:
            bone["parent"] = name_map[parent_name]

    renamed_root_bones = {name_map[name] for name in root_bone_names}
    for bone in bones:
        if bone["name"] in renamed_root_bones:
            bone["parent"] = slot_bone_name

    bones.insert(
        0,
        {
            "name": slot_bone_name,
            "parent": GLOBAL_ROOT_BONE_NAME,
            "pivot": [0, 0, 0],
        },
    )
    bones.insert(
        0,
        {
            "name": GLOBAL_ROOT_BONE_NAME,
            "pivot": [0, 0, 0],
        },
    )

    return format_version, geometry


def create_collector_seats() -> list[dict]:
    return [{
        "position": [0, -0.25, 0],
        "min_rider_count": 1,
        "lock_rider_rotation": 0,
    } for _ in range(FRAGMENTS_PER_COLLECTOR)]


def create_fragment_bp_entity(
    identifier: str,
    family: str,
    active_tag: str,
) -> dict:
    return {
        "format_version": "1.21.0",
        "minecraft:entity": {
            "description": {
                "identifier": identifier,
                "is_spawnable": False,
                "is_summonable": True,
                "is_experimental": False,
            },
            "components": {
                "minecraft:type_family": {
                    "family": [family, "inanimate"]
                },
                "minecraft:damage_sensor": {
                    "triggers": [{
                        "cause": "all",
                        "deals_damage": False
                    }]
                },
                "minecraft:despawn": {
                    "filters": {
                        "all_of": [
                            {
                                "test": "is_riding",
                                "value": False
                            },
                            {
                                "test": "has_tag",
                                "value": active_tag
                            },
                        ]
                    }
                },
                "minecraft:collision_box": {
                    "width": 0,
                    "height": 0
                },
                "minecraft:health": {
                    "value": 1,
                    "min": 1,
                    "max": 1
                },
                "minecraft:knockback_resistance": {
                    "value": 1
                },
                "minecraft:pushable": {
                    "is_pushable": False,
                    "is_pushable_by_piston": False,
                },
                "minecraft:persistent": {},
                "minecraft:physics": {
                    "has_collision": False,
                    "has_gravity": False,
                },
                "minecraft:fire_immune": {},
                "minecraft:conditional_bandwidth_optimization": {
                    "default_values": {
                        "max_optimized_distance": 0,
                        "max_dropped_ticks": 0,
                    }
                },
            },
        },
    }


def create_collector_bp_entity(
    identifier: str,
    collector_family: str,
    rider_families: list[str],
    active_tag: str,
) -> dict:
    return {
        "format_version": "1.21.0",
        "minecraft:entity": {
            "description": {
                "identifier": identifier,
                "is_spawnable": False,
                "is_summonable": True,
                "is_experimental": False,
            },
            "components": {
                "minecraft:type_family": {
                    "family": ["fragment", collector_family, "inanimate"],
                },
                "minecraft:rideable": {
                    "seat_count": FRAGMENTS_PER_COLLECTOR,
                    "family_types": rider_families,
                    "seats": create_collector_seats(),
                },
                "minecraft:damage_sensor": {
                    "triggers": [{
                        "cause": "all",
                        "deals_damage": False
                    }]
                },
                "minecraft:despawn": {
                    "filters": {
                        "all_of": [
                            {
                                "test": "is_riding",
                                "value": False
                            },
                            {
                                "test": "has_tag",
                                "value": active_tag
                            },
                        ]
                    }
                },
                "minecraft:collision_box": {
                    "width": 0,
                    "height": 0
                },
                "minecraft:health": {
                    "value": 1,
                    "min": 1,
                    "max": 1
                },
                "minecraft:knockback_resistance": {
                    "value": 1
                },
                "minecraft:pushable": {
                    "is_pushable": False,
                    "is_pushable_by_piston": False,
                },
                "minecraft:persistent": {},
                "minecraft:physics": {
                    "has_collision": False,
                    "has_gravity": False,
                },
                "minecraft:fire_immune": {},
                "minecraft:conditional_bandwidth_optimization": {
                    "default_values": {
                        "max_optimized_distance": 0,
                        "max_dropped_ticks": 0,
                    }
                },
            },
        },
    }


def create_fragment_animation(animation_key: str, slot_count: int) -> dict:
    initialize_state = []
    animations = {
        f"animation.{animation_key}.update": {
            "loop": True,
            "bones": {
                GLOBAL_ROOT_BONE_NAME: {
                    "scale": 1
                }
            },
        }
    }

    for slot_index in range(slot_count):
        initialize_state.append(
            f"v.b{slot_index}_model=0;v.b{slot_index}_texture=0;v.b{slot_index}px=0;"
            f"v.b{slot_index}py=0;v.b{slot_index}pz=0;v.b{slot_index}ox=0;"
            f"v.b{slot_index}oy=0;v.b{slot_index}oz=0;v.b{slot_index}rx=0;"
            f"v.b{slot_index}ry=0;v.b{slot_index}rz=0;v.b{slot_index}s=1;"
            f"v.b{slot_index}material=0;"
            f"v.b{slot_index}v=0;")
        animations[f"animation.{animation_key}.b{slot_index}"] = {
            "loop": True,
            "bones": {
                get_slot_bone_name(slot_index): {
                    "position": [
                        f"((v.b{slot_index}px??0)*16)+(v.b{slot_index}ox??0)",
                        f"((v.b{slot_index}py??0)*16)+(v.fragment_y_correction_px??0)+(v.b{slot_index}oy??0)",
                        f"((v.b{slot_index}pz??0)*16)+(v.b{slot_index}oz??0)",
                    ],
                    "rotation": [
                        f"(v.b{slot_index}rx??0)*90",
                        f"(v.b{slot_index}ry??0)*90",
                        f"(v.b{slot_index}rz??0)*90",
                    ],
                    "scale": [
                        f"(v.b{slot_index}s??1)",
                        f"(v.b{slot_index}s??1)",
                        f"(v.b{slot_index}s??1)",
                    ],
                }
            },
        }

    return {
        "initialize_state": initialize_state,
        "payload": {
            "format_version": "1.20.60",
            "animations": animations,
        },
    }


def create_simple_fragment_animation(animation_key: str,
                                     slot_count: int) -> dict:
    initialize_state = []
    animations = {
        f"animation.{animation_key}.update": {
            "loop": True,
            "bones": {
                GLOBAL_ROOT_BONE_NAME: {
                    "scale": 1
                }
            },
        }
    }

    for slot_index in range(slot_count):
        initialize_state.append(
            f"v.b{slot_index}_type=0;v.b{slot_index}_model=-1;v.b{slot_index}px=0;"
            f"v.b{slot_index}py=0;v.b{slot_index}pz=0;v.b{slot_index}ox=0;"
            f"v.b{slot_index}oy=0;v.b{slot_index}oz=0;v.b{slot_index}rx=0;"
            f"v.b{slot_index}ry=0;v.b{slot_index}rz=0;v.b{slot_index}s=1;"
            f"v.b{slot_index}material=0;v.b{slot_index}v=0;")
        animations[f"animation.{animation_key}.b{slot_index}"] = {
            "loop": True,
            "bones": {
                get_slot_bone_name(slot_index): {
                    "position": [
                        f"((v.b{slot_index}px??0)*16)+(v.b{slot_index}ox??0)",
                        f"((v.b{slot_index}py??0)*16)+(v.fragment_y_correction_px??0)+(v.b{slot_index}oy??0)",
                        f"((v.b{slot_index}pz??0)*16)+(v.b{slot_index}oz??0)",
                    ],
                    "rotation": [
                        f"(v.b{slot_index}rx??0)*90",
                        f"(v.b{slot_index}ry??0)*90",
                        f"(v.b{slot_index}rz??0)*90",
                    ],
                    "scale": [
                        f"(v.b{slot_index}s??1)",
                        f"(v.b{slot_index}s??1)",
                        f"(v.b{slot_index}s??1)",
                    ],
                }
            },
        }

    return {
        "initialize_state": initialize_state,
        "payload": {
            "format_version": "1.20.60",
            "animations": animations,
        },
    }


def build_material_dispatch_expression(slot_index: int) -> str:
    material_ref = f"(v.b{slot_index}material??0)"
    return (
        f"return ({material_ref}==1) ? Material.default : "
        f"(({material_ref}==2) ? Material.glass : "
        f"(({material_ref}==3) ? Material.slime_outer : "
        f"(({material_ref}==4) ? Material.redstone_torch : Material.default)));"
    )


def create_client_entity(
    identifier: str,
    material_name: str,
    geometry_map: dict,
    textures_map: dict,
    render_controller_prefix: str,
    animation_key: str,
    slot_count: int,
) -> dict:
    animation_data = create_fragment_animation(animation_key, slot_count)
    animate_entries = [f"b{slot_index}" for slot_index in range(slot_count)]
    render_controllers = [{
        f"{render_controller_prefix}_{slot_index}":
        f"(v.b{slot_index}v??0)==1&&((v.b{slot_index}_model??0)>0)"
    } for slot_index in range(slot_count)]
    animation_refs = {
        "update": f"animation.{animation_key}.update",
    }
    for slot_index in range(slot_count):
        animation_refs[f"b{slot_index}"] = (
            f"animation.{animation_key}.b{slot_index}")

    description = {
        "identifier": identifier,
        "materials": {
            "default": f"{material_name}_default",
            "glow": f"{material_name}_default",
            "glass": f"{material_name}_glass",
            "slime_outer": f"{material_name}_slime_outer",
            "redstone_torch": f"{material_name}_redstone_torch",
        },
        "textures": textures_map,
        "geometry": geometry_map,
        "animations": animation_refs,
        "scripts": {
            "should_update_bones_and_effects_offscreen":
            True,
            "initialize": [
                f"v.fragment_y_correction_px={DEFAULT_FRAGMENT_Y_CORRECTION_PX};",
                *animation_data["initialize_state"],
            ],
            "animate":
            animate_entries,
        },
        "render_controllers": render_controllers,
    }

    return {
        "entity": {
            "format_version": "1.10.0",
            "minecraft:client_entity": {
                "description": description
            },
        },
        "animation": animation_data["payload"],
    }


def create_simple_client_entity(
    identifier: str,
    material_name: str,
    geometry_map: dict,
    texture_path: str,
    render_controller_prefix: str,
    animation_key: str,
    slot_count: int,
) -> dict:
    animation_data = create_simple_fragment_animation(animation_key,
                                                      slot_count)
    animate_entries = [f"b{slot_index}" for slot_index in range(slot_count)]
    render_controllers = [{
        f"{render_controller_prefix}_{slot_index}":
        (f"(v.b{slot_index}v??0)==1&&"
         f"((v.b{slot_index}_model??-1)>=0)&&"
         f"((v.b{slot_index}_type??-1)>=0)")
    } for slot_index in range(slot_count)]
    animation_refs = {
        "update": f"animation.{animation_key}.update",
    }
    for slot_index in range(slot_count):
        animation_refs[f"b{slot_index}"] = (
            f"animation.{animation_key}.b{slot_index}")

    description = {
        "identifier": identifier,
        "materials": {
            "default": f"{material_name}_default",
            "glow": f"{material_name}_default",
            "glass": f"{material_name}_glass",
            "slime_outer": f"{material_name}_slime_outer",
            "redstone_torch": f"{material_name}_redstone_torch",
        },
        "textures": {
            "default": texture_path
        },
        "geometry": geometry_map,
        "animations": animation_refs,
        "scripts": {
            "should_update_bones_and_effects_offscreen":
            True,
            "initialize": [
                f"v.fragment_y_correction_px={DEFAULT_FRAGMENT_Y_CORRECTION_PX};",
                *animation_data["initialize_state"],
            ],
            "animate":
            animate_entries,
        },
        "render_controllers": render_controllers,
    }

    return {
        "entity": {
            "format_version": "1.10.0",
            "minecraft:client_entity": {
                "description": description
            },
        },
        "animation": animation_data["payload"],
    }


def create_render_controllers(
    controller_prefix: str,
    geometry_refs_by_slot: list[list[str]],
    texture_refs: list[str],
) -> dict:
    controllers = {}
    for slot_index, geometry_refs in enumerate(geometry_refs_by_slot):
        controllers[f"{controller_prefix}_{slot_index}"] = {
            "arrays": {
                "geometries": {
                    "Array.geometry_list": geometry_refs,
                },
                "textures": {
                    "Array.texture_list": texture_refs,
                },
            },
            "geometry": f"Array.geometry_list[v.b{slot_index}_model]",
            "materials": [{
                "*": build_material_dispatch_expression(slot_index)
            }],
            "textures": [f"Array.texture_list[v.b{slot_index}_texture]"],
            "light_color_multiplier": 0.8,
            "overlay_color": {
                "r": "0.0",
                "g": "0.0",
                "b": "0.0",
                "a": "-1.0",
            },
            "is_hurt_color": {
                "r": "0.0",
                "g": "0.0",
                "b": "0.0",
                "a": "-1.0",
            },
            "on_fire_color": {
                "r": "0.0",
                "g": "0.0",
                "b": "0.0",
                "a": "-1.0",
            },
        }

    return {
        "format_version": "1.8.0",
        "render_controllers": controllers,
    }


def create_simple_render_controllers(
    controller_prefix: str,
    geometry_refs_by_slot: list[list[str]],
    atlas_columns: int,
    atlas_rows: int,
) -> dict:
    controllers = {}
    for slot_index, geometry_refs in enumerate(geometry_refs_by_slot):
        controllers[f"{controller_prefix}_{slot_index}"] = {
            "arrays": {
                "geometries": {
                    "Array.geometry_list": geometry_refs,
                }
            },
            "textures": ["Texture.default"],
            "geometry": f"Array.geometry_list[v.b{slot_index}_model]",
            "materials": [{
                "*": build_material_dispatch_expression(slot_index)
            }],
            "light_color_multiplier": 0.8,
            "overlay_color": {
                "r": "0.0",
                "g": "0.0",
                "b": "0.0",
                "a": "-1.0",
            },
            "is_hurt_color": {
                "r": "0.0",
                "g": "0.0",
                "b": "0.0",
                "a": "-1.0",
            },
            "on_fire_color": {
                "r": "0.0",
                "g": "0.0",
                "b": "0.0",
                "a": "-1.0",
            },
            "uv_anim": {
                "offset": [
                    f"Math.mod(v.b{slot_index}_type,{atlas_columns})/{atlas_columns}",
                    f"Math.floor(v.b{slot_index}_type/{atlas_columns})/{atlas_rows}",
                ],
                "scale": [1, 1],
            },
        }

    return {
        "format_version": "1.8.0",
        "render_controllers": controllers,
    }


def create_material_file(material_name: str) -> dict:
    return {
        "materials": {
            "version": "1.0.0",
            f"{material_name}_default:entity_alphatest": {
                "+defines": ["USE_UV_ANIM"]
            },
            f"{material_name}_glow:entity_alphatest": {
                "+defines": ["USE_UV_ANIM"]
            },
            f"{material_name}_glass:entity": {
                "+defines": ["ALPHA_TEST", "USE_UV_ANIM"],
                "+states": ["EnableAlphaToCoverage", "Blending"]
            },
            f"{material_name}_slime_outer:entity": {
                "+defines": ["USE_UV_ANIM"],
                "+states": ["Blending"]
            },
            f"{material_name}_redstone_torch:entity_emissive_alpha_one_sided":
            {
                "+defines": ["USE_UV_ANIM"],
                "-defines": ["FANCY"]
            },
        }
    }


def get_train_bp_dependency() -> tuple[str, list[int]]:
    if not TRAIN_BP_MANIFEST_PATH.exists():
        return DEFAULT_TRAIN_BP_UUID, DEFAULT_TRAIN_BP_VERSION

    try:
        manifest = load_json_allow_block_comments(TRAIN_BP_MANIFEST_PATH)
        header = manifest.get("header", {})
        uuid_value = header.get("uuid", DEFAULT_TRAIN_BP_UUID)
        version_value = header.get("version", DEFAULT_TRAIN_BP_VERSION)
        if (isinstance(uuid_value, str) and isinstance(version_value, list)
                and len(version_value) == 3):
            return uuid_value, version_value
    except Exception:
        pass

    return DEFAULT_TRAIN_BP_UUID, DEFAULT_TRAIN_BP_VERSION


def create_bp_manifest(plugin_name: str, build_identity: dict) -> dict:
    train_bp_uuid, train_bp_version = get_train_bp_dependency()
    return {
        "format_version":
        2,
        "header": {
            "name": f"{plugin_name} BP",
            "description": f"{plugin_name} behavior pack",
            "uuid": build_identity["bp_header_uuid"],
            "version": [1, 0, 0],
            "min_engine_version": [1, 21, 101],
        },
        "modules": [
            {
                "type": "data",
                "uuid": build_identity["bp_data_uuid"],
                "version": [1, 0, 0],
            },
            {
                "type": "script",
                "language": "javascript",
                "entry": "scripts/index.js",
                "uuid": build_identity["bp_script_uuid"],
                "version": [1, 0, 0],
            },
        ],
        "dependencies": [
            {
                "uuid": build_identity["rp_header_uuid"],
                "version": [1, 0, 0]
            },
            {
                "uuid": train_bp_uuid,
                "version": train_bp_version
            },
            {
                "module_name": "@minecraft/server",
                "version": "1.18.0"
            },
        ],
    }


def create_rp_manifest(plugin_name: str, build_identity: dict) -> dict:
    return {
        "format_version":
        2,
        "header": {
            "name": f"{plugin_name} RP",
            "description": f"{plugin_name} resource pack",
            "uuid": build_identity["rp_header_uuid"],
            "version": [1, 0, 0],
            "min_engine_version": [1, 21, 101],
        },
        "modules": [{
            "type": "resources",
            "uuid": build_identity["rp_resources_uuid"],
            "version": [1, 0, 0],
        }],
        "dependencies": [{
            "uuid": build_identity["bp_header_uuid"],
            "version": [1, 0, 0]
        }],
    }


def create_registry_js(
    plugin_name: str,
    plugin_source_namespace: str,
    plugin_runtime_namespace: str,
    build_tag: str,
    collector_type: str,
    fragment_type: str,
    simple_fragment_type: str,
    collector_family: str,
    fragment_family: str,
    simple_fragment_family: str,
    atlas_entries: list[dict],
    custom_entries: list[dict],
) -> str:
    payload = {"atlas": atlas_entries, "custom": custom_entries}
    data_json = json.dumps(payload, ensure_ascii=False, indent=4)
    tag_prefix = f"{plugin_runtime_namespace}_train_plugin"

    return (
        f'export const PLUGIN_NAME = {json.dumps(plugin_name, ensure_ascii=False)};\n'
        f'export const PLUGIN_SOURCE_NAMESPACE = "{plugin_source_namespace}";\n'
        f'export const PLUGIN_NAMESPACE = "{plugin_runtime_namespace}";\n'
        f'export const PLUGIN_BUILD_TAG = "{build_tag}";\n'
        f'export const COLLECTOR_TYPE = "{collector_type}";\n'
        f'export const FRAGMENT_TYPE = "{fragment_type}";\n'
        f'export const SIMPLE_FRAGMENT_TYPE = "{simple_fragment_type}";\n'
        f'export const PLUGIN_COLLECTOR_FAMILY = "{collector_family}";\n'
        f'export const FRAGMENT_FAMILY = "{fragment_family}";\n'
        f'export const SIMPLE_FRAGMENT_FAMILY = "{simple_fragment_family}";\n'
        f'export const PLUGIN_TAG_PREFIX = "{tag_prefix}";\n'
        'export const PLUGIN_ACTIVE_TAG = `${PLUGIN_TAG_PREFIX}_active`;\n'
        'export const PLUGIN_COLLECTOR_TAG = `${PLUGIN_TAG_PREFIX}_collector`;\n'
        'export const PLUGIN_FRAGMENT_TAG = `${PLUGIN_TAG_PREFIX}_fragment`;\n'
        'export const PLUGIN_SIMPLE_FRAGMENT_TAG = `${PLUGIN_TAG_PREFIX}_simple_fragment`;\n'
        'export const PLUGIN_OWNER_TAG_PREFIX = `${PLUGIN_TAG_PREFIX}_owner_`;\n'
        'export const PLUGIN_KEY_TAG_PREFIX = `${PLUGIN_TAG_PREFIX}_key_`;\n'
        'export const PLUGIN_COLLECTOR_INDEX_TAG_PREFIX = `${PLUGIN_TAG_PREFIX}_collector_index_`;\n'
        'export const TRAIN_PLUGIN_ATTACHED_TAG = "train_plugin_attached";\n'
        f"export const FRAGMENT_SLOT_COUNT = {FRAGMENT_SLOT_COUNT};\n"
        f"export const SIMPLE_FRAGMENT_SLOT_COUNT = {SIMPLE_FRAGMENT_SLOT_COUNT};\n"
        f"export const FRAGMENTS_PER_COLLECTOR = {FRAGMENTS_PER_COLLECTOR};\n"
        "export const ANIMATION_REFRESH_INTERVAL = 20;\n"
        f'export const FRAGMENT_ANIMATION = "animation.{plugin_runtime_namespace}.train_fragment.update";\n'
        f'export const SIMPLE_FRAGMENT_ANIMATION = "animation.{plugin_runtime_namespace}.train_simple_fragment.update";\n'
        f"const BLOCK_DATA = {data_json};\n"
        "export const ATLAS_BLOCK_DEFINITIONS = BLOCK_DATA.atlas;\n"
        "export const CUSTOM_BLOCK_DEFINITIONS = BLOCK_DATA.custom;\n"
        "export const BLOCK_DEFINITIONS = [...ATLAS_BLOCK_DEFINITIONS, ...CUSTOM_BLOCK_DEFINITIONS];\n"
        "export const BLOCK_REGISTRY = new Map(BLOCK_DEFINITIONS.map((entry) => [entry.blockId, entry]));\n"
    )


def get_custom_geometry_signature(block: dict) -> str | None:
    model_path = block.get("modelPath")
    if block.get("renderMode") != "custom_model" or block.get(
            "placeholder") or not model_path:
        return None

    resolved_model_path = Path(model_path).resolve().as_posix()
    geometry_identifier = block.get("geometryIdentifier") or ""
    return f"{resolved_model_path}::{geometry_identifier}"


def create_empty_pack_spec() -> dict:
    return {
        "atlasBlocks": [],
        "customBlocks": [],
        "customGeometryKeys": set(),
    }


def has_pack_content(pack_spec: dict) -> bool:
    return bool(pack_spec["atlasBlocks"] or pack_spec["customBlocks"])


def calculate_pack_complexity(pack_spec: dict) -> int:
    return (len(pack_spec["atlasBlocks"]) * ATLAS_BLOCK_COMPLEXITY +
            len(pack_spec["customBlocks"]) * CUSTOM_BLOCK_COMPLEXITY +
            len(pack_spec["customGeometryKeys"]) * CUSTOM_GEOMETRY_COMPLEXITY)


def can_accept_atlas_block(pack_spec: dict) -> bool:
    next_atlas_count = len(pack_spec["atlasBlocks"]) + 1
    next_complexity = calculate_pack_complexity(
        pack_spec) + ATLAS_BLOCK_COMPLEXITY
    return (next_atlas_count <= MAX_PACK_ATLAS_BLOCKS
            and next_complexity <= MAX_PACK_COMPLEXITY)


def can_accept_custom_group(pack_spec: dict, group_blocks: list[dict],
                            geometry_key: str | None) -> bool:
    next_custom_count = len(pack_spec["customBlocks"]) + len(group_blocks)
    next_geometry_count = len(pack_spec["customGeometryKeys"])
    next_complexity = calculate_pack_complexity(pack_spec)

    if geometry_key and geometry_key not in pack_spec["customGeometryKeys"]:
        next_geometry_count += 1
        next_complexity += CUSTOM_GEOMETRY_COMPLEXITY

    next_complexity += len(group_blocks) * CUSTOM_BLOCK_COMPLEXITY
    return (next_custom_count <= MAX_PACK_CUSTOM_BLOCKS
            and next_geometry_count <= MAX_PACK_CUSTOM_GEOMETRIES
            and next_complexity <= MAX_PACK_COMPLEXITY)


def partition_blocks_into_packs(atlas_blocks: list[dict],
                                custom_blocks: list[dict]) -> list[dict]:
    packs: list[dict] = []
    current_pack = create_empty_pack_spec()

    def flush_current_pack() -> None:
        nonlocal current_pack
        if has_pack_content(current_pack):
            packs.append(current_pack)
        current_pack = create_empty_pack_spec()

    for atlas_block in atlas_blocks:
        if has_pack_content(
                current_pack) and not can_accept_atlas_block(current_pack):
            flush_current_pack()
        current_pack["atlasBlocks"].append(atlas_block)

    grouped_custom_blocks: dict[str | None, list[dict]] = {}
    grouped_custom_order: list[str | None] = []
    for custom_block in custom_blocks:
        geometry_key = get_custom_geometry_signature(custom_block)
        if geometry_key not in grouped_custom_blocks:
            grouped_custom_blocks[geometry_key] = []
            grouped_custom_order.append(geometry_key)
        grouped_custom_blocks[geometry_key].append(custom_block)

    for geometry_key in grouped_custom_order:
        group_blocks = grouped_custom_blocks[geometry_key]
        if (has_pack_content(current_pack) and not can_accept_custom_group(
                current_pack, group_blocks, geometry_key)):
            flush_current_pack()

        current_pack["customBlocks"].extend(group_blocks)
        if geometry_key:
            current_pack["customGeometryKeys"].add(geometry_key)

    flush_current_pack()
    return packs or [create_empty_pack_spec()]


def get_pack_key(pack_index: int, total_packs: int) -> str:
    return "default" if total_packs == 1 else f"pack_{pack_index + 1:02d}"


def get_pack_source_namespace(plugin_namespace: str, pack_index: int,
                              total_packs: int) -> str:
    if total_packs == 1:
        return plugin_namespace
    return f"{plugin_namespace}_p{pack_index + 1:02d}"


def get_pack_runtime_namespace(base_runtime_namespace: str, pack_index: int,
                               total_packs: int) -> str:
    if total_packs == 1:
        return base_runtime_namespace
    return f"{base_runtime_namespace}_p{pack_index + 1:02d}"


def get_pack_plugin_name(plugin_name: str, pack_index: int,
                         total_packs: int) -> str:
    if total_packs == 1:
        return plugin_name
    return f"{plugin_name} Pack {pack_index + 1:02d}"


def get_pack_build_root(pack_index: int, total_packs: int) -> Path:
    if total_packs == 1:
        return BUILD_DIR
    return BUILD_DIR / "packs" / f"pack_{pack_index + 1:02d}"


def normalize_blocks(
    config: dict
) -> tuple[str, str, list[dict], list[dict], list[str], list[str]]:
    plugin_namespace = config.get("plugin_namespace")
    plugin_name = config.get("plugin_name")
    if not isinstance(plugin_namespace, str):
        raise ConfigError("plugin_namespace 必须是字符串。")
    if not isinstance(plugin_name, str):
        raise ConfigError("plugin_name 必须是字符串。")

    validate_namespace(plugin_namespace)

    raw_blocks = config.get("blocks", [])
    if not isinstance(raw_blocks, list):
        raise ConfigError("blocks 必须是数组。")

    atlas_blocks: list[dict] = []
    custom_blocks: list[dict] = []
    used_block_ids: set[str] = set()
    (manual_blocks, manual_blocks_by_id,
     manual_texture_issue_reports) = normalize_manual_blocks(raw_blocks)
    (auto_atlas_blocks, auto_custom_blocks, auto_texture_issue_reports,
     consumed_manual_block_ids) = normalize_auto_blocks(
         used_block_ids, manual_blocks_by_id)
    atlas_blocks.extend(auto_atlas_blocks)
    custom_blocks.extend(auto_custom_blocks)

    for normalized_block in manual_blocks:
        block_id = normalized_block["blockId"]
        if block_id in consumed_manual_block_ids:
            continue
        if block_id in used_block_ids:
            raise ConfigError(f"block_id 重复: {block_id}")
        used_block_ids.add(block_id)
        if normalized_block["renderMode"] == "atlas":
            atlas_blocks.append(normalized_block)
        else:
            custom_blocks.append(normalized_block)

    return (plugin_namespace, plugin_name, atlas_blocks, custom_blocks,
            manual_texture_issue_reports, auto_texture_issue_reports)


def write_pack_output(
    *,
    pack_index: int,
    total_packs: int,
    pack_spec: dict,
    plugin_name: str,
    plugin_namespace: str,
    build_identity: dict,
    uuid_bundle: dict,
) -> dict:
    pack_plugin_name = get_pack_plugin_name(plugin_name, pack_index,
                                            total_packs)
    pack_plugin_namespace = get_pack_source_namespace(plugin_namespace,
                                                      pack_index, total_packs)
    runtime_namespace = get_pack_runtime_namespace(
        build_identity["generated_namespace"], pack_index, total_packs)
    build_root = get_pack_build_root(pack_index, total_packs)
    bp_dir = build_root / "BP"
    rp_dir = build_root / "RP"

    bp_dir.mkdir(parents=True, exist_ok=True)
    rp_dir.mkdir(parents=True, exist_ok=True)

    generated_texture_root = rp_dir / "textures" / "generated"
    runtime_texture_root = generated_texture_root / runtime_namespace
    custom_texture_dir = runtime_texture_root / "custom"
    atlas_texture_path = runtime_texture_root / "train_fragment_atlas.png"
    placeholder_texture_path = runtime_texture_root / "placeholder.png"

    collector_type = f"{runtime_namespace}:train_plugin_collector"
    fragment_type = f"{runtime_namespace}:train_fragment"
    simple_fragment_type = f"{runtime_namespace}:train_simple_fragment"

    collector_family = f"{runtime_namespace}_train_plugin_collector"
    fragment_family = f"{runtime_namespace}_train_plugin_fragment"
    simple_fragment_family = f"{runtime_namespace}_train_plugin_simple_fragment"

    plugin_tag_prefix = f"{runtime_namespace}_train_plugin"
    active_tag = f"{plugin_tag_prefix}_active"
    material_name = f"{runtime_namespace}_fragment"
    fragment_animation_key = f"{runtime_namespace}.train_fragment"
    simple_fragment_animation_key = f"{runtime_namespace}.train_simple_fragment"
    fragment_controller_prefix = (
        f"controller.render.{runtime_namespace}.train_fragment")
    simple_fragment_controller_prefix = (
        f"controller.render.{runtime_namespace}.train_simple_fragment")

    atlas_blocks = pack_spec["atlasBlocks"]
    custom_blocks = pack_spec["customBlocks"]

    create_placeholder_texture(placeholder_texture_path)

    atlas_generated_entries: list[dict] = []
    atlas_count = max(1, len(atlas_blocks))
    atlas_columns = max(1, min(8, math.ceil(math.sqrt(atlas_count))))
    atlas_rows = max(1, math.ceil(atlas_count / atlas_columns))
    atlas_width = atlas_columns * ATLAS_REGION_WIDTH
    atlas_height = atlas_rows * ATLAS_REGION_HEIGHT
    atlas_image = Image.new("RGBA", (atlas_width, atlas_height), (0, 0, 0, 0))
    atlas_texture_path.parent.mkdir(parents=True, exist_ok=True)
    atlas_image.save(atlas_texture_path)

    custom_geometry_map: dict[str, str] = {}
    custom_geometry_refs_by_slot: list[list[str]] = [
        [] for _ in range(FRAGMENT_SLOT_COUNT)
    ]
    custom_texture_map = {
        "placeholder": format_resource_path(placeholder_texture_path, rp_dir),
    }
    custom_texture_refs = ["Texture.placeholder"]
    custom_fragment_geometries: list[dict] = []

    for slot_index in range(FRAGMENT_SLOT_COUNT):
        placeholder_key = f"placeholder_{slot_index}"
        placeholder_identifier = (
            f"geometry.{runtime_namespace}.train_fragment.placeholder_{slot_index}"
        )
        custom_geometry_map[placeholder_key] = placeholder_identifier
        custom_geometry_refs_by_slot[slot_index].append(
            f"Geometry.{placeholder_key}")
        custom_fragment_geometries.append(
            create_placeholder_geometry(placeholder_identifier, slot_index))

    simple_geometry_map: dict[str, str] = {}
    simple_geometry_refs_by_slot: list[list[str]] = [
        [] for _ in range(SIMPLE_FRAGMENT_SLOT_COUNT)
    ]
    simple_fragment_geometries: list[dict] = []

    for slot_index in range(SIMPLE_FRAGMENT_SLOT_COUNT):
        for shape in ATLAS_MODEL_ORDER:
            geometry_key = f"{shape}_{slot_index}"
            geometry_identifier = (
                f"geometry.{runtime_namespace}.train_simple_fragment."
                f"{shape}_{slot_index}")
            simple_geometry_map[geometry_key] = geometry_identifier
            simple_geometry_refs_by_slot[slot_index].append(
                f"Geometry.{geometry_key}")
            simple_fragment_geometries.append(
                create_simple_atlas_geometry(
                    geometry_identifier,
                    atlas_width,
                    atlas_height,
                    shape,
                    slot_index,
                ))

    for index, block in enumerate(atlas_blocks):
        tile_index = index
        region_x = (tile_index % atlas_columns) * ATLAS_REGION_WIDTH
        region_y = (tile_index // atlas_columns) * ATLAS_REGION_HEIGHT

        for face, (offset_x, offset_y) in ATLAS_FACE_LAYOUT.items():
            if block.get("placeholder"):
                texture = read_texture_image(placeholder_texture_path)
            else:
                texture = read_texture_image(block["faceTextures"][face])
            if texture.size != (16, 16):
                texture = texture.resize((16, 16), RESAMPLING_NEAREST)

            tile_x = region_x + offset_x
            tile_y = region_y + offset_y
            atlas_image.paste(texture, (tile_x, tile_y))

        atlas_generated_entries.append({
            "blockId":
            block["blockId"],
            "renderMode":
            "atlas",
            "specialInteraction":
            block["specialInteraction"],
            "collisionProfile":
            block["collisionProfile"],
            "typeIndex":
            index,
            "modelIndex":
            ATLAS_MODEL_ORDER.index(block["shape"]),
            "offsetPx":
            block["offsetPx"],
            "scale":
            block["scale"],
            "rotationRules":
            block.get("rotationRules", []),
            "materialIndex":
            MATERIAL_INDEX_MAP[block["material"]],
        })

    atlas_image.save(atlas_texture_path)

    custom_generated_entries: list[dict] = []
    texture_indices_by_source: dict[str, int] = {}
    geometry_indices_by_signature: dict[str, int] = {}

    for block in custom_blocks:
        geometry_index = 0
        texture_index = 0

        if not block.get("placeholder"):
            texture_source_path = Path(block["texturePath"]).resolve()
            texture_signature = texture_source_path.as_posix()
            texture_index = texture_indices_by_source.get(texture_signature, 0)
            if texture_index == 0:
                texture_index = len(custom_texture_refs)
                texture_output_path = (
                    custom_texture_dir /
                    f"texture_{texture_index:04d}{texture_source_path.suffix or '.png'}"
                )
                texture_output_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(texture_source_path, texture_output_path)

                texture_key = f"custom_texture_{texture_index:04d}"
                custom_texture_map[texture_key] = format_resource_path(
                    texture_output_path, rp_dir)
                custom_texture_refs.append(f"Texture.{texture_key}")
                texture_indices_by_source[texture_signature] = texture_index

            geometry_signature = get_custom_geometry_signature(block)
            if geometry_signature:
                geometry_index = geometry_indices_by_signature.get(
                    geometry_signature, 0)
                if geometry_index == 0:
                    geometry_index = len(geometry_indices_by_signature) + 1
                    geometry_indices_by_signature[
                        geometry_signature] = geometry_index
                    for slot_index in range(FRAGMENT_SLOT_COUNT):
                        geometry_key = (
                            f"custom_model_{geometry_index:04d}_{slot_index}")
                        generated_identifier = (
                            f"geometry.{runtime_namespace}.train_fragment.model."
                            f"{geometry_index:04d}_{slot_index}")
                        custom_geometry_map[
                            geometry_key] = generated_identifier
                        custom_geometry_refs_by_slot[slot_index].append(
                            f"Geometry.{geometry_key}")
                        _, geometry_payload = create_custom_geometry(
                            Path(block["modelPath"]),
                            block["geometryIdentifier"],
                            generated_identifier,
                            slot_index,
                        )
                        custom_fragment_geometries.append(geometry_payload)

        custom_generated_entries.append({
            "blockId":
            block["blockId"],
            "renderMode":
            "custom_model",
            "specialInteraction":
            block["specialInteraction"],
            "collisionProfile":
            block["collisionProfile"],
            "geometryIndex":
            geometry_index,
            "textureIndex":
            texture_index,
            "offsetPx":
            block["offsetPx"],
            "scale":
            block["scale"],
            "rotationRules":
            block.get("rotationRules", []),
            "materialIndex":
            MATERIAL_INDEX_MAP[block["material"]],
        })

    manifest_identity = {
        **build_identity,
        **uuid_bundle,
    }

    write_json(
        bp_dir / "manifest.json",
        create_bp_manifest(pack_plugin_name, manifest_identity),
    )
    write_json(
        rp_dir / "manifest.json",
        create_rp_manifest(pack_plugin_name, manifest_identity),
    )

    write_json(
        bp_dir / "entities" / "train_plugin_collector.json",
        create_collector_bp_entity(
            collector_type,
            collector_family,
            [fragment_family, simple_fragment_family],
            active_tag,
        ),
    )
    write_json(
        bp_dir / "entities" / "train_fragment.json",
        create_fragment_bp_entity(fragment_type, fragment_family, active_tag),
    )
    write_json(
        bp_dir / "entities" / "train_simple_fragment.json",
        create_fragment_bp_entity(simple_fragment_type, simple_fragment_family,
                                  active_tag),
    )

    write_text(
        bp_dir / "scripts" / "generated" / "pluginRegistry.js",
        create_registry_js(
            pack_plugin_name,
            pack_plugin_namespace,
            runtime_namespace,
            build_identity["build_tag"],
            collector_type,
            fragment_type,
            simple_fragment_type,
            collector_family,
            fragment_family,
            simple_fragment_family,
            atlas_generated_entries,
            custom_generated_entries,
        ),
    )
    if not RUNTIME_SCRIPT_TEMPLATE_PATH.exists():
        raise ConfigError(f"缺少运行时脚本模板: {RUNTIME_SCRIPT_TEMPLATE_PATH}")
    write_text(
        bp_dir / "scripts" / "index.js",
        RUNTIME_SCRIPT_TEMPLATE_PATH.read_text(encoding="utf-8"),
    )

    fragment_client = create_client_entity(
        fragment_type,
        material_name,
        custom_geometry_map,
        custom_texture_map,
        fragment_controller_prefix,
        fragment_animation_key,
        FRAGMENT_SLOT_COUNT,
    )
    write_json(rp_dir / "entity" / "train_fragment.entity.json",
               fragment_client["entity"])
    write_json(
        rp_dir / "animations" / "train_fragment.animation.json",
        fragment_client["animation"],
    )
    write_json(
        rp_dir / "models" / "entity" / "train_fragment.geo.json",
        {
            "format_version": "1.12.0",
            "minecraft:geometry": custom_fragment_geometries,
        },
    )
    write_json(
        rp_dir / "render_controllers" /
        "train_fragment.render_controllers.json",
        create_render_controllers(
            fragment_controller_prefix,
            custom_geometry_refs_by_slot,
            custom_texture_refs,
        ),
    )
    simple_fragment_client = create_simple_client_entity(
        simple_fragment_type,
        material_name,
        simple_geometry_map,
        format_resource_path(atlas_texture_path, rp_dir),
        simple_fragment_controller_prefix,
        simple_fragment_animation_key,
        SIMPLE_FRAGMENT_SLOT_COUNT,
    )
    write_json(rp_dir / "entity" / "train_simple_fragment.entity.json",
               simple_fragment_client["entity"])
    write_json(
        rp_dir / "animations" / "train_simple_fragment.animation.json",
        simple_fragment_client["animation"],
    )
    write_json(
        rp_dir / "models" / "entity" / "train_simple_fragment.geo.json",
        {
            "format_version": "1.12.0",
            "minecraft:geometry": simple_fragment_geometries,
        },
    )
    write_json(
        rp_dir / "render_controllers" /
        "train_simple_fragment.render_controllers.json",
        create_simple_render_controllers(
            simple_fragment_controller_prefix,
            simple_geometry_refs_by_slot,
            atlas_columns,
            atlas_rows,
        ),
    )
    write_json(
        rp_dir / "materials" / "entity.material",
        create_material_file(material_name),
    )

    return {
        "packName": pack_plugin_name,
        "buildRoot": build_root,
        "runtimeNamespace": runtime_namespace,
        "atlasCount": len(atlas_generated_entries),
        "customBlockCount": len(custom_generated_entries),
        "customGeometryCount": len(geometry_indices_by_signature),
    }


def generate() -> None:
    config = load_json_allow_block_comments(CONFIG_PATH)
    (plugin_namespace, plugin_name, atlas_blocks, custom_blocks,
     manual_texture_issue_reports,
     auto_texture_issue_reports) = normalize_blocks(config)
    build_identity = load_or_create_build_identity(plugin_namespace)
    pack_specs = partition_blocks_into_packs(atlas_blocks, custom_blocks)
    total_packs = len(pack_specs)
    pack_keys = [
        get_pack_key(pack_index, total_packs)
        for pack_index in range(total_packs)
    ]
    build_identity, pack_uuid_bundles = finalize_pack_uuid_bundles(
        build_identity, pack_keys)

    ensure_clean_dir(BUILD_DIR)

    pack_results = []
    for pack_index, pack_spec in enumerate(pack_specs):
        pack_key = pack_keys[pack_index]
        pack_result = write_pack_output(
            pack_index=pack_index,
            total_packs=total_packs,
            pack_spec=pack_spec,
            plugin_name=plugin_name,
            plugin_namespace=plugin_namespace,
            build_identity=build_identity,
            uuid_bundle=pack_uuid_bundles[pack_key],
        )
        pack_results.append(pack_result)

    print(f"[{plugin_name}] generated successfully: "
          f"build={build_identity['build_tag']}, packs={total_packs}")
    for pack_result in pack_results:
        print(f"- {pack_result['packName']}: "
              f"runtime_namespace={pack_result['runtimeNamespace']}, "
              f"atlas={pack_result['atlasCount']}, "
              f"custom_block={pack_result['customBlockCount']}, "
              f"custom_geometry={pack_result['customGeometryCount']}, "
              f"path={pack_result['buildRoot']}")

    if manual_texture_issue_reports:
        print(f"[{plugin_name}] 以下手动模式条目因贴图解析失败已跳过:")
        for issue in manual_texture_issue_reports:
            print(f"- {issue}")
    if auto_texture_issue_reports:
        print(f"[{plugin_name}] 以下方块自动模式解析失败，已保留占位，请改用手动模式补录:")
        for block_id in dict.fromkeys(auto_texture_issue_reports):
            print(f"- {block_id}")


if __name__ == "__main__":
    generate()
