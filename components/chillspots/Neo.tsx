import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { imageFor } from './assets';
import { hardShadow, mono, theme } from './theme';

export function Avatar({ name, avatar, size = 40 }: { name: string; avatar?: string | null; size?: number }) {
  return <View style={{ width: size, height: size, borderWidth: 2, borderColor: theme.ink, backgroundColor: theme.lime, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
    {avatar ? <Image source={imageFor(avatar)} style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontFamily: 'Inter-Bold', fontSize: size * .35, color: theme.ink }}>{name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'CS'}</Text>}
  </View>;
}
export function IconAction({ name, label, onPress, active, disabled, style, color, size = 20 }: { name: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; active?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; color?: string; size?: number }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active, disabled }} aria-pressed={active} aria-disabled={disabled} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.icon, active && { backgroundColor: theme.lime }, style, pressed && { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOpacity: 0 }, disabled && { opacity: .4 }]}><Ionicons name={name} size={size} color={color ?? theme.ink} /></Pressable>;
}
export function Tag({ text, color = theme.lime }: { text: string; color?: string }) { return <View style={[styles.tag, { backgroundColor: color }]}><Text style={styles.tagText}>{text}</Text></View>; }
export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) { return <View style={styles.empty}><View style={styles.symbol}><Ionicons name="sparkles-outline" size={28} color={theme.ink} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text>{action}</View>; }
const styles = StyleSheet.create({
  icon: { width: 44, height: 44, backgroundColor: theme.white, borderWidth: 2, borderColor: theme.ink, justifyContent: 'center', alignItems: 'center' },
  tag: { paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: theme.ink, alignSelf: 'flex-start' }, tagText: { fontFamily: mono, fontSize: 10, fontWeight: '700', color: theme.ink, textTransform: 'uppercase', letterSpacing: .4 },
  empty: { padding: 28, gap: 12, alignItems: 'flex-start' }, symbol: { padding: 12, backgroundColor: theme.lime, borderWidth: 2, borderColor: theme.ink, ...hardShadow, marginBottom: 8 }, emptyTitle: { fontFamily: 'Inter-Bold', fontSize: 23, lineHeight: 27, color: theme.ink }, emptyBody: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 22, color: theme.muted },
});
