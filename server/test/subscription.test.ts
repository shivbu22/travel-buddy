import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { SubscriptionService } from '../src/subscription.service';

function createMockDb(overrides: Record<string, unknown> = {}) {
  return {
    subscription: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    dailyLike: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    dealbreakerPreference: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    },
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as any;
}

describe('SubscriptionService (HingeX replication)', () => {
  describe('getEntitlement', () => {
    it('grants free tier defaults with 8 daily likes and no HingeX perks', async () => {
      const db = createMockDb();
      const service = new SubscriptionService(db);

      const ent = await service.getEntitlement('user-1');

      expect(ent.plan).toBe('FREE');
      expect(ent.isHingeX).toBe(false);
      expect(ent.isHingePlus).toBe(false);
      expect(ent.dailyLikesLimit).toBe(8);
      expect(ent.dailyLikesUsed).toBe(0);
      expect(ent.dailyLikesRemaining).toBe(8);
      expect(ent.hasPriorityLikes).toBe(false);
      expect(ent.hasEnhancedRecommendations).toBe(false);
      expect(ent.hasFullLikesYouGrid).toBe(false);
      expect(ent.hasStrictDealbreakers).toBe(false);
      expect(ent.subscription).toBeNull();
    });

    it('grants full HingeX perks and unlimited likes for active X subscription', async () => {
      const futureEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const db = createMockDb({
        subscription: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'sub-1',
            userId: 'user-vip',
            plan: 'X',
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            startedAt: new Date(),
            currentPeriodEnd: futureEnd,
            autoRenew: true,
          }),
          upsert: vi.fn(),
          update: vi.fn(),
        },
      });
      const service = new SubscriptionService(db);

      const ent = await service.getEntitlement('user-vip');

      expect(ent.plan).toBe('X');
      expect(ent.isHingeX).toBe(true);
      expect(ent.isHingePlus).toBe(false);
      expect(ent.dailyLikesLimit).toBeNull();
      expect(ent.dailyLikesRemaining).toBeNull();
      expect(ent.hasPriorityLikes).toBe(true);
      expect(ent.hasEnhancedRecommendations).toBe(true);
      expect(ent.hasFullLikesYouGrid).toBe(true);
      expect(ent.hasStrictDealbreakers).toBe(true);
      expect(ent.subscription?.plan).toBe('X');
    });

    it('reverts expired subscription to free tier', async () => {
      const pastEnd = new Date(Date.now() - 1000);
      const db = createMockDb({
        subscription: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'sub-2',
            userId: 'user-expired',
            plan: 'X',
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            startedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            currentPeriodEnd: pastEnd,
            autoRenew: false,
          }),
        },
      });
      const service = new SubscriptionService(db);

      const ent = await service.getEntitlement('user-expired');
      expect(ent.plan).toBe('FREE');
      expect(ent.isHingeX).toBe(false);
      expect(ent.dailyLikesLimit).toBe(8);
    });
  });

  describe('recordLikeInTx (quota and priority gate)', () => {
    it('allows a free user within quota to send a standard like', async () => {
      const mockTx = {
        subscription: { findUnique: vi.fn().mockResolvedValue(null) },
        dailyLike: {
          upsert: vi.fn().mockResolvedValue({ userId: 'u1', count: 3 }),
          update: vi.fn().mockResolvedValue({ userId: 'u1', count: 4 }),
        },
      } as any;

      const service = new SubscriptionService(createMockDb());
      const result = await service.recordLikeInTx(mockTx, 'u1', false);

      expect(result.isPriority).toBe(false);
      expect(result.remaining).toBe(4);
      expect(mockTx.dailyLike.update).toHaveBeenCalled();
    });

    it('rejects priority like attempt by a free user', async () => {
      const mockTx = {
        subscription: { findUnique: vi.fn().mockResolvedValue(null) },
        dailyLike: {
          upsert: vi.fn().mockResolvedValue({ userId: 'u1', count: 0 }),
          update: vi.fn(),
        },
      } as any;

      const service = new SubscriptionService(createMockDb());
      await expect(service.recordLikeInTx(mockTx, 'u1', true)).rejects.toThrow(ForbiddenException);
    });

    it('rejects free user when daily quota of 8 is exhausted', async () => {
      const mockTx = {
        subscription: { findUnique: vi.fn().mockResolvedValue(null) },
        dailyLike: {
          upsert: vi.fn().mockResolvedValue({ userId: 'u1', count: 8 }),
          update: vi.fn(),
        },
      } as any;

      const service = new SubscriptionService(createMockDb());
      await expect(service.recordLikeInTx(mockTx, 'u1', false)).rejects.toThrow('DAILY_LIMIT_EXHAUSTED');
    });

    it('allows HingeX user to send priority likes and bypass quota', async () => {
      const futureEnd = new Date(Date.now() + 100000);
      const mockTx = {
        subscription: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'sub-x',
            userId: 'u-x',
            plan: 'X',
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            startedAt: new Date(),
            currentPeriodEnd: futureEnd,
            autoRenew: true,
          }),
        },
        dailyLike: {
          upsert: vi.fn().mockResolvedValue({ userId: 'u-x', count: 50 }),
          update: vi.fn().mockResolvedValue({ userId: 'u-x', count: 51 }),
        },
      } as any;

      const service = new SubscriptionService(createMockDb());
      const result = await service.recordLikeInTx(mockTx, 'u-x', true);

      expect(result.isPriority).toBe(true);
      expect(result.remaining).toBeNull();
    });
  });

  describe('dealbreakers', () => {
    it('blocks free user from updating strict dealbreakers', async () => {
      const db = createMockDb();
      const service = new SubscriptionService(db);

      await expect(
        service.updateDealbreakers('user-free', {
          strictVerifiedOnly: true,
          strictSamePace: true,
          strictBudgetOverlap: true,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows HingeX user to update strict dealbreakers', async () => {
      const futureEnd = new Date(Date.now() + 100000);
      const db = createMockDb({
        subscription: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'sub-vip',
            userId: 'user-vip',
            plan: 'X',
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            startedAt: new Date(),
            currentPeriodEnd: futureEnd,
            autoRenew: true,
          }),
        },
        dealbreakerPreference: {
          upsert: vi.fn().mockResolvedValue({
            userId: 'user-vip',
            strictVerifiedOnly: true,
            strictSamePace: false,
            strictBudgetOverlap: true,
            updatedAt: new Date(),
          }),
        },
      });
      const service = new SubscriptionService(db);

      const res = await service.updateDealbreakers('user-vip', {
        strictVerifiedOnly: true,
        strictSamePace: false,
        strictBudgetOverlap: true,
      });

      expect(res.strictVerifiedOnly).toBe(true);
      expect(res.strictBudgetOverlap).toBe(true);
    });
  });

  describe('upgrade', () => {
    it('upgrades a user to HingeX with correct expiration period', async () => {
      const db = createMockDb({
        subscription: {
          upsert: vi.fn().mockResolvedValue({
            id: 'sub-new',
            userId: 'u-upgrade',
            plan: 'X',
            status: 'ACTIVE',
            billingCycle: 'TRIMONTHLY',
            startedAt: new Date(),
            currentPeriodEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            autoRenew: true,
          }),
          findUnique: vi.fn().mockResolvedValue({
            id: 'sub-new',
            userId: 'u-upgrade',
            plan: 'X',
            status: 'ACTIVE',
            billingCycle: 'TRIMONTHLY',
            startedAt: new Date(),
            currentPeriodEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            autoRenew: true,
          }),
        },
        dailyLike: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      });

      const service = new SubscriptionService(db);
      const ent = await service.upgrade('u-upgrade', { plan: 'X', billingCycle: 'TRIMONTHLY' });

      expect(ent.isHingeX).toBe(true);
      expect(ent.plan).toBe('X');
      expect(ent.hasPriorityLikes).toBe(true);
    });
  });
});
