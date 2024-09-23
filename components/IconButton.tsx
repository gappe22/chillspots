import { useState } from "react";
import { GestureResponderEvent, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";
import Svg, { SvgUri } from 'react-native-svg'

export default function IconButton({
    uri,
    size,
    onPress,
    style
  }: {
    uri: string,
    size: number,
    onPress?: (e: GestureResponderEvent) => void,
    style?: StyleProp<ViewStyle>
  }
) {
  const [pressed, setPressed] = useState(false);
  const styles = StyleSheet.create({
    background: {
      backgroundColor: 'white',
      borderWidth: 1.5,
      borderBlockColor: 'black',
      borderRadius: 50,
  
      shadowRadius: 4,
      shadowOpacity: 0.45,
      shadowOffset: {width: 2, height: 2},
  
      padding: 10,
  
      marginHorizontal: 5,
    },
  })

  //const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

  return (
    <Pressable
      style={[styles.background, style, pressed ? {backgroundColor: 'lightgrey'} : {}]}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
    >
        <SvgUri width={size} height={size} uri={uri}></SvgUri>
    </Pressable>
  );
}