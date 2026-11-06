import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Profile, Spot } from '@/shared/types';
import type { Coordinate } from './mapHelpers';
import { distanceKm, distanceLabel, hasActiveFilter, type Filter, type RatingFilter, type RatingKey, type Sort } from '@/lib/discovery';
import { imageFor } from './assets';
import MenuSheet from './MenuSheet';
import { Avatar } from './Neo';
import { formatRating, ratingCategories } from './Ratings';
import { sortLabels, type Page } from './Discovery';
import { hardShadow, mono, theme } from './theme';

function toRatingFilter(filter: Filter): RatingFilter {
  if (typeof filter === 'string') return filter === 'all' ? {} : { [filter]: 4 };
  return filter;
}

function filterSummary(filter: Filter): string {
  const ratings = toRatingFilter(filter);
  const parts = ratingCategories
    .filter(({ key }) => (ratings[key] ?? 0) > 0)
    .map(({ key, label }) => `${label} ${ratings[key] === 5 ? '5' : `${ratings[key]}+`}`);
  return parts.length ? parts.join(' · ') : 'Filtra per rating';
}

export function MapProfile({ profile, onPress, ready }: { profile: Profile | null; onPress: () => void; ready: boolean }) {
  const xpInLevel = profile ? profile.xp % 100 : 0;
  const xpLeft = 100 - xpInLevel;
  const progress = xpInLevel / 100;
  const perimeter = 240;
  const ringPath = 'M 33 3 H 63 V 63 H 3 V 3 H 33';
  return <Pressable accessibilityRole="button" accessibilityLabel={profile ? `Profilo di ${profile.name}, livello ${profile.level}, mancano ${xpLeft} XP al prossimo livello` : 'Accedi al tuo profilo'} disabled={!ready} onPress={onPress} style={styles.profile}>
    <View style={styles.avatarRing}>
      {profile ? <Avatar name={profile.name} avatar={profile.avatar} size={54} /> : <Ionicons name="person-outline" size={29} color={theme.ink} />}
      <Svg width={66} height={66} viewBox="0 0 66 66" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path d={ringPath} stroke={theme.line} strokeWidth={5} fill="none" />
        {progress > 0 && <Path d={ringPath} stroke={theme.green} strokeWidth={5} fill="none" strokeDasharray={`${perimeter} ${perimeter}`} strokeDashoffset={perimeter * (1 - progress)} />}
        <Path d="M 6 6 H 60 V 60 H 6 Z" stroke={theme.ink} strokeWidth={1.5} fill="none" />
        <Path d="M 0.75 0.75 H 65.25 V 65.25 H 0.75 Z" stroke={theme.ink} strokeWidth={1.5} fill="none" />
      </Svg>
    </View>
    <Text style={styles.level}>{profile ? `Lvl. ${profile.level}` : 'ACCEDI'}</Text>
  </Pressable>;
}
export function SpotRow({ spot, origin, unit, onSelect }: { spot: Spot; origin: Coordinate; unit: 'km' | 'mi'; onSelect: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Scopri ${spot.name}`} onPress={onSelect} style={styles.row}><Image source={imageFor(spot.photos[0])} style={styles.photo} /><View style={styles.rowBody}><Text numberOfLines={1} style={styles.spotTitle}>{spot.name}<Text style={styles.locality}> · {spot.locality}</Text></Text><View style={styles.meta}><Text style={styles.distance}>{distanceLabel(distanceKm(origin, spot), unit)}</Text>{ratingCategories.map(({ key, icon }) => <View key={key} style={styles.metric}><View style={styles.dot} /><Text style={styles.distance}>{formatRating(spot.ratings[key])}</Text><Ionicons name={icon} size={12} color={key === 'beauty' ? theme.green : theme.blue} /></View>)}</View></View><Ionicons name="chevron-forward" size={14} color={theme.ink} /></Pressable>;
}
export function PlacesPanel({ spots, page, expanded, onExpand, onExpandedChange, onSelect, onSearch, onSort, sort, origin, unit, loading, error, onRetry, signedIn, onLogin }: { spots: Spot[]; page: Page; expanded: boolean; onExpand: () => void; onExpandedChange?: (expanded: boolean) => void; onSelect: (id: string) => void; onSearch: () => void; onSort: () => void; sort: Sort; origin: Coordinate; unit: 'km' | 'mi'; loading: boolean; error: string | null; onRetry: () => void; signedIn: boolean; onLogin: () => void }) {
  const title = page === 'saved' ? 'I tuoi spot salvati' : 'ChillSpot nei paraggi';
  const content = <>
    <View style={styles.listTools}><Pressable accessibilityRole="button" onPress={onSort} style={styles.tool}><Ionicons name="swap-vertical" size={14} color={theme.ink} /><Text style={styles.toolText}>{sortLabels[sort]}</Text></Pressable><Pressable accessibilityRole="button" onPress={onSearch} style={styles.tool}><Ionicons name="search-outline" size={14} color={theme.ink} /><Text style={styles.toolText}>Cerca e filtra</Text></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.rows}>{page === 'saved' && !signedIn ? <Pressable accessibilityRole="button" onPress={onLogin} style={styles.empty}><Text style={styles.emptyTitle}>I tuoi posti, sempre con te.</Text><Text style={styles.emptyText}>Accedi per salvare le tue prossime scoperte ↗</Text></Pressable> : error ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.empty}><Text style={styles.emptyText}>{error}</Text><Text style={styles.emptyTitle}>Riprova ↗</Text></Pressable> : loading ? <Text style={styles.emptyText}>Cerchiamo un bel posto per te…</Text> : spots.length ? spots.map(spot => <SpotRow key={spot.id} spot={spot} origin={origin} unit={unit} onSelect={() => onSelect(spot.id)} />) : <View style={styles.empty}><Text style={styles.emptyTitle}>{page === 'saved' ? 'La tua collezione inizia qui.' : 'Nessuno spot in quest’area.'}</Text><Text style={styles.emptyText}>{page === 'saved' ? 'Tocca il segnalibro di un posto per ritrovarlo qui.' : 'Sposta la mappa o modifica i filtri.'}</Text></View>}</ScrollView>
  </>;
  return <MenuSheet key={page} title={title} onClose={onExpand} expanded={page === 'saved' ? undefined : expanded} onExpandedChange={page === 'saved' ? undefined : onExpandedChange} animateOnMount={expanded}>{content}</MenuSheet>;
}

export function SearchPanel({ spots, origin, unit, filter, onFilter, sort, onSort, onClose, onSelect, onClear, onlyArea, onArea }: { spots: Spot[]; origin: Coordinate; unit: 'km' | 'mi'; filter: Filter; onFilter: (value: Filter) => void; sort: Sort; onSort: () => void; onClose: () => void; onSelect: (id: string) => void; onClear: () => void; onlyArea: boolean; onArea: () => void }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const currentRatings = toRatingFilter(filter);
  const active = hasActiveFilter(filter);
  function setCategoryRating(key: RatingKey, score: number) {
    const next: RatingFilter = { ...currentRatings };
    if (score <= 0 || next[key] === score) delete next[key];
    else next[key] = score;
    onFilter(Object.keys(next).length ? next : 'all');
  }
  return <MenuSheet title="Cerca un posto" onClose={onClose} header={false} focusOnMount={false} zIndex={60}><View style={styles.searchContent}>
    <View style={styles.filterHeader}>
      <Pressable accessibilityRole="button" accessibilityLabel="Apri filtri per rating" accessibilityState={{ expanded: filterOpen, selected: active }} aria-expanded={filterOpen} onPress={() => setFilterOpen(value => !value)} style={[styles.filterToggle, active && { backgroundColor: theme.lime }]}>
        <Ionicons name="options-outline" size={16} color={theme.ink} />
        <Text numberOfLines={1} style={styles.filterToggleText}>{filterSummary(filter)}</Text>
        <Ionicons name={filterOpen ? 'chevron-up' : 'chevron-down'} size={15} color={theme.ink} />
      </Pressable>
      {active && <Pressable accessibilityRole="button" accessibilityLabel="Azzera filtri rating" onPress={() => onFilter('all')} style={styles.filterReset}><Ionicons name="close" size={15} color={theme.ink} /><Text style={styles.filterResetText}>Azzera</Text></Pressable>}
    </View>
    {filterOpen && <View style={styles.filterBox}>
      {ratingCategories.map(({ key, label, color, icon }) => {
        const selectedScore = currentRatings[key] ?? 0;
        return <View key={key} style={styles.filterCategory}>
          <View style={styles.filterCategoryHeader}>
            <Ionicons name={icon} size={14} color={theme.ink} />
            <Text style={styles.filterCategoryLabel}>{label}</Text>
            <Text style={styles.filterCategoryValue}>{selectedScore ? (selectedScore === 5 ? 'Solo 5/5' : `Minimo ${selectedScore}/5`) : 'Qualsiasi'}</Text>
          </View>
          <View style={styles.ratingChoices}>
            {[0, 1, 2, 3, 4, 5].map(score => {
              const chosen = selectedScore === score;
              const filled = selectedScore > 0 && score >= selectedScore;
              return <Pressable key={score} accessibilityRole="button" accessibilityLabel={score === 0 ? `${label}: qualsiasi` : `${label}: almeno ${score} su 5`} accessibilityState={{ selected: chosen }} aria-pressed={chosen} onPress={() => setCategoryRating(key, score)} style={[styles.ratingChoice, (chosen && score === 0) && { backgroundColor: theme.ink }, filled && { backgroundColor: color }]}>
                <Text style={[styles.ratingChoiceText, ((chosen && score === 0) || (filled && key === 'privacy')) && { color: theme.paper }]}>{score === 0 ? 'Tutti' : score === 5 ? '5' : `${score}+`}</Text>
              </Pressable>;
            })}
          </View>
        </View>;
      })}
    </View>}
    <View style={styles.searchSummary}><Pressable accessibilityRole="button" accessibilityLabel="Mostra solo gli spot in quest’area" accessibilityState={{ selected: onlyArea }} aria-pressed={onlyArea} onPress={onArea} style={styles.tool}><Ionicons name={onlyArea ? 'checkbox-outline' : 'square-outline'} size={14} color={theme.ink} /><Text style={styles.toolText}>In quest’area</Text></Pressable><Text accessibilityLiveRegion="polite" style={styles.resultCount}>{spots.length} spot</Text><Pressable accessibilityRole="button" accessibilityLabel={`Ordina: ${sortLabels[sort]}`} onPress={onSort} style={styles.tool}><Ionicons name="swap-vertical" size={13} color={theme.ink} /><Text style={styles.toolText}>{sortLabels[sort]}</Text></Pressable></View><ScrollView style={{ flex: 1, minHeight: 0 }} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.searchRows}>{spots.length ? spots.map(spot => <SpotRow key={spot.id} spot={spot} origin={origin} unit={unit} onSelect={() => onSelect(spot.id)} />) : <View style={styles.empty}><Text style={styles.emptyTitle}>Nessun posto trovato.</Text><Text style={styles.emptyText}>Prova un’altra località o rimuovi i filtri.</Text><Pressable accessibilityRole="button" onPress={onClear} style={styles.tool}><Text style={styles.toolText}>Azzera ricerca e filtri ↗</Text></Pressable></View>}</ScrollView></View></MenuSheet>;
}
const styles = StyleSheet.create({
  profile: { alignItems: 'center', width: 76, paddingTop: 3 }, avatarRing: { width: 66, height: 66, backgroundColor: theme.paper, alignItems: 'center', justifyContent: 'center', ...hardShadow }, level: { marginTop: -7, backgroundColor: theme.lime, borderWidth: 1.5, borderColor: theme.ink, paddingHorizontal: 8, paddingVertical: 3, fontFamily: 'Inter-Bold', fontSize: 11, color: theme.ink },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: theme.paper, borderWidth: 2, borderBottomWidth: 0, borderColor: theme.ink, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingBottom: 7 }, sheetTitle: { flex: 1, fontFamily: 'Inter-Bold', fontSize: 17, letterSpacing: -.5, color: theme.ink },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderColor: theme.line, minHeight: 72 }, photo: { width: 44, height: 44, borderWidth: 1.5, borderColor: theme.ink }, rowBody: { flex: 1, minWidth: 0 }, spotTitle: { fontFamily: 'Inter-Bold', fontSize: 14, color: theme.ink, letterSpacing: -.35 }, locality: { fontFamily: 'Inter-Regular', color: theme.muted, fontSize: 12 }, meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }, metric: { flexDirection: 'row', alignItems: 'center', gap: 3 }, distance: { fontFamily: 'Inter-Medium', fontSize: 10, color: theme.muted }, dot: { width: 3, height: 3, backgroundColor: theme.ink, marginRight: 2 }, rows: { paddingHorizontal: 18, paddingBottom: 8 }, listTools: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 18, borderBottomWidth: 1, borderColor: theme.line, paddingBottom: 8 }, tool: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5 }, toolText: { fontFamily: 'Inter-Medium', fontSize: 11, color: theme.ink }, empty: { paddingVertical: 14, gap: 6 }, emptyTitle: { fontFamily: 'Inter-Bold', fontSize: 14, color: theme.ink }, emptyText: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 18, color: theme.muted },
  searchContent: { flex: 1, minHeight: 0 },
  filterHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  filterToggle: { flex: 1, minHeight: 36, paddingHorizontal: 12, borderWidth: 1.5, borderColor: theme.ink, backgroundColor: theme.paper, flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterToggleText: { flex: 1, fontFamily: 'Inter-Bold', fontSize: 12, color: theme.ink },
  filterReset: { minHeight: 36, paddingHorizontal: 10, borderWidth: 1.5, borderColor: theme.ink, backgroundColor: theme.paper, flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterResetText: { fontFamily: 'Inter-Medium', fontSize: 11, color: theme.ink },
  filterBox: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderWidth: 1.5, borderColor: theme.ink, backgroundColor: theme.paper, gap: 10 },
  filterCategory: { gap: 5 },
  filterCategoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterCategoryLabel: { fontFamily: 'Inter-Bold', fontSize: 12, color: theme.ink },
  filterCategoryValue: { marginLeft: 'auto', fontFamily: mono, fontSize: 10, color: theme.muted },
  ratingChoices: { flexDirection: 'row', gap: 4 },
  ratingChoice: { flex: 1, height: 32, borderWidth: 1.5, borderColor: theme.ink, backgroundColor: theme.paper, alignItems: 'center', justifyContent: 'center' },
  ratingChoiceText: { fontFamily: 'Inter-Bold', fontSize: 11, color: theme.ink },
  searchSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderColor: theme.line }, resultCount: { fontFamily: mono, fontSize: 10, color: theme.muted }, searchRows: { paddingHorizontal: 16, paddingBottom: 12 },
});
