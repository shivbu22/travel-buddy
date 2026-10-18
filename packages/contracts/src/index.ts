import { z } from 'zod';

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(60),
  age: z.number().int().min(18).max(100),
  gender: z.enum(['Woman', 'Man', 'Non-binary']),
  city: z.string().trim().min(2).max(80),
  bio: z.string().trim().min(10).max(300),
  languages: z.array(z.string().min(2).max(30)).min(1).max(8),
  styles: z.array(z.string().min(2).max(40)).min(1).max(8),
  pace: z.enum(['Slow', 'Balanced', 'Fast']),
  safety: z.enum(['open', 'same_gender', 'women_only']),
  intent: z.enum(['Meaningful connection', 'Dating while travelling', 'Exploring together']),
  hometown: z.string().trim().max(80).default(''),
  occupation: z.string().trim().max(80).default(''),
  education: z.string().trim().max(120).default(''),
  heightCm: z.number().int().min(100).max(250).nullable().default(null),
  relationshipGoal: z.enum(['', 'Life partner', 'Long-term relationship', 'Short-term relationship', 'Figuring it out']).default(''),
  prompts: z.array(z.object({ question: z.string().min(4).max(120), answer: z.string().trim().min(10).max(500) })).min(1).max(5),
}).refine((p) => p.safety !== 'women_only' || p.gender === 'Woman', { message: 'Women-only mode is available to women.', path: ['safety'] });

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((d) => { const parsed = new Date(d); return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === d; }, 'Choose a valid date');
export const tripSchema = z.object({
  city: z.string().trim().min(2).max(80), country: z.string().trim().min(2).max(80),
  start: day, end: day, flexible: z.boolean().default(false),
  budgetMin: z.number().int().min(0).max(100000), budgetMax: z.number().int().min(1).max(100000),
  currency: z.enum(['INR', 'USD', 'EUR', 'JPY']).default('INR'),
  styles: z.array(z.string().min(2).max(40)).min(1).max(8),
  description: z.string().trim().min(10).max(500),
}).refine((t) => t.end >= t.start, { message: 'End date must follow start date', path: ['end'] })
  .refine((t) => t.budgetMax >= t.budgetMin, { message: 'Maximum budget must be at least the minimum', path: ['budgetMax'] });

export type ProfileInput = z.infer<typeof profileSchema>;
export type TripInput = z.infer<typeof tripSchema>;
export type UserDto = Omit<ProfileInput, 'prompts'> & {
  id: string; onboarded: boolean; verified: boolean; verificationStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'; photos: string[]; prompts: ProfileInput['prompts'];
  photoIds: string[]; promptIds: string[];
  completeness: { percent: number; missing: string[]; discoveryReady: boolean };
  subscriptionPlan?: SubscriptionPlan;
  isHingeX?: boolean;
};
export type TripDto = TripInput & { id: string; userId: string; status: 'OPEN' | 'CLOSED' };
export type TravelerDto = UserDto & {
  trip: TripDto;
  compatibility: number;
  sharedStyles: string[];
  overlapDays: number;
  recommendation: { id: string; source: 'trip_overlap'; viewerTripId: string; reasons: string[]; budgetOverlap: boolean; samePace: boolean };
  isHingeX?: boolean;
  isPriorityLike?: boolean;
};
export type SessionDto = { accessToken: string; refreshToken: string; userId: string };
export const reauthResponseSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('recent'), alreadyVerified: z.literal(true), expiresIn: z.number().int().positive() }),
  z.object({ method: z.literal('phone'), hint: z.string(), expiresIn: z.number().int().positive(), retryAfter: z.number().int().nonnegative(), devCode: z.string().regex(/^\d{6}$/).optional() }),
  z.object({ method: z.literal('apple'), nonce: z.string().min(32), expiresIn: z.number().int().positive() }),
]);
export type ReauthResponse = z.infer<typeof reauthResponseSchema>;
export const reauthVerifySchema = z.union([
  z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the six-digit verification code.') }).strict(),
  z.object({ identityToken: z.string().min(1).max(10000) }).strict(),
]);
export type ReauthVerifyInput = z.infer<typeof reauthVerifySchema>;
export type MatchDto = { id: string; person: UserDto; trip: TripDto; createdAt: string };
export type MessageDto = { id: string; conversationId: string; senderId: string; body: string; createdAt: string };
export type ConversationDto = MatchDto & { lastMessage: MessageDto | null; unread: number };
export type InterestResult = { mutual: boolean; matchId: string | null };
export type IncomingInterestDto = {
  id: string;
  person: TravelerDto;
  kind: 'normal' | 'super';
  isPriority: boolean;
  target: InterestTarget;
  targetText: string | null;
  recipientTrip: TripDto;
  targetIndex?: number | null;
  comment?: string | null;
  createdAt: string;
};
export const postSchema = z.object({
  caption: z.string().trim().min(1).max(500),
  city: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(80),
});
export const postCommentSchema = z.object({ body: z.string().trim().min(1).max(500) });
export const postReportSchema = z.object({ details: z.string().trim().max(900).default('') });
export type PostInput = z.infer<typeof postSchema>;
export type PostCommentDto = { id: string; author: Pick<UserDto, 'id' | 'name' | 'photos' | 'verified' | 'verificationStatus'>; body: string; createdAt: string };
export type PostDto = {
  id: string;
  author: Pick<UserDto, 'id' | 'name' | 'age' | 'city' | 'photos' | 'verified' | 'verificationStatus'>;
  media: string[];
  caption: string;
  city: string;
  country: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  comments: PostCommentDto[];
};
export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use international format, for example +919000000001');
export const interestSchema = z.object({
  toUserId: z.string().uuid(),
  tripId: z.string().uuid(),
  kind: z.enum(['normal', 'super']).default('normal'),
  isPriority: z.boolean().default(false),
  comment: z.string().trim().max(300).optional(),
  target: z.enum(['profile', 'photo', 'prompt', 'trip']).default('profile'),
  targetIndex: z.number().int().min(0).max(5).optional(),
  targetId: z.string().uuid().optional(),
  source: z.enum(['discover', 'profile', 'incoming']).default('discover')
});
export type InterestTarget = z.infer<typeof interestSchema>['target'];
export const photoOrderSchema = z.object({ order: z.array(z.number().int().min(0).max(5)).min(1).max(6) });
export const locationSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100000).nullable(), city: z.string().trim().min(2).max(80), neighborhood: z.string().trim().max(120).default('') });
export type PrivateLocationDto = z.infer<typeof locationSchema> & { updatedAt: string };
export const messageSchema = z.object({ body: z.string().trim().min(1).max(2000), clientId: z.string().min(10).max(100) });
export const reportSchema = z.object({ userId: z.string().uuid(), reason: z.enum(['Spam or scam', 'Harassment', 'Fake profile', 'Unsafe behavior', 'Other']), details: z.string().trim().max(1000).default('') });

// --- HingeX Subscription & Entitlements ---
export type SubscriptionPlan = 'FREE' | 'PLUS' | 'X';
export type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'EXPIRED';
export type BillingCycle = 'MONTHLY' | 'TRIMONTHLY' | 'SEMIANNUAL';

export type SubscriptionDto = {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startedAt: string;
  currentPeriodEnd: string;
  autoRenew: boolean;
};

export type EntitlementDto = {
  plan: SubscriptionPlan;
  isHingeX: boolean;
  isHingePlus: boolean;
  dailyLikesLimit: number | null;
  dailyLikesUsed: number;
  dailyLikesRemaining: number | null;
  hasPriorityLikes: boolean;
  hasEnhancedRecommendations: boolean;
  hasFullLikesYouGrid: boolean;
  hasStrictDealbreakers: boolean;
  subscription: SubscriptionDto | null;
};

export const upgradeSubscriptionSchema = z.object({
  plan: z.enum(['PLUS', 'X']),
  billingCycle: z.enum(['MONTHLY', 'TRIMONTHLY', 'SEMIANNUAL']).default('MONTHLY'),
});
export type UpgradeSubscriptionInput = z.infer<typeof upgradeSubscriptionSchema>;

export type PlanOfferingTier = {
  plan: 'PLUS' | 'X';
  name: string;
  tagline: string;
  pricing: {
    monthly: { price: number; formattedPrice: string; periodLabel: string };
    trimonthly: { price: number; formattedPrice: string; periodLabel: string; discountPercent: number; saveLabel: string };
    semiannual: { price: number; formattedPrice: string; periodLabel: string; discountPercent: number; saveLabel: string };
  };
  features: string[];
};

export type PlanOfferingsDto = {
  offerings: PlanOfferingTier[];
};

export const dealbreakerSchema = z.object({
  strictVerifiedOnly: z.boolean().default(false),
  strictSamePace: z.boolean().default(false),
  strictBudgetOverlap: z.boolean().default(false),
});
export type DealbreakerInput = z.infer<typeof dealbreakerSchema>;
export type DealbreakerDto = DealbreakerInput & { updatedAt: string };

export function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return Math.max(0, Math.floor((Math.min(Date.parse(aEnd), Date.parse(bEnd)) - Math.max(Date.parse(aStart), Date.parse(bStart))) / 86400000) + 1);
}
export function safetyAllows(a: { safety: string; gender: string }, b: { safety: string; gender: string }) {
  const allows = (owner: typeof a, other: typeof b) => owner.safety === 'open' || (owner.safety === 'same_gender' && owner.gender === other.gender) || (owner.safety === 'women_only' && owner.gender === 'Woman' && other.gender === 'Woman');
  return allows(a, b) && allows(b, a);
}
