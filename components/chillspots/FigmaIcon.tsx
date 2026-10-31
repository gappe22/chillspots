import { Asset } from 'expo-asset';
import { Image, Platform, View } from 'react-native';
import { SvgUri } from 'react-native-svg';

// The downloaded SVGs retain their original dimensions and shadow margins.
const icons = {
  star: { source: require('../../assets/figma/spot-imgStar.svg'), width: 14.0097, height: 14.0097 },
  shield: { source: require('../../assets/figma/spot-imgShield.svg'), width: 18, height: 18 },
  path: { source: require('../../assets/figma/spot-imgPathIcon.svg'), width: 16, height: 16 },
  info: { source: require('../../assets/figma/spot-imgInfo2.svg'), width: 15, height: 15 },
  addComment: { source: require('../../assets/figma/spot-imgAddComment.svg'), width: 45.2377, height: 45.2377 },
  search: { source: require('../../assets/figma/home-imgSearchButton.svg'), width: 59.3046, height: 59.3046, slot: 43.3046, left: -8, top: -6 },
  searchIcon: { source: require('../../assets/figma/search-imgSearchIcon.svg'), width: 17.2969, height: 17.216 },
  back: { source: require('../../assets/figma/spot-imgBackButton.svg'), width: 56, height: 56, slot: 40, left: -8, top: -6 },
  plus: { source: require('../../assets/figma/home-imgPlusIconButton.svg'), width: 44, height: 44, slot: 37, left: -3.5, top: -3.5 },
  progress: { source: require('../../assets/figma/home-imgProgressBar.svg'), width: 69.603, height: 69.603 },
  progressBack: { source: require('../../assets/figma/home-imgProgressBar1.svg'), width: 69.603, height: 69.603 },
  profileLight: { source: require('../../assets/figma/home-imgRadialLighten.svg'), width: 68.0877, height: 68.0877 },
};
export type FigmaIconName = keyof typeof icons;

export function FigmaIcon({ name, size }: { name: FigmaIconName; size?: number }) {
  const icon = icons[name];
  const slot = 'slot' in icon ? icon.slot : icon.width;
  const scale = (size ?? slot) / slot;
  const width = icon.width, height = icon.height;
  return <View pointerEvents="none" style={{ width: size ?? slot, height: size ?? slot, overflow: 'visible' }}>
    <View style={{ position: 'absolute', width, height, left: ('left' in icon ? icon.left : 0) + (width * scale - width) / 2, top: ('top' in icon ? icon.top : 0) + (height * scale - height) / 2, transform: [{ scale }] }}>
      {Platform.OS === 'web'
        ? <Image source={icon.source} style={{ width, height }} accessibilityElementsHidden />
        : <SvgUri uri={Asset.fromModule(icon.source).uri} />}
    </View>
  </View>;
}
