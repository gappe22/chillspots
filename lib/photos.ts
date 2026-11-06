import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

function pickWebFile(): Promise< { uri: string; width: number; height: number } | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    let settled = false;
    const finish = (value: { uri: string; width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.addEventListener('cancel', () => finish(null));
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { finish(null); return; }
      const reader = new FileReader();
      reader.onerror = () => finish(null);
      reader.onload = () => {
        const uri = typeof reader.result === 'string' ? reader.result : '';
        if (!uri) { finish(null); return; }
        const img = new window.Image();
        img.onload = () => finish({ uri, width: img.naturalWidth || img.width || 1200, height: img.naturalHeight || img.height || 900 });
        img.onerror = () => finish(null);
        img.src = uri;
      };
      reader.readAsDataURL(file);
    });
    input.click();
  });
}

export async function pickPhoto(): Promise<string | null> {
  let asset: { uri: string; width: number; height: number } | null = null;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    asset = await pickWebFile();
  } else {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 1 });
    if (!result.canceled && result.assets[0]) asset = result.assets[0];
  }
  if (!asset) return null;
  const w = asset.width || 1200;
  const h = asset.height || 900;
  const resize = w >= h ? { width: Math.min(w, 1600) } : { height: Math.min(h, 1600) };
  let image = await ImageManipulator.manipulateAsync(asset.uri, [{ resize }], { format: ImageManipulator.SaveFormat.JPEG, compress: .75, base64: true });
  if ((image.base64?.length ?? Infinity) > 1398104) image = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: w >= h ? { width: 1000 } : { height: 1000 } }], { format: ImageManipulator.SaveFormat.JPEG, compress: .5, base64: true });
  if (!image.base64 || image.base64.length > 1398104) throw new Error('La foto è troppo grande. Prova con un’altra immagine.');
  return `data:image/jpeg;base64,${image.base64}`;
}
