import test from 'node:test';
import assert from 'node:assert/strict';
import { discover, distanceKm, distanceLabel } from './discovery.ts';
const spot = (id, changes) => ({ id, name: id, locality: 'Brescia', description: '', latitude: 45.5, longitude: 10.2, photos: ['mountain'], reviewCount: 0, ratings: { overall: 4, beauty: 4, privacy: 4, accessibility: 4 }, ...changes });
test('discovery combines accent-insensitive search and category filters without mutating source', () => {
  const source = [spot('a', { name: 'Forèsta', ratings: { beauty: 4.9, privacy: 3.9, accessibility: 4, overall: 4.3 } }), spot('b', { name: 'Foresta alta' }), spot('c', { name: 'Lago' })];
  assert.deepEqual(discover(source, 'FORESTA', 'privacy', 'recommended', source[0]).map(item => item.id), ['b']);
  assert.deepEqual(discover(source, 'foresta', 'all', 'recommended', source[0]).map(item => item.id), ['a', 'b']);
  assert.deepEqual(source.map(item => item.id), ['a', 'b', 'c']);
});
test('distance and recency sorting use actual coordinates and dates', () => {
  const source = [spot('far', { latitude: 46.5, createdAt: '2026-01-01' }), spot('near', { createdAt: '2026-02-01' }), spot('legacy', { latitude: 45.6 })];
  assert.deepEqual(discover(source, '', 'all', 'distance', source[1]).map(item => item.id), ['near', 'legacy', 'far']);
  assert.deepEqual(discover(source, '', 'all', 'recent', source[1]).map(item => item.id), ['near', 'far', 'legacy']);
  assert.equal(distanceKm(source[0], source[0]), 0);
  const distance = distanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
  assert.ok(distance > 111 && distance < 112);
  assert.equal(distanceLabel(1.609344, 'mi'), '1,0 mi');
  assert.equal(distanceLabel(12.3, 'km'), '12 km');
});
