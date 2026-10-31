import { Asset } from 'expo-asset';
import type { ImageSourcePropType } from 'react-native';

const images: Record<string, number> = {
  mountain: require('../../assets/figma/spot-imgRectangle33.png'),
  signpost: require('../../assets/figma/spot-imgRectangle34.png'),
  hiker: require('../../assets/figma/spot-imgRectangle35.png'),
  profile: require('../../assets/figma/home-imgProfilePic.png'),
  scobe: require('../../assets/figma/spot-imgEllipse12.png'),
  mark: require('../../assets/figma/spot-imgEllipse13.png'),
  marker: require('../../assets/figma/home-imgEllipse9.png'),
};

export function imageFor(key: string = 'mountain'): ImageSourcePropType {
  return key.startsWith('data:image/') ? { uri: key } : images[key] ?? images.mountain;
}

export function imageUri(key: string = 'mountain'): string {
  return key.startsWith('data:image/') ? key : Asset.fromModule(images[key] ?? images.mountain).uri;
}
