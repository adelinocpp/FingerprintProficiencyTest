import { createContext, useContext, useState, ReactNode } from 'react';
import { Language, I18nMessages } from '../types/index';
import ptBR from './pt-br.json';
import en from './en.json';
import es from './es.json';

const messages: Record<Language, I18nMessages> = {
  'pt-BR': ptBR,
  'en': en,
  'es': es,
};

let currentLanguage: Language = 'pt-BR';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('language') as Language;
    if (saved && messages[saved]) {
      currentLanguage = saved;
      return saved;
    }
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('pt')) {
      currentLanguage = 'pt-BR';
      return 'pt-BR';
    } else if (browserLang.startsWith('es')) {
      currentLanguage = 'es';
      return 'es';
    }
    currentLanguage = 'en';
    return 'en';
  });

  const handleSetLanguage = (lang: Language) => {
    if (messages[lang]) {
      currentLanguage = lang;
      setLang(lang);
      localStorage.setItem('language', lang);
    }
  };

  const translate = (key: string, params?: Record<string, string>): string => {
    const keys = key.split('.');
    let value: any = messages[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    if (params) {
      let result = value;
      for (const [key, val] of Object.entries(params)) {
        result = result.replace(`{${key}}`, val);
      }
      return result;
    }

    return value;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage: handleSetLanguage, t: translate }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
