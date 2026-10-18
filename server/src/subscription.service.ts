import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BillingCycle,
  DealbreakerDto,
  dealbreakerSchema,
  EntitlementDto,
  PlanOfferingsDto,
  SubscriptionDto,
  SubscriptionPlan,
  SubscriptionStatus,
  upgradeSubscriptionSchema,
} from '@raahi/contracts';
import { PrismaService } from './prisma.service';

const FREE_DAILY_LIKES = 8;

export const subscriptionDto = (s: {
  id: string;
  userId: string;
  plan: string;
  status: string;
  billingCycle: string;
  startedAt: Date;
  currentPeriodEnd: Date;
  autoRenew: boolean;
}): SubscriptionDto => ({
  id: s.id,
  userId: s.userId,
  plan: s.plan as SubscriptionPlan,
  status: s.status as SubscriptionStatus,
  billingCycle: s.billingCycle as BillingCycle,
  startedAt: s.startedAt.toISOString(),
  currentPeriodEnd: s.currentPeriodEnd.toISOString(),
  autoRenew: s.autoRenew,
});

@Injectable()
export class SubscriptionService {
  constructor(readonly db: PrismaService) {}

  private getTodayDate(): Date {
    return new Date(new Date().toISOString().slice(0, 10));
  }

  async getEntitlement(userId: string): Promise<EntitlementDto> {
    const today = this.getTodayDate();
    const [sub, dailyLike] = await Promise.all([
      this.db.subscription.findUnique({ where: { userId } }),
      this.db.dailyLike.findUnique({ where: { userId_date: { userId, date: today } } }),
    ]);

    const isExpired = sub ? sub.currentPeriodEnd.valueOf() < Date.now() : false;
    const effectivePlan: SubscriptionPlan = sub && !isExpired && sub.status === 'ACTIVE'
      ? (sub.plan as SubscriptionPlan)
      : 'FREE';

    const isHingeX = effectivePlan === 'X';
    const isHingePlus = effectivePlan === 'PLUS';
    const dailyLikesUsed = dailyLike?.count ?? 0;
    const dailyLikesLimit = effectivePlan === 'FREE' ? FREE_DAILY_LIKES : null;
    const dailyLikesRemaining = dailyLikesLimit !== null ? Math.max(0, dailyLikesLimit - dailyLikesUsed) : null;

    return {
      plan: effectivePlan,
      isHingeX,
      isHingePlus,
      dailyLikesLimit,
      dailyLikesUsed,
      dailyLikesRemaining,
      hasPriorityLikes: isHingeX,
      hasEnhancedRecommendations: isHingeX || isHingePlus,
      hasFullLikesYouGrid: isHingeX || isHingePlus,
      hasStrictDealbreakers: isHingeX,
      subscription: sub ? subscriptionDto(sub) : null,
    };
  }

  async recordLikeInTx(
    tx: Prisma.TransactionClient,
    userId: string,
    requestedPriority = false,
  ): Promise<{ isPriority: boolean; remaining: number | null }> {
    const today = this.getTodayDate();
    const sub = await tx.subscription.findUnique({ where: { userId } });
    const isExpired = sub ? sub.currentPeriodEnd.valueOf() < Date.now() : false;
    const plan: SubscriptionPlan = sub && !isExpired && sub.status === 'ACTIVE'
      ? (sub.plan as SubscriptionPlan)
      : 'FREE';

    const daily = await tx.dailyLike.upsert({
      where: { userId_date: { userId, date: today } },
      create: { userId, date: today, count: 0 },
      update: {},
    });

    if (plan === 'FREE') {
      if (requestedPriority) {
        throw new ForbiddenException('Priority Likes are exclusive to HingeX members.');
      }
      if (daily.count >= FREE_DAILY_LIKES) {
        throw new ForbiddenException(
          'DAILY_LIMIT_EXHAUSTED: You have reached your daily limit of 8 likes. Upgrade to HingeX for unlimited likes and priority placement.',
        );
      }
      await tx.dailyLike.update({
        where: { id: daily.id },
        data: { count: { increment: 1 } },
      });
      return { isPriority: false, remaining: Math.max(0, FREE_DAILY_LIKES - (daily.count + 1)) };
    }

    if (plan === 'PLUS') {
      if (requestedPriority) {
        throw new ForbiddenException('Priority Likes are exclusive to HingeX members.');
      }
      await tx.dailyLike.update({
        where: { id: daily.id },
        data: { count: { increment: 1 } },
      });
      return { isPriority: false, remaining: null };
    }

    // X (HingeX): unlimited likes + priority likes
    await tx.dailyLike.update({
      where: { id: daily.id },
      data: { count: { increment: 1 } },
    });

    return { isPriority: Boolean(requestedPriority), remaining: null };
  }

  getOfferings(): PlanOfferingsDto {
    return {
      offerings: [
        {
          plan: 'PLUS',
          name: 'Hinge Plus',
          tagline: 'Connect with more travelers faster with unlimited likes and grid view.',
          pricing: {
            monthly: { price: 999, formattedPrice: '₹999 / mo', periodLabel: '1 Month' },
            trimonthly: {
              price: 2399,
              formattedPrice: '₹799 / mo',
              periodLabel: '3 Months (₹2,399 billed total)',
              discountPercent: 20,
              saveLabel: 'Save 20%',
            },
            semiannual: {
              price: 3999,
              formattedPrice: '₹666 / mo',
              periodLabel: '6 Months (₹3,999 billed total)',
              discountPercent: 33,
              saveLabel: 'Save 33%',
            },
          },
          features: [
            'Unlimited Daily Likes (No 8-like limit)',
            'See Everyone Who Likes You (Full Grid View)',
            'Enhanced Travel Recommendations',
            'Travel Filter Tuning',
          ],
        },
        {
          plan: 'X',
          name: 'HingeX VIP',
          tagline: 'Our most exclusive membership. Skip the line with Priority Likes and real-time adaptive fit.',
          pricing: {
            monthly: { price: 1999, formattedPrice: '₹1,999 / mo', periodLabel: '1 Month' },
            trimonthly: {
              price: 4499,
              formattedPrice: '₹1,499 / mo',
              periodLabel: '3 Months (₹4,499 billed total)',
              discountPercent: 25,
              saveLabel: 'Popular · Save 25%',
            },
            semiannual: {
              price: 6999,
              formattedPrice: '₹1,166 / mo',
              periodLabel: '6 Months (₹6,999 billed total)',
              discountPercent: 42,
              saveLabel: 'Best Value · Save 42%',
            },
          },
          features: [
            'Priority Likes — Stay at the top of their Likes You queue',
            'Real-Time Adaptive Fit Recommendations',
            'Unlimited Daily Likes',
            'See Everyone Who Likes You at once in full grid',
            'Strict Dealbreakers on verified, budget, and pace',
            'Exclusive HingeX VIP Gold Badge on profile and header',
            'Complimentary weekly boost perks',
          ],
        },
      ],
    };
  }

  async upgrade(userId: string, raw: unknown): Promise<EntitlementDto> {
    const input = upgradeSubscriptionSchema.safeParse(raw);
    if (!input.success) {
      throw new BadRequestException(input.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '));
    }

    const { plan, billingCycle } = input.data;
    const daysToAdd = billingCycle === 'SEMIANNUAL' ? 180 : billingCycle === 'TRIMONTHLY' ? 90 : 30;
    const currentPeriodEnd = new Date(Date.now() + daysToAdd * 86400000);

    await this.db.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        status: 'ACTIVE',
        billingCycle,
        startedAt: new Date(),
        currentPeriodEnd,
        autoRenew: true,
      },
      update: {
        plan,
        status: 'ACTIVE',
        billingCycle,
        currentPeriodEnd,
        autoRenew: true,
      },
    });

    return this.getEntitlement(userId);
  }

  async restore(userId: string): Promise<EntitlementDto> {
    const sub = await this.db.subscription.findUnique({ where: { userId } });
    if (!sub) {
      return this.getEntitlement(userId);
    }

    if (sub.currentPeriodEnd.valueOf() > Date.now()) {
      await this.db.subscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE' },
      });
    }

    return this.getEntitlement(userId);
  }

  async cancel(userId: string): Promise<EntitlementDto> {
    const sub = await this.db.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('No active subscription found.');

    await this.db.subscription.update({
      where: { id: sub.id },
      data: { autoRenew: false },
    });

    return this.getEntitlement(userId);
  }

  async getDealbreakers(userId: string): Promise<DealbreakerDto> {
    const row = await this.db.dealbreakerPreference.findUnique({ where: { userId } });
    return {
      strictVerifiedOnly: row?.strictVerifiedOnly ?? false,
      strictSamePace: row?.strictSamePace ?? false,
      strictBudgetOverlap: row?.strictBudgetOverlap ?? false,
      updatedAt: (row?.updatedAt ?? new Date()).toISOString(),
    };
  }

  async updateDealbreakers(userId: string, raw: unknown): Promise<DealbreakerDto> {
    const entitlement = await this.getEntitlement(userId);
    if (!entitlement.hasStrictDealbreakers) {
      throw new ForbiddenException('Strict Dealbreakers are an exclusive feature of HingeX. Upgrade to unlock.');
    }

    const input = dealbreakerSchema.safeParse(raw);
    if (!input.success) {
      throw new BadRequestException(input.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '));
    }

    const updated = await this.db.dealbreakerPreference.upsert({
      where: { userId },
      create: { userId, ...input.data },
      update: { ...input.data },
    });

    return {
      strictVerifiedOnly: updated.strictVerifiedOnly,
      strictSamePace: updated.strictSamePace,
      strictBudgetOverlap: updated.strictBudgetOverlap,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
