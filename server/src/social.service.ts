import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Trip } from '@prisma/client';
import { ZodType } from 'zod';
import { createHash } from 'node:crypto';
import { interestSchema, messageSchema, overlap, photoOrderSchema, profileSchema, reportSchema, safetyAllows, tripSchema, UserDto, TripDto, TravelerDto, MessageDto, IncomingInterestDto, SubscriptionPlan } from '@raahi/contracts';
import { PrismaService } from './prisma.service';
import { SubscriptionService } from './subscription.service';
import { assertSafeUserText } from './content-safety';

const userInclude = {
  photos: { orderBy: { sortOrder: 'asc' as const } },
  prompts: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
  subscription: true,
};
type UserRecord = Prisma.UserGetPayload<{ include: typeof userInclude }>;
export const parse = <T>(schema: ZodType<T>, data: unknown): T => {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
  return parsed.data;
};
export const tripDto = (t: Trip): TripDto => ({ id: t.id, userId: t.userId, city: t.city, country: t.country, start: t.start.toISOString().slice(0, 10), end: t.end.toISOString().slice(0, 10), flexible: t.flexible, budgetMin: t.budgetMin, budgetMax: t.budgetMax, currency: t.currency as TripDto['currency'], styles: t.styles, description: t.description, status: t.status as TripDto['status'] });
export const messageDto = (m: { id: string; conversationId: string; senderId: string; body: string; createdAt: Date }): MessageDto => ({ ...m, createdAt: m.createdAt.toISOString() });

@Injectable()
export class SocialService {
  constructor(readonly db: PrismaService, readonly subscriptionService: SubscriptionService) {}
  dto(u: UserRecord): UserDto {
    const checks: [string, boolean][] = [['Profile details', profileSchema.safeParse(u).success], ['Three profile photos', u.photos.length >= 3], ['Verified sign-in', u.verified], ['Selfie approval', u.verificationStatus === 'APPROVED'], ['Save your profile', u.onboarded]];
    const missing = checks.filter(([, complete]) => !complete).map(([label]) => label);
    const isHingeX = Boolean(u.subscription && u.subscription.status === 'ACTIVE' && u.subscription.plan === 'X' && u.subscription.currentPeriodEnd.valueOf() > Date.now());
    const subscriptionPlan = (isHingeX ? 'X' : (u.subscription?.plan as SubscriptionPlan)) || 'FREE';
    return { id: u.id, name: u.name, age: u.age, gender: u.gender as UserDto['gender'], city: u.city, bio: u.bio, languages: u.languages, styles: u.styles, pace: u.pace as UserDto['pace'], safety: u.safety as UserDto['safety'], intent: u.intent as UserDto['intent'], hometown: u.hometown, occupation: u.occupation, education: u.education, heightCm: u.heightCm, relationshipGoal: u.relationshipGoal as UserDto['relationshipGoal'], onboarded: u.onboarded, verified: u.verified, verificationStatus: u.verificationStatus as UserDto['verificationStatus'], prompts: u.prompts.map(({ question, answer }) => ({ question, answer })), photos: u.photos.map((p) => p.key.startsWith('https://') ? p.key : `${process.env.PUBLIC_URL || 'http://localhost:4000'}/uploads/${p.key}`), photoIds: u.photos.map((p) => p.id), promptIds: u.prompts.map((p) => p.id), completeness: { percent: Math.round((checks.length - missing.length) / checks.length * 100), missing, discoveryReady: missing.length === 0 }, subscriptionPlan, isHingeX };
  }
  async me(id: string) {
    const user = await this.db.user.findUnique({ where: { id }, include: userInclude });
    if (!user) throw new NotFoundException('Account not found.');
    return this.dto(user);
  }
  async saveProfile(id: string, body: unknown) {
    const input = parse(profileSchema, body);
    assertSafeUserText(input.bio, 'profile introduction'); input.prompts.forEach((prompt) => assertSafeUserText(`${prompt.question} ${prompt.answer}`, 'prompt answer'));
    const photos = await this.db.photo.count({ where: { userId: id } });
    if (photos < 3) throw new BadRequestException('Add at least three profile photos.');
    const trust = await this.db.user.findUniqueOrThrow({ where: { id }, select: { verificationStatus: true } });
    if (!['PENDING', 'APPROVED'].includes(trust.verificationStatus)) throw new BadRequestException('Complete the selfie review before your profile can go live.');
    const { prompts, ...data } = input;
    const user = await this.db.user.update({ where: { id }, data: { ...data, onboarded: true, prompts: { deleteMany: {}, create: prompts.map((prompt, sortOrder) => ({ ...prompt, sortOrder })) } }, include: userInclude });
    return this.dto(user);
  }
  async addPhoto(id: string, key: string) {
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const photos = await tx.photo.findMany({ where: { userId: id } });
      const count = photos.length;
      if (count >= 6) throw new BadRequestException('Your profile can have up to six photos.');
      await tx.photo.create({ data: { userId: id, key, sortOrder: photos.reduce((max, photo) => Math.max(max, photo.sortOrder), -1) + 1 } });
    });
    return this.me(id);
  }
  async removePhoto(id: string, index: number) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id }, include: userInclude });
    if (user.onboarded && user.photos.length <= 3) throw new BadRequestException('Keep at least three profile photos.');
    if (!Number.isInteger(index) || !user.photos[index]) throw new NotFoundException();
    const key = user.photos[index].key;
    await this.db.photo.delete({ where: { id: user.photos[index].id } });
    return { user: await this.me(id), key };
  }
  async reorderPhotos(id: string, body: unknown) {
    const { order } = parse(photoOrderSchema, body);
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const photos = await tx.photo.findMany({ where: { userId: id }, orderBy: { sortOrder: 'asc' } });
      if (photos.length !== order.length || new Set(order).size !== photos.length || order.some((index) => !photos[index])) throw new BadRequestException('Refresh your photos before changing their order.');
      for (let position = 0; position < order.length; position++) await tx.photo.update({ where: { id: photos[order[position]].id }, data: { sortOrder: position } });
    });
    return this.me(id);
  }
  async replacePhoto(id: string, index: number, key: string) {
    const oldKey = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const photos = await tx.photo.findMany({ where: { userId: id }, orderBy: { sortOrder: 'asc' } });
      if (!Number.isInteger(index) || !photos[index]) throw new BadRequestException('That photo is no longer available. Refresh and retry.');
      await tx.photo.update({ where: { id: photos[index].id }, data: { key } });
      return photos[index].key;
    });
    return { user: await this.me(id), oldKey };
  }
  async trips(id: string) { return (await this.db.trip.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } })).map(tripDto); }
  async saveTrip(id: string, body: unknown, tripId?: string) {
    const data = parse(tripSchema, body);
    assertSafeUserText(data.description, 'trip description');
    if (data.end < new Date().toISOString().slice(0, 10)) throw new BadRequestException('Choose a trip that has not already ended.');
    const user = await this.me(id);
    if (!user.onboarded) throw new BadRequestException('Complete your profile first.');
    if (tripId && !(await this.db.trip.findFirst({ where: { id: tripId, userId: id } }))) throw new NotFoundException();
    const write = { ...data, key: `${data.city.trim().toLowerCase()}|${data.country.trim().toLowerCase()}`, start: new Date(data.start), end: new Date(data.end) };
    return tripDto(tripId ? await this.db.trip.update({ where: { id: tripId }, data: write }) : await this.db.trip.create({ data: { ...write, userId: id } }));
  }
  async closeTrip(id: string, tripId: string) {
    if ((await this.db.trip.updateMany({ where: { id: tripId, userId: id }, data: { status: 'CLOSED' } })).count !== 1) throw new NotFoundException();
  }
  async blocked(a: string, b: string) { return Boolean(await this.db.block.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } })); }
  private compatible(a: UserDto, b: UserDto, at: Trip, bt: Trip) {
    return a.verified && b.verified && a.verificationStatus === 'APPROVED' && b.verificationStatus === 'APPROVED' && a.onboarded && b.onboarded && safetyAllows(a, b) && at.key === bt.key && at.status === 'OPEN' && bt.status === 'OPEN' && bt.end.valueOf() >= Date.now() - 86400000 && overlap(at.start.toISOString(), at.end.toISOString(), bt.start.toISOString(), bt.end.toISOString()) >= 3;
  }
  private traveler(viewer: UserDto, person: UserDto, own: Trip, trip: Trip): TravelerDto {
    const days = overlap(own.start.toISOString(), own.end.toISOString(), trip.start.toISOString(), trip.end.toISOString());
    const sharedStyles = own.styles.filter((style) => trip.styles.includes(style));
    const budgetOverlap = own.currency === trip.currency && Math.min(own.budgetMax, trip.budgetMax) >= Math.max(own.budgetMin, trip.budgetMin);
    const samePace = viewer.pace === person.pace;
    const compatibility = Math.min(99, 50 + Math.min(20, days * 2) + Math.min(15, sharedStyles.length * 5) + (samePace ? 8 : 0) + (budgetOverlap ? 6 : 0));
    const reasons = [`${days} shared days in ${trip.city}`, ...(sharedStyles.length ? [`Shared styles: ${sharedStyles.join(', ')}`] : []), ...(samePace ? [`Both prefer a ${person.pace.toLowerCase()} pace`] : []), ...(budgetOverlap ? [`Overlapping ${trip.currency} budgets`] : [])];
    const recommendation = { id: createHash('sha256').update(`${viewer.id}:${own.id}:${trip.id}`).digest('hex'), source: 'trip_overlap' as const, viewerTripId: own.id, reasons, budgetOverlap, samePace };
    return { ...person, trip: tripDto(trip), compatibility, sharedStyles, overlapDays: days, recommendation, isHingeX: person.isHingeX };
  }
  async feed(id: string, tripId?: string, style?: string): Promise<TravelerDto[]> {
    const viewer = await this.me(id);
    const [entitlement, dealbreakers] = await Promise.all([
      this.subscriptionService.getEntitlement(id),
      this.subscriptionService.getDealbreakers(id),
    ]);
    const own = await this.db.trip.findFirst({ where: { userId: id, status: 'OPEN', ...(tripId ? { id: tripId } : {}) }, orderBy: { createdAt: 'desc' } });
    if (!own) return [];
    const [blocks, interests, passes, matches] = await Promise.all([
      this.db.block.findMany({ where: { OR: [{ blockerId: id }, { blockedId: id }] } }),
      this.db.interest.findMany({ where: { fromUserId: id } }), this.db.pass.findMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } }),
      this.db.match.findMany({ where: { OR: [{ userAId: id }, { userBId: id }] } }),
    ]);
    const excluded = [id, ...blocks.map((b) => b.blockerId === id ? b.blockedId : b.blockerId), ...interests.map((i) => i.toUserId), ...passes.map((p) => p.fromUserId === id ? p.toUserId : p.fromUserId), ...matches.map((m) => m.userAId === id ? m.userBId : m.userAId)];
    const candidates = await this.db.trip.findMany({ where: { key: own.key, status: 'OPEN', userId: { notIn: excluded }, start: { lte: own.end }, end: { gte: own.start }, user: { verified: true, onboarded: true }, ...(style ? { styles: { has: style.slice(0, 40) } } : {}) }, include: { user: { include: userInclude } }, take: 100 });
    const cards: TravelerDto[] = []; const seen = new Set<string>();
    for (const trip of candidates) {
      const person = this.dto(trip.user);
      if (seen.has(person.id) || !this.compatible(viewer, person, own, trip)) continue;
      if (entitlement.hasStrictDealbreakers) {
        if (dealbreakers.strictVerifiedOnly && person.verificationStatus !== 'APPROVED') continue;
        if (dealbreakers.strictSamePace && person.pace !== viewer.pace) continue;
        if (dealbreakers.strictBudgetOverlap) {
          const budgetOverlap = own.currency === trip.currency && Math.min(own.budgetMax, trip.budgetMax) >= Math.max(own.budgetMin, trip.budgetMin);
          if (!budgetOverlap) continue;
        }
      }
      cards.push(this.traveler(viewer, person, own, trip)); seen.add(person.id);
    }
    return cards.sort((a, b) => b.compatibility - a.compatibility);
  }
  async incomingInterests(id: string): Promise<IncomingInterestDto[]> {
    const viewer = await this.me(id);
    const [ownTrips, blocks, passes, matches] = await Promise.all([
      this.db.trip.findMany({ where: { userId: id, status: 'OPEN' } }),
      this.db.block.findMany({ where: { OR: [{ blockerId: id }, { blockedId: id }] } }),
      this.db.pass.findMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } }),
      this.db.match.findMany({ where: { OR: [{ userAId: id }, { userBId: id }] } }),
    ]);
    if (!ownTrips.length) return [];
    const excluded = [id, ...blocks.map((b) => b.blockerId === id ? b.blockedId : b.blockerId), ...passes.map((p) => p.fromUserId === id ? p.toUserId : p.fromUserId), ...matches.map((m) => m.userAId === id ? m.userBId : m.userAId)];
    const incoming = await this.db.interest.findMany({ where: { toUserId: id, dismissedAt: null, fromUserId: { notIn: excluded } }, orderBy: [{ isPriority: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], take: 50 });
    const trips = await this.db.trip.findMany({ where: { userId: { in: incoming.map((i) => i.fromUserId) }, status: 'OPEN', key: { in: ownTrips.map((t) => t.key) } }, include: { user: { include: userInclude } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    const result: IncomingInterestDto[] = [];
    for (const interest of incoming) {
      const trip = trips.find((candidate) => candidate.userId === interest.fromUserId && ownTrips.some((ownTrip) => this.compatible(viewer, this.dto(candidate.user), ownTrip, candidate)));
      const own = trip && ownTrips.find((candidate) => this.compatible(viewer, this.dto(trip.user), candidate, trip));
      if (!trip || !own) continue;
      result.push({ id: interest.id, person: this.traveler(viewer, this.dto(trip.user), own, trip), recipientTrip: tripDto(own), kind: interest.kind as IncomingInterestDto['kind'], isPriority: interest.isPriority, target: interest.target as IncomingInterestDto['target'], targetText: interest.targetText, targetIndex: interest.targetIndex, comment: interest.comment, createdAt: interest.createdAt.toISOString() });
    }
    return result;
  }
  async dismissIncomingInterest(id: string, interestId: string) {
    const interest = await this.db.interest.findFirst({ where: { id: interestId, toUserId: id } });
    if (!interest) throw new NotFoundException('That interest is no longer available.');
    const pairKey = [id, interest.fromUserId].sort().join(':');
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pairKey}))`;
      if (await tx.match.findUnique({ where: { pairKey } })) throw new BadRequestException('This interest has already become a match. Use the connection controls to end it.');
      await tx.interest.updateMany({ where: { id: interestId, toUserId: id, dismissedAt: null }, data: { dismissedAt: new Date() } });
      await tx.pass.upsert({ where: { fromUserId_toUserId: { fromUserId: id, toUserId: interest.fromUserId } }, create: { fromUserId: id, toUserId: interest.fromUserId }, update: {} });
    });
  }
  async acceptIncomingInterest(id: string, interestId: string) {
    const incoming = (await this.incomingInterests(id)).find((i) => i.id === interestId);
    if (!incoming) {
      const previous = await this.db.interest.findFirst({ where: { id: interestId, toUserId: id, dismissedAt: null } });
      const match = previous && await this.db.match.findUnique({ where: { pairKey: [id, previous.fromUserId].sort().join(':') } });
      if (match && !match.ended && !await this.blocked(id, previous!.fromUserId)) return { mutual: true, matchId: match.id };
      throw new NotFoundException('That interest is no longer available. Refresh your connections.');
    }
    return this.interest(id, { toUserId: incoming.person.id, tripId: incoming.person.trip.id, source: 'incoming' }, interestId);
  }
  async profile(viewer: string, personId: string) {
    if (await this.blocked(viewer, personId)) throw new NotFoundException();
    const match = await this.db.match.findFirst({ where: { ended: false, OR: [{ userAId: viewer, userBId: personId }, { userAId: personId, userBId: viewer }] } });
    const incoming = (await this.incomingInterests(viewer)).find((i) => i.person.id === personId);
    if (incoming) return incoming.person;
    const ownTrips = await this.db.trip.findMany({ where: { userId: viewer, status: 'OPEN' } });
    const candidateTrips = await this.db.trip.findMany({ where: { userId: personId, status: 'OPEN' }, include: { user: { include: userInclude } } });
    const me = await this.me(viewer);
    const excluded = await this.db.pass.findFirst({ where: { OR: [{ fromUserId: viewer, toUserId: personId }, { fromUserId: personId, toUserId: viewer }] } });
    const history = await this.db.match.findUnique({ where: { pairKey: [viewer, personId].sort().join(':') } });
    if (!excluded && !history?.ended) for (const trip of candidateTrips) {
      const person = this.dto(trip.user);
      const own = ownTrips.find((t) => this.compatible(me, person, t, trip));
      if (own) return this.traveler(me, person, own, trip);
    }
    if (match) return this.me(personId);
    throw new ForbiddenException('This profile is not available.');
  }
  async pass(id: string, personId: string) {
    if (await this.db.pass.findUnique({ where: { fromUserId_toUserId: { fromUserId: id, toUserId: personId } } })) return;
    if (!(await this.feed(id)).some((c) => c.id === personId)) throw new BadRequestException('This profile is no longer in your discovery feed.');
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${[id, personId].sort().join(':')}))`;
      if (await tx.match.findUnique({ where: { pairKey: [id, personId].sort().join(':') } })) throw new BadRequestException('This connection has changed. Refresh your matches.');
      await tx.pass.upsert({ where: { fromUserId_toUserId: { fromUserId: id, toUserId: personId } }, create: { fromUserId: id, toUserId: personId }, update: {} });
    });
  }
  async interest(id: string, body: unknown, incomingId?: string) {
    const input = parse(interestSchema, body);
    const pairKey = [id, input.toUserId].sort().join(':');
    return this.db.$transaction(async (tx) => {
      // Serialize the daily allowance across different target pairs, too.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'interest-quota:' + id}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pairKey}))`;
      if (id === input.toUserId || await this.blocked(id, input.toUserId)) throw new ForbiddenException('This person is unavailable.');
      if (await tx.pass.findUnique({ where: { fromUserId_toUserId: { fromUserId: input.toUserId, toUserId: id } } })) throw new ForbiddenException('This person is unavailable.');
      const previousMatch = await tx.match.findUnique({ where: { pairKey } });
      if (previousMatch?.ended) throw new ForbiddenException('This connection was ended.');
      if (previousMatch) return { mutual: true, matchId: previousMatch.id };
      if (incomingId && !await tx.interest.findFirst({ where: { id: incomingId, toUserId: id, fromUserId: input.toUserId, dismissedAt: null } })) throw new NotFoundException('That interest is no longer available.');
      const existing = await tx.interest.findUnique({ where: { fromUserId_toUserId: { fromUserId: id, toUserId: input.toUserId } } });
      if (existing?.dismissedAt) throw new ForbiddenException('This person is unavailable.');
      const target = await tx.trip.findFirst({ where: { id: input.tripId, userId: input.toUserId }, include: { user: { include: userInclude } } });
      const ownUser = await tx.user.findUniqueOrThrow({ where: { id }, include: userInclude });
      const ownTrips = await tx.trip.findMany({ where: { userId: id, status: 'OPEN' } });
      if (!target || !ownTrips.some((trip) => this.compatible(this.dto(ownUser), this.dto(target.user), trip, target))) throw new ForbiddenException('Your travel dates or safety preferences no longer match.');
      if (!existing) {
        // Enforce daily like allowance and priority status via SubscriptionService
        const { isPriority } = await this.subscriptionService.recordLikeInTx(tx, id, Boolean(input.isPriority));
        const media = input.target === 'photo' ? target.user.photos : input.target === 'prompt' ? target.user.prompts : [];
        const index = input.targetId ? media.findIndex((m) => m.id === input.targetId) : input.targetIndex;
        if (['photo', 'prompt'].includes(input.target) && (index === undefined || !media[index])) throw new BadRequestException('That profile item changed. Refresh the profile before liking it.');
        if (input.kind === 'super' && await tx.interest.count({ where: { fromUserId: id, kind: 'super', createdAt: { gte: new Date(new Date().toISOString().slice(0, 10)) } } }) >= 1) throw new BadRequestException('Your daily Super Interest has been used.');
        const targetText = input.target === 'prompt' ? `${target.user.prompts[index!].question}: ${target.user.prompts[index!].answer}` : input.target === 'trip' ? `${target.city}, ${target.country} · ${target.start.toISOString().slice(0, 10)}–${target.end.toISOString().slice(0, 10)}` : input.target === 'photo' ? `Photo ${(index ?? 0) + 1}` : null;
        await tx.interest.create({ data: { fromUserId: id, ...input, isPriority, targetIndex: index, targetId: media[index ?? -1]?.id ?? (input.target === 'trip' ? target.id : null), targetText } });
      }
      const reciprocal = await tx.interest.findUnique({ where: { fromUserId_toUserId: { fromUserId: input.toUserId, toUserId: id } } });
      if (!reciprocal || reciprocal.dismissedAt) return { mutual: false, matchId: null };
      const [userAId, userBId] = [id, input.toUserId].sort();
      const match = await tx.match.upsert({ where: { pairKey }, create: { pairKey, userAId, userBId, tripId: input.tripId }, update: {} });
      if (match.ended) throw new ForbiddenException('This connection was ended.');
      return { mutual: true, matchId: match.id };
    });
  }
  async authorize(id: string, conversationId: string) {
    const match = await this.db.match.findUnique({ where: { id: conversationId } });
    if (!match || match.ended || (match.userAId !== id && match.userBId !== id) || await this.blocked(match.userAId, match.userBId)) throw new ForbiddenException('This conversation is unavailable.');
    return match;
  }
  async matches(id: string) {
    const matches = await this.db.match.findMany({ where: { ended: false, OR: [{ userAId: id }, { userBId: id }] }, orderBy: { createdAt: 'desc' } });
    const result = [];
    for (const match of matches) {
      if (await this.blocked(match.userAId, match.userBId)) continue;
      const personId = match.userAId === id ? match.userBId : match.userAId;
      const trip = await this.db.trip.findUnique({ where: { id: match.tripId } });
      if (!trip) continue;
      const [person, lastMessage, read] = await Promise.all([this.me(personId), this.db.message.findFirst({ where: { conversationId: match.id }, orderBy: { createdAt: 'desc' } }), this.db.readState.findUnique({ where: { conversationId_userId: { conversationId: match.id, userId: id } } })]);
      const unread = await this.db.message.count({ where: { conversationId: match.id, senderId: { not: id }, ...(read ? { createdAt: { gt: read.lastReadAt } } : {}) } });
      result.push({ id: match.id, person, trip: tripDto(trip), createdAt: match.createdAt.toISOString(), lastMessage: lastMessage ? messageDto(lastMessage) : null, unread });
    }
    return result;
  }
  async messages(id: string, conversationId: string, before?: string) {
    await this.authorize(id, conversationId);
    if (before && Number.isNaN(Date.parse(before))) throw new BadRequestException('Invalid pagination date.');
    const messages = await this.db.message.findMany({ where: { conversationId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) }, orderBy: { createdAt: 'desc' }, take: 50 });
    await this.db.readState.upsert({ where: { conversationId_userId: { conversationId, userId: id } }, create: { conversationId, userId: id }, update: { lastReadAt: new Date() } });
    return messages.reverse().map(messageDto);
  }
  async send(id: string, conversationId: string, body: unknown) {
    const match = await this.authorize(id, conversationId);
    const input = parse(messageSchema, body);
    assertSafeUserText(input.body, 'message');
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${match.pairKey}))`;
      await this.authorize(id, conversationId);
      const existing = await tx.message.findUnique({ where: { senderId_clientId: { senderId: id, clientId: input.clientId } } });
      if (existing) { if (existing.conversationId !== conversationId) throw new BadRequestException('Message ID was already used.'); return messageDto(existing); }
      return messageDto(await tx.message.create({ data: { senderId: id, conversationId, ...input } }));
    });
  }
  async block(id: string, target: string) {
    if (target === id || !(await this.db.user.findUnique({ where: { id: target } }))) throw new BadRequestException('Invalid profile.');
    const pairKey = [id, target].sort().join(':');
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pairKey}))`;
      await tx.block.upsert({ where: { blockerId_blockedId: { blockerId: id, blockedId: target } }, create: { blockerId: id, blockedId: target }, update: {} });
      await tx.match.updateMany({ where: { pairKey }, data: { ended: true } });
    });
  }
  async report(id: string, body: unknown) {
    const input = parse(reportSchema, body);
    if (input.userId === id || !(await this.db.user.findUnique({ where: { id: input.userId } }))) throw new BadRequestException('Invalid profile.');
    return this.db.report.create({ data: { reporterId: id, reportedUserId: input.userId, reason: input.reason, details: input.details } });
  }
  async unmatch(id: string, matchId: string) {
    const match = await this.authorize(id, matchId);
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${match.pairKey}))`;
      await tx.match.update({ where: { id: matchId }, data: { ended: true } });
    });
  }
}
