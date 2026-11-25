import { trackEvent } from './analytics.js?v=analytics-4';

const STORAGE_KEY = '13fathers_lang';
const DEFAULT_LANG = 'en';
const LANGUAGES = {
  en: { flag: '🇬🇧', label: 'English' },
  ka: { flag: '🇬🇪', label: 'ქართული' },
  ru: { flag: '🇷🇺', label: 'Русский' }
};

export function getRouteFromLocation(pathname = window.location.pathname) {
  const segments = String(pathname || '/').split('/').filter(Boolean);
  let lang = null;
  let monkId = document.documentElement.dataset.monkId || null;

  if (segments[0] && Object.prototype.hasOwnProperty.call(LANGUAGES, segments[0])) {
    lang = segments[0];
    if (!monkId && segments[1] && segments[1] !== 'index.html') {
      monkId = segments[1];
    }
  } else if (segments[0] && segments[0] !== 'index.html') {
    lang = DEFAULT_LANG;
    if (!monkId) {
      monkId = segments[0];
    }
  }

  return { lang, monkId };
}

export function buildLocalizedPath(lang, monkId = null) {
  const safeLang = Object.prototype.hasOwnProperty.call(LANGUAGES, lang) ? lang : DEFAULT_LANG;
  const parts = [];
  if (safeLang !== DEFAULT_LANG) parts.push(safeLang);
  if (monkId) parts.push(monkId);
  return parts.length ? `/${parts.join('/')}/` : '/';
}

class I18nManager {
  constructor() {
    this.currentLang = this.getInitialLanguage();
    this.cache = new Map();
    this.dictionary = {};
    this.listeners = new Set();
    this.pendingRequest = null;
  }

  getInitialLanguage() {
    const { lang: routeLang } = getRouteFromLocation();
    if (routeLang) return routeLang;
    return this.getSavedLanguage();
  }

  getSavedLanguage() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && Object.prototype.hasOwnProperty.call(LANGUAGES, saved)) {
        return saved;
      }
    } catch {
      // Ignore storage access errors in restricted modes
    }
    return DEFAULT_LANG;
  }

  saveLanguage(lang) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage access errors in restricted modes
    }
  }

  async loadLocale(lang) {
    if (this.cache.has(lang)) {
      return this.cache.get(lang);
    }

    const response = await fetch(`./data/locales/${lang}.json`, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load locale "${lang}": ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.cache.set(lang, data);
    return data;
  }

  getValue(keyPath, source = this.dictionary) {
    if (!keyPath || !source) return undefined;
    return keyPath.split('.').reduce((acc, part) => (
      acc && Object.prototype.hasOwnProperty.call(acc, part) ? acc[part] : undefined
    ), source);
  }

  t(keyPath, fallback = '') {
    const val = this.getValue(keyPath);
    return typeof val === 'string' ? val : fallback;
  }

  applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      const translated = this.getValue(key);
      if (typeof translated === 'string') {
        element.textContent = translated;
      }
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      const key = element.getAttribute('data-i18n-placeholder');
      const translated = this.getValue(key);
      if (typeof translated === 'string') {
        element.setAttribute('placeholder', translated);
      }
    });

    root.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
      const key = element.getAttribute('data-i18n-aria-label');
      const translated = this.getValue(key);
      if (typeof translated === 'string') {
        element.setAttribute('aria-label', translated);
      }
    });
  }

  async setLanguage(lang, { persist = true } = {}) {
    const targetLang = Object.prototype.hasOwnProperty.call(LANGUAGES, lang) ? lang : DEFAULT_LANG;
    const request = this.loadLocale(targetLang);
    this.pendingRequest = request;

    try {
      const dictionary = await request;
      if (this.pendingRequest !== request) return;

      this.currentLang = targetLang;
      this.dictionary = dictionary;
      if (persist) this.saveLanguage(targetLang);

      document.documentElement.lang = targetLang;
      this.updateSwitcherUI();
      this.applyTranslations();
      this.listeners.forEach((listener) => listener(targetLang, dictionary));
    } catch (error) {
      console.error(`Unable to switch language to "${targetLang}"`, error);
    }
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  updateSwitcherUI() {
    const currentFlag = document.getElementById('language-current-flag');
    if (currentFlag && LANGUAGES[this.currentLang]) {
      currentFlag.textContent = LANGUAGES[this.currentLang].flag;
    }

    document.querySelectorAll('.language-option').forEach((button) => {
      const isSelected = button.dataset.lang === this.currentLang;
      button.classList.toggle('is-active', isSelected);
      button.setAttribute('aria-selected', String(isSelected));
    });
  }

  closeMenu() {
    const container = document.getElementById('language-switch');
    const toggle = document.getElementById('language-toggle');
    const menu = document.getElementById('language-menu');
    if (!container || !toggle || !menu) return;

    container.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
  }

  toggleMenu() {
    const container = document.getElementById('language-switch');
    const toggle = document.getElementById('language-toggle');
    const menu = document.getElementById('language-menu');
    if (!container || !toggle || !menu) return;

    const willOpen = menu.hidden;
    container.classList.toggle('is-open', willOpen);
    toggle.setAttribute('aria-expanded', String(willOpen));
    menu.hidden = !willOpen;
  }

  bindSwitcher() {
    const container = document.getElementById('language-switch');
    const toggle = document.getElementById('language-toggle');
    const menu = document.getElementById('language-menu');
    if (!container || !toggle || !menu) return;

    this.updateSwitcherUI();

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleMenu();
    });

    menu.querySelectorAll('.language-option').forEach((option) => {
      option.addEventListener('click', (event) => {
        event.stopPropagation();
        const selectedLang = option.dataset.lang;
        this.closeMenu();
        if (selectedLang && selectedLang !== this.currentLang) {
          const fromLang = this.currentLang;
          trackEvent('language_switch', {
            from_lang: fromLang,
            to_lang: selectedLang
          });
          void this.setLanguage(selectedLang);
        }
      });
    });

    document.addEventListener('click', (event) => {
      if (!container.contains(event.target)) {
        this.closeMenu();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !menu.hidden) {
        this.closeMenu();
        toggle.focus();
      }
    });
  }

  async init() {
    this.bindSwitcher();
    await this.setLanguage(this.currentLang, { persist: false });
  }
}

export const i18n = new I18nManager();
