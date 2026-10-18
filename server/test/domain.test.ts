import { describe, expect, it } from 'vitest';
import { overlap, safetyAllows, tripSchema } from '@raahi/contracts';
import { decryptAppleRefreshToken, encryptAppleRefreshToken } from '../src/auth';
import { containsDisallowedContent } from '../src/content-safety';

describe('matching invariants', () => {
  it('requires at least three overlapping travel days', () => {
    expect(overlap('2026-11-18', '2026-11-28', '2026-11-20', '2026-11-29')).toBe(9);
    expect(overlap('2026-11-18', '2026-11-19', '2026-11-20', '2026-11-29')).toBe(0);
  });
  it('applies both travelers safety preferences', () => {
    expect(safetyAllows({ safety: 'women_only', gender: 'Woman' }, { safety: 'open', gender: 'Woman' })).toBe(true);
    expect(safetyAllows({ safety: 'women_only', gender: 'Woman' }, { safety: 'open', gender: 'Man' })).toBe(false);
    expect(safetyAllows({ safety: 'same_gender', gender: 'Woman' }, { safety: 'same_gender', gender: 'Man' })).toBe(false);
  });
  it('rejects invalid trip windows and budgets', () => {
    const result = tripSchema.safeParse({ city: 'Tokyo', country: 'Japan', start: '2026-11-28', end: '2026-11-18', flexible: false, budgetMin: 9000, budgetMax: 6000, currency: 'INR', styles: ['Food'], description: 'A real trip note.' });
    expect(result.success).toBe(false);
  });
  it('encrypts Apple refresh tokens without exposing the provider credential', () => {
    const previous = process.env.APPLE_TOKEN_ENCRYPTION_KEY;
    process.env.APPLE_TOKEN_ENCRYPTION_KEY = 'test-apple-token-key';
    const token = 'apple-refresh-token-fixture'; const encrypted = encryptAppleRefreshToken(token);
    expect(encrypted).not.toContain(token); expect(decryptAppleRefreshToken(encrypted)).toBe(token);
    if (previous === undefined) delete process.env.APPLE_TOKEN_ENCRYPTION_KEY; else process.env.APPLE_TOKEN_ENCRYPTION_KEY = previous;
  });
  it('flags explicit exploitative and threatening public text for moderation review', () => {
    expect(containsDisallowedContent('A thoughtful coffee walk in Kyoto.')).toBe(false);
    expect(containsDisallowedContent('send nudes')).toBe(true);
    expect(containsDisallowedContent('I will kill you')).toBe(true);
  });
});
