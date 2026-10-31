import { Stack } from "expo-router";
import { useFonts } from 'expo-font';
import { ActivityIndicator, View } from 'react-native';
import { theme } from '@/components/chillspots/theme';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Inter-Regular': require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
    'Inter-Medium': require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
    'Inter-SemiBold': require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
    'Inter-Bold': require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
    'Inter-Black': require('@expo-google-fonts/inter/900Black/Inter_900Black.ttf'),
  });
  if (!loaded && !error) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.paper }}><ActivityIndicator color={theme.green} /></View>;
  return (
    <><StatusBar style="dark" />
    <Stack screenOptions={{
      headerShown: false
    }}>
      <Stack.Screen name="index" options={{title: "ChillSpots"}} />
    </Stack>
    </>
  );
}
