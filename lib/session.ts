import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const key = 'chillspots.session';
export async function readSession() {
  return Platform.OS === 'web' ? null : SecureStore.getItemAsync(key);
}
export async function saveSession(token: string | null) {
  if (Platform.OS === 'web') return;
  if (token) await SecureStore.setItemAsync(key, token);
  else await SecureStore.deleteItemAsync(key);
}
