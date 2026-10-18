import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is for development only.');
  const people = [
    { phone: '+919000000001', name: 'Aanya', gender: 'Woman', age: 28, city: 'Mumbai', photo: 'photo-1534528741775-53994a69daeb', styles: ['Food', 'Culture', 'Photography'] },
    { phone: '+919000000002', name: 'Zoe', gender: 'Woman', age: 27, city: 'London', photo: 'photo-1524504388940-b1c1722653e1', styles: ['Food', 'Culture', 'Design'] },
    { phone: '+919000000003', name: 'Arjun', gender: 'Man', age: 29, city: 'Bengaluru', photo: 'photo-1500648767791-00dcc994a43e', styles: ['Food', 'Nature', 'Photography'] },
  ];
  const start = new Date(); start.setUTCDate(start.getUTCDate() + 30);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 10);
  await db.user.updateMany({ where: { phone: { startsWith: '+91900000000' } }, data: { verified: true, onboarded: true, verificationStatus: 'APPROVED' } });
  for (const person of people) {
    const { photo, ...data } = person;
    const exists = await db.user.findUnique({ where: { phone: person.phone } });
    if (exists) continue;
    const user = await db.user.create({ data: { ...data, verified: true, verificationStatus: 'APPROVED', onboarded: true, bio: 'Slow mornings, tiny coffee shops, and finding the best neighborhood food. Looking for someone curious to explore with.', pace: 'Balanced', intent: 'Meaningful connection', safety: 'open', languages: ['English', 'Hindi'], photos: { create: [0, 1, 2].map((i) => ({ key: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=900&q=85&sig=${i}`, sortOrder: i })) }, prompts: { create: { question: 'My ideal travel day', answer: 'No alarm. A good coffee. One neighborhood explored properly, and a dinner recommendation from a local.' } } } });
    await db.trip.create({ data: { userId: user.id, city: 'Tokyo', country: 'Japan', key: 'tokyo|japan', start, end, currency: 'INR', budgetMin: 5000, budgetMax: 9000, styles: data.styles, description: 'Coffee, bookstores, neighborhood wandering, and one unforgettable bowl of ramen.' } });
  }
  console.log('Seed ready: +919000000001 (Aanya), +919000000002 (Zoe), +919000000003 (Arjun). Request a fresh OTP to sign in.');
}
main().finally(() => db.$disconnect());
