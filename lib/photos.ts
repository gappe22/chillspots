import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
export async function pickPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 1 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const resize = asset.width >= asset.height ? { width: Math.min(asset.width, 1600) } : { height: Math.min(asset.height, 1600) };
  let image = await ImageManipulator.manipulateAsync(asset.uri, [{ resize }], { format: ImageManipulator.SaveFormat.JPEG, compress: .75, base64: true });
  if ((image.base64?.length ?? Infinity) > 1398104) image = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: asset.width >= asset.height ? { width: 1000 } : { height: 1000 } }], { format: ImageManipulator.SaveFormat.JPEG, compress: .5, base64: true });
  if (!image.base64 || image.base64.length > 1398104) throw new Error('La foto è troppo grande. Prova con un’altra immagine.');
  return `data:image/jpeg;base64,${image.base64}`;
}
