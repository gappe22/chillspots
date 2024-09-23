import { useState } from "react";
import { GestureResponderEvent, Pressable, StyleSheet, Text } from "react-native";
import Animated, { useSharedValue } from "react-native-reanimated";

export default function TextButton({
    text,
    size,
    onPress
  }: {
    text: string,
    size?: number,
    onPress?: (e: GestureResponderEvent) => void
  }
) {
  const [pressed, setPressed] = useState(false);
  const styles = StyleSheet.create({
    background: {
      backgroundColor: 'white',
      borderWidth: 1.5,
      borderBlockColor: 'black',
      borderRadius: 6.5,
  
      shadowRadius: 4,
      shadowOpacity: 0.45,
      shadowOffset: {width: 2, height: 2},
  
      paddingVertical: 4,
      paddingHorizontal: 5,
  
      marginHorizontal: 5,
    },
    text: {
      fontSize: 14,
      color: 'black'
    }
  })

  //const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

  return (
    <Pressable
      style={[styles.background, pressed ? {backgroundColor: 'lightgrey'} : {}]}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
    >
      <Text style={[styles.text, {fontSize: size}]}>{text}</Text>
    </Pressable>
  );
}