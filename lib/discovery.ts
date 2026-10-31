import type { Spot } from '@/shared/types';
import type { Coordinate } from '@/components/chillspots/mapHelpers';
export type Filter = 'all' | 'beauty' | 'privacy' | 'accessibility';
export type Sort = 'recommended' | 'distance' | 'recent';
export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it');
export function distanceKm(a: Coordinate, b: Coordinate) {
  const rad = Math.PI / 180, lat = (b.latitude - a.latitude) * rad, lng = (b.longitude - a.longitude) * rad;
  const value = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(lng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, value)));
}
export function distanceLabel(km: number, unit: 'km' | 'mi') { const value = unit === 'mi' ? km / 1.609344 : km; return `${value < 10 ? value.toFixed(1).replace('.', ',') : Math.round(value)} ${unit}`; }
export function discover(spots: Spot[], query: string, filter: Filter, sort: Sort, origin: Coordinate) {
  const needle = normalize(query.trim());
  return spots.filter(spot => normalize(`${spot.name} ${spot.locality} ${spot.description}`).includes(needle) && (filter === 'all' || spot.ratings[filter] >= 4)).sort((a, b) => sort === 'distance' ? distanceKm(origin, a) - distanceKm(origin, b) : sort === 'recent' ? (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0) : b.ratings.overall - a.ratings.overall);
}
