import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { CategoryRatings, CreateReviewInput, CreateSpotInput, Review } from '@/shared/types';
import { Action, Field, Message, ModalSheet } from './Controls';
import { ratingCategories } from './Ratings';
import { imageFor } from './assets';
import type { Coordinate } from './mapHelpers';
import { mono, theme } from './theme';
import { pickPhoto } from '@/lib/photos';
import { reverseGeocode } from '@/lib/geolocation';

function parseCoord(text: string, min: number, max: number): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!normalized || normalized === '-' || normalized === '.') return null;
  const num = Number(normalized);
  return Number.isFinite(num) && num >= min && num <= max ? num : null;
}

export function CoordinateInputs({ coordinate, onChange, editable = true }: { coordinate: Coordinate | null; onChange: (coord: Coordinate) => void; editable?: boolean }) {
  const [latText, setLatText] = useState(coordinate ? coordinate.latitude.toFixed(5) : '');
  const [lngText, setLngText] = useState(coordinate ? coordinate.longitude.toFixed(5) : '');
  useEffect(() => {
    if (!coordinate) { setLatText(''); setLngText(''); return; }
    const currentLat = parseCoord(latText, -90, 90);
    const currentLng = parseCoord(lngText, -180, 180);
    if (currentLat === null || Math.abs(currentLat - coordinate.latitude) > 1e-6) setLatText(coordinate.latitude.toFixed(5));
    if (currentLng === null || Math.abs(currentLng - coordinate.longitude) > 1e-6) setLngText(coordinate.longitude.toFixed(5));
  }, [coordinate?.latitude, coordinate?.longitude]);

  function updateCoords(nextLatRaw: string, nextLngRaw: string) {
    // Support pasting "45.65000, 10.38000" into the latitude input
    if (nextLatRaw.includes(',') && nextLatRaw.split(',').length === 2 && /\d\s*,\s*-?\d/.test(nextLatRaw)) {
      const [a, b] = nextLatRaw.split(',');
      const pLat = parseCoord(a, -90, 90);
      const pLng = parseCoord(b, -180, 180);
      if (pLat !== null && pLng !== null) {
        setLatText(a.trim());
        setLngText(b.trim());
        onChange({ latitude: pLat, longitude: pLng });
        return;
      }
    }
    setLatText(nextLatRaw);
    setLngText(nextLngRaw);
    const pLat = parseCoord(nextLatRaw, -90, 90);
    const pLng = parseCoord(nextLngRaw, -180, 180);
    if (pLat !== null && pLng !== null) onChange({ latitude: pLat, longitude: pLng });
  }

  return <View style={styles.coordRow}>
    <View style={styles.coordField}>
      <Text style={styles.coordLabel}>LATITUDINE</Text>
      <TextInput accessibilityLabel="Latitudine" value={latText} onChangeText={val => updateCoords(val, lngText)} placeholder="es. 45.65000" placeholderTextColor={theme.muted} keyboardType="numbers-and-punctuation" autoCapitalize="none" autoCorrect={false} editable={editable} style={styles.coordInput} />
    </View>
    <View style={styles.coordField}>
      <Text style={styles.coordLabel}>LONGITUDINE</Text>
      <TextInput accessibilityLabel="Longitudine" value={lngText} onChangeText={val => updateCoords(latText, val)} placeholder="es. 10.38000" placeholderTextColor={theme.muted} keyboardType="numbers-and-punctuation" autoCapitalize="none" autoCorrect={false} editable={editable} style={styles.coordInput} />
    </View>
  </View>;
}

function RatingInput({ value, onChange }: { value: CategoryRatings; onChange: (value: CategoryRatings) => void }) {
  return <View style={styles.ratings}>{ratingCategories.map(({ key, label, color, icon }) => <View key={key} style={styles.ratingRow}><View style={styles.ratingLabel}><Ionicons name={icon} size={17} color={theme.ink} /><Text style={styles.label}>{label}</Text><Text style={styles.score}>{value[key]}/5</Text></View><View style={styles.choices}>{[1, 2, 3, 4, 5].map(score => <Pressable key={score} accessibilityRole="button" accessibilityLabel={`${label}: ${score} su 5`} accessibilityState={{ selected: value[key] === score }} aria-pressed={value[key] === score} onPress={() => onChange({ ...value, [key]: score })} style={[styles.choice, { backgroundColor: score <= value[key] ? color : theme.paper }]}><Text style={[styles.choiceText, key === 'privacy' && score <= value[key] && { color: theme.paper }]}>{score}</Text></Pressable>)}</View></View>)}</View>;
}
const initialRatings = { beauty: 3, privacy: 3, accessibility: 3 };
export function ReviewForm({ onClose, onSubmit, busy, error, initial }: { onClose: () => void; onSubmit: (input: CreateReviewInput) => void; busy: boolean; error: string | null; initial?: Review }) {
  const [text, setText] = useState(initial?.text ?? ''); const [ratings, setRatings] = useState<CategoryRatings>(initial?.ratings ?? initialRatings);
  return <ModalSheet title={initial ? 'Aggiorna la tua esperienza.' : 'Ci sei stato? Raccontalo.'} onClose={onClose}><Text style={styles.caption}>{initial ? 'I consigli migliori sono quelli aggiornati. Modificare una recensione non cambia i tuoi XP.' : 'Un consiglio concreto fa la differenza. Condividi la tua esperienza e guadagna 10 XP.'}</Text><RatingInput value={ratings} onChange={setRatings} /><Field label="La tua recensione" placeholder="Com’è il posto? Un consiglio per raggiungerlo?" multiline maxLength={2000} value={text} onChangeText={setText} editable={!busy} /><Text style={styles.counter}>{text.length}/2000</Text><Message text={error} /><Action title={initial ? 'Salva modifiche' : 'Pubblica recensione · +10 XP'} busy={busy} disabled={!text.trim()} onPress={() => onSubmit({ text, ratings })} /></ModalSheet>;
}
export type SpotDraft = Pick<CreateSpotInput, 'name' | 'locality' | 'description' | 'photos' | 'ratings'>;
export function CreateSpotForm({ coordinate, onCoordinateChange, onClose, onCancel, onChangeLocation, onSubmit, busy, error, draft, onDraftChange, editing = false }: { coordinate: Coordinate; onCoordinateChange?: (coord: Coordinate) => void; onClose: () => void; onCancel?: () => void; onChangeLocation: () => void; onSubmit: (input: CreateSpotInput) => void; busy: boolean; error: string | null; draft?: SpotDraft; onDraftChange: (draft: SpotDraft) => void; editing?: boolean }) {
  const [name, setName] = useState(draft?.name ?? ''); const [locality, setLocality] = useState(draft?.locality ?? ''); const [description, setDescription] = useState(draft?.description ?? ''); const [photos, setPhotos] = useState<string[]>(draft?.photos ?? []); const [ratings, setRatings] = useState<CategoryRatings>(draft?.ratings ?? initialRatings);
  useEffect(() => { onDraftChange({ name, locality, description, photos, ratings }); }, [name, locality, description, photos, ratings, onDraftChange]);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void reverseGeocode(coordinate).then(resolved => {
        if (!cancelled) setLocality(resolved);
      });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [coordinate.latitude, coordinate.longitude]);
  const [photoError, setPhotoError] = useState<string | null>(null); const [photoBusy, setPhotoBusy] = useState(false);
  async function choosePhoto() { setPhotoError(null); setPhotoBusy(true); try { const photo = await pickPhoto(); if (photo) setPhotos(old => [...old, photo].slice(0, 3)); } catch { setPhotoError('Non è stato possibile preparare la foto. Scegli un’altra immagine.'); } finally { setPhotoBusy(false); } }
  const resolvedLocality = locality.trim() || `${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`;
  return <ModalSheet title={editing ? 'Uno spot, ancora meglio.' : 'Condividi il tuo posto.'} onClose={onClose}>
    <Text style={styles.caption}>{editing ? 'Aggiorna foto e indicazioni per aiutare chi verrà dopo di te.' : 'Il panorama perfetto. Una panchina nascosta. Quel posto che merita di essere condiviso. +50 XP per te.'}</Text>
    <Pressable onPress={onChangeLocation} accessibilityRole="button" style={styles.location}><Ionicons name="location-outline" size={22} color={theme.ink} /><View style={{ flex: 1 }}><Text style={styles.label}>{locality ? `Posizione · ${locality}` : 'Posizione sulla mappa'}</Text><Text style={styles.coordinate}>{coordinate.latitude.toFixed(5)}, {coordinate.longitude.toFixed(5)}</Text></View><Ionicons name="map-outline" size={20} color={theme.ink} /></Pressable>
    {onCoordinateChange && <CoordinateInputs coordinate={coordinate} onChange={onCoordinateChange} editable={!busy} />}
    <Field label="Nome dello spot *" placeholder="Dai un nome a questo posto" value={name} onChangeText={setName} maxLength={80} editable={!busy} />
    <Field label="Descrizione e indicazioni" placeholder="Cosa lo rende speciale? Come si raggiunge?" multiline value={description} onChangeText={setDescription} maxLength={2000} editable={!busy} />
    <Text style={[styles.label, { marginTop: 22 }]}>Foto (opzionale) · {photos.length}/3</Text><View style={styles.photos}>{photos.map((photo, index) => <Pressable key={index} disabled={busy} accessibilityRole="button" accessibilityLabel={`Rimuovi foto ${index + 1}`} onPress={() => setPhotos(old => old.filter((_, i) => i !== index))} style={styles.photo}><Image source={imageFor(photo)} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} /><View style={styles.remove}><Ionicons name="close" size={16} color={theme.paper} /></View>{index === 0 && <Text style={styles.cover}>COPERTINA</Text>}</Pressable>)}{photos.length < 3 && <Pressable accessibilityRole="button" accessibilityLabel="Aggiungi foto" disabled={photoBusy || busy} onPress={choosePhoto} style={[styles.photo, styles.addPhoto]}><Ionicons name={photoBusy ? 'hourglass-outline' : 'add'} size={30} color={theme.ink} /><Text style={styles.photoLabel}>{photoBusy ? 'ATTENDI' : 'AGGIUNGI'}</Text></Pressable>}</View>
    <Text style={styles.hint}>La prima foto sarà la copertina (opzionale). Le immagini vengono ottimizzate automaticamente.</Text><Message text={photoError} />
    {!editing && <><Text style={[styles.label, { marginTop: 24 }]}>La tua prima valutazione</Text><RatingInput value={ratings} onChange={setRatings} /></>}
    <Message text={error} /><Action title={editing ? 'Salva modifiche' : 'Condividi spot · +50 XP'} busy={busy} disabled={name.trim().length < 2 || photoBusy} onPress={() => onSubmit({ name, locality: resolvedLocality, description, ...coordinate, photos, ratings })} />
    <Action secondary title="Annulla" disabled={busy || photoBusy} onPress={onCancel ?? onClose} />
  </ModalSheet>;
}
const styles = StyleSheet.create({ caption: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 22, color: theme.muted, marginTop: 12 }, hint: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 18, color: theme.muted, marginTop: 10 }, counter: { fontFamily: mono, fontSize: 10, color: theme.muted, textAlign: 'right', marginTop: 5 }, ratings: { marginTop: 18, gap: 17 }, ratingRow: { gap: 9 }, ratingLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 }, label: { fontFamily: 'Inter-Bold', color: theme.ink, fontSize: 12 }, score: { marginLeft: 'auto', fontFamily: mono, fontSize: 11, color: theme.muted }, choices: { flexDirection: 'row', gap: 5 }, choice: { flex: 1, height: 44, borderWidth: 1.5, borderColor: theme.ink, alignItems: 'center', justifyContent: 'center' }, choiceText: { fontFamily: 'Inter-Bold', color: theme.ink, fontSize: 14 }, location: { backgroundColor: theme.lime, borderWidth: 2, borderColor: theme.ink, padding: 13, marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }, coordinate: { fontFamily: mono, color: theme.ink, fontSize: 10, marginTop: 4 }, coordRow: { flexDirection: 'row', gap: 10, marginTop: 10 }, coordField: { flex: 1 }, coordLabel: { fontFamily: mono, fontSize: 10, fontWeight: '700', color: theme.ink, marginBottom: 5 }, coordInput: { fontFamily: mono, fontSize: 13, borderWidth: 1.5, borderColor: theme.ink, backgroundColor: theme.paper, color: theme.ink, paddingHorizontal: 10, paddingVertical: 8 }, photos: { flexDirection: 'row', gap: 9, marginTop: 10 }, photo: { width: 86, height: 90, borderWidth: 2, borderColor: theme.ink, overflow: 'hidden' }, addPhoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.lime }, photoLabel: { fontFamily: mono, fontSize: 9, fontWeight: '700' }, remove: { position: 'absolute', right: 2, top: 2, backgroundColor: theme.ink, width: 23, height: 23, alignItems: 'center', justifyContent: 'center' }, cover: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.ink, color: theme.paper, fontFamily: mono, fontSize: 8, padding: 4, textAlign: 'center' } });
