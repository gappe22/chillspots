import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from './theme';

export type NavTab = 'map' | 'search' | 'saved' | 'profile' | 'settings';
export const NAV_BAR_HEIGHT = 134;
export const NAV_TABS_HEIGHT = 70;
const tabs = [
  { id: 'map', label: 'Mappa', icon: 'map-outline' },
  { id: 'saved', label: 'Salvati', icon: 'bookmark-outline' },
  { id: 'profile', label: 'Profilo', icon: 'person-outline' },
  { id: 'settings', label: 'Impostazioni', icon: 'options-outline' },
] as const;
export default function NavBar({ active, onSelect, onSearch, onQuery, searchQuery, searchExpanded, bottom, keyboardOffset, disabled, hideSearch = false }: { active: NavTab; onSelect: (tab: NavTab) => void; onSearch: () => void; onQuery: (value: string) => void; searchQuery: string; searchExpanded: boolean; bottom: number; keyboardOffset: number; disabled?: boolean; hideSearch?: boolean }) {
  const input = useRef<TextInput>(null);
  const focusedOnce = useRef(false);
  useEffect(() => {
    if (active === 'search' && searchExpanded && !disabled) {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        input.current?.focus();
      }
    } else {
      focusedOnce.current = false;
    }
  }, [active, searchExpanded, disabled]);
  return <View style={[styles.nav, { minHeight: hideSearch ? NAV_TABS_HEIGHT : NAV_BAR_HEIGHT, paddingBottom: bottom, bottom: keyboardOffset }]}>
    {!hideSearch && <View style={styles.searchRow}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={21} color={theme.ink} />
        <TextInput ref={input} accessibilityLabel="Cerca uno spot o una località" accessibilityHint="Apre ricerca, filtri e risultati" accessibilityState={{ expanded: searchExpanded, disabled }} aria-expanded={searchExpanded} editable={!disabled} value={searchQuery} onChangeText={onQuery} onFocus={onSearch} placeholder="Cerca un posto…" placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} maxLength={120} returnKeyType="search" style={styles.searchText} />
      </View>
    </View>}
    <View accessibilityRole="tablist" accessibilityLabel="Navigazione principale" style={styles.tabs}>{tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: active === tab.id, disabled }} aria-selected={active === tab.id} disabled={disabled} onPress={() => onSelect(tab.id)} style={styles.tab}><View style={[styles.icon, active === tab.id && styles.selected]}><Ionicons name={tab.icon} size={21} color={theme.ink} /></View><Text style={[styles.label, active === tab.id && { fontFamily: 'Inter-Bold' }]}>{tab.label}</Text></Pressable>)}</View>
  </View>;
}
const styles = StyleSheet.create({ nav: { position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: NAV_BAR_HEIGHT, backgroundColor: theme.paper, zIndex: 100 }, searchRow: { height: 64, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }, searchBar: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderWidth: 1.5, borderColor: theme.ink, backgroundColor: theme.paper }, searchActive: { borderColor: theme.green }, searchText: { flex: 1, minWidth: 0, fontFamily: 'Inter-Regular', fontSize: 16, color: theme.ink, paddingVertical: 10 }, tabs: { flexDirection: 'row', paddingTop: 8 }, tab: { flex: 1, height: 60, alignItems: 'center', justifyContent: 'flex-start', gap: 5 }, icon: { width: 42, height: 29, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' }, selected: { backgroundColor: theme.lime, borderColor: theme.ink }, label: { fontFamily: 'Inter-Medium', fontSize: 10, color: theme.ink } });
