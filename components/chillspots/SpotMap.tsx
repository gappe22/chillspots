import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { imageFor } from './assets';
import { theme } from './theme';
import { clusterSpots, INITIAL_REGION, regionForCluster, type SpotMapProps } from './mapHelpers';

export type { SpotMapProps } from './mapHelpers';

export default function SpotMap({ spots, selectedId, onSelect, onRegionChange, picking, pickedCoordinate, onPick, target, reduceMotion, userCoordinate, zoomRequest }: SpotMapProps) {
  const map = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(INITIAL_REGION);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [size, setSize] = useState({ width: 390, height: 500 });
  const { width, height } = size;
  const clusters = useMemo(() => clusterSpots(spots, selectedId, coordinate => ({
    x: (coordinate.longitude - region.longitude) / region.longitudeDelta * width,
    y: (region.latitude - coordinate.latitude) / region.latitudeDelta * height,
  })), [spots, selectedId, region, width, height]);

  useEffect(() => {
    if (ready) return;
    const timeout = setTimeout(() => setLoadFailed(true), 15000);
    return () => clearTimeout(timeout);
  }, [ready, attempt]);

  useEffect(() => {
    if (!ready || !target) return;
    map.current?.animateToRegion({
      latitude: target.latitude,
      longitude: target.longitude,
      latitudeDelta: target.latitudeDelta ?? 0.12,
      longitudeDelta: target.longitudeDelta ?? 0.12,
    }, reduceMotion ? 0 : 450);
  }, [ready, target, reduceMotion]);

  useEffect(() => {
    if (!ready || !zoomRequest) return;
    const factor = zoomRequest.direction === 'in' ? .5 : 2;
    map.current?.animateToRegion({ ...region, latitudeDelta: Math.min(150, Math.max(.001, region.latitudeDelta * factor)), longitudeDelta: Math.min(300, Math.max(.001, region.longitudeDelta * factor)) }, reduceMotion ? 0 : 250);
  }, [ready, zoomRequest]);

  return (
    <View style={styles.container} onLayout={event => setSize(event.nativeEvent.layout)}>
      <MapView
        key={attempt}
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={INITIAL_REGION}
        showsPointsOfInterest={false}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        loadingEnabled
        onMapReady={() => { setReady(true); setLoadFailed(false); }}
        onRegionChangeComplete={next => { setRegion(next); onRegionChange?.(next); }}
        onPress={event => { if (picking) onPick?.(event.nativeEvent.coordinate); }}
      >
        {clusters.map(cluster => {
          const selected = cluster.members[0].id === selectedId;
          const grouped = cluster.members.length > 1;
          const size = selected ? 72 : 44;
          return (
            <Marker
              key={`${cluster.id}-${selected ? 'selected' : 'regular'}`}
              coordinate={cluster.coordinate}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={selected ? 10 : 1}
              tracksViewChanges
              accessibilityLabel={grouped ? `Ingrandisci ${cluster.members.length} spot` : `Apri ${cluster.members[0].name}`}
              onPress={event => {
                event.stopPropagation();
                if (grouped) map.current?.animateToRegion(regionForCluster(cluster, region), reduceMotion ? 0 : 400);
                else onSelect(cluster.members[0].id);
              }}
            >
              <View style={[styles.markerBounds, { width: size + 28, height: size + 28 }]}>
                {grouped && <Image source={imageFor(cluster.members[1].photos[0] ?? 'mountain')} style={styles.rearPhoto} />}
                <View style={[styles.photoBorder, { width: size, height: size, borderRadius: 4, borderWidth: selected ? 5 : 3 }, selected && styles.selected]}>
                  <Image source={imageFor(cluster.members[0].photos[0] ?? 'mountain')} style={styles.photo} />
                </View>
                {grouped && <View style={styles.count}><Text style={styles.countText}>+{cluster.members.length - 1}</Text></View>}
              </View>
            </Marker>
          );
        })}
        {userCoordinate && <Marker coordinate={userCoordinate} anchor={{ x: .5, y: .5 }} accessibilityLabel="La tua posizione"><View style={styles.pickedHalo}><View style={styles.pickedPoint} /></View></Marker>}
        {picking && pickedCoordinate && <Marker
          coordinate={pickedCoordinate}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={20}
          accessibilityLabel="Posizione del nuovo spot"
        >
          <View style={styles.pickedHalo}><View style={styles.pickedPoint} /></View>
        </Marker>}
      </MapView>
      {loadFailed && <View style={styles.error} accessibilityLiveRegion="polite">
        <Text style={styles.errorText}>La mappa sta impiegando più tempo del previsto.</Text>
        <Pressable accessibilityRole="button" onPress={() => { setReady(false); setLoadFailed(false); setAttempt(value => value + 1); }}><Text style={styles.retry}>Riprova</Text></Pressable>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.paper },
  markerBounds: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  photoBorder: { borderColor: theme.ink, backgroundColor: theme.paper, shadowColor: theme.ink, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  photo: { width: '100%', height: '100%', borderRadius: 0 },
  selected: { borderColor: theme.lime, shadowColor: theme.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 3, height: 3 }, elevation: 6 },
  rearPhoto: { position: 'absolute', top: 9, right: 9, width: 38, height: 38, borderRadius: 4, borderWidth: 3, borderColor: theme.ink },
  count: { position: 'absolute', top: 1, right: 0, minWidth: 23, height: 23, paddingHorizontal: 3, borderRadius: 12, backgroundColor: theme.lime, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 12, color: theme.ink, fontWeight: '600' },
  pickedHalo: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#00804C33', alignItems: 'center', justifyContent: 'center' },
  pickedPoint: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.green, borderWidth: 4, borderColor: theme.ink, shadowColor: theme.green, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 3 },
  error: { position: 'absolute', top: '40%', alignSelf: 'center', padding: 18, borderRadius: 0, backgroundColor: theme.paper, alignItems: 'center', gap: 10 },
  errorText: { fontSize: 14, color: theme.ink },
  retry: { color: theme.green, fontSize: 15, fontWeight: '600' },
});
