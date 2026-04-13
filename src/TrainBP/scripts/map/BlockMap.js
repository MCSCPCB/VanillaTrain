const BLOCK_ID_ENTRIES = [
     ["air", 0],
     ["connect_core", 1],
     ["stone", 2],
     ["dirt", 3],
     ["oak_planks", 4],
     ["spruce_planks", 5],
     ["birch_planks", 6],
     ["jungle_planks", 7],
     ["acacia_planks", 8],
     ["dark_oak_planks", 9],
     ["fence_gate", 4],
     ["spruce_fence_gate", 5],
     ["birch_fence_gate", 6],
     ["jungle_fence_gate", 7],
     ["acacia_fence_gate", 8],
     ["dark_oak_fence_gate", 9],
     ["oak_slab", 4],
     ["spruce_slab", 5],
     ["birch_slab", 6],
     ["jungle_slab", 7],
     ["acacia_slab", 8],
     ["dark_oak_slab", 9],
     ["oak_double_slab", 4],
     ["spruce_double_slab", 5],
     ["birch_double_slab", 6],
     ["jungle_double_slab", 7],
     ["acacia_double_slab", 8],
     ["dark_oak_double_slab", 9],
     ["campfire", 10],
     ["bell", 11],
     ["mangrove_planks", 12],
     ["cherry_planks", 13],
     ["pale_oak_planks", 14],
     ["bamboo_planks", 15],
     ["crimson_planks", 16],
     ["warped_planks", 17],
     ["mangrove_fence_gate", 12],
     ["cherry_fence_gate", 13],
     ["pale_oak_fence_gate", 14],
     ["bamboo_fence_gate", 15],
     ["crimson_fence_gate", 16],
     ["warped_fence_gate", 17],
     ["mangrove_slab", 12],
     ["cherry_slab", 13],
     ["pale_oak_slab", 14],
     ["bamboo_slab", 15],
     ["crimson_slab", 16],
     ["warped_slab", 17],
     ["mangrove_double_slab", 12],
     ["cherry_double_slab", 13],
     ["pale_oak_double_slab", 14],
     ["bamboo_double_slab", 15],
     ["crimson_double_slab", 16],
     ["warped_double_slab", 17],
     ["iron_bars", 18],
     ["glass", 19],
     ["white_stained_glass", 20],
     ["orange_stained_glass", 21],
     ["magenta_stained_glass", 22],
     ["light_blue_stained_glass", 23],
     ["yellow_stained_glass", 24],
     ["lime_stained_glass", 25],
     ["pink_stained_glass", 26],
     ["gray_stained_glass", 27],
     ["light_gray_stained_glass", 28],
     ["cyan_stained_glass", 29],
     ["purple_stained_glass", 30],
     ["blue_stained_glass", 31],
     ["brown_stained_glass", 32],
     ["green_stained_glass", 33],
     ["red_stained_glass", 34],
     ["black_stained_glass", 35],
     ["glass_pane", 19],
     ["white_stained_glass_pane", 20],
     ["orange_stained_glass_pane", 21],
     ["magenta_stained_glass_pane", 22],
     ["light_blue_stained_glass_pane", 23],
     ["yellow_stained_glass_pane", 24],
     ["lime_stained_glass_pane", 25],
     ["pink_stained_glass_pane", 26],
     ["gray_stained_glass_pane", 27],
     ["light_gray_stained_glass_pane", 28],
     ["cyan_stained_glass_pane", 29],
     ["purple_stained_glass_pane", 30],
     ["blue_stained_glass_pane", 31],
     ["brown_stained_glass_pane", 32],
     ["green_stained_glass_pane", 33],
     ["red_stained_glass_pane", 34],
     ["black_stained_glass_pane", 35],
     ["ladder", 36],
     ["soul_campfire", 37],
     ["amethyst_block", 38],
     ["andesite", 39],
     ["polished_andesite", 40],
     ["calcite", 41],
     ["clay", 42],
     ["coarse_dirt", 43],
     ["cobblestone", 44],
     ["mossy_cobblestone", 45],
     ["diorite", 46],
     ["polished_diorite", 47],
     ["dripstone_block", 48],
     ["granite", 49],
     ["polished_granite", 50],
     ["gravel", 51],
     ["hardened_clay", 52],
     ["obsidian", 53],
     ["crying_obsidian", 54],
     ["netherrack", 55],
     ["quartz_ore", 56],
     ["nether_gold_ore", 57],
     ["coal_ore", 58],
     ["copper_ore", 59],
     ["diamond_ore", 60],
     ["emerald_ore", 61],
     ["gold_ore", 62],
     ["iron_ore", 63],
     ["lapis_ore", 64],
     ["redstone_ore", 65],
     ["coal_block", 66],
     ["diamond_block", 67],
     ["emerald_block", 68],
     ["gold_block", 69],
     ["iron_block", 70],
     ["lapis_block", 71],
     ["netherite_block", 72],
     ["redstone_block", 73],
     ["raw_iron_block", 74],
     ["raw_gold_block", 75],
     ["raw_copper_block", 76],
     ["copper_block", 469],
     ["exposed_copper", 470],
     ["weathered_copper", 471],
     ["oxidized_copper", 472],
     ["waxed_copper", 469],
     ["waxed_exposed_copper", 470],
     ["waxed_weathered_copper", 471],
     ["waxed_oxidized_copper", 472],
     ["chiseled_copper", 473],
     ["exposed_chiseled_copper", 474],
     ["weathered_chiseled_copper", 475],
     ["oxidized_chiseled_copper", 476],
     ["waxed_chiseled_copper", 473],
     ["waxed_exposed_chiseled_copper", 474],
     ["waxed_weathered_chiseled_copper", 475],
     ["waxed_oxidized_chiseled_copper", 476],
     ["deepslate", 77],
     ["cobbled_deepslate", 78],
     ["polished_deepslate", 79],
     ["deepslate_bricks", 80],
     ["cracked_deepslate_bricks", 81],
     ["deepslate_tiles", 82],
     ["cracked_deepslate_tiles", 83],
     ["chiseled_deepslate", 84],
     ["deepslate_coal_ore", 85],
     ["deepslate_copper_ore", 86],
     ["deepslate_diamond_ore", 87],
     ["deepslate_emerald_ore", 88],
     ["deepslate_gold_ore", 89],
     ["deepslate_iron_ore", 90],
     ["deepslate_lapis_ore", 91],
     ["deepslate_redstone_ore", 92],
     ["tuff", 93],
     ["polished_tuff", 94],
     ["tuff_bricks", 95],
     ["chiseled_tuff", 96],
     ["chiseled_tuff_bricks", 97],
     ["blackstone", 98],
     ["gilded_blackstone", 99],
     ["polished_blackstone", 100],
     ["polished_blackstone_bricks", 101],
     ["cracked_polished_blackstone_bricks", 102],
     ["chiseled_polished_blackstone", 103],
     ["stonebrick", 104],
     ["stone_bricks", 104],
     ["mossy_stone_bricks", 105],
     ["cracked_stone_bricks", 106],
     ["chiseled_stone_bricks", 107],
     ["brick_block", 108],
     ["nether_brick", 109],
     ["red_nether_brick", 110],
     ["cracked_nether_bricks", 111],
     ["chiseled_nether_bricks", 112],
     ["mud", 113],
     ["packed_mud", 114],
     ["mud_bricks", 115],
     ["resin_block", 116],
     ["resin_bricks", 117],
     ["chiseled_resin_bricks", 118],
     ["end_stone", 119],
     ["end_bricks", 120],
     ["purpur_block", 121],
     ["prismarine", 122],
     ["prismarine_bricks", 123],
     ["dark_prismarine", 124],
     ["sponge", 125],
     ["wet_sponge", 126],
     ["glowstone", 127],
     ["magma", 128],
     ["bamboo_mosaic", 129],
     ["white_concrete", 130],
     ["orange_concrete", 131],
     ["magenta_concrete", 132],
     ["light_blue_concrete", 133],
     ["yellow_concrete", 134],
     ["lime_concrete", 135],
     ["pink_concrete", 136],
     ["gray_concrete", 137],
     ["light_gray_concrete", 138],
     ["cyan_concrete", 139],
     ["purple_concrete", 140],
     ["blue_concrete", 141],
     ["brown_concrete", 142],
     ["green_concrete", 143],
     ["red_concrete", 144],
     ["black_concrete", 145],
     ["white_concrete_powder", 146],
     ["orange_concrete_powder", 147],
     ["magenta_concrete_powder", 148],
     ["light_blue_concrete_powder", 149],
     ["yellow_concrete_powder", 150],
     ["lime_concrete_powder", 151],
     ["pink_concrete_powder", 152],
     ["gray_concrete_powder", 153],
     ["light_gray_concrete_powder", 154],
     ["cyan_concrete_powder", 155],
     ["purple_concrete_powder", 156],
     ["blue_concrete_powder", 157],
     ["brown_concrete_powder", 158],
     ["green_concrete_powder", 159],
     ["red_concrete_powder", 160],
     ["black_concrete_powder", 161],
     ["white_terracotta", 162],
     ["orange_terracotta", 163],
     ["magenta_terracotta", 164],
     ["light_blue_terracotta", 165],
     ["yellow_terracotta", 166],
     ["lime_terracotta", 167],
     ["pink_terracotta", 168],
     ["gray_terracotta", 169],
     ["light_gray_terracotta", 170],
     ["cyan_terracotta", 171],
     ["purple_terracotta", 172],
     ["blue_terracotta", 173],
     ["brown_terracotta", 174],
     ["green_terracotta", 175],
     ["red_terracotta", 176],
     ["black_terracotta", 177],
     ["white_wool", 178],
     ["orange_wool", 179],
     ["magenta_wool", 180],
     ["light_blue_wool", 181],
     ["yellow_wool", 182],
     ["lime_wool", 183],
     ["pink_wool", 184],
     ["gray_wool", 185],
     ["light_gray_wool", 186],
     ["cyan_wool", 187],
     ["purple_wool", 188],
     ["blue_wool", 189],
     ["brown_wool", 190],
     ["green_wool", 191],
     ["red_wool", 192],
     ["black_wool", 193],
     ["andesite_slab", 39],
     ["andesite_double_slab", 39],
     ["polished_andesite_slab", 40],
     ["polished_andesite_double_slab", 40],
     ["bamboo_mosaic_slab", 129],
     ["bamboo_mosaic_double_slab", 129],
     ["blackstone_slab", 98],
     ["blackstone_double_slab", 98],
     ["brick_slab", 108],
     ["brick_double_slab", 108],
     ["cobbled_deepslate_slab", 78],
     ["cobbled_deepslate_double_slab", 78],
     ["cobblestone_slab", 44],
     ["cobblestone_double_slab", 44],
     ["dark_prismarine_slab", 124],
     ["dark_prismarine_double_slab", 124],
     ["deepslate_brick_slab", 80],
     ["deepslate_brick_double_slab", 80],
     ["deepslate_tile_slab", 82],
     ["deepslate_tile_double_slab", 82],
     ["diorite_slab", 46],
     ["diorite_double_slab", 46],
     ["end_stone_brick_slab", 120],
     ["end_stone_brick_double_slab", 120],
     ["granite_slab", 49],
     ["granite_double_slab", 49],
     ["mossy_cobblestone_slab", 45],
     ["mossy_cobblestone_double_slab", 45],
     ["mossy_stone_brick_slab", 105],
     ["mossy_stone_brick_double_slab", 105],
     ["mud_brick_slab", 115],
     ["mud_brick_double_slab", 115],
     ["nether_brick_slab", 109],
     ["nether_brick_double_slab", 109],
     ["normal_stone_slab", 2],
     ["normal_stone_double_slab", 2],
     ["polished_blackstone_brick_slab", 101],
     ["polished_blackstone_brick_double_slab", 101],
     ["polished_blackstone_slab", 100],
     ["polished_blackstone_double_slab", 100],
     ["polished_deepslate_slab", 79],
     ["polished_deepslate_double_slab", 79],
     ["polished_diorite_slab", 47],
     ["polished_diorite_double_slab", 47],
     ["polished_granite_slab", 50],
     ["polished_granite_double_slab", 50],
     ["polished_tuff_slab", 94],
     ["polished_tuff_double_slab", 94],
     ["prismarine_brick_slab", 123],
     ["prismarine_brick_double_slab", 123],
     ["prismarine_slab", 122],
     ["prismarine_double_slab", 122],
     ["purpur_slab", 121],
     ["purpur_double_slab", 121],
     ["red_nether_brick_slab", 110],
     ["red_nether_brick_double_slab", 110],
     ["resin_brick_slab", 117],
     ["resin_brick_double_slab", 117],
     ["stone_brick_slab", 104],
     ["stone_brick_double_slab", 104],
     ["tuff_brick_slab", 95],
     ["tuff_brick_double_slab", 95],
     ["tuff_slab", 93],
     ["tuff_double_slab", 93],
     ["cut_copper", 194],
     ["cut_copper_slab", 194],
     ["double_cut_copper_slab", 194],
     ["waxed_cut_copper", 194],
     ["waxed_cut_copper_slab", 194],
     ["waxed_double_cut_copper_slab", 194],
     ["exposed_cut_copper", 195],
     ["exposed_cut_copper_slab", 195],
     ["exposed_double_cut_copper_slab", 195],
     ["waxed_exposed_cut_copper", 195],
     ["waxed_exposed_cut_copper_slab", 195],
     ["waxed_exposed_double_cut_copper_slab", 195],
     ["weathered_cut_copper", 196],
     ["weathered_cut_copper_slab", 196],
     ["weathered_double_cut_copper_slab", 196],
     ["waxed_weathered_cut_copper", 196],
     ["waxed_weathered_cut_copper_slab", 196],
     ["waxed_weathered_double_cut_copper_slab", 196],
     ["oxidized_cut_copper", 197],
     ["oxidized_cut_copper_slab", 197],
     ["oxidized_double_cut_copper_slab", 197],
     ["waxed_oxidized_cut_copper", 197],
     ["waxed_oxidized_cut_copper_slab", 197],
     ["waxed_oxidized_double_cut_copper_slab", 197],
     ["cut_red_sandstone_slab", 198],
     ["cut_red_sandstone_double_slab", 198],
     ["cut_sandstone_slab", 199],
     ["cut_sandstone_double_slab", 199],
     ["smooth_quartz", 200],
     ["smooth_quartz_slab", 200],
     ["smooth_quartz_double_slab", 200],
     ["quartz_block", 201],
     ["quartz_slab", 201],
     ["quartz_double_slab", 201],
     ["sandstone_slab", 202],
     ["sandstone_double_slab", 202],
     ["red_sandstone_slab", 203],
     ["red_sandstone_double_slab", 203],
     ["smooth_stone_slab", 204],
     ["smooth_stone_double_slab", 204],
     ["smooth_sandstone_slab", 205],
     ["smooth_sandstone_double_slab", 205],
     ["smooth_red_sandstone_slab", 206],
     ["smooth_red_sandstone_double_slab", 206],
     ["smooth_stone", 207],
     ["quartz_bricks", 208],
     ["chiseled_quartz_block", 209],
     ["tinted_glass", 210],
     ["moss_block", 211],
     ["pale_moss_block", 212],
     ["nether_wart_block", 213],
     ["warped_wart_block", 214],
     ["shroomlight", 215],
     ["sea_lantern", 216],
     ["oak_log", 217],
     ["spruce_log", 218],
     ["birch_log", 219],
     ["jungle_log", 220],
     ["acacia_log", 221],
     ["dark_oak_log", 222],
     ["mangrove_log", 223],
     ["cherry_log", 224],
     ["crimson_stem", 225],
     ["warped_stem", 226],
     ["pale_oak_log", 227],
     ["stripped_oak_log", 228],
     ["stripped_spruce_log", 229],
     ["stripped_birch_log", 230],
     ["stripped_jungle_log", 231],
     ["stripped_acacia_log", 232],
     ["stripped_dark_oak_log", 233],
     ["stripped_mangrove_log", 234],
     ["stripped_cherry_log", 235],
     ["stripped_crimson_stem", 236],
     ["stripped_warped_stem", 237],
     ["stripped_pale_oak_log", 238],
     ["oak_wood", 239],
     ["spruce_wood", 240],
     ["birch_wood", 241],
     ["jungle_wood", 242],
     ["acacia_wood", 243],
     ["dark_oak_wood", 244],
     ["mangrove_wood", 245],
     ["cherry_wood", 246],
     ["crimson_hyphae", 247],
     ["warped_hyphae", 248],
     ["bamboo_block", 249],
     ["pale_oak_wood", 250],
     ["stripped_oak_wood", 251],
     ["stripped_spruce_wood", 252],
     ["stripped_birch_wood", 253],
     ["stripped_jungle_wood", 254],
     ["stripped_acacia_wood", 255],
     ["stripped_dark_oak_wood", 256],
     ["stripped_mangrove_wood", 257],
     ["stripped_cherry_wood", 258],
     ["stripped_crimson_hyphae", 259],
     ["stripped_warped_hyphae", 260],
     ["stripped_bamboo_block", 261],
     ["stripped_pale_oak_wood", 262],
     ["quartz_pillar", 263],
     ["hay_block", 264],
     ["pearlescent_froglight", 265],
     ["verdant_froglight", 266],
     ["ochre_froglight", 267],
     ["crafting_table", 268],
     ["cartography_table", 269],
     ["fletching_table", 270],
     ["smithing_table", 271],
     ["furnace", 272],
     ["lit_furnace", 273],
     ["blast_furnace", 274],
     ["lit_blast_furnace", 275],
     ["smoker", 276],
     ["lit_smoker", 277],
     ["bookshelf", 278],
     ["barrel", 279],
     ["noteblock", 280],
     ["jukebox", 281],
     ["redstone_lamp", 282],
     ["lit_redstone_lamp", 283],
     ["loom", 284],
     ["trapdoor", 285],
     ["spruce_trapdoor", 286],
     ["birch_trapdoor", 287],
     ["jungle_trapdoor", 288],
     ["acacia_trapdoor", 289],
     ["dark_oak_trapdoor", 290],
     ["mangrove_trapdoor", 291],
     ["cherry_trapdoor", 292],
     ["bamboo_trapdoor", 293],
     ["crimson_trapdoor", 294],
     ["warped_trapdoor", 295],
     ["pale_oak_trapdoor", 296],
     ["wooden_door", 297],
     ["spruce_door", 298],
     ["birch_door", 299],
     ["jungle_door", 300],
     ["acacia_door", 301],
     ["dark_oak_door", 302],
     ["mangrove_door", 303],
     ["cherry_door", 304],
     ["bamboo_door", 305],
     ["crimson_door", 306],
     ["warped_door", 307],
     ["pale_oak_door", 308],
     ["lantern", 309],
     ["soul_lantern", 310],
     ["torch", 311],
     ["soul_torch", 312],
     ["end_rod", 313],
     ["chain", 314],
     ["iron_chain", 314],
     ["composter", 315],
     ["anvil", 316],
     ["chipped_anvil", 317],
     ["damaged_anvil", 318],
     ["stonecutter_block", 319],
     ["grindstone", 320],
     ["enchanting_table", 321],
     ["brewing_stand", 322],
     ["lectern", 323],
     ["_lectern", 324],
     ["cauldron", 325],
     ["_cauldron", 326],
     ["chest", 327],
     ["trapped_chest", 328],
     ["ender_chest", 329],
     ["bed", 330],
     ["candle", 331],
     ["white_candle", 332],
     ["light_gray_candle", 333],
     ["gray_candle", 334],
     ["black_candle", 335],
     ["brown_candle", 336],
     ["red_candle", 337],
     ["orange_candle", 338],
     ["yellow_candle", 339],
     ["lime_candle", 340],
     ["green_candle", 341],
     ["cyan_candle", 342],
     ["light_blue_candle", 343],
     ["blue_candle", 344],
     ["purple_candle", 345],
     ["magenta_candle", 346],
     ["pink_candle", 347],
     ["iron_door", 348],
     ["iron_trapdoor", 349],
     ["redstone_torch", 350],
     ["unlit_redstone_torch", 351],
     ["copper_torch", 352],
     ["copper_lantern", 353],
     ["exposed_copper_lantern", 354],
     ["weathered_copper_lantern", 355],
     ["oxidized_copper_lantern", 356],
     ["waxed_copper_lantern", 353],
     ["waxed_exposed_copper_lantern", 354],
     ["waxed_weathered_copper_lantern", 355],
     ["waxed_oxidized_copper_lantern", 356],
     ["copper_door", 357],
     ["exposed_copper_door", 358],
     ["weathered_copper_door", 359],
     ["oxidized_copper_door", 360],
     ["waxed_copper_door", 357],
     ["waxed_exposed_copper_door", 358],
     ["waxed_weathered_copper_door", 359],
     ["waxed_oxidized_copper_door", 360],
     ["copper_trapdoor", 361],
     ["exposed_copper_trapdoor", 362],
     ["weathered_copper_trapdoor", 363],
     ["oxidized_copper_trapdoor", 364],
     ["waxed_copper_trapdoor", 361],
     ["waxed_exposed_copper_trapdoor", 362],
     ["waxed_weathered_copper_trapdoor", 363],
     ["waxed_oxidized_copper_trapdoor", 364],
     ["copper_bars", 365],
     ["exposed_copper_bars", 366],
     ["weathered_copper_bars", 367],
     ["oxidized_copper_bars", 368],
     ["waxed_copper_bars", 365],
     ["waxed_exposed_copper_bars", 366],
     ["waxed_weathered_copper_bars", 367],
     ["waxed_oxidized_copper_bars", 368],
     ["copper_grate", 369],
     ["exposed_copper_grate", 370],
     ["weathered_copper_grate", 371],
     ["oxidized_copper_grate", 372],
     ["waxed_copper_grate", 369],
     ["waxed_exposed_copper_grate", 370],
     ["waxed_weathered_copper_grate", 371],
     ["waxed_oxidized_copper_grate", 372],
     ["copper_chain", 373],
     ["exposed_copper_chain", 374],
     ["weathered_copper_chain", 375],
     ["oxidized_copper_chain", 376],
     ["waxed_copper_chain", 373],
     ["waxed_exposed_copper_chain", 374],
     ["waxed_weathered_copper_chain", 375],
     ["waxed_oxidized_copper_chain", 376],
     ["slime_block", 377],
     ["slime", 377],
     ["honey_block", 378],
     ["honeycomb_block", 379],
     ["target", 380],
     ["tnt", 381],
     ["dragon_egg", 382],
     ["carved_pumpkin", 383],
     ["lit_pumpkin", 384],
     ["white_glazed_terracotta", 385],
     ["orange_glazed_terracotta", 386],
     ["magenta_glazed_terracotta", 387],
     ["light_blue_glazed_terracotta", 388],
     ["yellow_glazed_terracotta", 389],
     ["lime_glazed_terracotta", 390],
     ["pink_glazed_terracotta", 391],
     ["gray_glazed_terracotta", 392],
     ["light_gray_glazed_terracotta", 393],
     ["silver_glazed_terracotta", 393],
     ["cyan_glazed_terracotta", 394],
     ["purple_glazed_terracotta", 395],
     ["blue_glazed_terracotta", 396],
     ["brown_glazed_terracotta", 397],
     ["green_glazed_terracotta", 398],
     ["red_glazed_terracotta", 399],
     ["black_glazed_terracotta", 400],
     ["undyed_shulker_box", 401],
     ["white_shulker_box", 402],
     ["light_gray_shulker_box", 403],
     ["gray_shulker_box", 404],
     ["black_shulker_box", 405],
     ["brown_shulker_box", 406],
     ["red_shulker_box", 407],
     ["orange_shulker_box", 408],
     ["yellow_shulker_box", 409],
     ["lime_shulker_box", 410],
     ["green_shulker_box", 411],
     ["cyan_shulker_box", 412],
     ["light_blue_shulker_box", 413],
     ["blue_shulker_box", 414],
     ["purple_shulker_box", 415],
     ["magenta_shulker_box", 416],
     ["pink_shulker_box", 417],
     ["white_carpet", 178],
     ["orange_carpet", 179],
     ["magenta_carpet", 180],
     ["light_blue_carpet", 181],
     ["yellow_carpet", 182],
     ["lime_carpet", 183],
     ["pink_carpet", 184],
     ["gray_carpet", 185],
     ["light_gray_carpet", 186],
     ["cyan_carpet", 187],
     ["purple_carpet", 188],
     ["blue_carpet", 189],
     ["brown_carpet", 190],
     ["green_carpet", 191],
     ["red_carpet", 192],
     ["black_carpet", 193],
     ["moss_carpet", 420],
     ["pale_moss_carpet", 421],
     ["oak_pressure_plate", 4],
     ["spruce_pressure_plate", 5],
     ["birch_pressure_plate", 6],
     ["jungle_pressure_plate", 7],
     ["acacia_pressure_plate", 8],
     ["dark_oak_pressure_plate", 9],
     ["mangrove_pressure_plate", 12],
     ["cherry_pressure_plate", 13],
     ["pale_oak_pressure_plate", 14],
     ["bamboo_pressure_plate", 15],
     ["crimson_pressure_plate", 16],
     ["warped_pressure_plate", 17],
     ["stone_pressure_plate", 2],
     ["polished_blackstone_pressure_plate", 100],
     ["light_weighted_pressure_plate", 69],
     ["heavy_weighted_pressure_plate", 70],
     ["bone_block", 422],
     ["pumpkin", 423],
     ["chiseled_bookshelf", 424],
     ["dispenser", 425],
     ["dropper", 426],
     ["beacon", 427],
     ["hopper", 428],
     ["piston", 429],
     ["sticky_piston", 430],
     ["observer", 431],
     ["daylight_detector", 432],
     ["daylight_detector_inverted", 433],
     ["command_block", 434],
     ["repeating_command_block", 435],
     ["chain_command_block", 436],
     ["dried_kelp_block", 437],
     ["standing_sign", 438],
     ["oak_standing_sign", 438],
     ["wall_sign", 438],
     ["oak_wall_sign", 438],
     ["oak_sign", 438],
     ["spruce_standing_sign", 439],
     ["spruce_wall_sign", 439],
     ["spruce_sign", 439],
     ["birch_standing_sign", 440],
     ["birch_wall_sign", 440],
     ["birch_sign", 440],
     ["jungle_standing_sign", 441],
     ["jungle_wall_sign", 441],
     ["jungle_sign", 441],
     ["acacia_standing_sign", 442],
     ["acacia_wall_sign", 442],
     ["acacia_sign", 442],
     ["darkoak_standing_sign", 443],
     ["darkoak_wall_sign", 443],
     ["dark_oak_standing_sign", 443],
     ["dark_oak_wall_sign", 443],
     ["dark_oak_sign", 443],
     ["mangrove_standing_sign", 444],
     ["mangrove_wall_sign", 444],
     ["mangrove_sign", 444],
     ["cherry_standing_sign", 445],
     ["cherry_wall_sign", 445],
     ["cherry_sign", 445],
     ["bamboo_standing_sign", 446],
     ["bamboo_wall_sign", 446],
     ["bamboo_sign", 446],
     ["crimson_standing_sign", 447],
     ["crimson_wall_sign", 447],
     ["crimson_sign", 447],
     ["warped_standing_sign", 448],
     ["warped_wall_sign", 448],
     ["warped_sign", 448],
     ["pale_oak_standing_sign", 449],
     ["pale_oak_wall_sign", 449],
     ["pale_oak_sign", 449],
     ["oak_hanging_sign", 450],
     ["spruce_hanging_sign", 451],
     ["birch_hanging_sign", 452],
     ["jungle_hanging_sign", 453],
     ["acacia_hanging_sign", 454],
     ["dark_oak_hanging_sign", 455],
     ["mangrove_hanging_sign", 456],
     ["cherry_hanging_sign", 457],
     ["bamboo_hanging_sign", 458],
     ["crimson_hanging_sign", 459],
     ["warped_hanging_sign", 460],
     ["pale_oak_hanging_sign", 461],
     ["skull", 462],
     ["skeleton_skull", 462],
     ["skeleton_wall_skull", 462],
     ["wither_skeleton_skull", 463],
     ["wither_skeleton_wall_skull", 463],
     ["zombie_head", 464],
     ["zombie_wall_head", 464],
     ["creeper_head", 465],
     ["creeper_wall_head", 465],
     ["player_head", 466],
     ["player_wall_head", 466],
     ["piglin_head", 467],
     ["piglin_wall_head", 467],
     ["dragon_head", 468],
     ["dragon_wall_head", 468],
     ["cobblestone_wall", 44],
     ["mossy_cobblestone_wall", 45],
     ["granite_wall", 49],
     ["diorite_wall", 46],
     ["andesite_wall", 39],
     ["stone_brick_wall", 104],
     ["mossy_stone_brick_wall", 105],
     ["blackstone_wall", 98],
     ["polished_blackstone_brick_wall", 101],
     ["polished_blackstone_wall", 100],
     ["mud_brick_wall", 115],
     ["polished_tuff_wall", 94],
     ["tuff_brick_wall", 95],
     ["tuff_wall", 93],
     ["resin_brick_wall", 117],
     ["cobbled_deepslate_wall", 78],
     ["polished_deepslate_wall", 79],
     ["deepslate_tile_wall", 82],
     ["deepslate_brick_wall", 80],
     ["oak_fence", 4],
     ["spruce_fence", 5],
     ["birch_fence", 6],
     ["jungle_fence", 7],
     ["acacia_fence", 8],
     ["dark_oak_fence", 9],
     ["mangrove_fence", 12],
     ["cherry_fence", 13],
     ["bamboo_fence", 15],
     ["crimson_fence", 16],
     ["warped_fence", 17],
     ["pale_oak_fence", 14],
     ["nether_brick_fence", 109],
     ["oak_stairs", 4],
     ["spruce_stairs", 5],
     ["birch_stairs", 6],
     ["jungle_stairs", 7],
     ["acacia_stairs", 8],
     ["dark_oak_stairs", 9],
     ["mangrove_stairs", 12],
     ["cherry_stairs", 13],
     ["bamboo_stairs", 15],
     ["bamboo_mosaic_stairs", 129],
     ["crimson_stairs", 16],
     ["warped_stairs", 17],
     ["pale_oak_stairs", 14],
     ["normal_stone_stairs", 2],
     ["stone_stairs", 44],
     ["mossy_cobblestone_stairs", 45],
     ["granite_stairs", 49],
     ["diorite_stairs", 46],
     ["andesite_stairs", 39],
     ["stone_brick_stairs", 104],
     ["mossy_stone_brick_stairs", 105],
     ["polished_granite_stairs", 50],
     ["polished_diorite_stairs", 47],
     ["polished_andesite_stairs", 40],
     ["brick_stairs", 108],
     ["nether_brick_stairs", 109],
     ["red_nether_brick_stairs", 110],
     ["blackstone_stairs", 98],
     ["polished_blackstone_stairs", 100],
     ["polished_blackstone_brick_stairs", 101],
     ["cobbled_deepslate_stairs", 78],
     ["polished_deepslate_stairs", 79],
     ["deepslate_brick_stairs", 80],
     ["deepslate_tile_stairs", 82],
     ["mud_brick_stairs", 115],
     ["end_brick_stairs", 120],
     ["prismarine_stairs", 122],
     ["prismarine_bricks_stairs", 123],
     ["dark_prismarine_stairs", 124],
     ["quartz_stairs", 201],
     ["smooth_quartz_stairs", 200],
     ["sandstone_stairs", 202],
     ["red_sandstone_stairs", 203],
     ["smooth_sandstone_stairs", 205],
     ["smooth_red_sandstone_stairs", 206],
     ["tuff_stairs", 93],
     ["polished_tuff_stairs", 94],
     ["tuff_brick_stairs", 95],
     ["resin_brick_stairs", 117],
     ["cut_copper_stairs", 194],
     ["waxed_cut_copper_stairs", 194],
     ["exposed_cut_copper_stairs", 195],
     ["waxed_exposed_cut_copper_stairs", 195],
     ["weathered_cut_copper_stairs", 196],
     ["waxed_weathered_cut_copper_stairs", 196],
     ["oxidized_cut_copper_stairs", 197],
     ["waxed_oxidized_cut_copper_stairs", 197],
];

const FULL_BLOCK_TYPES = new Set([
     "oak_planks",
     "spruce_planks",
     "birch_planks",
     "jungle_planks",
     "acacia_planks",
     "dark_oak_planks",
     "mangrove_planks",
     "cherry_planks",
     "pale_oak_planks",
     "bamboo_planks",
     "crimson_planks",
     "warped_planks",
     "oak_double_slab",
     "spruce_double_slab",
     "birch_double_slab",
     "jungle_double_slab",
     "acacia_double_slab",
     "dark_oak_double_slab",
     "mangrove_double_slab",
     "cherry_double_slab",
     "pale_oak_double_slab",
     "bamboo_double_slab",
     "crimson_double_slab",
     "warped_double_slab",
     "amethyst_block",
     "andesite",
     "polished_andesite",
     "calcite",
     "clay",
     "coarse_dirt",
     "cobblestone",
     "mossy_cobblestone",
     "diorite",
     "polished_diorite",
     "dripstone_block",
     "granite",
     "polished_granite",
     "gravel",
     "hardened_clay",
     "obsidian",
     "crying_obsidian",
     "netherrack",
     "quartz_ore",
     "nether_gold_ore",
     "coal_ore",
     "copper_ore",
     "diamond_ore",
     "emerald_ore",
     "gold_ore",
     "iron_ore",
     "lapis_ore",
     "redstone_ore",
     "coal_block",
     "diamond_block",
     "emerald_block",
     "gold_block",
     "iron_block",
     "lapis_block",
     "netherite_block",
     "redstone_block",
     "raw_iron_block",
     "raw_gold_block",
     "raw_copper_block",
     "copper_block",
     "exposed_copper",
     "weathered_copper",
     "oxidized_copper",
     "waxed_copper",
     "waxed_exposed_copper",
     "waxed_weathered_copper",
     "waxed_oxidized_copper",
     "chiseled_copper",
     "exposed_chiseled_copper",
     "weathered_chiseled_copper",
     "oxidized_chiseled_copper",
     "waxed_chiseled_copper",
     "waxed_exposed_chiseled_copper",
     "waxed_weathered_chiseled_copper",
     "waxed_oxidized_chiseled_copper",
     "deepslate",
     "cobbled_deepslate",
     "polished_deepslate",
     "deepslate_bricks",
     "cracked_deepslate_bricks",
     "deepslate_tiles",
     "cracked_deepslate_tiles",
     "chiseled_deepslate",
     "deepslate_coal_ore",
     "deepslate_copper_ore",
     "deepslate_diamond_ore",
     "deepslate_emerald_ore",
     "deepslate_gold_ore",
     "deepslate_iron_ore",
     "deepslate_lapis_ore",
     "deepslate_redstone_ore",
     "tuff",
     "polished_tuff",
     "tuff_bricks",
     "chiseled_tuff",
     "chiseled_tuff_bricks",
     "blackstone",
     "gilded_blackstone",
     "polished_blackstone",
     "polished_blackstone_bricks",
     "cracked_polished_blackstone_bricks",
     "chiseled_polished_blackstone",
     "stonebrick",
     "stone_bricks",
     "mossy_stone_bricks",
     "cracked_stone_bricks",
     "chiseled_stone_bricks",
     "smooth_stone",
     "brick_block",
     "nether_brick",
     "red_nether_brick",
     "cracked_nether_bricks",
     "chiseled_nether_bricks",
     "mud",
     "packed_mud",
     "mud_bricks",
     "resin_block",
     "resin_bricks",
     "chiseled_resin_bricks",
     "end_stone",
     "end_bricks",
     "purpur_block",
     "prismarine",
     "prismarine_bricks",
     "dark_prismarine",
     "sponge",
     "wet_sponge",
     "glowstone",
     "magma",
     "quartz_bricks",
     "smooth_quartz",
     "tinted_glass",
     "moss_block",
     "pale_moss_block",
     "nether_wart_block",
     "warped_wart_block",
     "shroomlight",
     "sea_lantern",
     "slime_block",
     "slime",
     "honey_block",
     "honeycomb_block",
     "dried_kelp_block",
     "target",
     "tnt",
     "pumpkin",
     "carved_pumpkin",
     "lit_pumpkin",
     "white_glazed_terracotta",
     "orange_glazed_terracotta",
     "magenta_glazed_terracotta",
     "light_blue_glazed_terracotta",
     "yellow_glazed_terracotta",
     "lime_glazed_terracotta",
     "pink_glazed_terracotta",
     "gray_glazed_terracotta",
     "light_gray_glazed_terracotta",
     "silver_glazed_terracotta",
     "cyan_glazed_terracotta",
     "purple_glazed_terracotta",
     "blue_glazed_terracotta",
     "brown_glazed_terracotta",
     "green_glazed_terracotta",
     "red_glazed_terracotta",
     "black_glazed_terracotta",
     "oak_log",
     "spruce_log",
     "birch_log",
     "jungle_log",
     "acacia_log",
     "dark_oak_log",
     "mangrove_log",
     "cherry_log",
     "crimson_stem",
     "warped_stem",
     "pale_oak_log",
     "stripped_oak_log",
     "stripped_spruce_log",
     "stripped_birch_log",
     "stripped_jungle_log",
     "stripped_acacia_log",
     "stripped_dark_oak_log",
     "stripped_mangrove_log",
     "stripped_cherry_log",
     "stripped_crimson_stem",
     "stripped_warped_stem",
     "stripped_pale_oak_log",
     "oak_wood",
     "spruce_wood",
     "birch_wood",
     "jungle_wood",
     "acacia_wood",
     "dark_oak_wood",
     "mangrove_wood",
     "cherry_wood",
     "crimson_hyphae",
     "warped_hyphae",
     "bamboo_block",
     "pale_oak_wood",
     "stripped_oak_wood",
     "stripped_spruce_wood",
     "stripped_birch_wood",
     "stripped_jungle_wood",
     "stripped_acacia_wood",
     "stripped_dark_oak_wood",
     "stripped_mangrove_wood",
     "stripped_cherry_wood",
     "stripped_crimson_hyphae",
     "stripped_warped_hyphae",
     "stripped_bamboo_block",
     "stripped_pale_oak_wood",
     "quartz_pillar",
     "hay_block",
     "pearlescent_froglight",
     "verdant_froglight",
     "ochre_froglight",
     "crafting_table",
     "cartography_table",
     "fletching_table",
     "smithing_table",
     "furnace",
     "lit_furnace",
     "blast_furnace",
     "lit_blast_furnace",
     "smoker",
     "lit_smoker",
     "bookshelf",
     "chiseled_bookshelf",
     "barrel",
     "dispenser",
     "dropper",
     "observer",
     "noteblock",
     "jukebox",
     "redstone_lamp",
     "lit_redstone_lamp",
     "loom",
     "composter",
     "command_block",
     "repeating_command_block",
     "chain_command_block",
     "piston",
     "sticky_piston",
     "bamboo_mosaic",
     "white_concrete",
     "orange_concrete",
     "magenta_concrete",
     "light_blue_concrete",
     "yellow_concrete",
     "lime_concrete",
     "pink_concrete",
     "gray_concrete",
     "light_gray_concrete",
     "cyan_concrete",
     "purple_concrete",
     "blue_concrete",
     "brown_concrete",
     "green_concrete",
     "red_concrete",
     "black_concrete",
     "white_concrete_powder",
     "orange_concrete_powder",
     "magenta_concrete_powder",
     "light_blue_concrete_powder",
     "yellow_concrete_powder",
     "lime_concrete_powder",
     "pink_concrete_powder",
     "gray_concrete_powder",
     "light_gray_concrete_powder",
     "cyan_concrete_powder",
     "purple_concrete_powder",
     "blue_concrete_powder",
     "brown_concrete_powder",
     "green_concrete_powder",
     "red_concrete_powder",
     "black_concrete_powder",
     "white_terracotta",
     "orange_terracotta",
     "magenta_terracotta",
     "light_blue_terracotta",
     "yellow_terracotta",
     "lime_terracotta",
     "pink_terracotta",
     "gray_terracotta",
     "light_gray_terracotta",
     "cyan_terracotta",
     "purple_terracotta",
     "blue_terracotta",
     "brown_terracotta",
     "green_terracotta",
     "red_terracotta",
     "black_terracotta",
     "white_wool",
     "orange_wool",
     "magenta_wool",
     "light_blue_wool",
     "yellow_wool",
     "lime_wool",
     "pink_wool",
     "gray_wool",
     "light_gray_wool",
     "cyan_wool",
     "purple_wool",
     "blue_wool",
     "brown_wool",
     "green_wool",
     "red_wool",
     "black_wool",
     "copper_grate",
     "exposed_copper_grate",
     "weathered_copper_grate",
     "oxidized_copper_grate",
     "waxed_copper_grate",
     "waxed_exposed_copper_grate",
     "waxed_weathered_copper_grate",
     "waxed_oxidized_copper_grate",
     "andesite_double_slab",
     "polished_andesite_double_slab",
     "bamboo_mosaic_double_slab",
     "blackstone_double_slab",
     "brick_double_slab",
     "cobbled_deepslate_double_slab",
     "cobblestone_double_slab",
     "dark_prismarine_double_slab",
     "deepslate_brick_double_slab",
     "deepslate_tile_double_slab",
     "diorite_double_slab",
     "end_stone_brick_double_slab",
     "granite_double_slab",
     "mossy_cobblestone_double_slab",
     "mossy_stone_brick_double_slab",
     "mud_brick_double_slab",
     "nether_brick_double_slab",
     "normal_stone_double_slab",
     "polished_blackstone_brick_double_slab",
     "polished_blackstone_double_slab",
     "polished_deepslate_double_slab",
     "polished_diorite_double_slab",
     "polished_granite_double_slab",
     "polished_tuff_double_slab",
     "prismarine_brick_double_slab",
     "prismarine_double_slab",
     "purpur_double_slab",
     "red_nether_brick_double_slab",
     "resin_brick_double_slab",
     "stone_brick_double_slab",
     "tuff_brick_double_slab",
     "tuff_double_slab",
     "double_cut_copper_slab",
     "waxed_double_cut_copper_slab",
     "exposed_double_cut_copper_slab",
     "waxed_exposed_double_cut_copper_slab",
     "weathered_double_cut_copper_slab",
     "waxed_weathered_double_cut_copper_slab",
     "oxidized_double_cut_copper_slab",
     "waxed_oxidized_double_cut_copper_slab",
     "cut_copper",
     "waxed_cut_copper",
     "exposed_cut_copper",
     "waxed_exposed_cut_copper",
     "weathered_cut_copper",
     "waxed_weathered_cut_copper",
     "oxidized_cut_copper",
     "waxed_oxidized_cut_copper",
     "cut_red_sandstone_double_slab",
     "cut_sandstone_double_slab",
     "smooth_quartz_double_slab",
     "quartz_double_slab",
     "sandstone_double_slab",
     "red_sandstone_double_slab",
     "smooth_stone_double_slab",
     "smooth_sandstone_double_slab",
     "smooth_red_sandstone_double_slab",
]);

const SLAB_TYPES = new Set([
     "oak_slab",
     "spruce_slab",
     "birch_slab",
     "jungle_slab",
     "acacia_slab",
     "dark_oak_slab",
     "mangrove_slab",
     "cherry_slab",
     "pale_oak_slab",
     "bamboo_slab",
     "crimson_slab",
     "warped_slab",
     "andesite_slab",
     "polished_andesite_slab",
     "bamboo_mosaic_slab",
     "blackstone_slab",
     "brick_slab",
     "cobbled_deepslate_slab",
     "cobblestone_slab",
     "dark_prismarine_slab",
     "deepslate_brick_slab",
     "deepslate_tile_slab",
     "diorite_slab",
     "end_stone_brick_slab",
     "granite_slab",
     "mossy_cobblestone_slab",
     "mossy_stone_brick_slab",
     "mud_brick_slab",
     "nether_brick_slab",
     "normal_stone_slab",
     "polished_blackstone_brick_slab",
     "polished_blackstone_slab",
     "polished_deepslate_slab",
     "polished_diorite_slab",
     "polished_granite_slab",
     "polished_tuff_slab",
     "prismarine_brick_slab",
     "prismarine_slab",
     "purpur_slab",
     "red_nether_brick_slab",
     "resin_brick_slab",
     "stone_brick_slab",
     "tuff_brick_slab",
     "tuff_slab",
     "cut_copper_slab",
     "waxed_cut_copper_slab",
     "exposed_cut_copper_slab",
     "waxed_exposed_cut_copper_slab",
     "weathered_cut_copper_slab",
     "waxed_weathered_cut_copper_slab",
     "oxidized_cut_copper_slab",
     "waxed_oxidized_cut_copper_slab",
     "cut_red_sandstone_slab",
     "cut_sandstone_slab",
     "smooth_quartz_slab",
     "quartz_slab",
     "sandstone_slab",
     "red_sandstone_slab",
     "smooth_stone_slab",
     "smooth_sandstone_slab",
     "smooth_red_sandstone_slab",
]);

// 这些方块的顶面、底面和侧面贴图不同，需要单独的 UV 模型。
const MULTI_FACE_FULL_BLOCK_TYPES = new Set([
     "quartz_block",
     "chiseled_quartz_block",
     "quartz_double_slab",
     "sandstone_double_slab",
     "red_sandstone_double_slab",
     "smooth_stone_double_slab",
     "piston",
     "sticky_piston",
     "observer",
     "command_block",
     "repeating_command_block",
     "chain_command_block",
]);

const MULTI_FACE_SLAB_TYPES = new Set([
     "quartz_slab",
     "sandstone_slab",
     "red_sandstone_slab",
     "smooth_stone_slab",
]);

const CAMPFIRE_TYPES = new Set(["campfire", "soul_campfire"]);
const BELL_TYPES = new Set(["bell"]);
const LADDER_TYPES = new Set(["ladder"]);
const FENCE_GATE_TYPES = new Set([
     "fence_gate",
     "spruce_fence_gate",
     "birch_fence_gate",
     "jungle_fence_gate",
     "acacia_fence_gate",
     "dark_oak_fence_gate",
     "mangrove_fence_gate",
     "cherry_fence_gate",
     "bamboo_fence_gate",
     "crimson_fence_gate",
     "warped_fence_gate",
     "pale_oak_fence_gate",
]);
const TRAPDOOR_TYPES = new Set([
     "trapdoor",
     "spruce_trapdoor",
     "birch_trapdoor",
     "jungle_trapdoor",
     "acacia_trapdoor",
     "dark_oak_trapdoor",
     "mangrove_trapdoor",
     "cherry_trapdoor",
     "bamboo_trapdoor",
     "crimson_trapdoor",
     "warped_trapdoor",
     "pale_oak_trapdoor",
     "iron_trapdoor",
     "copper_trapdoor",
     "exposed_copper_trapdoor",
     "weathered_copper_trapdoor",
     "oxidized_copper_trapdoor",
     "waxed_copper_trapdoor",
     "waxed_exposed_copper_trapdoor",
     "waxed_weathered_copper_trapdoor",
     "waxed_oxidized_copper_trapdoor",
]);
const DOOR_TYPES = new Set([
     "wooden_door",
     "spruce_door",
     "birch_door",
     "jungle_door",
     "acacia_door",
     "dark_oak_door",
     "mangrove_door",
     "cherry_door",
     "bamboo_door",
     "crimson_door",
     "warped_door",
     "pale_oak_door",
     "iron_door",
     "copper_door",
     "exposed_copper_door",
     "weathered_copper_door",
     "oxidized_copper_door",
     "waxed_copper_door",
     "waxed_exposed_copper_door",
     "waxed_weathered_copper_door",
     "waxed_oxidized_copper_door",
]);
const LANTERN_TYPES = new Set([
     "lantern",
     "soul_lantern",
     "copper_lantern",
     "exposed_copper_lantern",
     "weathered_copper_lantern",
     "oxidized_copper_lantern",
     "waxed_copper_lantern",
     "waxed_exposed_copper_lantern",
     "waxed_weathered_copper_lantern",
     "waxed_oxidized_copper_lantern",
]);
const TORCH_TYPES = new Set([
     "torch",
     "soul_torch",
     "redstone_torch",
     "unlit_redstone_torch",
     "copper_torch",
]);
const REDSTONE_TORCH_TYPES = new Set(["redstone_torch", "unlit_redstone_torch"]);
const END_ROD_TYPES = new Set(["end_rod"]);
const CHAIN_TYPES = new Set([
     "chain",
     "iron_chain",
     "copper_chain",
     "exposed_copper_chain",
     "weathered_copper_chain",
     "oxidized_copper_chain",
     "waxed_copper_chain",
     "waxed_exposed_copper_chain",
     "waxed_weathered_copper_chain",
     "waxed_oxidized_copper_chain",
]);
const ANVIL_TYPES = new Set(["anvil", "chipped_anvil", "damaged_anvil"]);
const STONECUTTER_TYPES = new Set(["stonecutter_block"]);
const GRINDSTONE_TYPES = new Set(["grindstone"]);
const ENCHANTING_TABLE_TYPES = new Set(["enchanting_table"]);
const BREWING_STAND_TYPES = new Set(["brewing_stand"]);
const LECTERN_TYPES = new Set(["lectern", "_lectern"]);
const CAULDRON_TYPES = new Set(["cauldron", "_cauldron"]);
const CHEST_TYPES = new Set(["chest", "trapped_chest", "ender_chest"]);
const SHULKER_BOX_TYPES = new Set([
     "undyed_shulker_box",
     "white_shulker_box",
     "light_gray_shulker_box",
     "gray_shulker_box",
     "black_shulker_box",
     "brown_shulker_box",
     "red_shulker_box",
     "orange_shulker_box",
     "yellow_shulker_box",
     "lime_shulker_box",
     "green_shulker_box",
     "cyan_shulker_box",
     "light_blue_shulker_box",
     "blue_shulker_box",
     "purple_shulker_box",
     "magenta_shulker_box",
     "pink_shulker_box",
]);
const BED_TYPES = new Set(["bed"]);
const CANDLE_TYPES = new Set([
     "candle",
     "white_candle",
     "light_gray_candle",
     "gray_candle",
     "black_candle",
     "brown_candle",
     "red_candle",
     "orange_candle",
     "yellow_candle",
     "lime_candle",
     "green_candle",
     "cyan_candle",
     "light_blue_candle",
     "blue_candle",
     "purple_candle",
     "magenta_candle",
     "pink_candle",
]);
const CARPET_TYPES = new Set([
     "white_carpet",
     "orange_carpet",
     "magenta_carpet",
     "light_blue_carpet",
     "yellow_carpet",
     "lime_carpet",
     "pink_carpet",
     "gray_carpet",
     "light_gray_carpet",
     "cyan_carpet",
     "purple_carpet",
     "blue_carpet",
     "brown_carpet",
     "green_carpet",
     "red_carpet",
     "black_carpet",
     "moss_carpet",
     "pale_moss_carpet",
]);
const PRESSURE_PLATE_TYPES = new Set([
     "oak_pressure_plate",
     "spruce_pressure_plate",
     "birch_pressure_plate",
     "jungle_pressure_plate",
     "acacia_pressure_plate",
     "dark_oak_pressure_plate",
     "mangrove_pressure_plate",
     "cherry_pressure_plate",
     "pale_oak_pressure_plate",
     "bamboo_pressure_plate",
     "crimson_pressure_plate",
     "warped_pressure_plate",
     "stone_pressure_plate",
     "polished_blackstone_pressure_plate",
     "light_weighted_pressure_plate",
     "heavy_weighted_pressure_plate",
]);
const DAYLIGHT_DETECTOR_TYPES = new Set([
     "daylight_detector",
     "daylight_detector_inverted",
]);
const HOPPER_TYPES = new Set(["hopper"]);
const SIGN_TYPES = new Set([
     "standing_sign",
     "oak_standing_sign",
     "wall_sign",
     "oak_wall_sign",
     "oak_sign",
     "spruce_standing_sign",
     "spruce_wall_sign",
     "spruce_sign",
     "birch_standing_sign",
     "birch_wall_sign",
     "birch_sign",
     "jungle_standing_sign",
     "jungle_wall_sign",
     "jungle_sign",
     "acacia_standing_sign",
     "acacia_wall_sign",
     "acacia_sign",
     "darkoak_standing_sign",
     "darkoak_wall_sign",
     "dark_oak_standing_sign",
     "dark_oak_wall_sign",
     "dark_oak_sign",
     "mangrove_standing_sign",
     "mangrove_wall_sign",
     "mangrove_sign",
     "cherry_standing_sign",
     "cherry_wall_sign",
     "cherry_sign",
     "bamboo_standing_sign",
     "bamboo_wall_sign",
     "bamboo_sign",
     "crimson_standing_sign",
     "crimson_wall_sign",
     "crimson_sign",
     "warped_standing_sign",
     "warped_wall_sign",
     "warped_sign",
     "pale_oak_standing_sign",
     "pale_oak_wall_sign",
     "pale_oak_sign",
]);
const HANGING_SIGN_TYPES = new Set([
     "oak_hanging_sign",
     "spruce_hanging_sign",
     "birch_hanging_sign",
     "jungle_hanging_sign",
     "acacia_hanging_sign",
     "dark_oak_hanging_sign",
     "mangrove_hanging_sign",
     "cherry_hanging_sign",
     "bamboo_hanging_sign",
     "crimson_hanging_sign",
     "warped_hanging_sign",
     "pale_oak_hanging_sign",
]);
const HEAD_TYPES = new Set([
     "skull",
     "skeleton_skull",
     "skeleton_wall_skull",
     "wither_skeleton_skull",
     "wither_skeleton_wall_skull",
     "zombie_head",
     "zombie_wall_head",
     "creeper_head",
     "creeper_wall_head",
     "player_head",
     "player_wall_head",
     "piglin_head",
     "piglin_wall_head",
     "dragon_head",
     "dragon_wall_head",
]);
const BAR_TYPES = new Set([
     "iron_bars",
     "copper_bars",
     "exposed_copper_bars",
     "weathered_copper_bars",
     "oxidized_copper_bars",
     "waxed_copper_bars",
     "waxed_exposed_copper_bars",
     "waxed_weathered_copper_bars",
     "waxed_oxidized_copper_bars",
]);
const GLASS_PANE_TYPES = new Set([
     "glass_pane",
     "white_stained_glass_pane",
     "light_gray_stained_glass_pane",
     "gray_stained_glass_pane",
     "black_stained_glass_pane",
     "brown_stained_glass_pane",
     "red_stained_glass_pane",
     "orange_stained_glass_pane",
     "yellow_stained_glass_pane",
     "lime_stained_glass_pane",
     "green_stained_glass_pane",
     "cyan_stained_glass_pane",
     "light_blue_stained_glass_pane",
     "blue_stained_glass_pane",
     "purple_stained_glass_pane",
     "magenta_stained_glass_pane",
     "pink_stained_glass_pane",
]);
const WALL_TYPES = new Set([
     "cobblestone_wall",
     "mossy_cobblestone_wall",
     "granite_wall",
     "diorite_wall",
     "andesite_wall",
     "stone_brick_wall",
     "mossy_stone_brick_wall",
     "blackstone_wall",
     "polished_blackstone_brick_wall",
     "polished_blackstone_wall",
     "mud_brick_wall",
     "polished_tuff_wall",
     "tuff_brick_wall",
     "tuff_wall",
     "resin_brick_wall",
     "cobbled_deepslate_wall",
     "polished_deepslate_wall",
     "deepslate_tile_wall",
     "deepslate_brick_wall",
]);
const FENCE_TYPES = new Set([
     "oak_fence",
     "spruce_fence",
     "birch_fence",
     "jungle_fence",
     "acacia_fence",
     "dark_oak_fence",
     "mangrove_fence",
     "cherry_fence",
     "bamboo_fence",
     "crimson_fence",
     "warped_fence",
     "pale_oak_fence",
     "nether_brick_fence",
]);
const STAIR_TYPES = new Set([
     "oak_stairs",
     "spruce_stairs",
     "birch_stairs",
     "jungle_stairs",
     "acacia_stairs",
     "dark_oak_stairs",
     "mangrove_stairs",
     "cherry_stairs",
     "bamboo_stairs",
     "bamboo_mosaic_stairs",
     "crimson_stairs",
     "warped_stairs",
     "pale_oak_stairs",
     "normal_stone_stairs",
     "stone_stairs",
     "mossy_cobblestone_stairs",
     "granite_stairs",
     "diorite_stairs",
     "andesite_stairs",
     "stone_brick_stairs",
     "mossy_stone_brick_stairs",
     "polished_granite_stairs",
     "polished_diorite_stairs",
     "polished_andesite_stairs",
     "brick_stairs",
     "nether_brick_stairs",
     "red_nether_brick_stairs",
     "blackstone_stairs",
     "polished_blackstone_stairs",
     "polished_blackstone_brick_stairs",
     "cobbled_deepslate_stairs",
     "polished_deepslate_stairs",
     "deepslate_brick_stairs",
     "deepslate_tile_stairs",
     "mud_brick_stairs",
     "end_brick_stairs",
     "prismarine_stairs",
     "prismarine_bricks_stairs",
     "dark_prismarine_stairs",
     "quartz_stairs",
     "smooth_quartz_stairs",
     "sandstone_stairs",
     "red_sandstone_stairs",
     "smooth_sandstone_stairs",
     "smooth_red_sandstone_stairs",
     "tuff_stairs",
     "polished_tuff_stairs",
     "tuff_brick_stairs",
     "resin_brick_stairs",
     "cut_copper_stairs",
     "waxed_cut_copper_stairs",
     "exposed_cut_copper_stairs",
     "waxed_exposed_cut_copper_stairs",
     "weathered_cut_copper_stairs",
     "waxed_weathered_cut_copper_stairs",
     "oxidized_cut_copper_stairs",
     "waxed_oxidized_cut_copper_stairs",
]);
const AXIS_ROTATION_TYPES = new Set([
     "oak_log",
     "spruce_log",
     "birch_log",
     "jungle_log",
     "acacia_log",
     "dark_oak_log",
     "mangrove_log",
     "cherry_log",
     "crimson_stem",
     "warped_stem",
     "pale_oak_log",
     "stripped_oak_log",
     "stripped_spruce_log",
     "stripped_birch_log",
     "stripped_jungle_log",
     "stripped_acacia_log",
     "stripped_dark_oak_log",
     "stripped_mangrove_log",
     "stripped_cherry_log",
     "stripped_crimson_stem",
     "stripped_warped_stem",
     "stripped_pale_oak_log",
     "oak_wood",
     "spruce_wood",
     "birch_wood",
     "jungle_wood",
     "acacia_wood",
     "dark_oak_wood",
     "mangrove_wood",
     "cherry_wood",
     "crimson_hyphae",
     "warped_hyphae",
     "bamboo_block",
     "pale_oak_wood",
     "stripped_oak_wood",
     "stripped_spruce_wood",
     "stripped_birch_wood",
     "stripped_jungle_wood",
     "stripped_acacia_wood",
     "stripped_dark_oak_wood",
     "stripped_mangrove_wood",
     "stripped_cherry_wood",
     "stripped_crimson_hyphae",
     "stripped_warped_hyphae",
     "stripped_bamboo_block",
     "stripped_pale_oak_wood",
     "quartz_pillar",
     "bone_block",
     "hay_block",
     "target",
     "pearlescent_froglight",
     "verdant_froglight",
     "ochre_froglight",
]);
const CARDINAL_ROTATION_TYPES = new Set([
     "furnace",
     "lit_furnace",
     "blast_furnace",
     "lit_blast_furnace",
     "smoker",
     "lit_smoker",
     "chiseled_bookshelf",
     "carved_pumpkin",
     "lit_pumpkin",
     "white_glazed_terracotta",
     "orange_glazed_terracotta",
     "magenta_glazed_terracotta",
     "light_blue_glazed_terracotta",
     "yellow_glazed_terracotta",
     "lime_glazed_terracotta",
     "pink_glazed_terracotta",
     "gray_glazed_terracotta",
     "light_gray_glazed_terracotta",
     "silver_glazed_terracotta",
     "cyan_glazed_terracotta",
     "purple_glazed_terracotta",
     "blue_glazed_terracotta",
     "brown_glazed_terracotta",
     "green_glazed_terracotta",
     "red_glazed_terracotta",
     "black_glazed_terracotta",
]);
const FACING_ROTATION_TYPES = new Set([
     "barrel",
     "dispenser",
     "dropper",
     "observer",
     "command_block",
     "repeating_command_block",
     "chain_command_block",
     "piston",
     "sticky_piston",
]);
const DIRECTION_ROTATION_TYPES = new Set(["loom"]);
const BEACON_TYPES = new Set(["beacon"]);
const SLIME_OUTER_CUBE_TYPES = new Set(["slime_block", "honey_block"]);

const LADDER_DIRECTION_TO_MODEL = new Map([
     [2, "LADDER_NORTH"],
     [3, "LADDER_SOUTH"],
     [4, "LADDER_WEST"],
     [5, "LADDER_EAST"],
]);

const BREWING_STAND_DATA_MAP = new Map([
     ["", 0],
     ["a", 1],
     ["b", 2],
     ["c", 3],
     ["ab", 4],
     ["ac", 5],
     ["bc", 6],
     ["abc", 7],
]);

// 数字索引会直接写入渲染控制器变量，因此保持显式映射。
export const BLOCK_ID_MAP = new Map(BLOCK_ID_ENTRIES);
export const UNREGISTERED_BLOCK_PLACEHOLDER_TYPE_INDEX = 499;

export const BLOCK_MODEL_MAP = {
     DEFAULT: 0,
     SLAB_BOTTOM: 1,
     SLAB_TOP: 2,
     CAMPFIRE: 3,
     BELL: 4,
     LADDER_NORTH: 5,
     LADDER_SOUTH: 6,
     LADDER_WEST: 7,
     LADDER_EAST: 8,
     MULTI_FACE_BLOCK: 9,
     MULTI_FACE_SLAB_BOTTOM: 10,
     MULTI_FACE_SLAB_TOP: 11,
     FENCE_GATE: 12,
     TRAPDOOR: 13,
     DOOR: 14,
     LANTERN: 15,
     TORCH: 16,
     REDSTONE_TORCH: 17,
     END_ROD: 18,
     CHAIN: 19,
     ANVIL: 20,
     STONECUTTER: 21,
     GRINDSTONE: 22,
     ENCHANTING_TABLE: 23,
     BREWING_STAND: 24,
     LECTERN: 25,
     CAULDRON: 26,
     CHEST: 27,
     BED: 28,
     CANDLE: 29,
     GLASS_PANE: 30,
     GLASS_PANEA: 31,
     GLASS_PANEB: 32,
     GLASS_PANEC: 33,
     GLASS_PANED: 34,
     GLASS_PANEE: 35,
     BAR_PANE: 36,
     BAR_PANEA: 37,
     BAR_PANEB: 38,
     BAR_PANEC: 39,
     BAR_PANED: 40,
     BAR_PANEE: 41,
     STONE_WALL: 42,
     STONE_WALLA: 43,
     STONE_WALLB: 44,
     STONE_WALLC: 45,
     STONE_WALLD: 46,
     STONE_WALLE: 47,
     FENCE: 48,
     FENCEA: 49,
     FENCEB: 50,
     FENCEC: 51,
     FENCED: 52,
     FENCEE: 53,
     STAIRS: 54,
     STAIRSA: 55,
     STAIRSB: 56,
     STAIRSC: 57,
     STAIRSD: 58,
     DRAGON_EGG: 59,
     CARPET: 60,
     PRESSURE_PLATE: 61,
     BEACON: 62,
     DAYLIGHT_DETECTOR: 63,
     HOPPER_DOWN: 64,
     HOPPER_SIDE: 65,
     SIGN_STANDING: 66,
     SIGN_WALL: 67,
     HANGING_SIGN: 68,
     HEAD: 69,
     HEAD_WALL: 70,
     DRAGON_HEAD: 71,
     DRAGON_HEAD_WALL: 72,
     LAYERED_CUBE: 73,
     PIGLIN_HEAD: 74,
     PIGLIN_HEAD_WALL: 75,
};

const GLASS_PANE_MODEL_TYPES = [
     BLOCK_MODEL_MAP.GLASS_PANE,
     BLOCK_MODEL_MAP.GLASS_PANEA,
     BLOCK_MODEL_MAP.GLASS_PANEB,
     BLOCK_MODEL_MAP.GLASS_PANEC,
     BLOCK_MODEL_MAP.GLASS_PANED,
     BLOCK_MODEL_MAP.GLASS_PANEE,
];

const SIMPLE_FRAGMENT_MODEL_TYPES = new Set([
     BLOCK_MODEL_MAP.DEFAULT,
     BLOCK_MODEL_MAP.SLAB_BOTTOM,
     BLOCK_MODEL_MAP.SLAB_TOP,
     BLOCK_MODEL_MAP.CARPET,
]);

const BAR_MODEL_TYPES = [
     BLOCK_MODEL_MAP.BAR_PANE,
     BLOCK_MODEL_MAP.BAR_PANEA,
     BLOCK_MODEL_MAP.BAR_PANEB,
     BLOCK_MODEL_MAP.BAR_PANEC,
     BLOCK_MODEL_MAP.BAR_PANED,
     BLOCK_MODEL_MAP.BAR_PANEE,
];

const WALL_MODEL_TYPES = [
     BLOCK_MODEL_MAP.STONE_WALL,
     BLOCK_MODEL_MAP.STONE_WALLA,
     BLOCK_MODEL_MAP.STONE_WALLB,
     BLOCK_MODEL_MAP.STONE_WALLC,
     BLOCK_MODEL_MAP.STONE_WALLD,
     BLOCK_MODEL_MAP.STONE_WALLE,
];

const FENCE_MODEL_TYPES = [
     BLOCK_MODEL_MAP.FENCE,
     BLOCK_MODEL_MAP.FENCEA,
     BLOCK_MODEL_MAP.FENCEB,
     BLOCK_MODEL_MAP.FENCEC,
     BLOCK_MODEL_MAP.FENCED,
     BLOCK_MODEL_MAP.FENCEE,
];

const STAIR_MODEL_TYPES = [
     BLOCK_MODEL_MAP.STAIRS,
     BLOCK_MODEL_MAP.STAIRSA,
     BLOCK_MODEL_MAP.STAIRSB,
     BLOCK_MODEL_MAP.STAIRSC,
     BLOCK_MODEL_MAP.STAIRSD,
];

const SIMPLE_FRAGMENT_GLASS_FULL_BLOCK_TYPES = new Set([
     "glass",
     "white_stained_glass",
     "orange_stained_glass",
     "magenta_stained_glass",
     "light_blue_stained_glass",
     "yellow_stained_glass",
     "lime_stained_glass",
     "pink_stained_glass",
     "gray_stained_glass",
     "light_gray_stained_glass",
     "cyan_stained_glass",
     "purple_stained_glass",
     "blue_stained_glass",
     "brown_stained_glass",
     "green_stained_glass",
     "red_stained_glass",
     "black_stained_glass",
     "tinted_glass",
]);

function createEmptyRotation() {
     return {
          rx: 0,
          ry: 0,
          rz: 0,
     };
}

function createEmptyOffset() {
     return {
          x: 0,
          y: 0,
          z: 0,
     };
}

function getFacingDirectionRotation(direction) {
     const rotation = createEmptyRotation();

     if (direction === 0) {
          rotation.rx = 1;
     } else if (direction === 1) {
          rotation.rx = 3;
     } else if (direction === 2) {
          rotation.ry = 2;
     } else if (direction === 4) {
          rotation.ry = 1;
     } else if (direction === 5) {
          rotation.ry = 3;
     }

     return rotation;
}

function getHorizontalFacingDirectionRotation(direction) {
     const rotation = createEmptyRotation();

     if (direction === 3) {
          rotation.ry = 2;
     } else if (direction === 4) {
          rotation.ry = 1;
     } else if (direction === 5) {
          rotation.ry = 3;
     }

     return rotation;
}

function getPillarAxisRotation(axis) {
     const rotation = createEmptyRotation();

     if (axis === "x") {
          rotation.rz = 1;
     } else if (axis === "z") {
          rotation.rx = 1;
     }

     return rotation;
}

function getCardinalDirectionRotation(direction) {
     const rotation = createEmptyRotation();

     if (direction === "west") {
          rotation.ry = 1;
     } else if (direction === "north") {
          rotation.ry = 2;
     } else if (direction === "east") {
          rotation.ry = 3;
     }

     return rotation;
}

function getDirectionRotation(direction) {
     const rotation = createEmptyRotation();

     rotation.ry = direction ?? 0;
     if (direction === 1) {
          rotation.ry = 2;
     } else if (direction === 2) {
          rotation.ry = 1;
     }

     return rotation;
}

function getGroundSignDirectionRotation(direction) {
     const rotation = createEmptyRotation();
     const yaw = ((direction ?? 0) / 4) % 4;
     rotation.ry = (5 - yaw) % 4;
     return rotation;
}

function getSignLikeHorizontalFacingDirectionRotation(direction) {
     const rotation = getHorizontalFacingDirectionRotation(direction);

     if (direction === 4) {
          rotation.ry = 3;
     } else if (direction === 5) {
          rotation.ry = 1;
     }

     return rotation;
}

function isWallMountedSignLike(block) {
     const facing = getBlockState(block, "facing_direction");
     return facing >= 2 && facing <= 5;
}

function getSignLikeDirectionRotation(block) {
     if (isWallMountedSignLike(block)) {
          return getSignLikeHorizontalFacingDirectionRotation(
               getBlockState(block, "facing_direction")
          );
     }

     const groundDirection = getBlockState(block, "ground_sign_direction");
     if (typeof groundDirection === "number") {
          return getGroundSignDirectionRotation(groundDirection);
     }

     const direction = getBlockState(block, "direction");
     if (typeof direction === "number") {
          return direction > 3
               ? getGroundSignDirectionRotation(direction)
               : getDirectionRotation(direction);
     }

     return createEmptyRotation();
}

function getFenceGateDirectionRotation(direction) {
     const rotation = createEmptyRotation();

     // Fence gate 的 direction 状态直接作为水平旋转值使用。
     // 这里不额外交换索引，也不叠加 90 度补偿，以免开关态整体偏转。
     rotation.ry = direction ?? 0;

     return rotation;
}

function getTrapdoorRotation(block) {
     const rotation = getDirectionRotation(
          block.permutation.getState("direction")
     );

     if (block.permutation.getState("upside_down_bit")) {
          rotation.rx = 2;
     }

     return rotation;
}

function getDoorRotation(block) {
     const rotation = createEmptyRotation();
     rotation.ry = block.permutation.getState("direction") ?? 0;
     return rotation;
}

function getTorchRotation(block) {
     return getCardinalDirectionRotation(
          block.permutation.getState("torch_facing_direction")
     );
}

function getEndRodRotation(block) {
     const rotation = createEmptyRotation();
     const direction = block.permutation.getState("facing_direction");

     if (direction === 1) {
          rotation.rx = 0;
     } else if (direction === 2) {
          rotation.rx = 1;
     } else if (direction === 3) {
          rotation.rx = 3;
     } else if (direction === 4) {
          rotation.rz = 1;
     } else if (direction === 5) {
          rotation.rz = 3;
     } else {
          rotation.rx = 2;
     }

     return rotation;
}

function getHopperRotation(block) {
     const direction = getBlockState(block, "facing_direction") ?? 0;

     if (direction >= 2 && direction <= 5) {
          return getHorizontalFacingDirectionRotation(direction);
     }

     return createEmptyRotation();
}

function getGrindstoneRotation(block) {
     const rotation = createEmptyRotation();
     const attachment = block.permutation.getState("attachment");

     if (attachment === "side") {
          rotation.rx = 1;
     } else if (attachment === "hanging") {
          rotation.rx = 2;
     }

     rotation.ry = block.permutation.getState("direction") ?? 0;
     return rotation;
}

function getBlockState(block, stateName) {
     try {
          return block?.permutation?.getState(stateName);
     } catch {
          return undefined;
     }
}

function getBlockGridLocation(block) {
     return (
          block?.location ?? {
               x: block?.x ?? 0,
               y: block?.y ?? 0,
               z: block?.z ?? 0,
          }
     );
}

function getRelativeBlock(block, offset) {
     try {
          const location = getBlockGridLocation(block);
          return (
               block?.dimension?.getBlock({
                    x: location.x + offset.x,
                    y: location.y + offset.y,
                    z: location.z + offset.z,
               }) ?? null
          );
     } catch {
          return null;
     }
}

function getNeighborBlocks(block) {
     return {
          north: getRelativeBlock(block, { x: 0, y: 0, z: -1 }),
          west: getRelativeBlock(block, { x: -1, y: 0, z: 0 }),
          south: getRelativeBlock(block, { x: 0, y: 0, z: 1 }),
          east: getRelativeBlock(block, { x: 1, y: 0, z: 0 }),
     };
}

function getTypeName(typeId) {
     return (typeId ?? "").split(":")[1] ?? "";
}

function isShipConnectionExcluded(block) {
     const blockName = getTypeName(block?.typeId);
     return (
          !blockName ||
          blockName === "air" ||
          blockName.includes("water") ||
          blockName.includes("slab") ||
          blockName.includes("carpet") ||
          blockName.includes("pressure_plate") ||
          blockName.includes("daylight_detector") ||
          blockName === "hopper"
     );
}

function buildNeighborConnectionString(block) {
     const neighbors = getNeighborBlocks(block);
     let connection = "";

     if (!isShipConnectionExcluded(neighbors.north)) {
          connection += "n";
     }
     if (!isShipConnectionExcluded(neighbors.west)) {
          connection += "w";
     }
     if (!isShipConnectionExcluded(neighbors.south)) {
          connection += "s";
     }
     if (!isShipConnectionExcluded(neighbors.east)) {
          connection += "e";
     }

     return connection;
}

function buildWallConnectionString(block) {
     let connection = "";

     if (getBlockState(block, "wall_connection_type_north") !== "none") {
          connection += "n";
     }
     if (getBlockState(block, "wall_connection_type_west") !== "none") {
          connection += "w";
     }
     if (getBlockState(block, "wall_connection_type_south") !== "none") {
          connection += "s";
     }
     if (getBlockState(block, "wall_connection_type_east") !== "none") {
          connection += "e";
     }

     return connection;
}

function resolveShipConnectionShape(connection) {
     const state = {
          variant: 0,
          ry: 0,
     };

     if (connection.length === 1) {
          state.variant = 1;
          state.ry = "nesw".indexOf(connection);
          return state;
     }

     if (connection.length === 2) {
          let list = ["ns", "we"];
          if (list.includes(connection)) {
               state.variant = 2;
               state.ry = list.indexOf(connection);
               return state;
          }

          list = ["ne", "se", "ws", "nw"];
          if (list.includes(connection)) {
               state.variant = 3;
               state.ry = list.indexOf(connection);
          }
          return state;
     }

     if (connection.length === 3) {
          state.variant = 4;
          state.ry = ["nse", "wse", "nws", "nwe"].indexOf(connection);
          return state;
     }

     if (connection.length === 4) {
          state.variant = 5;
     }

     return state;
}

function getConnectionRotation(connection) {
     const rotation = createEmptyRotation();
     rotation.ry = resolveShipConnectionShape(connection).ry;
     return rotation;
}

function getWeirdoDirectionRotation(direction) {
     const rotation = createEmptyRotation();

     if (direction === 0) {
          rotation.ry = 1;
     } else if (direction === 1) {
          rotation.ry = 3;
     } else if (direction === 2) {
          rotation.ry = 2;
     } else if (direction === 3) {
          rotation.ry = 0;
     }

     return rotation;
}

function isStairsBlock(block) {
     return getTypeName(block?.typeId).endsWith("stairs");
}

function getStairShape(block) {
     const direction = getBlockState(block, "weirdo_direction") ?? 0;
     const upsideDown = getBlockState(block, "upside_down_bit");
     const neighbors = getNeighborBlocks(block);

     const northDirection = getBlockState(neighbors.north, "weirdo_direction");
     const southDirection = getBlockState(neighbors.south, "weirdo_direction");
     const eastDirection = getBlockState(neighbors.east, "weirdo_direction");
     const westDirection = getBlockState(neighbors.west, "weirdo_direction");

     const northUp = getBlockState(neighbors.north, "upside_down_bit");
     const southUp = getBlockState(neighbors.south, "upside_down_bit");
     const eastUp = getBlockState(neighbors.east, "upside_down_bit");
     const westUp = getBlockState(neighbors.west, "upside_down_bit");

     const northIsStairs = isStairsBlock(neighbors.north);
     const southIsStairs = isStairsBlock(neighbors.south);
     const eastIsStairs = isStairsBlock(neighbors.east);
     const westIsStairs = isStairsBlock(neighbors.west);

     let shape = 0;

     if (direction === 0) {
          if (
               upsideDown === eastUp &&
               eastDirection === 2 &&
               upsideDown === southUp &&
               !southDirection
          ) {
               shape = upsideDown ? 1 : 2;
          } else if (
               upsideDown === eastUp &&
               eastDirection === 3 &&
               upsideDown === northUp &&
               northIsStairs &&
               !northDirection
          ) {
               shape = upsideDown ? 2 : 1;
          } else if (
               upsideDown === westUp &&
               westDirection === 3 &&
               upsideDown === southUp &&
               southIsStairs &&
               !southDirection
          ) {
               shape = upsideDown ? 4 : 3;
          } else if (
               upsideDown === westUp &&
               westDirection === 2 &&
               upsideDown === northUp &&
               northIsStairs &&
               !northDirection
          ) {
               shape = upsideDown ? 3 : 4;
          }
     } else if (direction === 1) {
          if (
               upsideDown === northUp &&
               northDirection === 1 &&
               upsideDown === westUp &&
               westDirection === 3
          ) {
               shape = upsideDown ? 1 : 2;
          } else if (
               upsideDown === southUp &&
               southDirection === 1 &&
               upsideDown === westUp &&
               westDirection === 2
          ) {
               shape = upsideDown ? 2 : 1;
          } else if (
               upsideDown === northUp &&
               northDirection === 1 &&
               upsideDown === eastUp &&
               eastDirection === 2
          ) {
               shape = upsideDown ? 4 : 3;
          } else if (
               upsideDown === southUp &&
               southDirection === 1 &&
               upsideDown === eastUp &&
               eastDirection === 3
          ) {
               shape = upsideDown ? 3 : 4;
          }
     } else if (direction === 2) {
          if (
               upsideDown === westUp &&
               westDirection === 2 &&
               upsideDown === southUp &&
               southDirection === 1
          ) {
               shape = upsideDown ? 1 : 2;
          } else if (
               upsideDown === eastUp &&
               eastDirection === 2 &&
               upsideDown === southUp &&
               southIsStairs &&
               !southDirection
          ) {
               shape = upsideDown ? 2 : 1;
          } else if (
               upsideDown === westUp &&
               westDirection === 2 &&
               upsideDown === northUp &&
               northIsStairs &&
               !northDirection
          ) {
               shape = upsideDown ? 4 : 3;
          } else if (
               upsideDown === eastUp &&
               eastDirection === 2 &&
               upsideDown === northUp &&
               northDirection === 1
          ) {
               shape = upsideDown ? 3 : 4;
          }
     } else if (direction === 3) {
          if (
               upsideDown === eastUp &&
               eastDirection === 3 &&
               upsideDown === northUp &&
               northIsStairs &&
               !northDirection
          ) {
               shape = upsideDown ? 1 : 2;
          } else if (
               upsideDown === westUp &&
               westDirection === 3 &&
               upsideDown === northUp &&
               northDirection === 1
          ) {
               shape = upsideDown ? 2 : 1;
          } else if (
               upsideDown === eastUp &&
               eastDirection === 3 &&
               upsideDown === southUp &&
               southDirection === 1
          ) {
               shape = upsideDown ? 4 : 3;
          } else if (
               upsideDown === westUp &&
               westDirection === 3 &&
               upsideDown === southUp &&
               southIsStairs &&
               !southDirection
          ) {
               shape = upsideDown ? 3 : 4;
          }
     }

     return shape;
}

function getStairRotation(block) {
     const rotation = getWeirdoDirectionRotation(
          getBlockState(block, "weirdo_direction") ?? 0
     );

     if (getBlockState(block, "upside_down_bit")) {
          rotation.rx = 2;
          rotation.ry = (rotation.ry + 2) % 4;
     }

     return rotation;
}

function getVariantModelType(variantIndex, modelTypes) {
     return modelTypes[variantIndex] ?? modelTypes[0];
}

// 根据方块状态挑选模型类型，让同一个材质槽位表示不同外形。
export function getBlockModelType(block) {
     if (block.typeId === "minecraft:air") {
          return BLOCK_MODEL_MAP.DEFAULT;
     }

     const blockName = block.typeId.split(":")[1];

     if (blockName === "dragon_egg") {
          return BLOCK_MODEL_MAP.DRAGON_EGG;
     }

     if (BEACON_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.BEACON;
     }

     if (CARPET_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.CARPET;
     }

     if (PRESSURE_PLATE_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.PRESSURE_PLATE;
     }

     if (DAYLIGHT_DETECTOR_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.DAYLIGHT_DETECTOR;
     }

     if (HOPPER_TYPES.has(blockName)) {
          const direction = getBlockState(block, "facing_direction") ?? 0;
          return direction >= 2 && direction <= 5
               ? BLOCK_MODEL_MAP.HOPPER_SIDE
               : BLOCK_MODEL_MAP.HOPPER_DOWN;
     }

     if (HANGING_SIGN_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.HANGING_SIGN;
     }

     if (SIGN_TYPES.has(blockName)) {
          return isWallMountedSignLike(block)
               ? BLOCK_MODEL_MAP.SIGN_WALL
               : BLOCK_MODEL_MAP.SIGN_STANDING;
     }

     if (blockName === "dragon_head") {
          return BLOCK_MODEL_MAP.DRAGON_HEAD;
     }

     if (blockName === "dragon_wall_head") {
          return BLOCK_MODEL_MAP.DRAGON_HEAD_WALL;
     }

     if (blockName === "piglin_head") {
          return BLOCK_MODEL_MAP.PIGLIN_HEAD;
     }

     if (blockName === "piglin_wall_head") {
          return BLOCK_MODEL_MAP.PIGLIN_HEAD_WALL;
     }

     if (HEAD_TYPES.has(blockName)) {
          return isWallMountedSignLike(block)
               ? BLOCK_MODEL_MAP.HEAD_WALL
               : BLOCK_MODEL_MAP.HEAD;
     }

     if (SLIME_OUTER_CUBE_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.LAYERED_CUBE;
     }

     if (MULTI_FACE_FULL_BLOCK_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.MULTI_FACE_BLOCK;
     }

     if (MULTI_FACE_SLAB_TYPES.has(blockName)) {
          try {
               const verticalHalf = block.permutation.getState(
                    "minecraft:vertical_half"
               );

               if (verticalHalf === "bottom") {
                    return BLOCK_MODEL_MAP.MULTI_FACE_SLAB_BOTTOM;
               }

               if (verticalHalf === "top") {
                    return BLOCK_MODEL_MAP.MULTI_FACE_SLAB_TOP;
               }
          } catch (error) {
               console.warn(`无法获取多面半砖状态: ${error}`);
          }

          return BLOCK_MODEL_MAP.MULTI_FACE_SLAB_BOTTOM;
     }

     if (FULL_BLOCK_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.DEFAULT;
     }

     if (SLAB_TYPES.has(blockName)) {
          try {
               const verticalHalf = block.permutation.getState(
                    "minecraft:vertical_half"
               );

               if (verticalHalf === "bottom") {
                    return BLOCK_MODEL_MAP.SLAB_BOTTOM;
               }

               if (verticalHalf === "top") {
                    return BLOCK_MODEL_MAP.SLAB_TOP;
               }
          } catch (error) {
               console.warn(`无法获取台阶状态: ${error}`);
          }

          return BLOCK_MODEL_MAP.DEFAULT;
     }

     if (CAMPFIRE_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.CAMPFIRE;
     }

     if (BELL_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.BELL;
     }

     if (LADDER_TYPES.has(blockName)) {
          try {
               const direction = block.permutation.getState("facing_direction");
               const modelKey = LADDER_DIRECTION_TO_MODEL.get(direction);

               if (modelKey) {
                    return BLOCK_MODEL_MAP[modelKey];
               }
          } catch {}

          return BLOCK_MODEL_MAP.DEFAULT;
     }

     if (FENCE_GATE_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.FENCE_GATE;
     }

     if (TRAPDOOR_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.TRAPDOOR;
     }

     if (DOOR_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.DOOR;
     }

     if (LANTERN_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.LANTERN;
     }

     if (TORCH_TYPES.has(blockName)) {
          return REDSTONE_TORCH_TYPES.has(blockName)
               ? BLOCK_MODEL_MAP.REDSTONE_TORCH
               : BLOCK_MODEL_MAP.TORCH;
     }

     if (END_ROD_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.END_ROD;
     }

     if (CHAIN_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.CHAIN;
     }

     if (ANVIL_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.ANVIL;
     }

     if (STONECUTTER_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.STONECUTTER;
     }

     if (GRINDSTONE_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.GRINDSTONE;
     }

     if (ENCHANTING_TABLE_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.ENCHANTING_TABLE;
     }

     if (BREWING_STAND_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.BREWING_STAND;
     }

     if (LECTERN_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.LECTERN;
     }

     if (CAULDRON_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.CAULDRON;
     }

     if (CHEST_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.CHEST;
     }

     if (SHULKER_BOX_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.DEFAULT;
     }

     if (BED_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.BED;
     }

     if (CANDLE_TYPES.has(blockName)) {
          return BLOCK_MODEL_MAP.CANDLE;
     }

     if (BAR_TYPES.has(blockName)) {
          return getVariantModelType(
               resolveShipConnectionShape(buildNeighborConnectionString(block))
                    .variant,
               BAR_MODEL_TYPES
          );
     }

     if (GLASS_PANE_TYPES.has(blockName)) {
          return getVariantModelType(
               resolveShipConnectionShape(buildNeighborConnectionString(block))
                    .variant,
               GLASS_PANE_MODEL_TYPES
          );
     }

     if (WALL_TYPES.has(blockName)) {
          return getVariantModelType(
               resolveShipConnectionShape(buildWallConnectionString(block))
                    .variant,
               WALL_MODEL_TYPES
          );
     }

     if (FENCE_TYPES.has(blockName)) {
          return getVariantModelType(
               resolveShipConnectionShape(buildNeighborConnectionString(block))
                    .variant,
               FENCE_MODEL_TYPES
          );
     }

     if (STAIR_TYPES.has(blockName)) {
          return getVariantModelType(getStairShape(block), STAIR_MODEL_TYPES);
     }

     return BLOCK_MODEL_MAP.DEFAULT;
}

// 按方块状态生成槽位旋转值，供 fragment 渲染控制器读取。
export function getBlockRotation(block) {
     if (!block || block.typeId === "minecraft:air") {
          return createEmptyRotation();
     }

     const blockName = block.typeId.split(":")[1];

     try {
          if (AXIS_ROTATION_TYPES.has(blockName)) {
               return getPillarAxisRotation(
                    block.permutation.getState("pillar_axis")
               );
          }

          if (CARDINAL_ROTATION_TYPES.has(blockName)) {
               return getCardinalDirectionRotation(
                    block.permutation.getState("minecraft:cardinal_direction")
               );
          }

          if (FACING_ROTATION_TYPES.has(blockName)) {
               return getFacingDirectionRotation(
                    block.permutation.getState("facing_direction")
               );
          }

          if (DIRECTION_ROTATION_TYPES.has(blockName)) {
               return getDirectionRotation(
                    block.permutation.getState("direction")
               );
          }

          if (FENCE_GATE_TYPES.has(blockName)) {
               return getFenceGateDirectionRotation(
                    block.permutation.getState("direction")
               );
          }

          if (TRAPDOOR_TYPES.has(blockName)) {
               return getTrapdoorRotation(block);
          }

          if (DOOR_TYPES.has(blockName)) {
               return getDoorRotation(block);
          }

          if (TORCH_TYPES.has(blockName)) {
               return getTorchRotation(block);
          }

          if (END_ROD_TYPES.has(blockName)) {
               return getEndRodRotation(block);
          }

          if (CHAIN_TYPES.has(blockName)) {
               return getPillarAxisRotation(
                    block.permutation.getState("pillar_axis")
               );
          }

          if (HOPPER_TYPES.has(blockName)) {
               return getHopperRotation(block);
          }

          if (HANGING_SIGN_TYPES.has(blockName)) {
               return getSignLikeDirectionRotation(block);
          }

          if (SIGN_TYPES.has(blockName)) {
               return getSignLikeDirectionRotation(block);
          }

          if (HEAD_TYPES.has(blockName)) {
               return getSignLikeDirectionRotation(block);
          }

          if (ANVIL_TYPES.has(blockName)) {
               return getCardinalDirectionRotation(
                    block.permutation.getState("minecraft:cardinal_direction")
               );
          }

          if (STONECUTTER_TYPES.has(blockName)) {
               return getCardinalDirectionRotation(
                    block.permutation.getState("minecraft:cardinal_direction")
               );
          }

          if (GRINDSTONE_TYPES.has(blockName)) {
               return getGrindstoneRotation(block);
          }

          if (LECTERN_TYPES.has(blockName)) {
               return getCardinalDirectionRotation(
                    block.permutation.getState("minecraft:cardinal_direction")
               );
          }

          if (CHEST_TYPES.has(blockName)) {
               return getCardinalDirectionRotation(
                    getBlockState(block, "minecraft:cardinal_direction")
               );
          }

          if (BED_TYPES.has(blockName)) {
               const rotation = createEmptyRotation();
               rotation.ry = getBlockState(block, "direction") ?? 0;
               return rotation;
          }

          if (BAR_TYPES.has(blockName)) {
               return getConnectionRotation(buildNeighborConnectionString(block));
          }

          if (GLASS_PANE_TYPES.has(blockName)) {
               return getConnectionRotation(buildNeighborConnectionString(block));
          }

          if (WALL_TYPES.has(blockName)) {
               return getConnectionRotation(buildWallConnectionString(block));
          }

          if (FENCE_TYPES.has(blockName)) {
               return getConnectionRotation(buildNeighborConnectionString(block));
          }

          if (STAIR_TYPES.has(blockName)) {
               return getStairRotation(block);
          }
     } catch (error) {
          console.warn(`无法获取方块旋转状态 ${blockName}: ${error}`);
     }

     return createEmptyRotation();
}

export function getBlockData(block) {
     if (!block || block.typeId === "minecraft:air") {
          return 0;
     }

     const blockName = block.typeId.split(":")[1];

     try {
          if (FENCE_GATE_TYPES.has(blockName)) {
               return 6 + (block.permutation.getState("open_bit") ? 1 : 0);
          }

          if (TRAPDOOR_TYPES.has(blockName)) {
               return block.permutation.getState("open_bit") ? 1 : 0;
          }

          if (DOOR_TYPES.has(blockName)) {
               return block.permutation.getState("open_bit") ? 1 : 0;
          }

          if (LANTERN_TYPES.has(blockName)) {
               return block.permutation.getState("hanging") ? 1 : 0;
          }

          if (TORCH_TYPES.has(blockName)) {
               return block.permutation.getState("torch_facing_direction") ===
                    "top"
                    ? 0
                    : 1;
          }

          if (BREWING_STAND_TYPES.has(blockName)) {
               let bottleState = block.permutation.getState(
                    "brewing_stand_slot_a_bit"
               )
                    ? "a"
                    : "";
               bottleState += block.permutation.getState(
                    "brewing_stand_slot_b_bit"
               )
                    ? "b"
                    : "";
               bottleState += block.permutation.getState(
                    "brewing_stand_slot_c_bit"
               )
                    ? "c"
                    : "";

               return BREWING_STAND_DATA_MAP.get(bottleState) ?? 0;
          }

          if (CANDLE_TYPES.has(blockName)) {
               return getBlockState(block, "candles") ?? 0;
          }
     } catch (error) {
          console.warn(`无法获取方块数据状态 ${blockName}: ${error}`);
     }

     return 0;
}

export function isSimpleFragmentBlock(block) {
     if (!block || block.typeId === "minecraft:air") {
          return false;
     }

     const blockName = block.typeId.split(":")[1];
     const modelType = getBlockModelType(block);

     if (!SIMPLE_FRAGMENT_MODEL_TYPES.has(modelType)) {
          return false;
     }

     if (SIMPLE_FRAGMENT_GLASS_FULL_BLOCK_TYPES.has(blockName)) {
          return false;
     }

     if (SLIME_OUTER_CUBE_TYPES.has(blockName)) {
          return false;
     }

     return true;
}

export function getFragmentTypeIndex(blockTypeId) {
     if (typeof blockTypeId !== "string" || blockTypeId.length === 0) {
          return 0;
     }

     if (blockTypeId === "train:connect_core") {
          return BLOCK_ID_MAP.get("connect_core") ?? 0;
     }

     if (!blockTypeId.startsWith("minecraft:")) {
          return 0;
     }

     const blockName = blockTypeId.split(":")[1];
     if (typeof blockName !== "string" || blockName.length === 0) {
          return 0;
     }

     return (
          BLOCK_ID_MAP.get(blockName) ??
          UNREGISTERED_BLOCK_PLACEHOLDER_TYPE_INDEX
     );
}

// 完整方块几何默认绕底面中心旋转。
// 对于需要绕 X/Z 轴旋转的柱类方块，这里补偿由旋转点引起的位置偏移。
export function getBlockRenderOffset(block) {
     if (!block || block.typeId === "minecraft:air") {
          return createEmptyOffset();
     }

     const blockName = block.typeId.split(":")[1];
     if (!AXIS_ROTATION_TYPES.has(blockName)) {
          return createEmptyOffset();
     }

     try {
          const axis = block.permutation.getState("pillar_axis");

          if (axis === "x") {
               return {
                    x: -0.5,
                    y: 0.5,
                    z: 0,
               };
          }

          if (axis === "z") {
               return {
                    x: 0,
                    y: 0.5,
                    z: -0.5,
               };
          }
     } catch (error) {
          console.warn(`无法获取方块偏移状态 ${blockName}: ${error}`);
     }

     return createEmptyOffset();
}
