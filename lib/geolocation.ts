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

export async function reverseGeocode({ latitude, longitude }: Coordinate): Promise<string> {
  const fallback = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=14&accept-language=it`);
    if (response.ok) {
      const data = await response.json() as { address?: Record<string, string>; name?: string };
      const addr = data.address ?? {};
      const place = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || addr.suburb || addr.locality || data.name;
      const area = addr.county || addr.province || addr.state;
      const parts = [place, area].filter((item, idx, arr) => item && arr.indexOf(item) === idx);
      if (parts.length) return parts.join(', ').slice(0, 120);
    }
  } catch {}
  if (Platform.OS !== 'web') {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results[0]) {
        const parts = [results[0].city || results[0].name, results[0].subregion || results[0].region].filter(Boolean);
        if (parts.length) return parts.join(', ').slice(0, 120);
      }
    } catch {}
  }
  return fallback;
}
