import { describe, expect, it, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { SocialService } from '../src/social.service';
import { SubscriptionService } from '../src/subscription.service';

const run = process.env.RUN_DB_TESTS === '1';
const db = new PrismaClient();
const subscription = new SubscriptionService(db as never);
const social = new SocialService(db as never, subscription);

describe.skipIf(!run)('database-backed social flow', () => {
  const created: string[] = [];
  afterAll(async () => {
    if (created.length) {
      await db.match.deleteMany({ where: { OR: [{ userAId: { in: created } }, { userBId: { in: created } }] } });
      await db.interest.deleteMany({ where: { OR: [{ fromUserId: { in: created } }, { toUserId: { in: created } }] } });
      await db.pass.deleteMany({ where: { OR: [{ fromUserId: { in: created } }, { toUserId: { in: created } }] } });
      await db.block.deleteMany({ where: { OR: [{ blockerId: { in: created } }, { blockedId: { in: created } }] } });
      await db.user.deleteMany({ where: { id: { in: created } } });
    }
    await db.$disconnect();
  });

  it('filters, gates mutual chat, and hides both sides after blocking', async () => {
    const suffix = Date.now().toString();
    const makeUser = (name: string, phone: string) => db.user.create({ data: {
      phone, name, age: 28, gender: 'Woman', city: 'Mumbai', bio: 'A patient, curious traveler who likes local food and long walks.', languages: ['English'], styles: ['Food', 'Culture'], pace: 'Balanced', safety: 'open', intent: 'Meaningful connection', verified: true, verificationStatus: 'APPROVED', onboarded: true,
      photos: { create: [0, 1, 2].map((sortOrder) => ({ key: `https://example.com/${suffix}-${name}-${sortOrder}.jpg`, sortOrder })) }, prompts: { create: { question: 'Ideal day', answer: 'Coffee, a neighborhood, and a kind conversation.' } },
    } });
    const a = await makeUser(`A-${suffix}`, `+9191${suffix}01`); const b = await makeUser(`B-${suffix}`, `+9191${suffix}02`); created.push(a.id, b.id);
    const start = new Date('2030-11-18T00:00:00.000Z'); const end = new Date('2030-11-28T00:00:00.000Z');
    const tripA = await db.trip.create({ data: { userId: a.id, city: 'Tokyo', country: 'Japan', key: 'tokyo|japan', start, end, budgetMin: 5000, budgetMax: 9000, currency: 'INR', styles: ['Food', 'Culture'], description: 'A slow, curious city trip.' } });
    const tripB = await db.trip.create({ data: { userId: b.id, city: 'Tokyo', country: 'Japan', key: 'tokyo|japan', start, end, budgetMin: 6000, budgetMax: 9000, currency: 'INR', styles: ['Food', 'Culture'], description: 'Neighborhoods, food, and tiny bookstores.' } });
    expect((await social.feed(a.id)).map((card) => card.id)).toContain(b.id);
    expect((await social.interest(a.id, { toUserId: b.id, tripId: tripB.id, kind: 'normal', target: 'prompt', targetIndex: 0, comment: 'That neighborhood plan sounds perfect.', source: 'profile' })).mutual).toBe(false);
    const incoming = await social.incomingInterests(b.id);
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({ person: { id: a.id, trip: { id: tripA.id } }, recipientTrip: { id: tripB.id }, target: 'prompt', targetIndex: 0, comment: 'That neighborhood plan sounds perfect.' });
    expect(incoming[0].targetText).toContain('Ideal day');
    const matchResult = await social.acceptIncomingInterest(b.id, incoming[0].id); expect(matchResult.mutual).toBe(true);
    const match = (await social.matches(a.id))[0]; expect(match.id).toBe(matchResult.matchId);
    const message = await social.send(a.id, match.id, { body: 'Coffee on day one?', clientId: `client-${suffix}` }); expect(message.body).toBe('Coffee on day one?');
    await expect(social.send(b.id, match.id, { body: 'Absolutely.', clientId: `client-${suffix}-b` })).resolves.toMatchObject({ senderId: b.id });
    await social.block(a.id, b.id);
    await expect(social.messages(b.id, match.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect((await social.feed(b.id)).map((card) => card.id)).not.toContain(a.id);
  });

  it('dismisses inbound interest without exposing it again', async () => {
    const suffix = `${Date.now()}-dismiss`;
    const makeUser = (name: string, phone: string) => db.user.create({ data: {
      phone, name, age: 28, gender: 'Woman', city: 'Mumbai', bio: 'A patient, curious traveler who likes local food and long walks.', languages: ['English'], styles: ['Food', 'Culture'], pace: 'Balanced', safety: 'open', intent: 'Meaningful connection', verified: true, verificationStatus: 'APPROVED', onboarded: true,
      photos: { create: [0, 1, 2].map((sortOrder) => ({ key: `https://example.com/${suffix}-${name}-${sortOrder}.jpg`, sortOrder })) }, prompts: { create: { question: 'Ideal day', answer: 'Coffee, a neighborhood, and a kind conversation.' } },
    } });
    const a = await makeUser(`C-${suffix}`, `+9191${Date.now().toString().slice(-8)}11`); const b = await makeUser(`D-${suffix}`, `+9191${Date.now().toString().slice(-8)}12`); created.push(a.id, b.id);
    const start = new Date('2031-01-18T00:00:00.000Z'); const end = new Date('2031-01-28T00:00:00.000Z');
    await db.trip.create({ data: { userId: a.id, city: 'Kyoto', country: 'Japan', key: 'kyoto|japan', start, end, budgetMin: 5000, budgetMax: 9000, currency: 'INR', styles: ['Food', 'Culture'], description: 'A slow, curious city trip.' } });
    const tripB = await db.trip.create({ data: { userId: b.id, city: 'Kyoto', country: 'Japan', key: 'kyoto|japan', start, end, budgetMin: 6000, budgetMax: 9000, currency: 'INR', styles: ['Food', 'Culture'], description: 'Neighborhoods and tiny bookstores.' } });
    await social.interest(a.id, { toUserId: b.id, tripId: tripB.id, kind: 'normal' });
    const incoming = await social.incomingInterests(b.id); expect(incoming).toHaveLength(1);
    await social.dismissIncomingInterest(b.id, incoming[0].id);
    expect(await social.incomingInterests(b.id)).toHaveLength(0);
    await expect(social.interest(a.id, { toUserId: b.id, tripId: tripB.id, kind: 'normal' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
