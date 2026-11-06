import { Pressable, StyleSheet, View } from 'react-native';
import { theme } from './theme';

export default function SheetHandle({ expanded, onChange, subject }: { expanded: boolean; onChange: (value: boolean) => void; subject: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? 'Riduci' : 'Espandi'} ${subject}`} accessibilityHint="Trascina verso l’alto per aprire, verso il basso per nascondere." accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => onChange(!expanded)} style={styles.hit}><View style={styles.handle} /></Pressable>;
}
const styles = StyleSheet.create({ hit: { height: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, handle: { width: 48, height: 5, borderRadius: 999, backgroundColor: theme.ink } });
