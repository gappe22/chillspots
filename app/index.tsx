import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Dimensions, Image, Keyboard, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Region } from 'react-native-maps';
import type { AuthResponse, CreateReviewInput, CreateSpotInput, Profile, Review, Spot } from '@/shared/types';
import { useChillspots } from '@/hooks/useChillspots';
import { api, RequestError } from '@/lib/api';
import { batchUpdates } from '@/lib/batchUpdates';
import { discover, hasActiveFilter, type Filter, type Sort } from '@/lib/discovery';
import { locate } from '@/lib/geolocation';
import SpotMap from '@/components/chillspots/SpotMap';
import { INITIAL_REGION, type Coordinate } from '@/components/chillspots/mapHelpers';
import SpotPanel from '@/components/chillspots/SpotPanel';
import { AuthPanel, PasswordPanel, ProfileEditor, ProfilePanel } from '@/components/chillspots/AccountPanels';
import { CoordinateInputs, CreateSpotForm, ReviewForm, type SpotDraft } from '@/components/chillspots/ContributionForms';
import { Action, Message, ModalSheet } from '@/components/chillspots/Controls';
import { sortLabels, type Page } from '@/components/chillspots/Discovery';
import { SettingsPage } from '@/components/chillspots/SettingsPage';
import { IconAction } from '@/components/chillspots/Neo';
import { MapProfile, PlacesPanel, SearchPanel } from '@/components/chillspots/MapPanels';
import Overlay from '@/components/chillspots/Overlay';
import GlobalStyles from '@/components/chillspots/GlobalStyles';
import NavBar, { NAV_BAR_HEIGHT, NAV_TABS_HEIGHT, type NavTab } from '@/components/chillspots/NavBar';
import type { SheetController } from '@/components/chillspots/useSheetMotion';
import MenuSheet, { MenuLayoutContext } from '@/components/chillspots/MenuSheet';
import { PreferencesContext } from '@/components/chillspots/PreferencesContext';
import { imageFor } from '@/components/chillspots/assets';
import { hardShadow, mono, theme } from '@/components/chillspots/theme';

type ModalName = 'auth' | 'profile' | 'profileEdit' | 'password' | 'review' | 'create' | 'sort' | 'deleteReview' | 'logout' | null;
type Pending = { kind: 'add' | 'review' | 'save' | 'profile' | 'saved'; id?: string } | null;
const messageFor = (reason: unknown) => reason instanceof Error ? reason.message : 'Qualcosa è andato storto. Riprova.';

export default function Home() {
  const app = useChillspots(); const { width, height } = useWindowDimensions(); const insets = useSafeAreaInsets(); const wide = width >= 700;
  const [page, setPage] = useState<Page>('explore'); const [view, setView] = useState<'map' | 'list'>('map');
  const [searchOpen, setSearchOpen] = useState(false); const [sheetExpanded, setSheetExpanded] = useState(false);
  const [animateSheetEntry, setAnimateSheetEntry] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState<Filter>('all'); const [sort, setSort] = useState<Sort>('recommended'); const [onlyArea, setOnlyArea] = useState(false);
  const [region, setRegion] = useState<Region>(INITIAL_REGION); const [userCoordinate, setUserCoordinate] = useState<Coordinate | undefined>(); const [locating, setLocating] = useState(false);
  const [target, setTarget] = useState<(Coordinate & { latitudeDelta?: number; longitudeDelta?: number }) | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null); const selected = app.spots.find(spot => spot.id === selectedId);
  const [reviews, setReviews] = useState<Review[]>([]); const [reviewsLoading, setReviewsLoading] = useState(false); const [reviewsError, setReviewsError] = useState<string | null>(null); const reviewRequest = useRef(0);
  const [modal, setModal] = useState<ModalName>(null); const [pending, setPending] = useState<Pending>(null); const [busy, setBusy] = useState(false); const [modalError, setModalError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false); const [coordinate, setCoordinate] = useState<Coordinate | null>(null); const [spotDraft, setSpotDraft] = useState<SpotDraft>(); const [editingSpotId, setEditingSpotId] = useState<string | null>(null); const [editingReview, setEditingReview] = useState<Review>();
  const [saveBusy, setSaveBusy] = useState<string | null>(null); const saveInFlight = useRef(false); const [toast, setToast] = useState<string | null>(null); const [gallery, setGallery] = useState<number | null>(null);
  const deepLinkHandled = useRef(false); const locationBackup = useRef<Coordinate | null>(null);
  const sheet = useRef<SheetController | null>(null); const sheetStack = useRef<SheetController[]>([]); const transition = useRef(0);
  const registerSheet = useCallback((controller: SheetController) => {
    sheetStack.current.push(controller);
    sheet.current = controller;
    return () => {
      sheetStack.current = sheetStack.current.filter(c => c !== controller);
      sheet.current = sheetStack.current[sheetStack.current.length - 1] ?? null;
    };
  }, []);
  const [closingSearch, setClosingSearch] = useState(false);
  const closeSearch = useCallback(() => {
    if (closingSearch) return;
    setClosingSearch(true);
    Keyboard.dismiss();
    setSheetExpanded(false);
    const finish = () => {
      setClosingSearch(false);
      setSearchOpen(false);
    };
    if (sheet.current) {
      sheet.current.dismiss(finish);
    } else {
      finish();
    }
  }, [closingSearch]);
  const origin = userCoordinate ?? region;
  const isMapOrSaved = (page === 'explore' || page === 'saved') && !picking && !selected && (!modal || modal === 'sort');
  const hideSearch = !isMapOrSaved;
  const navBottom = keyboardHeight > 0 ? 0 : insets.bottom;
  const navHeight = (hideSearch ? NAV_TABS_HEIGHT : NAV_BAR_HEIGHT) + navBottom + keyboardHeight;
  const showBackButton = !!(selected || page !== 'explore' || searchOpen || modal || picking || view === 'list');
  const activeTab: NavTab = page === 'settings' ? 'settings' : page === 'saved' ? 'saved' : searchOpen ? 'search' : modal === 'auth' || modal === 'profile' || modal === 'profileEdit' || modal === 'password' ? 'profile' : 'map';
  const filtered = useMemo(() => {
    const source = page === 'saved' ? app.spots.filter(spot => app.account?.savedSpotIds.includes(spot.id)) : app.spots;
    const found = discover(source, query, filter, sort, origin);
    return onlyArea ? found.filter(spot => Math.abs(spot.latitude - region.latitude) <= region.latitudeDelta / 2 && Math.abs(spot.longitude - region.longitude) <= region.longitudeDelta / 2) : found;
  }, [app.spots, app.account?.savedSpotIds, page, query, filter, sort, origin, onlyArea, region, view]);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const frame = Keyboard.addListener('keyboardWillChangeFrame', event => {
      Keyboard.scheduleLayoutAnimation(event);
      setKeyboardHeight(Math.max(0, Dimensions.get('screen').height - event.endCoordinates.screenY));
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    return () => { frame.remove(); hide.remove(); };
  }, []);
  useEffect(() => setView(app.preferences.defaultView), [app.preferences.defaultView]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 5500); return () => clearTimeout(timer); }, [toast]);
  const loadReviews = useCallback(async (id: string) => {
    const request = ++reviewRequest.current; setReviewsLoading(true); setReviewsError(null); setReviews([]);
    try { const result = await api<{ reviews: Review[] }>(`/spots/${id}/reviews`); if (request === reviewRequest.current) setReviews(result.reviews); }
    catch (reason) { if (request === reviewRequest.current) setReviewsError(messageFor(reason)); }
    finally { if (request === reviewRequest.current) setReviewsLoading(false); }
  }, []);
  useEffect(() => { if (selectedId) loadReviews(selectedId); else { ++reviewRequest.current; setReviews([]); } }, [selectedId, loadReviews]);
  const closeDetail = useCallback(() => { setSelectedId(null); setGallery(null); }, []);
  function transitionCard(action: () => void) {
    const request = ++transition.current;
    const commit = () => {
      if (request !== transition.current) return;
      // Animation callbacks must commit the destination in one render, including on legacy roots.
      batchUpdates(() => { setAnimateSheetEntry(true); action(); });
    };
    if (sheet.current) sheet.current.dismiss(commit); else commit();
  }
  function openModal(name: ModalName) { if (name === modal) { sheet.current?.expand(); return; } transitionCard(() => { setModalError(null); setModal(name); }); }
  function closeModal() { if (!busy) { setModal(null); setModalError(null); setPending(null); } }
  function focusSpot(spot: Spot) {
    const latitudeSpan = Math.max(.12, .12 * height / width * Math.cos(spot.latitude * Math.PI / 180));
    setTarget({ latitude: spot.latitude - latitudeSpan * .375, longitude: spot.longitude, latitudeDelta: .12, longitudeDelta: .12 });
  }
  function selectSpot(id: string) { if (id === selectedId && !modal && gallery === null) { sheet.current?.expand(); return; } Keyboard.dismiss(); transitionCard(() => { setSearchOpen(false); setSelectedId(id); setModal(null); setGallery(null); const spot = app.spots.find(item => item.id === id); if (spot) focusSpot(spot); }); }
  function changePage(value: Page) { setPage(value); setSelectedId(null); setPicking(false); setQuery(''); setFilter('all'); setOnlyArea(false); setSearchOpen(false); if (value === 'saved') setView('list'); }
  function activateTab(tab: NavTab, expandMap = false, preserveKeyboard = false) {
    setView(expandMap ? 'list' : 'map');
    if (!preserveKeyboard) Keyboard.dismiss();
    setModal(null); setModalError(null); setPending(null); setGallery(null);
    changePage('explore');
    if (tab === 'search') setSearchOpen(true);
    else if (tab === 'saved' || tab === 'settings') changePage(tab);
    else if (tab === 'profile') showProfile();
  }
  function navigate(tab: NavTab) {
    if (busy) return;
    if (searchOpen && tab === 'map') {
      closeSearch();
      return;
    }
    if (tab === 'map' && page === 'explore' && !selected && !searchOpen && !modal && gallery === null && !picking) {
      ++transition.current;
      setView('map');
      sheet.current?.collapse();
      return;
    }
    transitionCard(() => activateTab(tab));
  }
  function selectNavTab(tab: NavTab, preserveKeyboard = false) {
    if (busy) return;
    ++transition.current;
    if (searchOpen && tab === 'map') {
      closeSearch();
      return;
    }
    if (tab === 'map' && activeTab === 'map' && page === 'explore' && !selected && !picking && gallery === null && !modal) {
      if (view === 'list' || sheet.current?.isExpanded()) {
        setView('map');
        sheet.current?.collapse();
      } else {
        setView('list');
        sheet.current?.expand(preserveKeyboard);
      }
      return;
    }
    if (tab === activeTab && !selected && !picking && gallery === null && (!modal || modal === 'auth' || modal === 'profile' || modal === 'profileEdit' || modal === 'password') && sheet.current) {
      if (sheet.current.isExpanded()) {
        sheet.current.collapse();
      } else {
        sheet.current.expand(preserveKeyboard);
      }
      return;
    }
    setAnimateSheetEntry(!sheet.current?.isExpanded());
    activateTab(tab, true, preserveKeyboard);
  }
  function beginAdding() { setSearchOpen(false); locationBackup.current = null; setEditingSpotId(null); setEditingReview(undefined); setSpotDraft(undefined); setCoordinate(null); setSelectedId(null); setPage('explore'); setView('map'); setPicking(true); setModal(null); }
  function startAdding() { if (!app.profile) { setPending({ kind: 'add' }); openModal('auth'); } else beginAdding(); }
  function backToPicking() {
    if (busy) return;
    transitionCard(() => {
      setModal(null);
      setModalError(null);
      setPicking(true);
      setView('map');
      if (coordinate) setTarget({ ...coordinate, latitudeDelta: .03, longitudeDelta: .03 });
    });
  }
  function cancelAdding() {
    if (busy) return;
    transitionCard(() => {
      locationBackup.current = null;
      setPicking(false);
      setModal(null);
      setModalError(null);
      setEditingSpotId(null);
      setSpotDraft(undefined);
      setCoordinate(null);
    });
  }
  function showProfile() { setPage('explore'); setSearchOpen(false); setSelectedId(null); setPicking(false); setModalError(null); if (!app.profile) { setPending({ kind: 'profile' }); setModal('auth'); } else setModal('profile'); }
  function openProfile() { if (modal === 'auth' || modal === 'profile') { sheet.current?.expand(); return; } transitionCard(showProfile); }
  function addReview() { if (selected && app.profile && selected.ownerId === app.profile.id) return; setEditingReview(undefined); if (!app.profile) { setPending({ kind: 'review', id: selectedId ?? undefined }); openModal('auth'); } else openModal('review'); }
  function editSpot() {
    if (!selected || !app.profile || selected.ownerId !== app.profile.id) return;
    setEditingSpotId(selected.id); setCoordinate({ latitude: selected.latitude, longitude: selected.longitude }); setSpotDraft({ name: selected.name, locality: selected.locality, description: selected.description, photos: selected.photos, ratings: selected.ratings }); openModal('create');
  }
  useEffect(() => {
    function dismissPanel() {
      if (gallery !== null) { transitionCard(() => setGallery(null)); return true; }
      if (modal) { if (!busy) transitionCard(closeModal); return true; }
      if (searchOpen) { closeSearch(); return true; }
      if (selectedId) { transitionCard(closeDetail); return true; }
      if (picking) { setPicking(false); if (locationBackup.current) { setCoordinate(locationBackup.current); setModal('create'); } return true; }
      if (page !== 'explore') { transitionCard(() => changePage('explore')); return true; }
      if (view === 'list') { sheet.current?.collapse(); return true; }
      return false;
    }
    if (Platform.OS === 'android') { const subscription = BackHandler.addEventListener('hardwareBackPress', dismissPanel); return () => subscription.remove(); }

  }, [modal, gallery, searchOpen, selectedId, picking, page, view, closeDetail, busy]);
  async function modalWork(work: () => Promise<void>) {
    if (busy) return; setBusy(true); setModalError(null);
    try { await work(); }
    catch (reason) {
      setModalError(messageFor(reason));
      if (reason instanceof RequestError && reason.code === 'UNAUTHORIZED') { await app.logout().catch(() => {}); setModal('auth'); setPending(null); }
    } finally { setBusy(false); }
  }
  async function signIn(register: boolean, fields: { name: string; email: string; password: string }) {
    await modalWork(async () => {
      const result = await api<AuthResponse>(register ? '/auth/register' : '/auth/login', fields); await app.acceptAuth(result); setModal(null); setToast(register ? 'Benvenuto fuori. La tua prossima scoperta ti aspetta!' : 'Bentornato. Ripartiamo da un bel posto.');
      const next = pending; setPending(null);
      if (next?.kind === 'add') beginAdding();
      else if (next?.kind === 'review') { const targetSpot = app.spots.find(s => s.id === (next.id ?? selectedId)); if (next.id) setSelectedId(next.id); if (!targetSpot || targetSpot.ownerId !== result.profile.id) setModal('review'); }
      else if (next?.kind === 'profile') setModal('profile');
      else if (next?.kind === 'saved') changePage('saved');
      else if (next?.kind === 'save' && next.id) { await api(`/saved/${next.id}`, undefined, 'PUT'); await app.refreshAccount(); setToast('Spot salvato'); }
    });
  }
  async function saveSpot(id: string) {
    if (!app.profile) { setPending({ kind: 'save', id }); openModal('auth'); return; }
    if (saveInFlight.current) return; saveInFlight.current = true; setSaveBusy(id);
    try { const saved = await app.saveSpot(id); setToast(saved ? 'Spot salvato' : 'Spot rimosso dai salvati.'); }
    catch (reason) { setToast(messageFor(reason)); }
    finally { saveInFlight.current = false; setSaveBusy(null); }
  }
  async function submitContribution(input: CreateReviewInput | CreateSpotInput, creating: boolean) {
    if (!creating && !selected) return;
    await modalWork(async () => {
      const path = creating ? editingSpotId ? `/spots/${editingSpotId}` : '/spots' : editingReview ? `/spots/${selected!.id}/reviews/${editingReview.id}` : `/spots/${selected!.id}/reviews`;
      const editing = creating ? !!editingSpotId : !!editingReview;
      const result = await api<{ spot: Spot; profile: Profile; review?: Review }>(path, input, editing ? 'PATCH' : 'POST');
      app.updateSpot(result.spot); app.updateProfile(result.profile); setModal(null); setPicking(false); setSelectedId(result.spot.id); focusSpot(result.spot); setEditingSpotId(null); setSpotDraft(undefined); setEditingReview(undefined);
      if (!creating && result.review) { ++reviewRequest.current; setReviews(old => editing ? old.map(review => review.id === result.review!.id ? result.review! : review) : [result.review!, ...old]); setReviewsLoading(false); }
      setToast(editing ? 'Modifiche salvate. Grazie per tenerci aggiornati.' : creating ? 'Una nuova scoperta per tutti. +50 XP per te!' : 'La tua esperienza conta. +10 XP!');
      void app.refreshAccount().catch(() => {});
    });
  }
  async function removeReview() {
    if (!selected || !editingReview) return;
    await modalWork(async () => { const result = await api<{ spot: Spot; profile: Profile }>(`/spots/${selected.id}/reviews/${editingReview.id}`, undefined, 'DELETE'); app.updateSpot(result.spot); app.updateProfile(result.profile); setReviews(old => old.filter(review => review.id !== editingReview.id)); setModal(null); setEditingReview(undefined); setToast('Recensione eliminata. I 10 XP assegnati sono stati rimossi.'); void app.refreshAccount().catch(() => {}); });
  }
  async function findMe() { setLocating(true); try { const position = await locate(); setUserCoordinate(position); setTarget({ ...position, latitudeDelta: .09, longitudeDelta: .09 }); setSort('distance'); setView('map'); setPage('explore'); setSearchOpen(false); setModal(null); setToast('Eccoti. Scopri cosa c’è intorno a te.'); } catch (reason) { setToast(messageFor(reason)); } finally { setLocating(false); } }
  function directions() { if (selected) void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`).catch(() => setToast('Non è stato possibile aprire le indicazioni.')); }
  async function share() {
    if (!selected) return;
    const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : process.env.EXPO_PUBLIC_WEB_URL ?? 'http://127.0.0.1:3001';
    const url = `${origin}/?spot=${encodeURIComponent(selected.id)}`;
    try { if (Platform.OS === 'web' && navigator.clipboard) { await navigator.clipboard.writeText(url); setToast('Link copiato. Condividi una bella scoperta.'); } else await Share.share({ title: selected.name, message: `${selected.name} · ${selected.locality}\n${url}` }); }
    catch { setToast('Condivisione non disponibile. Riprova.'); }
  }
  useEffect(() => {
    if (app.loading || !app.spots.length || deepLinkHandled.current) return; deepLinkHandled.current = true;
    const apply = (url: string | null) => { if (!url) return; try { const id = new URL(url).searchParams.get('spot'); if (id && app.spots.some(spot => spot.id === id)) selectSpot(id); } catch {} };
    if (Platform.OS === 'web') apply(window.location.href); else void Linking.getInitialURL().then(apply);
  }, [app.loading, app.spots]);

  const handleMapInteract = useCallback(() => {
    if (picking || busy || selected || (modal && modal !== 'auth' && modal !== 'profile' && modal !== 'profileEdit' && modal !== 'password')) return;
    Keyboard.dismiss();
    if (page === 'explore' && view === 'list') {
      setView('map');
    }
    if (sheet.current?.isExpanded()) {
      sheet.current.collapse();
    }
  }, [picking, busy, modal, selected, page, view]);

  const sheetBottom = navHeight + 36;
  return <PreferencesContext.Provider value={app.preferences}><MenuLayoutContext.Provider value={{ bottom: navHeight, registerSheet, closeDisabled: busy, onSheetExpanded: setSheetExpanded, animateEntry: animateSheetEntry }}><View style={styles.page}><GlobalStyles />
    <View style={StyleSheet.absoluteFill}>
      <SpotMap spots={picking ? app.spots : filtered} selectedId={selectedId} onSelect={id => { if (!picking && !busy) selectSpot(id); }} onRegionChange={setRegion} target={target} reduceMotion={app.preferences.reduceMotion} userCoordinate={userCoordinate} picking={picking} pickedCoordinate={coordinate ?? undefined} onPick={setCoordinate} bottomInset={sheetExpanded ? height * .75 : picking ? navHeight + 180 : sheetBottom} onInteract={handleMapInteract} />
    </View>
    <View pointerEvents="box-none" style={[styles.floatingTop, { top: insets.top + 16 }]}><IconAction name={showBackButton ? 'arrow-back' : 'search-outline'} label={modal === 'create' ? 'Torna alla scelta posizione' : picking ? 'Annulla scelta posizione' : showBackButton ? 'Torna alla mappa' : 'Cerca un ChillSpot'} disabled={busy} onPress={() => { if (modal === 'create') backToPicking(); else if (picking) cancelAdding(); else if (searchOpen) closeSearch(); else if (showBackButton) navigate('map'); else setSearchOpen(true); }} style={styles.floatingButton} /><MapProfile profile={app.profile} onPress={openProfile} ready={app.authReady && !busy} /></View>
    {page === 'settings' && !modal && !selected && <MenuSheet title="Impostazioni" onClose={() => { changePage('explore'); setView('map'); }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}><SettingsPage profile={app.profile} preferences={app.preferences} onPreferences={app.changePreferences} onEditProfile={() => openModal('profileEdit')} onPassword={() => openModal('password')} onLogin={() => { setPending(null); openModal('auth'); }} onLogout={() => openModal('logout')} onProfile={openProfile} onLocate={findMe} /></ScrollView></MenuSheet>}
    {page !== 'settings' && !selected && !modal && !picking && (!searchOpen || closingSearch) && <>
      {view === 'map' && page === 'explore' && <View pointerEvents={searchOpen ? 'none' : 'box-none'} style={StyleSheet.absoluteFill}><View pointerEvents="box-none" style={[styles.mapActions, { bottom: sheetBottom + 82 }]}><IconAction name="locate-outline" label="Vicino a me" onPress={findMe} disabled={locating} style={styles.floatingButton} /><IconAction name="scan-outline" label="Torna all’area iniziale" onPress={() => setTarget({ ...INITIAL_REGION })} style={styles.floatingButton} /></View><View pointerEvents="box-none" style={[styles.addPosition, { bottom: sheetBottom + 14 }]}><Pressable accessibilityRole="button" accessibilityLabel="Aggiungi un ChillSpot" disabled={!app.authReady} onPress={startAdding} style={styles.addButton}><View style={styles.addSymbol}><Ionicons name="add" size={25} color={theme.ink} /></View><Text style={styles.addText}>Aggiungi un{'\n'}ChillSpot</Text></Pressable></View></View>}
      <View pointerEvents={searchOpen ? 'none' : 'box-none'} style={StyleSheet.absoluteFill}>
        <PlacesPanel spots={filtered} page={page} expanded={page === 'saved' || view === 'list'} onExpand={() => { if (page === 'saved') navigate('map'); else setView(view === 'list' ? 'map' : 'list'); }} onSelect={selectSpot} onSearch={() => setSearchOpen(true)} onSort={() => openModal('sort')} sort={sort} origin={origin} unit={app.preferences.distanceUnit} loading={app.loading} error={app.error} onRetry={app.refreshSpots} signedIn={!!app.profile} onLogin={() => { setPending({ kind: 'saved' }); openModal('auth'); }} />
      </View>
    </>}
    {!selected && !picking && !searchOpen && !modal && page === 'explore' && (query || hasActiveFilter(filter) || onlyArea) && <Pressable accessibilityRole="button" accessibilityLabel="Modifica ricerca e filtri" onPress={() => setSearchOpen(true)} style={[styles.activeSearch, { top: insets.top + 76 }]}><Ionicons name="search-outline" size={13} color={theme.ink} /><Text style={styles.activeSearchText}>{query || (onlyArea ? 'In quest’area' : 'Filtri attivi')} · {filtered.length}</Text></Pressable>}
    {searchOpen && !picking && !modal && !selected && <SearchPanel spots={filtered} origin={origin} unit={app.preferences.distanceUnit} filter={filter} onFilter={setFilter} sort={sort} onSort={() => openModal('sort')} onlyArea={onlyArea} onArea={() => setOnlyArea(value => !value)} onClose={() => setSearchOpen(false)} onSelect={selectSpot} onClear={() => { setQuery(''); setFilter('all'); setOnlyArea(false); }} />}
    {picking && !modal && <View style={[styles.pickPanel, { bottom: Math.max(0, navHeight - 2) }]}><Text style={styles.pickTitle}>Dove si trova il tuo ChillSpot?</Text><Text style={styles.pickHint}>Tocca la mappa oppure inserisci a mano le coordinate:</Text><CoordinateInputs coordinate={coordinate} onChange={coord => { setCoordinate(coord); setTarget({ ...coord, latitudeDelta: .03, longitudeDelta: .03 }); }} /><View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Action compact secondary title="Annulla" onPress={cancelAdding} /></View><View style={{ flex: 1.6 }}><Action compact title="Conferma posizione" disabled={!coordinate} onPress={() => openModal('create')} /></View></View></View>}
    {!!toast && <View style={[styles.toast, { bottom: navHeight + 12 }]}><Ionicons name="information-circle-outline" size={21} color={theme.lime} /><Text accessibilityLiveRegion="polite" style={styles.toastText}>{toast}</Text><Pressable accessibilityRole="button" accessibilityLabel="Chiudi messaggio" onPress={() => setToast(null)} style={{ padding: 5 }}><Ionicons name="close" size={18} color={theme.paper} /></Pressable></View>}
    {selected && !picking && !modal && gallery === null && <Overlay key={selected.id} onClose={closeDetail} wide={wide}><SpotPanel key={selected.id} spot={selected} reviews={reviews} profile={app.profile} saved={!!app.account?.savedSpotIds.includes(selected.id)} saving={saveBusy !== null} loadingReviews={reviewsLoading} error={reviewsError} onClose={closeDetail} onSave={() => saveSpot(selected.id)} onDirections={directions} onShare={share} onEditSpot={editSpot} onAddReview={addReview} onEditReview={review => { setEditingReview(review); openModal('review'); }} onDeleteReview={review => { setEditingReview(review); openModal('deleteReview'); }} onOpenGallery={setGallery} onRetry={() => loadReviews(selected.id)} /></Overlay>}
    {modal === 'auth' && <AuthPanel key={page} onClose={closeModal} onSubmit={signIn} busy={busy} error={modalError} onResetError={() => setModalError(null)} />}
    {modal === 'profile' && app.account && <ProfilePanel account={app.account} onClose={closeModal} onEdit={() => openModal('profileEdit')} onSettings={() => { setModal(null); changePage('settings'); }} onSpot={selectSpot} onReview={(id, review) => { setSelectedId(id); setEditingReview(review); openModal('review'); }} />}
    {modal === 'profileEdit' && app.profile && <ProfileEditor profile={app.profile} onClose={closeModal} busy={busy} error={modalError} onSubmit={input => modalWork(async () => { const result = await api<{ profile: Profile }>('/profile', input, 'PATCH'); app.updateProfile(result.profile); setModal(null); setToast('Profilo aggiornato. Sempre più tuo.'); await app.refreshAccount(); if (selectedId) void loadReviews(selectedId); })} />}
    {modal === 'password' && <PasswordPanel onClose={closeModal} busy={busy} error={modalError} onSubmit={input => modalWork(async () => { const result = await api<AuthResponse>('/auth/password', input); await app.acceptAuth(result); setModal(null); setToast('Password aggiornata. Le altre sessioni sono state disconnesse.'); })} />}
    {modal === 'review' && <ReviewForm onClose={closeModal} initial={editingReview} onSubmit={input => submitContribution(input, false)} busy={busy} error={modalError} />}
    {modal === 'create' && coordinate && <CreateSpotForm coordinate={coordinate} onCoordinateChange={coord => { setCoordinate(coord); setTarget({ ...coord, latitudeDelta: .03, longitudeDelta: .03 }); }} draft={spotDraft} onDraftChange={setSpotDraft} editing={!!editingSpotId} onClose={backToPicking} onCancel={cancelAdding} onChangeLocation={backToPicking} onSubmit={input => submitContribution(input, true)} busy={busy} error={modalError} />}
    {modal === 'sort' && <ModalSheet title="Segui il tuo istinto." onClose={closeModal}><Text style={styles.modalCopy}>Ordina gli spot per trovare la tua prossima pausa.</Text>{(['recommended', 'distance', 'recent'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: sort === value }} aria-checked={sort === value} onPress={() => { setSort(value); setModal(null); }} style={[styles.sortOption, sort === value && { backgroundColor: theme.lime }]}><Text style={styles.sortOptionText}>{sortLabels[value]}</Text><Ionicons name={sort === value ? 'radio-button-on' : 'radio-button-off'} size={21} color={theme.ink} /></Pressable>)}<Text style={styles.modalCopy}>{userCoordinate ? 'Le distanze partono dalla tua posizione.' : 'Le distanze partono dal centro della mappa. Tocca “Vicino a me” per usare la tua posizione.'}</Text></ModalSheet>}
    {modal === 'deleteReview' && <ModalSheet title="Eliminare la recensione?" onClose={closeModal}><Text style={styles.modalCopy}>Il tuo commento verrà rimosso e i 10 XP assegnati saranno sottratti dal tuo totale. Potrai scrivere una nuova recensione in seguito.</Text><Message text={modalError} /><Action danger title="Elimina recensione" busy={busy} onPress={removeReview} /><Action secondary title="Tieni la recensione" disabled={busy} onPress={closeModal} /></ModalSheet>}
    {modal === 'logout' && <ModalSheet title="Ci vediamo fuori." onClose={closeModal}><Text style={styles.modalCopy}>Vuoi uscire dal tuo account? I tuoi spot e salvataggi ti aspettano al prossimo accesso.</Text><Message text={modalError} /><Action title="Esci dall’account" busy={busy} onPress={() => modalWork(async () => { await app.logout(); setModal(null); setSelectedId(null); changePage('explore'); setToast('Hai effettuato l’uscita. A presto!'); })} /><Action secondary title="Resta qui" disabled={busy} onPress={closeModal} /></ModalSheet>}
    {gallery !== null && selected && <MenuSheet title={selected.name} onClose={() => setGallery(null)}><View style={styles.gallery}><Text style={styles.galleryCounter}>FOTO {gallery + 1} / {selected.photos.length}</Text><Image source={imageFor(selected.photos[gallery])} style={styles.galleryImage} resizeMode="contain" /><View style={styles.galleryNav}><IconAction name="arrow-back" label="Foto precedente" disabled={gallery === 0} onPress={() => setGallery(gallery - 1)} /><Text style={styles.galleryCounter}>{gallery + 1} DI {selected.photos.length}</Text><IconAction name="arrow-forward" label="Foto successiva" disabled={gallery === selected.photos.length - 1} onPress={() => setGallery(gallery + 1)} /></View></View></MenuSheet>}
    <NavBar active={activeTab} onSelect={selectNavTab} onSearch={() => selectNavTab('search', true)} onQuery={setQuery} searchQuery={query} searchExpanded={searchOpen && sheetExpanded && !modal && !selected} bottom={navBottom} keyboardOffset={keyboardHeight} disabled={busy} hideSearch={hideSearch} />
  </View></MenuLayoutContext.Provider></PreferencesContext.Provider>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.paper },
  floatingTop: { position: 'absolute', left: 16, right: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, floatingButton: { width: 44, height: 44, ...hardShadow },
  mapActions: { position: 'absolute', right: 17, gap: 10 }, addPosition: { position: 'absolute', left: 0, right: 0, alignItems: 'center' }, addButton: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, padding: 5, paddingRight: 15, backgroundColor: theme.paper, borderWidth: 2, borderColor: theme.ink, ...hardShadow }, addSymbol: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.lime, borderWidth: 1, borderColor: theme.ink }, addText: { fontFamily: 'Inter-Bold', fontSize: 12, lineHeight: 15, color: theme.ink },
  activeSearch: { position: 'absolute', left: 16, maxWidth: 230, flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: theme.lime, borderWidth: 1.5, borderColor: theme.ink, padding: 8 }, activeSearchText: { fontFamily: 'Inter-Medium', fontSize: 11, color: theme.ink, flexShrink: 1 },
  pickPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 2, borderColor: theme.ink, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: theme.paper, padding: 18, paddingBottom: 14 }, pickTitle: { fontFamily: 'Inter-Bold', fontSize: 20, lineHeight: 24, letterSpacing: -.5, color: theme.ink }, pickHint: { fontFamily: 'Inter-Regular', color: theme.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  toast: { position: 'absolute', alignSelf: 'center', maxWidth: 520, width: '90%', backgroundColor: theme.ink, borderWidth: 1, borderColor: theme.lime, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 1100, ...hardShadow }, toastText: { flex: 1, color: theme.paper, fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 19 }, modalCopy: { fontFamily: 'Inter-Regular', color: theme.muted, fontSize: 14, lineHeight: 23, marginVertical: 17 }, sortOption: { padding: 17, borderWidth: 1.5, borderColor: theme.ink, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sortOptionText: { fontFamily: 'Inter-Bold', fontSize: 14, color: theme.ink },
  gallery: { flex: 1, backgroundColor: theme.paper }, galleryCounter: { fontFamily: mono, fontSize: 10, color: theme.muted, marginTop: 7 }, galleryImage: { flex: 1, width: '100%', marginVertical: 18 }, galleryNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 30, padding: 16 },
});
