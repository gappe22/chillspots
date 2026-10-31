import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Preferences } from '@/shared/types';
export const defaultPreferences: Preferences = { distanceUnit: 'km', defaultView: 'map', reduceMotion: false };
const key = 'chillspots.preferences';
export async function readPreferences(): Promise<Preferences> {
  try {
    const raw = Platform.OS === 'web' ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
    const value = raw ? JSON.parse(raw) : {};
    return { distanceUnit: value.distanceUnit === 'mi' ? 'mi' : 'km', defaultView: value.defaultView === 'list' ? 'list' : 'map', reduceMotion: value.reduceMotion === true };
  } catch { return defaultPreferences; }
}
export async function writePreferences(value: Preferences) {
  if (Platform.OS === 'web') { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Browsing still works when browser storage is unavailable. */ } }
  else await SecureStore.setItemAsync(key, JSON.stringify(value));
}
