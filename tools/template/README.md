# Vanilla Train Add-on 方块适配包模板

这份模板的用途：

在**不修改 Vanilla Train Add-on 主包**的前提下，为**自定义方块 Add-on**生成一套**适配包**，让自定义方块能够适配火车的渲染系统，并在需要时接入少量特殊碰撞或特殊交互。

目前模板提供两种操作方式：

- `手动模式`
  直接在 `plugin_blocks.json` 里逐个声明方块。适合你想精确控制材质、模型、贴图、特殊碰撞/交互的时候。
- `自动模式`
  按标准自定义方块目录把文件放进 `auto/`。生成器会自动解析方块ID、材质、模型和贴图。适合批量适配。

如果同一个 `block_id` 同时出现在手动模式和自动模式中，**手动配置优先**。

## 目录结构

| 路径 | 作用 | 怎么用 |
| --- | --- | --- |
| `plugin_blocks.json` | 手动模式配置入口 | 平时主要编辑这个文件 |
| `assets/textures/` | 手动模式贴图输入目录 | 放手动配置要引用的贴图 |
| `assets/models/` | 手动模式模型输入目录 | 放手动配置要引用的 `geo.json` |
| `auto/BP/blocks/` | 自动模式行为包方块目录 | 放原始自定义方块行为文件 |
| `auto/RP/models/blocks/` | 自动模式资源包模型目录 | 放原始自定义方块模型 |
| `auto/RP/blocks.json` | 自动模式资源包方块定义文件 | 读取贴图定义 |
| `auto/RP/textures/blocks/` | 自动模式资源包贴图目录 | 放原始方块贴图 |
| `auto/RP/textures/terrain_texture.json` | 自动模式贴图索引文件 | 放贴图短名和真实贴图路径映射 |
| `tools/generate_plugin_files.py` | 生成脚本 | 配置完成后运行 |
| `build/BP/` | 生成后的行为包 | 进游戏时加载 |
| `build/RP/` | 生成后的资源包 | 进游戏时加载 |
| `.internal/build_identity.json` | 内部身份文件 | 一般不需要手动改 |

## 快速开始

### 手动模式

1. 把自定义模型 `geo.json` 放进 `assets/models/`。
2. 把贴图放进 `assets/textures/`。
3. 编辑 `plugin_blocks.json`。
4. 运行：

```powershell
python tools/generate_plugin_files.py
```

### 自动模式

1. 把行为 `json` 放进 `auto/BP/blocks/`。
2. 把自定义模型 `geo.json` 放进 `auto/RP/models/blocks/`。
3. 如果原资源包带有 `blocks.json`，把它放进 `auto/RP/`。
4. 把贴图放进 `auto/RP/textures/blocks/`，并把 `terrain_texture.json` 放进 `auto/RP/textures/`。
5. 运行：

```powershell
python tools/generate_plugin_files.py
```

脚本在最后一步会确认一次：

- 本次是否使用新的 UUID
- 直接回车默认就是使用新的 UUID
- 如果选择不使用，就会复用 `.internal/build_identity.json` 里当前保存的 UUID
- 模板初始状态下这里的 UUID 为空，所以第一次通常直接回车即可

### 游戏内加载顺序

强烈建议按**以下**的顺序摆放：

1. Vanilla Train Add-on 适配包（最上）
2. 自定义方块 Add-on（中间）
3. Vanilla Train Add-on 主包（最下）


如果你的自定义方块 Add-on 分成多个包，例如行为包和资源包，那么它们也应当放在**主包之上、适配包之下**。

## 手动模式

配置文件是 [plugin_blocks.json](plugin_blocks.json)。

顶层字段有 3 个：

- `plugin_namespace`
  自定义方块 Add-on 的命名空间。只允许小写字母、数字和下划线。
- `plugin_name`
  适配包的名称，给 `manifest.json` 使用。
- `blocks`
  需要适配的方块列表。

每个方块条目至少包含：

- `block_id`
- `model_type`

`model_type` 有两个可用值：

- `vanilla`
- `custom`

### 手动模式完整字段

| 字段 | 作用 | 是否必须 |
| --- | --- | --- |
| `block_id` | 方块完整 ID，如 `test:test_block` | 是 |
| `model_type` | 方块模型类型，可用 `vanilla` 或 `custom` | 是 |
| `material` | 渲染材质，可用值见下方标注 | 否，默认 `default` |
| `special_interaction` | 特殊交互/特殊碰撞，可用值见下方标注 | 否 |
| `client_offset_px` | 客户端渲染偏移，单位像素 | 否，默认 `[0, 0, 0]` |
| `scale` | 客户端渲染缩放 | 否，默认 `1` |

注：`material` 可用值：

- `default`
- `glass`
- `slime_outer`
- `redstone_torch`

### `vanilla` 模型类型

适用场景：

- 完整方块模型
- 半砖模型
- 地毯模型

`vanilla` 必须字段：

| 字段 | 作用 | 是否必须 |
| --- | --- | --- |
| `model` | 模型类型，可用值见下方标注 | 是 |
| `textures` | 六个面对应的贴图 | 是 |

注：`model` 可用值：

- `full_block`
- `slab`
- `carpet`
  
另注：`vanilla` 模型类型下`special_interaction` 可用值：

- `slab_bottom`
  表示下半砖/半格碰撞。

另注：`textures` 需要明确写出 6 个面：

- `up`
- `down`
- `north`
- `east`
- `south`
- `west`

其中：

- `top` 可以代替 `up`
- `bottom` 可以代替 `down`

最小示例：

```json
{
  "block_id": "test:test_block",
  "model_type": "vanilla",
  "model": "full_block",
  "textures": {
    "up": "assets/textures/test_block_up.png",
    "down": "assets/textures/test_block_down.png",
    "north": "assets/textures/test_block_north.png",
    "east": "assets/textures/test_block_east.png",
    "south": "assets/textures/test_block_south.png",
    "west": "assets/textures/test_block_west.png"
  }
}
```

下半砖碰撞示例：

```json
{
  "block_id": "test:test_slab",
  "model_type": "vanilla",
  "model": "slab",
  "textures": {
    "up": "assets/textures/test_slab_top.png",
    "down": "assets/textures/test_slab_bottom.png",
    "north": "assets/textures/test_slab_side.png",
    "east": "assets/textures/test_slab_side.png",
    "south": "assets/textures/test_slab_side.png",
    "west": "assets/textures/test_slab_side.png"
  },
  "special_interaction": "slab_bottom"
}
```

这里要注意：

- `model: "slab"` 只决定渲染外形是下半砖。
- `special_interaction: "slab_bottom"` 才表示它在火车里使用下半砖碰撞。



### `custom` 模型类型

适用场景：

- 具有自定义方块模型 `geo.json`
- 模型不属于完整方块、半砖、地毯的方块

`custom` 必须字段：

| 字段 | 作用 | 是否必须 |
| --- | --- | --- |
| `model` | 自定义模型文件路径 | 是 |
| `texture` | 单图贴图路径 | 是 |


最小示例：

```json
{
  "block_id": "test:test_core",
  "model_type": "custom",
  "model": "assets/models/test_core.geo.json",
  "texture": "assets/textures/test_core.png"
}
```

带门交互的示例：

```json
{
  "block_id": "test:test_door",
  "model_type": "custom",
  "model": "assets/models/test_door.geo.json",
  "texture": "assets/textures/test_door.png",
  "special_interaction": "door"
}
```

注：`custom` 模型类型下`special_interaction`可用值：

- `slab_bottom`
  表示下半砖/半格碰撞。
- `door`
  表示使用门的开关渲染和开关碰撞逻辑。

关于 `door`，需要注意：

- 这里只模拟**原版门**的门表现。
- 它**不会**读取原 Add-on 的真实方块状态，因此和原 Add-on 中自定义门的实现方式无关，哪怕不是门都可以。
- 也就是说，这里只是一个简单的动画切换/碰撞切换功能，并且动画也只是原版门那样简单的开关动画

## 自动模式

使用标准基岩版自定义方块目录：

```text
auto/
  BP/
    blocks/
  RP/
    blocks.json
    models/
      blocks/
    textures/
      blocks/
      terrain_texture.json
```

你只需要把原始文件按目录放进去，生成器会自动尝试解析：

- 方块 ID
- 几何类型
- 模型文件
- 贴图短名和贴图路径
- 部分材质特征
- 部分特殊交互

### 自动模式目前会怎么判断

#### 模型几何

- 如果方块使用 `minecraft:geometry.full_block`
  会走 `vanilla` 路线。
- 如果方块使用其他自定义 geometry
  会按 geometry identifier 去 `auto/RP/models/blocks/` 里查找对应模型，然后走 `custom` 路线。
- 如果方块使用 `minecraft:geometry.cross`
  等不受支持的原版模型，需要改成手动模式，或者提前做一个自定义模型，按`custom` 路线处理。

#### 贴图

- 自动模式会优先从行为包里的 `minecraft:material_instances` 读取贴图短名。
- 如果行为包里缺失这部分贴图定义，也会继续尝试从 `auto/RP/blocks.json` 里读取对应方块的 `textures`。
- 再去 `auto/RP/textures/terrain_texture.json` 里找到真实贴图路径，并解析到 `auto/RP/textures/blocks/` 下的贴图文件。

#### 材质

自动模式目前只做很保守的自动推断：

  
- 如果材质实例的 `render_method` 是 `blend` 或 `alpha_blend`
  会使用 `glass`
- 其他情况统一回落到 `default`

如果你需要更精确的材质选择，建议改用手动模式。

#### 特殊交互

自动模式目前只自动识别两类：

- `slab_bottom`
  依据 `minecraft:collision_box` 是否接近标准下半砖碰撞箱判断。
- `door`
  依据方块 ID、状态名或条件中是否出现典型门状态判断。

关于自动识别的 `door`，规则和手动模式一致：

- 只是一个简单的的模拟碰撞和渲染逻辑
- 和原 Add-on 自定义门的实现方法无关

## 生成结果

运行生成脚本后，`build/` 目录里会生成一套可以直接加载的适配包。

常见输出包括：

- `build/BP/manifest.json`
- `build/RP/manifest.json`
- `build/BP/entities/...`
- `build/BP/scripts/generated/pluginRegistry.js`
- `build/RP/entity/...`
- `build/RP/models/...`
- `build/RP/render_controllers/...`
- `build/...`


其中 `pluginRegistry.js` 会记录每个方块在运行时需要用到的渲染索引，以及：

- `specialInteraction`
- `collisionProfile`

模板运行时会把这些定义同步到动态属性里，主包在建车时会据此决定插件方块要走哪种碰撞或特殊交互。

## 当前限制

这个模板仅支持：

- 普通完整方块渲染
- 半砖渲染
- 地毯渲染
- 自定义模型渲染
- 完整碰撞
- 下半砖碰撞
- 门碰撞与交互

它仍然不负责：

- 楼梯这类多朝向特殊方块
- 栅栏门、告示牌连接态之类的复杂状态逻辑
- 需要完全复刻原 Add-on 自己独立状态机的复杂方块
- 等等此类

如果你的方块已经超出这类边界，建议简单化处理为普通完整方块或其他方式，要不然只能忍痛割爱放弃适配
