import assert from 'node:assert/strict';
import test from 'node:test';
import { profileSchema, tripSchema, overlap, safetyAllows } from '@raahi/contracts';
import { emptyTrip } from '../src/data';
import { normalizePhotoUrl, resolveApiAddress } from '../src/api-address';

test('new trip drafts have a future ten-day window', () => {
  const draft = emptyTrip();
  assert.equal(overlap(draft.start, draft.end, draft.start, draft.end), 11);
  assert.equal(tripSchema.safeParse({ ...draft, city: 'Tokyo', country: 'Japan', styles: ['Food'], description: 'A real trip note.' }).success, true);
});

test('profile safety preferences are reciprocal', () => {
  assert.equal(safetyAllows({ safety: 'women_only', gender: 'Woman' }, { safety: 'open', gender: 'Woman' }), true);
  assert.equal(safetyAllows({ safety: 'women_only', gender: 'Woman' }, { safety: 'open', gender: 'Man' }), false);
});

test('profile validation requires a useful introduction and style', () => {
  assert.equal(profileSchema.safeParse({ name: 'Aanya', age: 28, gender: 'Woman', city: 'Mumbai', bio: 'Short', languages: ['English'], styles: [], pace: 'Balanced', safety: 'open', intent: 'Meaningful connection', prompts: [{ question: 'Day', answer: 'A' }] }).success, false);
});

test('local development URLs never use HTTPS against the phone API', () => {
  const api = resolveApiAddress('https://192.168.1.7:4000/v1', undefined, true, false);
  assert.equal(api, 'http://192.168.1.7:4000/v1');
  assert.equal(normalizePhotoUrl('https://192.168.1.7:4000/uploads/photo.jpg', api), 'http://192.168.1.7:4000/uploads/photo.jpg');
});

test('local development follows the current Expo LAN host when the saved IP changes', () => {
  assert.equal(resolveApiAddress('http://192.168.1.7:4000/v1', '192.168.1.42:8081', true, false), 'http://192.168.1.42:4000/v1');
  assert.equal(resolveApiAddress('https://api.raahi.app/v1', '192.168.1.42:8081', true, false), 'https://api.raahi.app/v1');
});
