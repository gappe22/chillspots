import React, { useEffect, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';
import { imageUri } from './assets';
import { theme } from './theme';
import { clusterSpots, INITIAL_REGION, regionForCluster, type Coordinate, type SpotMapProps } from './mapHelpers';

export type { SpotMapProps } from './mapHelpers';

type LatLng = [number, number];
type MapEvent = { latlng?: { lat: number; lng: number } };
type Bounds = {
  getCenter(): { lat: number; lng: number };
  getNorth(): number;
  getSouth(): number;
  getEast(): number;
  getWest(): number;
};
type Layer = {
  addTo(map: LeafletMap): Layer;
  remove(): void;
  on(event: string, callback: () => void): Layer;
};
type LeafletMap = {
  fitBounds(bounds: LatLng[], options?: { padding?: [number, number]; animate?: boolean; duration?: number }): void;
  flyToBounds(bounds: LatLng[], options?: { padding?: [number, number]; duration?: number }): void;
  getBounds(): Bounds;
  latLngToContainerPoint(coordinate: LatLng): { x: number; y: number };
  on(event: string, callback: (event: MapEvent) => void): void;
  invalidateSize(options?: { pan: boolean }): void;
  remove(): void;
  zoomIn(delta?: number, options?: { animate: boolean }): void;
  zoomOut(delta?: number, options?: { animate: boolean }): void;
};
type Leaflet = {
  map(element: HTMLElement, options: { zoomControl: boolean; attributionControl: boolean; minZoom: number; maxZoom: number; zoomSnap: number }): LeafletMap;
  tileLayer(url: string, options: { attribution: string; maxZoom: number }): Layer;
  marker(coordinate: LatLng, options: { icon: unknown; keyboard: boolean; zIndexOffset: number }): Layer;
  divIcon(options: { html: HTMLElement; className: string; iconSize: [number, number]; iconAnchor: [number, number] }): unknown;
};
type Context = { library: Leaflet; map: LeafletMap };
let leafletPromise: Promise<Leaflet> | undefined;

function loadLeaflet(): Promise<Leaflet> {
  const loaded = (window as unknown as { L?: Leaflet }).L;
  if (loaded) return Promise.resolve(loaded);
  if (!leafletPromise) {
    leafletPromise = new Promise<Leaflet>((resolve, reject) => {
      if (!document.querySelector('link[href="/vendor/leaflet.css"]')) {
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = '/vendor/leaflet.css';
        document.head.appendChild(stylesheet);
      }
      const script = document.createElement('script');
      script.src = '/vendor/leaflet.js';
      script.async = true;
      const timeout = window.setTimeout(() => fail(), 15000);
      function fail() {
        window.clearTimeout(timeout);
        leafletPromise = undefined;
        script.remove();
        reject(new Error('Impossibile caricare la mappa. Controlla la connessione e riprova.'));
      }
      script.onload = () => {
        window.clearTimeout(timeout);
        const library = (window as unknown as { L?: Leaflet }).L;
        if (library) resolve(library);
        else fail();
      };
      script.onerror = fail;
      document.head.appendChild(script);
    });
  }
  return leafletPromise;
}

function readRegion(map: LeafletMap): Region {
  const bounds = map.getBounds();
  const center = bounds.getCenter();
  return { latitude: center.lat, longitude: center.lng, latitudeDelta: bounds.getNorth() - bounds.getSouth(), longitudeDelta: bounds.getEast() - bounds.getWest() };
}

function regionBounds(region: Region): LatLng[] {
  return [
    [region.latitude - region.latitudeDelta / 2, region.longitude - region.longitudeDelta / 2],
    [region.latitude + region.latitudeDelta / 2, region.longitude + region.longitudeDelta / 2],
  ];
}

function photo(key: string, size: number, border: number): HTMLImageElement {
  const image = document.createElement('img');
  image.src = imageUri(key);
  image.alt = '';
  image.draggable = false;
  Object.assign(image.style, {
    display: 'block', width: `${size}px`, height: `${size}px`, borderRadius: '4px',
    objectFit: 'cover', border: `${border}px solid ${theme.ink}`, boxSizing: 'border-box',
    background: theme.paper, boxShadow: '3px 3px 0 #001F3F',
  });
  return image;
}

export default function SpotMap(props: SpotMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const [context, setContext] = useState<Context | null>(null);
  const [revision, setRevision] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | undefined;
    let observer: ResizeObserver | undefined;
    setContext(null);
    setError(null);
    loadLeaflet().then(library => {
      if (disposed || !container.current) return;
      const activeMap = library.map(container.current, { zoomControl: false, attributionControl: true, minZoom: 3, maxZoom: 19, zoomSnap: 0 });
      map = activeMap;
      activeMap.fitBounds(regionBounds(INITIAL_REGION));
      let failedTiles = 0;
      library.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
        maxZoom: 19,
      }).on('tileerror', () => {
        failedTiles += 1;
        if (!disposed && failedTiles >= 4) setError('Impossibile caricare la mappa. Controlla la connessione e riprova.');
      }).on('tileload', () => {
        failedTiles = 0;
        if (!disposed) setError(null);
      }).addTo(activeMap);
      activeMap.on('moveend', () => {
        if (disposed) return;
        setRevision(value => value + 1);
        callbacks.current.onRegionChange?.(readRegion(activeMap));
      });
      activeMap.on('click', event => {
        if (callbacks.current.picking && event.latlng) callbacks.current.onPick?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      });
      observer = new ResizeObserver(() => {
        activeMap.invalidateSize({ pan: false });
        setRevision(value => value + 1);
      });
      observer.observe(container.current);
      setContext({ library, map: activeMap });
      callbacks.current.onRegionChange?.(readRegion(activeMap));
    }).catch(reason => {
      if (!disposed) setError(reason instanceof Error ? reason.message : 'Impossibile caricare la mappa. Riprova.');
    });
    return () => { disposed = true; observer?.disconnect(); map?.remove(); };
  }, [attempt]);

  useEffect(() => {
    if (!context || !props.target) return;
    const bounds = regionBounds({
      ...props.target,
      latitudeDelta: props.target.latitudeDelta ?? 0.12,
      longitudeDelta: props.target.longitudeDelta ?? 0.12,
    });
    if (props.reduceMotion) context.map.fitBounds(bounds, { animate: false });
    else context.map.flyToBounds(bounds, { duration: 0.45 });
  }, [context, props.target, props.reduceMotion]);
  useEffect(() => {
    if (!context || !props.zoomRequest) return;
    if (props.zoomRequest.direction === 'in') context.map.zoomIn(1, { animate: !props.reduceMotion }); else context.map.zoomOut(1, { animate: !props.reduceMotion });
  }, [context, props.zoomRequest]);

  useEffect(() => {
    if (!context) return;
    const { library, map } = context;
    const clusters = clusterSpots(props.spots, props.selectedId, (coordinate: Coordinate) => map.latLngToContainerPoint([coordinate.latitude, coordinate.longitude]));
    const layers: Layer[] = [];
    for (const cluster of clusters) {
      const selected = cluster.members[0].id === props.selectedId;
      const grouped = cluster.members.length > 1;
      const size = selected ? 72 : 44;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chillspots-map-photo';
      button.setAttribute('aria-label', grouped ? `Ingrandisci ${cluster.members.length} spot` : `Apri ${cluster.members[0].name}`);
      if (selected) button.setAttribute('aria-pressed', 'true');
      Object.assign(button.style, {
        position: 'relative', display: 'block', padding: '0', margin: '0', border: 'none',
        width: `${size}px`, height: `${size}px`, borderRadius: '4px', cursor: 'pointer',
        background: 'transparent', WebkitTapHighlightColor: 'transparent',
        boxShadow: '3px 3px 0 #001F3F',
      });
      if (grouped) {
        const rear = photo(cluster.members[1].photos[0] ?? 'mountain', 38, 3);
        Object.assign(rear.style, { position: 'absolute', top: '-4px', right: '-5px' });
        button.appendChild(rear);
      }
      const main = photo(cluster.members[0].photos[0] ?? 'mountain', size, selected ? 6 : 4);
      main.style.position = 'relative';
      main.style.borderColor = selected ? theme.lime : theme.ink;
      button.appendChild(main);
      if (grouped) {
        const badge = document.createElement('span');
        badge.textContent = `+${cluster.members.length - 1}`;
        Object.assign(badge.style, {
          position: 'absolute', top: '-8px', right: '-12px', minWidth: '23px', height: '23px',
          padding: '0 3px', boxSizing: 'border-box', borderRadius: '12px', background: theme.lime,
          color: theme.ink, font: '600 12px/23px -apple-system, BlinkMacSystemFont, sans-serif', textAlign: 'center',
        });
        button.appendChild(badge);
      }
      button.addEventListener('click', event => {
        event.stopPropagation();
        if (grouped) { const bounds = regionBounds(regionForCluster(cluster, readRegion(map))); if (callbacks.current.reduceMotion) map.fitBounds(bounds, { animate: false }); else map.flyToBounds(bounds, { duration: 0.4 }); }
        else callbacks.current.onSelect(cluster.members[0].id);
      });
      button.addEventListener('dblclick', event => event.stopPropagation());
      button.addEventListener('pointerdown', event => event.stopPropagation());
      button.addEventListener('mousedown', event => event.stopPropagation());
      button.addEventListener('touchstart', event => event.stopPropagation(), { passive: true });
      const icon = library.divIcon({ html: button, className: 'chillspots-photo-marker', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      layers.push(library.marker([cluster.coordinate.latitude, cluster.coordinate.longitude], { icon, keyboard: false, zIndexOffset: selected ? 1000 : 0 }).addTo(map));
    }
    return () => layers.forEach(layer => layer.remove());
  }, [context, props.spots, props.selectedId, revision]);

  useEffect(() => {
    if (!context) return;
    const layers: Layer[] = [];
    for (const [coordinate, label] of [[props.picking ? props.pickedCoordinate : undefined, 'Posizione del nuovo spot'], [props.userCoordinate, 'La tua posizione']] as const) {
      if (!coordinate) continue;
      const point = document.createElement('div');
      point.setAttribute('role', 'img'); point.setAttribute('aria-label', label);
      Object.assign(point.style, { width: '20px', height: '20px', borderRadius: '50%', background: theme.green, border: `3px solid ${theme.paper}`, boxSizing: 'border-box', pointerEvents: 'none', boxShadow: '0 0 0 8px #00804C33,0 0 0 1px #001F3F' });
      const icon = context.library.divIcon({ html: point, className: 'chillspots-photo-marker', iconSize: [20, 20], iconAnchor: [10, 10] });
      layers.push(context.library.marker([coordinate.latitude, coordinate.longitude], { icon, keyboard: false, zIndexOffset: 2000 }).addTo(context.map));
    }
    return () => layers.forEach(layer => layer.remove());
  }, [context, props.picking, props.pickedCoordinate, props.userCoordinate]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: '#F6F7ED' }}>
      <style>{`.chillspots-photo-marker{background:transparent!important;border:0!important}.chillspots-map-photo:focus-visible{outline:3px solid #00804C;outline-offset:4px}.chillspots-leaflet .leaflet-bottom{bottom:${props.bottomInset ?? 0}px}.chillspots-leaflet .leaflet-control-attribution{font:9px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;background:#F6F7ED;color:#001F3F}.chillspots-leaflet .leaflet-control-attribution a{color:#001F3F}`}</style>
      <div ref={container} className="chillspots-leaflet" role="region" aria-label={props.picking ? 'Mappa: scegli la posizione del nuovo spot' : 'Mappa Chillspots. Seleziona una foto per esplorare uno spot.'} style={{ position: 'absolute', inset: 0, cursor: props.picking ? 'crosshair' : undefined }} />
      {(!context || error) && <div role="status" style={{ position: 'absolute', left: '50%', top: '40%', transform: 'translate(-50%,-50%)', zIndex: 500, minWidth: 180, maxWidth: 280, padding: 18, border: `2px solid ${theme.ink}`, borderRadius: 0, background: theme.paper, color: theme.ink, font: '14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif', textAlign: 'center', boxShadow: '4px 4px 0 #001F3F' }}>
        <div>{error ?? 'Caricamento mappa…'}</div>
        {error && <button type="button" onClick={() => setAttempt(value => value + 1)} style={{ marginTop: 12, padding: 8, border: 0, background: 'transparent', color: '#00804C', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Riprova</button>}
      </div>}
    </div>
  );
}
