// NOTE: These values are for the hosted production API.
// This API key is rate-limited and intended for public use.
// For self-hosting, replace these with your own backend URL and API key.
// See SELF_HOSTING.md for instructions.

export const API_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "";

const BASE_URL = API_URL.replace(/\/api\/speech$/, "");
export const VOICE_CHAT_URL = `${BASE_URL}/api/voice-chat`;
export const VOICE_CHAT_INTRO_URL = `${BASE_URL}/api/voice-chat/intro`;
export const TRANSLATE_URL = `${BASE_URL}/api/translate`;
export const USER_URL = `${BASE_URL}/api/user`;
