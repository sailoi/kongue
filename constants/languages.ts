export interface Language {
  id: string;
  name: string;
  flag: string;
  targetLanguage: string;
  baseLanguage: string;
  voiceGender: {
    male: string;
    female: string;
  };
}

export const LANGUAGES: Language[] = [
  {
    id: 'spanish',
    name: 'Spanish',
    flag: '🇪🇸',
    targetLanguage: 'Spanish',
    baseLanguage: 'English',
    voiceGender: {
      male: 'es-ES-Wavenet-D',
      female: 'es-ES-Wavenet-B',
    },
  },
  {
    id: 'turkish',
    name: 'Turkish',
    flag: '🇹🇷',
    targetLanguage: 'Turkish',
    baseLanguage: 'English',
    voiceGender: {
      male: 'tr-TR-Wavenet-B',
      female: 'tr-TR-Wavenet-A',
    },
  },
];

export const DEFAULT_LANGUAGE = 'spanish';
