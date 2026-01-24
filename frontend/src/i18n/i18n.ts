import { Language, I18nMessages } from '@types/index';
import ptBR from './pt-br.json';
import en from './en.json';
import es from './es.json';

const messages: Record<Language, I18nMessages> = {
  'pt-BR': ptBR,
  'en': en,
  'es': es,
};

let currentLanguage: Language = 'pt-BR';

/**
 * Define idioma atual
 */
export function setLanguage(language: Language): void {
  if (messages[language]) {
    currentLanguage = language;
    localStorage.setItem('language', language);
  }
}

/**
 * Obtém idioma atual
 */
export function getLanguage(): Language {
  const saved = localStorage.getItem('language') as Language;
  if (saved && messages[saved]) {
    currentLanguage = saved;
  }
  return currentLanguage;
}

/**
 * Obtém mensagem traduzida
 */
export function t(key: string, params?: Record<string, string>): string {
  const keys = key.split('.');
  let value: any = messages[currentLanguage];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Retorna a chave se não encontrar
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  // Substitui parâmetros
  if (params) {
    let result = value;
    for (const [key, val] of Object.entries(params)) {
      result = result.replace(`{${key}}`, val);
    }
    return result;
  }

  return value;
}

/**
 * Obtém todas as mensagens do idioma atual
 */
export function getMessages(): I18nMessages {
  return messages[currentLanguage];
}

/**
 * Obtém idiomas disponíveis
 */
export function getAvailableLanguages(): Language[] {
  return Object.keys(messages) as Language[];
}

/**
 * Inicializa i18n
 */
export function initI18n(): void {
  const saved = localStorage.getItem('language') as Language;
  if (saved && messages[saved]) {
    currentLanguage = saved;
  } else {
    // Detecta idioma do navegador
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('pt')) {
      currentLanguage = 'pt-BR';
    } else if (browserLang.startsWith('es')) {
      currentLanguage = 'es';
    } else {
      currentLanguage = 'en';
    }
  }
}

export default {
  t,
  setLanguage,
  getLanguage,
  getMessages,
  getAvailableLanguages,
  initI18n,
};
