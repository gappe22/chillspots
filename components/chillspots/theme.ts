import { Platform, type ViewStyle } from 'react-native';

export const theme = {
  paper: '#F6F7ED', white: '#F6F7ED', ink: '#001F3F', muted: '#1E488F', line: '#001F3F26',
  blue: '#1E488F', blueSoft: '#1E488F0D', lime: '#DBE64C', green: '#00804C', mantis: '#74C365', danger: '#001F3F',
};
export const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
export const hardShadow: ViewStyle = { shadowColor: theme.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 3 };
export const smallShadow: ViewStyle = { ...hardShadow, shadowOffset: { width: 3, height: 3 } };
