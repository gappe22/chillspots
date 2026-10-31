import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { Coordinate } from '@/components/chillspots/mapHelpers';
export async function locate(): Promise<Coordinate> {
  if (Platform.OS === 'web') return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('La posizione non è disponibile in questo browser.'));
    navigator.geolocation.getCurrentPosition(position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }), () => reject(new Error('Posizione non disponibile. Consenti l’accesso nelle impostazioni del dispositivo oppure esplora la mappa.')), { timeout: 15000, maximumAge: 60000 });
  });
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Consenti l’accesso alla posizione per trovare gli spot vicini a te.');
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}
