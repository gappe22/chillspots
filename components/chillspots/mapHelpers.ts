import type { Region } from 'react-native-maps';
import type { Spot } from '@/shared/types';

export type Coordinate = { latitude: number; longitude: number };
export interface SpotMapProps {
  spots: Spot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRegionChange?: (region: Region) => void;
  picking?: boolean;
  pickedCoordinate?: Coordinate;
  onPick?: (coordinate: Coordinate) => void;
  target?: Coordinate & { latitudeDelta?: number; longitudeDelta?: number };
  bottomInset?: number;
  reduceMotion?: boolean;
  userCoordinate?: Coordinate;
  zoomRequest?: { direction: 'in' | 'out'; id: number };
  onInteract?: () => void;
}

export const INITIAL_REGION: Region = {
  latitude: 45.65,
  longitude: 10.38,
  latitudeDelta: 0.45,
  longitudeDelta: 0.45,
};

export interface MapCluster {
  id: string;
  members: Spot[];
  coordinate: Coordinate;
}

/** Group nearby photos in screen space; keep the selected photo visible. */
export function clusterSpots(
  spots: Spot[],
  selectedId: string | null,
  project: (coordinate: Coordinate) => { x: number; y: number },
  radius = 50,
): MapCluster[] {
  const clusters: (MapCluster & { x: number; y: number })[] = [];
  for (const spot of spots) {
    const point = project(spot);
    const nearby = spot.id === selectedId ? undefined : clusters.find(cluster =>
      cluster.members[0].id !== selectedId &&
      Math.hypot(point.x - cluster.x, point.y - cluster.y) < radius,
    );
    if (nearby) {
      nearby.members.push(spot);
      const count = nearby.members.length;
      nearby.coordinate = {
        latitude: nearby.coordinate.latitude + (spot.latitude - nearby.coordinate.latitude) / count,
        longitude: nearby.coordinate.longitude + (spot.longitude - nearby.coordinate.longitude) / count,
      };
      nearby.x += (point.x - nearby.x) / count;
      nearby.y += (point.y - nearby.y) / count;
    } else {
      clusters.push({
        id: spot.id,
        members: [spot],
        coordinate: { latitude: spot.latitude, longitude: spot.longitude },
        x: point.x,
        y: point.y,
      });
    }
  }
  return clusters;
}

export function regionForCluster(cluster: MapCluster, region: Region): Region {
  const latitudes = cluster.members.map(spot => spot.latitude);
  const longitudes = cluster.members.map(spot => spot.longitude);
  return {
    ...cluster.coordinate,
    latitudeDelta: Math.max(0.008, Math.min(region.latitudeDelta / 2, (Math.max(...latitudes) - Math.min(...latitudes)) * 2.4)),
    longitudeDelta: Math.max(0.008, Math.min(region.longitudeDelta / 2, (Math.max(...longitudes) - Math.min(...longitudes)) * 2.4)),
  };
}
