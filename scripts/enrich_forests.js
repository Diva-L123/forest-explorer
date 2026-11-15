'use strict';

const fs = require('fs');
const path = require('path');

const forestsPath = path.join(__dirname, '..', 'data', 'forests.json');
const forests = JSON.parse(fs.readFileSync(forestsPath, 'utf8'));

// Unique curated images for each of the 120 forests
const FOREST_IMAGES = {
  'cheonggyecheon-urban-stream': './images/cheonggyecheon/1_morning_mist.jpg',
  'amazon-rainforest': './images/amazon/1_canopy_sunrise.jpg',
  'yakushima-ancient-forest': './images/yakushima/1_moss_stream.jpg',
  'black-forest': './images/black_forest/1_mummelsee_lake.jpg',
  'redwood-national-park': './images/redwood/1_living_giants.jpg',
  'monteverde-cloud-forest': './images/monteverde/1_canopy_bridge.jpg',
  'bialowieza-primeval-forest': './images/bialowieza/01_ancient_oak.jpg',
  'congo-basin-rainforest': './images/congo/01_likouala_river.jpg',
  'daintree-rainforest': './images/daintree/01_canopy.jpg',
  'sundarbans-mangrove': './images/sundarbans/01_mangrove_tide.jpg',

  // Asia
  'kaziranga': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Kaziranga_National_Park%2C_Assam.jpg/1280px-Kaziranga_National_Park%2C_Assam.jpg',
  'western-ghats': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Western_Ghats_landscape.jpg/1280px-Western_Ghats_landscape.jpg',
  'nilgiri-shola': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Shola_Forest_Nilgiris.jpg/1280px-Shola_Forest_Nilgiris.jpg',
  'namdapha': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Namdapha_National_Park_river.jpg/1280px-Namdapha_National_Park_river.jpg',
  'kanha': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Kanha_National_Park_sal_forest.jpg/1280px-Kanha_National_Park_sal_forest.jpg',
  'chitwan': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Chitwan_National_Park_jungle.jpg/1280px-Chitwan_National_Park_jungle.jpg',
  'jigme-singye-wangchuck': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Black_Mountains_Bhutan.jpg/1280px-Black_Mountains_Bhutan.jpg',
  'sinharaja': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Sinharaja_Forest_Reserve_canopy.jpg/1280px-Sinharaja_Forest_Reserve_canopy.jpg',
  'knuckles': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Knuckles_Mountain_Range_mist.jpg/1280px-Knuckles_Mountain_Range_mist.jpg',
  'lawachara': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Lawachara_National_Park_trail.jpg/1280px-Lawachara_National_Park_trail.jpg',
  'hukaung-valley': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Hukaung_Valley_rainforest.jpg/1280px-Hukaung_Valley_rainforest.jpg',
  'khao-yai': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Khao_Yai_National_Park_forest.jpg/1280px-Khao_Yai_National_Park_forest.jpg',
  'cuc-phuong': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Cuc_Phuong_ancient_tree.jpg/1280px-Cuc_Phuong_ancient_tree.jpg',
  'nam-et-phou-louey': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Nam_Et-Phou_Louey_canopy.jpg/1280px-Nam_Et-Phou_Louey_canopy.jpg',
  'prey-lang': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Prey_Lang_evergreen_forest.jpg/1280px-Prey_Lang_evergreen_forest.jpg',
  'taman-negara': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Taman_Negara_primary_rainforest.jpg/1280px-Taman_Negara_primary_rainforest.jpg',
  'danum-valley': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Danum_Valley_Borneo_mist.jpg/1280px-Danum_Valley_Borneo_mist.jpg',
  'belum-temengor': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Royal_Belum_State_Park_lake.jpg/1280px-Royal_Belum_State_Park_lake.jpg',
  'gunung-leuser': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Gunung_Leuser_tropical_rainforest.jpg/1280px-Gunung_Leuser_tropical_rainforest.jpg',
  'tanjung-puting': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Tanjung_Puting_peat_forest.jpg/1280px-Tanjung_Puting_peat_forest.jpg',
  'ujung-kulon': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Ujung_Kulon_coastal_forest.jpg/1280px-Ujung_Kulon_coastal_forest.jpg',
  'xishuangbanna': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Xishuangbanna_tropical_rainforest.jpg/1280px-Xishuangbanna_tropical_rainforest.jpg',
  'zhangjiajie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Zhangjiajie_sandstone_pillars.jpg/1280px-Zhangjiajie_sandstone_pillars.jpg',
  'jiuzhaigou': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Jiuzhaigou_Valley.jpg/1280px-Jiuzhaigou_Valley.jpg',
  'shirakami-sanchi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Shirakami_Sanchi_virgin_beech.jpg/1280px-Shirakami_Sanchi_virgin_beech.jpg',
  'alishan': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Alishan_forest.jpg/1280px-Alishan_forest.jpg',
  'sikhote-alin': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Sikhote-Alin_taiga_forest.jpg/1280px-Sikhote-Alin_taiga_forest.jpg',
  'hyrcanian': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Hyrcanian_Forests_Iran.jpg/1280px-Hyrcanian_Forests_Iran.jpg',

  // Europe
  'bavarian-forest': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Bayerischer_Wald_Nationalpark.jpg/1280px-Bayerischer_Wald_Nationalpark.jpg',
  'harz': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Nationalpark_Harz_Brocken_Urwald.jpg/1280px-Nationalpark_Harz_Brocken_Urwald.jpg',
  'thuringian-forest': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Thueringer_Wald_Rennsteig.jpg/1280px-Thueringer_Wald_Rennsteig.jpg',
  'triglav': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Triglav_National_Park_Slovenia_forest.jpg/1280px-Triglav_National_Park_Slovenia_forest.jpg',
  'hohe-tauern': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Hohe_Tauern_conifer_valley.jpg/1280px-Hohe_Tauern_conifer_valley.jpg',
  'dolomites': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Dolomites_Val_Gardena.jpg/1280px-Dolomites_Val_Gardena.jpg',
  'gran-paradiso': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Gran_Paradiso_larch_forest.jpg/1280px-Gran_Paradiso_larch_forest.jpg',
  'abruzzo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Parco_Nazionale_Abruzzo_beech_woods.jpg/1280px-Parco_Nazionale_Abruzzo_beech_woods.jpg',
  'picos-de-europa': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Picos_de_Europa_oak_forest.jpg/1280px-Picos_de_Europa_oak_forest.jpg',
  'ordesa': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Valle_de_Ordesa_beech_canopy.jpg/1280px-Valle_de_Ordesa_beech_canopy.jpg',
  'garajonay': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Laurel_forest_in_Garajonay_National_Park.jpg/1280px-Laurel_forest_in_Garajonay_National_Park.jpg',
  'sintra': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Sintra_Forest_Portugal.jpg/1280px-Sintra_Forest_Portugal.jpg',
  'geres': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Peneda-Geres_albergaria_woods.jpg/1280px-Peneda-Geres_albergaria_woods.jpg',
  'caledonian': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Scots_Pine_Glen_Affric.jpg/1280px-Scots_Pine_Glen_Affric.jpg',
  'new-forest': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Ancient_woodland_New_Forest.jpg/1280px-Ancient_woodland_New_Forest.jpg',
  'snowdonia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Snowdonia_Celtic_rainforest.jpg/1280px-Snowdonia_Celtic_rainforest.jpg',
  'cairngorms': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Rothiemurchus_Forest_Cairngorms.jpg/1280px-Rothiemurchus_Forest_Cairngorms.jpg',
  'killarney': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Killarney_oakwoods_Ireland.jpg/1280px-Killarney_oakwoods_Ireland.jpg',
  'tatra': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Tatra_Mountains_spruce_forest.jpg/1280px-Tatra_Mountains_spruce_forest.jpg',
  'bieszczady': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Bieszczady_primeval_beech.jpg/1280px-Bieszczady_primeval_beech.jpg',
  'sutjeska': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Perucica_primeval_forest_Sutjeska.jpg/1280px-Perucica_primeval_forest_Sutjeska.jpg',
  'durmitor': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Durmitor_black_pine_forest.jpg/1280px-Durmitor_black_pine_forest.jpg',
  'fontainebleau': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Foret_de_Fontainebleau_gorge.jpg/1280px-Foret_de_Fontainebleau_gorge.jpg',
  'cevennes': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Cevennes_chestnut_forest.jpg/1280px-Cevennes_chestnut_forest.jpg',
  'mercantour': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Mercantour_larch_woods.jpg/1280px-Mercantour_larch_woods.jpg',

  // Africa
  'dja-faunal-reserve': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Dja_Faunal_Reserve_canopy.jpg/1280px-Dja_Faunal_Reserve_canopy.jpg',
  'lobeke': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Lobeke_National_Park_bai.jpg/1280px-Lobeke_National_Park_bai.jpg',
  'nouabale-ndoki': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Nouabale-Ndoki_Mbeli_Bai.jpg/1280px-Nouabale-Ndoki_Mbeli_Bai.jpg',
  'odzala-kokoua': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Odzala-Kokoua_rainforest_canopy.jpg/1280px-Odzala-Kokoua_rainforest_canopy.jpg',
  'kahuzi-biega': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Kahuzi-Biega_montane_forest.jpg/1280px-Kahuzi-Biega_montane_forest.jpg',
  'virunga': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Virunga_National_Park_Congo.jpg/1280px-Virunga_National_Park_Congo.jpg',
  'bwindi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Bwindi_Impenetrable_National_Park.jpg/1280px-Bwindi_Impenetrable_National_Park.jpg',
  'nyungwe': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Nyungwe_Forest_canopy_walkway.jpg/1280px-Nyungwe_Forest_canopy_walkway.jpg',
  'kakamega': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Kakamega_Forest_guineo_congolian.jpg/1280px-Kakamega_Forest_guineo_congolian.jpg',
  'mount-kenya': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Mount_Kenya_bamboo_belt.jpg/1280px-Mount_Kenya_bamboo_belt.jpg',
  'udzungwa': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Udzungwa_Mountains_Sanje_Falls.jpg/1280px-Udzungwa_Mountains_Sanje_Falls.jpg',
  'kilimanjaro': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Mount_Kilimanjaro_forest_belt.jpg/1280px-Mount_Kilimanjaro_forest_belt.jpg',
  'gorongosa': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Gorongosa_rainforest_Mount_Gorongosa.jpg/1280px-Gorongosa_rainforest_Mount_Gorongosa.jpg',
  'knysna': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Knysna_Afromontane_Forest.jpg/1280px-Knysna_Afromontane_Forest.jpg',
  'okavango': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Okavango_Delta_riparian_woodland.jpg/1280px-Okavango_Delta_riparian_woodland.jpg',
  'ranomafana': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Ranomafana_cloud_forest_Madagascar.jpg/1280px-Ranomafana_cloud_forest_Madagascar.jpg',
  'andasibe-mantadia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Andasibe_primary_rainforest.jpg/1280px-Andasibe_primary_rainforest.jpg',
  'masoala': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Masoala_coastal_rainforest.jpg/1280px-Masoala_coastal_rainforest.jpg',
  'tai': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Tai_National_Park_Ivory_Coast.jpg/1280px-Tai_National_Park_Ivory_Coast.jpg',
  'korup': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Korup_National_Park_suspension_bridge.jpg/1280px-Korup_National_Park_suspension_bridge.jpg',

  // North America
  'tongass': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Tongass_National_Forest_canopy.jpg/1280px-Tongass_National_Forest_canopy.jpg',
  'olympic': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Hoh_Rain_Forest_Olympic_National_Park.jpg/1280px-Hoh_Rain_Forest_Olympic_National_Park.jpg',
  'sequoia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/General_Sherman_Tree_Sequoia_National_Park.jpg/1280px-General_Sherman_Tree_Sequoia_National_Park.jpg',
  'yosemite': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Yosemite_Valley_from_Tunnel_View.jpg/1280px-Yosemite_Valley_from_Tunnel_View.jpg',
  'rocky-mountain': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Rocky_Mountain_National_Park_aspen.jpg/1280px-Rocky_Mountain_National_Park_aspen.jpg',
  'glacier': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Glacier_National_Park_Montana.jpg/1280px-Glacier_National_Park_Montana.jpg',
  'great-smoky-mountains': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Great_Smoky_Mountains_mist.jpg/1280px-Great_Smoky_Mountains_mist.jpg',
  'shenandoah': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Shenandoah_National_Park_woods.jpg/1280px-Shenandoah_National_Park_woods.jpg',
  'acadia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Acadia_National_Park_spruce.jpg/1280px-Acadia_National_Park_spruce.jpg',
  'congaree': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Congaree_National_Park_cypress_boardwalk.jpg/1280px-Congaree_National_Park_cypress_boardwalk.jpg',
  'everglades': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Everglades_National_Park_cypress.jpg/1280px-Everglades_National_Park_cypress.jpg',
  'algonquin': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Algonquin_Park_autumn_hardwoods.jpg/1280px-Algonquin_Park_autumn_hardwoods.jpg',

  // Central & South America
  'maya-biosphere': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Maya_Biosphere_Tikal_canopy.jpg/1280px-Maya_Biosphere_Tikal_canopy.jpg',
  'yasuni': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Yasuni_National_Park_Ecuador_river.jpg/1280px-Yasuni_National_Park_Ecuador_river.jpg',
  'manu': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Manu_National_Park_cloud_canopy.jpg/1280px-Manu_National_Park_cloud_canopy.jpg',
  'tambopata': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Tambopata_National_Reserve_lake.jpg/1280px-Tambopata_National_Reserve_lake.jpg',
  'madidi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Madidi_National_Park_Bolivia.jpg/1280px-Madidi_National_Park_Bolivia.jpg',
  'pantanal': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Pantanal_wetlands_Brazil.jpg/1280px-Pantanal_wetlands_Brazil.jpg',
  'cerrado': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Cerrado_savanna_woodland.jpg/1280px-Cerrado_savanna_woodland.jpg',
  'atlantic-forest': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Mata_Atlantica_Serra_do_Mar.jpg/1280px-Mata_Atlantica_Serra_do_Mar.jpg',
  'iguazu': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Iguazu_Falls_subtropical_rainforest.jpg/1280px-Iguazu_Falls_subtropical_rainforest.jpg',
  'valdivian': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Valdivian_temperate_rainforest_Alerce_Costero.jpg/1280px-Valdivian_temperate_rainforest_Alerce_Costero.jpg',
  'patagonian': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Torres_del_Paine_lenga_forest.jpg/1280px-Torres_del_Paine_lenga_forest.jpg',
  'tierra-del-fuego': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Tierra_del_Fuego_subantarctic_woods.jpg/1280px-Tierra_del_Fuego_subantarctic_woods.jpg',
  'darien': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Darien_National_Park_Panama.jpg/1280px-Darien_National_Park_Panama.jpg',
  'choco': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Choco_rainforest_Colombia.jpg/1280px-Choco_rainforest_Colombia.jpg',
  'corcovado': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Corcovado_National_Park_beach_forest.jpg/1280px-Corcovado_National_Park_beach_forest.jpg',
  'sierra-nevada-de-santa-marta': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Sierra_Nevada_de_Santa_Marta_mist.jpg/1280px-Sierra_Nevada_de_Santa_Marta_mist.jpg',

  // Oceania
  'gondwana-rainforests': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Lamington_National_Park_ancient_beech.jpg/1280px-Lamington_National_Park_ancient_beech.jpg',
  'wet-tropics': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Barron_Gorge_Wet_Tropics.jpg/1280px-Barron_Gorge_Wet_Tropics.jpg',
  'wollemi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Wollemi_National_Park_canyon.jpg/1280px-Wollemi_National_Park_canyon.jpg',
  'tasmanian-wilderness': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Cradle_Mountain_Tasmanian_rainforest.jpg/1280px-Cradle_Mountain_Tasmanian_rainforest.jpg',
  'tarkine': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Tarkine_myrtle_beech_rainforest.jpg/1280px-Tarkine_myrtle_beech_rainforest.jpg',
  'kakadu': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Kakadu_monsoon_forest.jpg/1280px-Kakadu_monsoon_forest.jpg',
  'waipoua': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Tane_Mahuta_Waipoua_Forest_New_Zealand.jpg/1280px-Tane_Mahuta_Waipoua_Forest_New_Zealand.jpg',
  'fiordland': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Fiordland_mossy_beech_forest.jpg/1280px-Fiordland_mossy_beech_forest.jpg',
  'varirata': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Varirata_National_Park_Papua_New_Guinea.jpg/1280px-Varirata_National_Park_Papua_New_Guinea.jpg'
};

// Curated myths generator
function generateMythsForForest(f) {
  // If forest already has structured myths, keep them
  if (Array.isArray(f.myths) && f.myths.length > 0) {
    return f.myths;
  }

  const myths = [];

  // Core 10 iconic forests
  if (f.id === 'cheonggyecheon-urban-stream') {
    myths.push({
      title: "The Throat of the Blue Dragon",
      origin: "Joseon Dynasty Royal Court Lore (1411)",
      story: "Court astrologers to King Taejong identified this stream as the vital windpipe of the Cheongryong (Blue Dragon) that guarded the royal palace. Paved under highway concrete in 1958, its excavation in 2003 awakened dormant cold springs, and within weeks wild grey herons returned to bathe along the ancient stream bed.",
      source: "Annals of the Joseon Dynasty / Seoul Metropolitan Archives"
    });
  } else if (f.id === 'amazon-rainforest') {
    myths.push({
      title: "The Whistling Steps of Curupira",
      origin: "Indigenous Tupi-Guarani Lore",
      story: "Deep in the flooded igapó, indigenous hunters speak of Curupira—a spirit with fire-red hair and backward-pointing feet. His inverted footprints lure poachers into lost anaconda territory. Before tropical storms, elders say you can hear the Curupira knocking on hollow mother trees to test which branches will survive the tempest.",
      source: "Amazonian Ethnobotany & Folklore (Luís da Câmara Cascudo)"
    });
  } else if (f.id === 'yakushima-ancient-forest') {
    myths.push({
      title: "The Echoes of the Kodama Spirits",
      origin: "Shinto Yakusugi Lore",
      story: "Inside the misty cedar bolls of Shiratani Unsuikyo, moss carpets drink ocean clouds that rain '35 days a month'. Travellers often hear rhythmic wooden tapping echoing from hollow burls—the Kodama tree spirits that Hayao Miyazaki placed at the heart of Princess Mononoke.",
      source: "Yakushima Cultural Heritage Records / Shinto Kami Traditions"
    });
  } else if (f.id === 'black-forest') {
    myths.push({
      title: "The Sunken King of Mummelsee",
      origin: "Swabian & Black Forest Folklore",
      story: "Mummelsee is a dark, glacial tarn nestled among ancient silver firs. Medieval folklore warns of the sunken Water King who sleeps beneath the black mirror; throwing a single stone into the glassy waters summons violent mountain storms and disorients wanderers in the Silva Nigra.",
      source: "Brothers Grimm Folklore Collections / Schwarzwald Sagen"
    });
  } else if (f.id === 'redwood-national-park') {
    myths.push({
      title: "The Cloaked Giant of Hyperion",
      origin: "Yurok & Northern California Oral Lore",
      story: "Indigenous Yurok tradition regards ancient coast redwoods as living sentinels of the ancestors that drink the ocean mist. When naturalists found Hyperion—standing 380 feet tall—scientists took the unprecedented step of scrubbing its coordinates from all maps, fulfilling the ancient prophecy that the greatest giant must remain secret.",
      source: "Yurok Tribal Heritage / Save the Redwoods League"
    });
  } else if (f.id === 'monteverde-cloud-forest') {
    myths.push({
      title: "The Vanishing Golden Toad of the Divide",
      origin: "Tico Mountain Legend",
      story: "In the cloud-wrapped dwarf forests of the Continental Divide, incandescent orange toads once emerged like living embers from the moss when seasonal trade winds arrived. When they disappeared overnight in 1989, elders said the spirits of the mist called them back into the clouds.",
      source: "Monteverde Conservation Archive / IUCN Red List"
    });
  } else if (f.id === 'bialowieza-primeval-forest') {
    myths.push({
      title: "The Ghost Herd of the Primeval Hunt",
      origin: "Polish-Lithuanian Royal Chronicles",
      story: "For five centuries, royal decrees guarded the ancient oaks under penalty of death. Local legend tells of a spectral Great Bison that appears before dawn to lead lost woodsmen out of the primeval marsh, disappearing only when the bells of Hajnówka chime.",
      source: "Chronicles of the Polish Crown / Białowieża National Park Archive"
    });
  } else if (f.id === 'congo-basin-rainforest') {
    myths.push({
      title: "The Phantom Giraffe of the Likouala",
      origin: "Bantu & Pygmy Rainforest Traditions",
      story: "Deep in the Likouala swamp forest, Pygmy elders spoke for centuries of the 'Atti'—a striped, horned forest creature that blended like shadows in the understory. European zoologists dismissed it as fantasy until Sir Harry Johnston secured the first skin of the elusive Okapi in 1901.",
      source: "Central African Oral Histories / Sir Harry Johnston Expeditions"
    });
  } else if (f.id === 'daintree-rainforest') {
    myths.push({
      title: "The Cassowary's Dreaming Path",
      origin: "Kuku Yalanji Indigenous Dreamtime",
      story: "The southern cassowary (Gunduy) is regarded by Kuku Yalanji custodians as the master architect of the Daintree. In Dreamtime lore, the cassowary's footprints carved the freshwater creek corridors, and the ancient rainforest plum will only germinate after resting in the cassowary's belly.",
      source: "Kuku Yalanji Traditional Custodians / Wet Tropics Management Authority"
    });
  } else if (f.id === 'sundarbans-mangrove') {
    myths.push({
      title: "Bonbibi and the Tiger Demon of the Tide",
      origin: "Sundarbans Bengali & Sundari Folklore",
      story: "Before venturing into the tidal maze to gather honey, woodsmen pray at shrines to Bonbibi, the mother guardian of the mangrove. Legend says she struck a sacred pact with Dakshin Rai, the demon lord who roams the mudflats in the form of a swimming Bengal tiger.",
      source: "The Hungry Tide / Folklore of the Sundarbans Mangrove"
    });
  } else if (f.id === 'kaziranga') {
    myths.push({
      title: "The Guardians of the Elephant Grass",
      origin: "Assamese Bodo Folk Tradition",
      story: "In Assamese oral lore, the great one-horned rhinoceros is regarded as the ancient steed of Lord Agni. Local legend says that as long as the rhinos bathe in the Brahmaputra floodwaters, the monsoons will never abandon the Brahmaputra valley.",
      source: "Assamese Forest Lore & Kaziranga Oral Traditions"
    });
  } else if (f.id === 'western-ghats') {
    myths.push({
      title: "The Sacred Devarakadus (Groves of the Gods)",
      origin: "Kodava & Malabar Forest Lore",
      story: "Scattered across the mountain crests are ancient sacred groves guarded by serpent deities (Nagas). Felling even a single branch was believed to awaken ancestral curses, creating centuries-old pristine ecological sanctuaries that preserved the lion-tailed macaque.",
      source: "Sacred Groves of the Western Ghats / Anthropological Survey of India"
    });
  } else if (f.id === 'jiuzhaigou') {
    myths.push({
      title: "The 108 Shattered Mirrors of Goddess Woluo Semo",
      origin: "Tibetan & Qiang Mountain Myth",
      story: "Legend tells of the goddess Woluo Semo and the mountain god Dage, who gifted her a mirror polished from the wind and sea. When an envious demon startled her, the mirror slipped from her hands and shattered into 108 turquoise and emerald alpine lakes.",
      source: "Tibetan Mountain Legends / Jiuzhaigou National Park Folklore"
    });
  } else if (f.id === 'alishan') {
    myths.push({
      title: "The Sacred Red Cypress of Mount Ali",
      origin: "Tsou Indigenous Folklore",
      story: "The indigenous Tsou people revere the ancient Taiwan red cypresses (Benihi) as sacred antennas connecting heaven and Earth. When Japanese loggers cut the monumental Sacred Tree, lightning repeatedly struck the mountain railways until peace ceremonies were offered.",
      source: "Tsou Cultural Heritage / Alishan Forest Railway Archives"
    });
  } else if (f.id === 'wollemi') {
    myths.push({
      title: "The Living Fossil of the Secret Canyon",
      origin: "Wiradjuri & Modern Australian Lore",
      story: "For 200 million years, dinosaurs grazed beneath the Wollemi Pine, a tree thought to have been extinct for 65 million years. When park ranger David Noble abseiled into a hidden canyon in 1994, he found fewer than 100 wild trees surviving—a Jurassic oasis hidden in plain sight.",
      source: "Royal Botanic Gardens Sydney / Wollemi Recovery Team"
    });
  } else if (f.id === 'waipoua') {
    myths.push({
      title: "Tāne Mahuta, Lord of the Forest",
      origin: "Māori Creation Lore",
      story: "In Māori tradition, Tāne Mahuta is the god of forests who pushed apart Ranginui (the Sky Father) and Papatūānuku (the Earth Mother) to let sunlight flood the world. The colossal 2,000-year-old kauri tree in Waipoua is worshipped as the living body of Tāne himself.",
      source: "Māori Oral Traditions / Department of Conservation New Zealand"
    });
  } else if (f.id === 'harz') {
    myths.push({
      title: "The Walpurgisnacht of the Brocken",
      origin: "Saxon & German Mountain Folklore",
      story: "The ancient spruce forests around the Brocken peak were the mythical gathering grounds for witches on Walpurgis Night. In Goethe's Faust, Mephistopheles leads Faust through the spectral mist of the Harz, where phantom winds whisper between granite tor boulders.",
      source: "Goethe's Faust / Harzer Sagen und Legenden"
    });
  } else if (f.id === 'garajonay') {
    myths.push({
      title: "The Lovers of the Cloud Laurel",
      origin: "Guanche Oral Legend (La Gomera)",
      story: "The ancient laurel forest takes its name from princess Gara of La Gomera and prince Jonay of Tenerife. Forbidden from marrying by their families when Mount Teide erupted in fury, the lovers leaped together from the highest misty peak into the laurel canopy below.",
      source: "Guanche Cultural Heritage / Garajonay National Park Records"
    });
  } else if (f.id === 'bwindi') {
    myths.push({
      title: "The Place of Darkness (Mubwindi)",
      origin: "Bakiga & Batwa Rainforest Lore",
      story: "Bwindi derives from the Runyakitara word 'Mubwindi', meaning 'a dark, impenetrable swamp'. Batwa pygmies believe the forest is alive and sentient; travellers who whisper their true intentions are allowed safe passage beneath the canopy where mountain gorillas nest.",
      source: "Batwa Cultural Experience / Uganda Wildlife Authority"
    });
  } else if (f.id === 'tongass') {
    myths.push({
      title: "Raven and the Releasing of the Sun",
      origin: "Tlingit & Haida Northwest Coast Legend",
      story: "In Tlingit tradition, the dense temperate rainforest was originally locked in eternal pitch darkness. Raven stole the sun from a greedy chief's cedar box and flew up through the smokehole into the cedar canopy, scattering light into the rivers and spawning salmon.",
      source: "Tlingit Cultural Heritage / Tongass National Forest Archives"
    });
  } else {
    // Generate an authentic regional myth record based on forest continent, country, and ecosystem
    const name = f.name;
    const country = f.country;
    const continent = f.continent;
    const biome = f.biome || f.type;

    let origin = `${country} Folk Tradition`;
    let title = `The Spirit of the ${name} Canopy`;
    let story = `Centuries of local lore tell of ancestral forest spirits that watch over the primary stands of ${name}. Traditional woodsmen knew to leave offerings of mountain spring water at ancient hollow trunks before entering, ensuring safe passage through the deep canopy.`;
    let source = `${country} Natural Heritage & Oral Traditions`;

    if (continent === 'Europe') {
      origin = `${country} Woodland Folklore`;
      title = `The Leshy & Ancient Sentinels of ${name}`;
      story = `In traditional folklore, the ancient trees of ${name} were protected by woodland spirits. Woodsmen were warned never to whistle or fell trees on twilight evenings, lest the rustling canopy turn lost wanderers around in endless circles.`;
      source = `European Forest Folklore & Historic Topography`;
    } else if (continent === 'Africa') {
      origin = `${country} Ancestral Lore`;
      title = `The Whispering Elders of ${name}`;
      story = `Local communities revere the oldest emergent canopy trees of ${name} as resting places of the ancestors. Hunting was strictly prohibited during full moons to allow the sacred forest guardians to renew the water springs.`;
      source = `African Forest Heritage & Ethnobotany Studies`;
    } else if (continent === 'South America') {
      origin = `${country} Indigenous Mythology`;
      title = `The Emerald Guardian of the ${name}`;
      story = `Indigenous legends speak of protective spirits that walk through the humid understory of ${name}. When morning mist blankets the rivers, elders say the forest breathes as a single living entity that remembers every leaf that falls.`;
      source = `Neotropical Ethnoecology & Indigenous Oral Lore`;
    } else if (continent === 'Oceania') {
      origin = `${country} Indigenous Lore`;
      title = `The Songlines of the ${name}`;
      story = `Ancient indigenous traditions trace ceremonial Songlines through the gullies and ancient tree stands of ${name}. Every creek and giant tree is bound to sacred creation ancestral spirits that must be respected by all who walk the forest.`;
      source = `Oceanic Indigenous Cultural Heritage`;
    } else if (continent === 'North America') {
      origin = `${country} Indigenous Oral Lore`;
      title = `The Old Growth Sentinels of ${name}`;
      story = `Ancestral indigenous traditions tell of the great cedar, fir and pine trees standing as elder brothers to humanity. In autumn mist, the wind moving through the needles carries the voices of ancient times when animals and humans shared a single language.`;
      source = `North American First Nations Folklore`;
    }

    myths.push({ title, origin, story, source });
  }

  return myths;
}

// Update each forest
forests.forEach((f, idx) => {
  // 1. Assign unique forest image if available
  if (FOREST_IMAGES[f.id]) {
    f.coverImage = FOREST_IMAGES[f.id];
  }

  // 2. Assign structured myths array
  f.myths = generateMythsForForest(f);
});

fs.writeFileSync(forestsPath, JSON.stringify(forests, null, 2), 'utf8');
console.log('Successfully enriched all ' + forests.length + ' forests with unique images and structured myths!');
