import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Text, View } from 'react-native';
import type { MapCircleProps, MapViewProps, MapMarkerProps, Region } from 'react-native-maps';

type Coordinates = [number, number];
type Bounds = {
  getCenter(): { lat: number; lng: number };
  getNorth(): number;
  getSouth(): number;
  getEast(): number;
  getWest(): number;
};
type Layer = { addTo(map: LeafletMap): Layer; remove(): void };
type LeafletMap = {
  fitBounds(bounds: Coordinates[], options: { padding: Coordinates }): void;
  getBounds(): Bounds;
  on(event: string, handler: () => void): void;
  invalidateSize(): void;
  remove(): void;
};
type Leaflet = {
  map(element: HTMLElement): LeafletMap;
  tileLayer(url: string, options: { attribution: string; maxZoom: number }): Layer;
  marker(coordinates: Coordinates, options: { icon: unknown; title?: string }): Layer;
  divIcon(options: { html: HTMLElement; className: string; iconSize: Coordinates; iconAnchor: Coordinates }): unknown;
  circle(coordinates: Coordinates, options: { radius: number; color?: string; fillColor?: string }): Layer;
};
type MapContextValue = { library: Leaflet; map: LeafletMap };

const MapContext = createContext<MapContextValue | null>(null);
let libraryPromise: Promise<Leaflet> | undefined;

function loadLeaflet() {
  if (!libraryPromise) {
    libraryPromise = new Promise<Leaflet>((resolve, reject) => {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = '/vendor/leaflet.css';
      document.head.appendChild(stylesheet);
      const script = document.createElement('script');
      script.src = '/vendor/leaflet.js';
      script.onload = () => resolve((window as unknown as { L: Leaflet }).L);
      script.onerror = () => {
        libraryPromise = undefined;
        reject(new Error('The map could not be loaded. Please refresh to try again.'));
      };
      document.head.appendChild(script);
    });
  }
  return libraryPromise;
}

function readRegion(map: LeafletMap): Region {
  const bounds = map.getBounds();
  const center = bounds.getCenter();
  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: bounds.getNorth() - bounds.getSouth(),
    longitudeDelta: bounds.getEast() - bounds.getWest(),
  };
}

export default function MapView({ initialRegion, style, children, onRegionChange, onRegionChangeComplete }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const initial = useRef(initialRegion);
  const callbacks = useRef({ onRegionChange, onRegionChangeComplete });
  callbacks.current = { onRegionChange, onRegionChangeComplete };
  const [context, setContext] = useState<MapContextValue | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | undefined;
    let observer: ResizeObserver | undefined;
    loadLeaflet().then(library => {
      if (disposed || !container.current) return;
      map = library.map(container.current);
      const region = initial.current ?? { latitude: 45.49, longitude: 10.5, latitudeDelta: 0.05, longitudeDelta: 0.05 };
      map.fitBounds([
        [region.latitude - region.latitudeDelta / 2, region.longitude - region.longitudeDelta / 2],
        [region.latitude + region.latitudeDelta / 2, region.longitude + region.longitudeDelta / 2],
      ], { padding: [0, 0] });
      library.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      const activeMap = map;
      activeMap.on('move', () => callbacks.current.onRegionChange?.(readRegion(activeMap), { isGesture: true }));
      activeMap.on('moveend', () => callbacks.current.onRegionChangeComplete?.(readRegion(activeMap), { isGesture: true }));
      observer = new ResizeObserver(() => activeMap.invalidateSize());
      observer.observe(container.current);
      setContext({ library, map });
    }).catch(reason => {
      if (!disposed) setError(reason.message);
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      map?.remove();
    };
  }, []);

  return (
    <View style={style}>
      <div ref={container} aria-label="Chillspots map" style={{ position: 'absolute', inset: 0 }} />
      {!context && <Text style={{ padding: 20 }}>{error ?? 'Loading map…'}</Text>}
      {context && <MapContext.Provider value={context}>{children}</MapContext.Provider>}
    </View>
  );
}

export function Marker({ coordinate, children, title }: MapMarkerProps) {
  const context = useContext(MapContext);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!context || !coordinate) return;
    const host = document.createElement('div');
    const icon = context.library.divIcon({ html: host, className: 'chillspots-marker', iconSize: [50, 50], iconAnchor: [25, 25] });
    const marker = context.library.marker([coordinate.latitude, coordinate.longitude], { icon, title }).addTo(context.map);
    setElement(host);
    return () => { marker.remove(); };
  }, [context, coordinate?.latitude, coordinate?.longitude, title]);
  return element ? createPortal(children, element) : null;
}

export function Circle({ center, radius, strokeColor, fillColor }: MapCircleProps) {
  const context = useContext(MapContext);
  useEffect(() => {
    if (!context || !center) return;
    const circle = context.library.circle([center.latitude, center.longitude], {
      radius,
      color: typeof strokeColor === 'string' ? strokeColor : undefined,
      fillColor: typeof fillColor === 'string' ? fillColor : undefined,
    }).addTo(context.map);
    return () => { circle.remove(); };
  }, [context, center?.latitude, center?.longitude, radius, strokeColor, fillColor]);
  return null;
}
