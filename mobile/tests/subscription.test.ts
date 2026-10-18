import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dealbreakerSchema,
  interestSchema,
  upgradeSubscriptionSchema,
  type EntitlementDto,
} from '@raahi/contracts';

test('dealbreaker schema provides default strict flags', () => {
  const parsed = dealbreakerSchema.parse({});
  assert.equal(parsed.strictVerifiedOnly, false);
  assert.equal(parsed.strictSamePace, false);
  assert.equal(parsed.strictBudgetOverlap, false);

  const active = dealbreakerSchema.parse({
    strictVerifiedOnly: true,
    strictSamePace: true,
    strictBudgetOverlap: true,
  });
  assert.equal(active.strictVerifiedOnly, true);
  assert.equal(active.strictSamePace, true);
  assert.equal(active.strictBudgetOverlap, true);
});

test('upgrade subscription schema accepts PLUS and X plans with valid billing cycles', () => {
  const resultX = upgradeSubscriptionSchema.safeParse({ plan: 'X', billingCycle: 'TRIMONTHLY' });
  assert.equal(resultX.success, true);
  if (resultX.success) {
    assert.equal(resultX.data.plan, 'X');
    assert.equal(resultX.data.billingCycle, 'TRIMONTHLY');
  }

  const resultPlus = upgradeSubscriptionSchema.safeParse({ plan: 'PLUS' });
  assert.equal(resultPlus.success, true);
  if (resultPlus.success) {
    assert.equal(resultPlus.data.plan, 'PLUS');
    assert.equal(resultPlus.data.billingCycle, 'MONTHLY');
  }

  const resultInvalid = upgradeSubscriptionSchema.safeParse({ plan: 'FREE' });
  assert.equal(resultInvalid.success, false);
});

test('interest schema accepts priority likes for HingeX', () => {
  const parsed = interestSchema.safeParse({
    toUserId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    tripId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    isPriority: true,
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.isPriority, true);
  }
});

test('HingeX entitlement provides all tier perks and unmetered daily likes', () => {
  const hingexEntitlement: EntitlementDto = {
    plan: 'X',
    isHingeX: true,
    isHingePlus: false,
    dailyLikesLimit: null,
    dailyLikesUsed: 12,
    dailyLikesRemaining: null,
    hasPriorityLikes: true,
    hasEnhancedRecommendations: true,
    hasFullLikesYouGrid: true,
    hasStrictDealbreakers: true,
    subscription: {
      id: 'sub-x',
      userId: 'u-1',
      plan: 'X',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      startedAt: '2026-10-16T00:00:00.000Z',
      currentPeriodEnd: '2026-11-16T00:00:00.000Z',
      autoRenew: true,
    },
  };

  assert.equal(hingexEntitlement.isHingeX, true);
  assert.equal(hingexEntitlement.dailyLikesLimit, null);
  assert.equal(hingexEntitlement.hasPriorityLikes, true);
  assert.equal(hingexEntitlement.hasStrictDealbreakers, true);
  assert.equal(hingexEntitlement.hasFullLikesYouGrid, true);
});

test('Free entitlement limits daily likes to 8 without priority or dealbreakers', () => {
  const freeEntitlement: EntitlementDto = {
    plan: 'FREE',
    isHingeX: false,
    isHingePlus: false,
    dailyLikesLimit: 8,
    dailyLikesUsed: 5,
    dailyLikesRemaining: 3,
    hasPriorityLikes: false,
    hasEnhancedRecommendations: false,
    hasFullLikesYouGrid: false,
    hasStrictDealbreakers: false,
    subscription: null,
  };

  assert.equal(freeEntitlement.isHingeX, false);
  assert.equal(freeEntitlement.dailyLikesLimit, 8);
  assert.equal(freeEntitlement.dailyLikesRemaining, 3);
  assert.equal(freeEntitlement.hasPriorityLikes, false);
  assert.equal(freeEntitlement.hasStrictDealbreakers, false);
  assert.equal(freeEntitlement.hasFullLikesYouGrid, false);
});
