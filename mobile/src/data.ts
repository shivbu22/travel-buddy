import type { ProfileInput, TripInput } from '@raahi/contracts';
export const heroImage = 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1000&q=85';
export const travelStyles = ['Food', 'Culture', 'Heritage', 'Nature', 'Photography', 'Beach', 'Wellness', 'Nightlife', 'Walks', 'Adventure'];
export const IndianLanguages = ['English', 'Hindi', 'Bengali', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Gujarati', 'Punjabi', 'Urdu'];
export const destinations = [
  { city: 'Goa', country: 'India', styles: ['Beach', 'Food', 'Nightlife'], note: 'Slow coast days and sunset plans' },
  { city: 'Jaipur', country: 'India', styles: ['Heritage', 'Food', 'Photography'], note: 'Forts, bazaars, and long dinners' },
  { city: 'Kochi', country: 'India', styles: ['Culture', 'Food', 'Walks'], note: 'Art, backwaters, and local cafés' },
  { city: 'Leh', country: 'India', styles: ['Nature', 'Adventure', 'Photography'], note: 'High-altitude roads and quiet mornings' },
  { city: 'Tokyo', country: 'Japan', styles: ['Food', 'Culture', 'Walks'], note: 'Neighborhoods worth getting lost in' },
  { city: 'Bali', country: 'Indonesia', styles: ['Wellness', 'Nature', 'Beach'], note: 'A softer pace, shared' },
];
export const emptyProfile: ProfileInput = { name: '', age: 18, gender: 'Non-binary', city: '', bio: '', languages: ['English'], styles: [], pace: 'Balanced', safety: 'open', intent: 'Meaningful connection', hometown: '', occupation: '', education: '', heightCm: null, relationshipGoal: '', prompts: [{ question: 'My ideal travel day', answer: '' }] };
export function emptyTrip(): TripInput {
  const start = new Date(); start.setUTCDate(start.getUTCDate() + 30);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 10);
  return { city: '', country: '', start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), flexible: false, budgetMin: 5000, budgetMax: 9000, currency: 'INR', styles: [], description: '' };
}
