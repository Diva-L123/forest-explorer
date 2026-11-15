'use strict';

import { state, emit } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { $$ } from '../utils/dom.js';

const DICTIONARY = {
  en: {
    site_title: 'Forest Explorer',
    site_tagline: 'Every forest has a story',
    home: 'Home',
    forests: 'Forests',
    map: 'Map',
    wildlife: 'Wildlife',
    discoveries: 'Discoveries',
    stories: 'Stories',
    deeptime: 'Deep Time',
    impact: 'Impact',
    about: 'About',
    compare: 'Compare',
    compare_btn: 'Compare Forests',
    save_btn: 'Save to journal',
    saved: 'Saved',
    locate_me: 'Locate Nearest Forest',
    species_layer: 'Species Layer',
    soundscape: 'Soundscape',
    offline_mode: 'Field Mode (Offline)',
    download_pack: 'Download Offline Pack',
    export_journal: 'Export Journal',
    export_json: 'Download JSON',
    export_pdf: 'Print / Save PDF',
    search_placeholder: 'Search forests, wildlife, stories...',
    quiz_title: 'Field Knowledge Quiz',
    badges_title: 'Expedition Badges'
  },
  es: {
    site_title: 'Explorador Forestal',
    site_tagline: 'Cada bosque tiene una historia',
    home: 'Inicio',
    forests: 'Bosques',
    map: 'Mapa',
    wildlife: 'Fauna',
    discoveries: 'Descubrimientos',
    stories: 'Historias',
    deeptime: 'Tiempo Profundo',
    impact: 'Impacto',
    about: 'Acerca de',
    compare: 'Comparar',
    compare_btn: 'Comparar Bosques',
    save_btn: 'Guardar en diario',
    saved: 'Guardado',
    locate_me: 'Localizar Bosque Cercano',
    species_layer: 'Capa de Especies',
    soundscape: 'Paisaje Sonoro',
    offline_mode: 'Modo de Campo (Offline)',
    download_pack: 'Descargar Paquete Offline',
    export_journal: 'Exportar Diario',
    export_json: 'Descargar JSON',
    export_pdf: 'Imprimir / Guardar PDF',
    search_placeholder: 'Buscar bosques, fauna, relatos...',
    quiz_title: 'Cuestionario de Campo',
    badges_title: 'Insignias de Expedición'
  },
  fr: {
    site_title: 'Explorateur de Forêts',
    site_tagline: 'Chaque forêt a une histoire',
    home: 'Accueil',
    forests: 'Forêts',
    map: 'Carte',
    wildlife: 'Faune',
    discoveries: 'Découvertes',
    stories: 'Récits',
    deeptime: 'Temps Profond',
    impact: 'Impact',
    about: 'À propos',
    compare: 'Comparer',
    compare_btn: 'Comparer les Forêts',
    save_btn: 'Sauvegarder au journal',
    saved: 'Sauvegardé',
    locate_me: 'Trouver la Forêt la Plus Proche',
    species_layer: 'Couche des Espèces',
    soundscape: 'Paysage Sonore',
    offline_mode: 'Mode Terrain (Hors Ligne)',
    download_pack: 'Télécharger Pack Hors Ligne',
    export_journal: 'Exporter le Journal',
    export_json: 'Télécharger JSON',
    export_pdf: 'Imprimer / Sauvegarder PDF',
    search_placeholder: 'Rechercher forêts, faune, récits...',
    quiz_title: 'Quiz de Terrain',
    badges_title: "Badges d'Expédition"
  },
  de: {
    site_title: 'Wald-Entdecker',
    site_tagline: 'Jeder Wald hat eine Geschichte',
    home: 'Start',
    forests: 'Wälder',
    map: 'Karte',
    wildlife: 'Tierwelt',
    discoveries: 'Entdeckungen',
    stories: 'Geschichten',
    deeptime: 'Urzeit',
    impact: 'Einfluss',
    about: 'Über uns',
    compare: 'Vergleichen',
    compare_btn: 'Wälder Vergleichen',
    save_btn: 'Im Tagebuch speichern',
    saved: 'Gespeichert',
    locate_me: 'Nächsten Wald Finden',
    species_layer: 'Artenebene',
    soundscape: 'Klanglandschaft',
    offline_mode: 'Feldmodus (Offline)',
    download_pack: 'Offline-Paket Herunterladen',
    export_journal: 'Tagebuch Exportieren',
    export_json: 'JSON Herunterladen',
    export_pdf: 'Drucken / PDF Speichern',
    search_placeholder: 'Wälder, Tierwelt und Geschichten suchen...',
    quiz_title: 'Feld-Wissensquiz',
    badges_title: 'Expeditions-Abzeichen'
  },
  ja: {
    site_title: '森林エクスプローラー',
    site_tagline: 'すべての森に、物語がある',
    home: 'ホーム',
    forests: '森林',
    map: 'マップ',
    wildlife: '野生生物',
    discoveries: '発見',
    stories: '物語',
    deeptime: '太古の時代',
    impact: '保全と影響',
    about: '概要',
    compare: '比較',
    compare_btn: '森林を比較',
    save_btn: '日誌に保存',
    saved: '保存済み',
    locate_me: '最も近い森林を探す',
    species_layer: '生息種レイヤー',
    soundscape: '環境音',
    offline_mode: 'フィールドモード (オフライン)',
    download_pack: 'オフラインパックを保存',
    export_journal: '日誌を書き出し',
    export_json: 'JSONダウンロード',
    export_pdf: '印刷 / PDF保存',
    search_placeholder: '森林、野生動物、物語を検索...',
    quiz_title: 'フィールドクイズ',
    badges_title: '探検バッジ'
  }
};

export function t(key) {
  const lang = state.currentLanguage || 'en';
  return DICTIONARY[lang]?.[key] || DICTIONARY.en[key] || key;
}

export function setLanguage(lang) {
  if (!DICTIONARY[lang]) lang = 'en';
  state.currentLanguage = lang;
  localStorage.setItem(CONFIG.STORAGE.language, lang);

  // Update translatable elements in DOM
  $$('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  emit('i18n:change', lang);
}

export function initI18n() {
  const saved = localStorage.getItem(CONFIG.STORAGE.language) || navigator.language.slice(0, 2);
  setLanguage(DICTIONARY[saved] ? saved : 'en');
}
