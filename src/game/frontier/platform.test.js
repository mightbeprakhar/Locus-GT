/**
 * @file platform.test.js
 * @description Unit tests for Frontier Aggregator / Platform Configuration and Commission Engine (Phase 8C).
 *
 * Verifies:
 * - Configuration validation, bounds, and defaults (commissionRate in [0, 1], enabled boolean)
 * - Immutability of configuration objects
 * - Pure commission calculation formula: C_platform = enabled ? m * P * D_delivery : 0
 * - Edge cases: zero demand, disabled platform, zero commission rate, rate = 1, fractional demand
 * - Linear scaling across commission rate, delivery demand, and price
 * - Strict separation of commission from dine-in demand and consumer delivery fees
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  DEFAULT_PLATFORM_CONFIG,
  CANONICAL_PLATFORM_CONFIG,
  validatePlatformConfig,
  createPlatformConfig,
  calculatePlatformCommission,
} from './platform.js';

describe('LOCUS Frontier Engine — Phase 8C: Platform Configuration & Commission', () => {
  describe('1. Configuration & Validation (TEST A)', () => {
    it('defines canonical default constants', () => {
      expect(DEFAULT_PLATFORM_COMMISSION_RATE).toBe(0.2);
      expect(DEFAULT_PLATFORM_CONFIG).toEqual({
        enabled: false,
        commissionRate: 0.2,
      });
      expect(Object.isFrozen(DEFAULT_PLATFORM_CONFIG)).toBe(true);

      expect(CANONICAL_PLATFORM_CONFIG).toEqual({
        enabled: true,
        commissionRate: 0.2,
      });
      expect(Object.isFrozen(CANONICAL_PLATFORM_CONFIG)).toBe(true);
    });

    it('validates valid configuration objects', () => {
      expect(validatePlatformConfig({ enabled: true, commissionRate: 0.15 })).toBe(true);
      expect(validatePlatformConfig({ enabled: false, commissionRate: 0.0 })).toBe(true);
      expect(validatePlatformConfig({ enabled: true, commissionRate: 1.0 })).toBe(true);
    });

    it('rejects non-object configurations', () => {
      expect(() => validatePlatformConfig(null)).toThrow(TypeError);
      expect(() => validatePlatformConfig(undefined)).toThrow(TypeError);
      expect(() => validatePlatformConfig('invalid')).toThrow(TypeError);
      expect(() => validatePlatformConfig(123)).toThrow(TypeError);
    });

    it('rejects non-boolean enabled properties', () => {
      expect(() => validatePlatformConfig({ enabled: 'true', commissionRate: 0.2 })).toThrow(
        TypeError
      );
      expect(() => validatePlatformConfig({ enabled: 1, commissionRate: 0.2 })).toThrow(
        TypeError
      );
      expect(() => validatePlatformConfig({ enabled: null, commissionRate: 0.2 })).toThrow(
        TypeError
      );
    });

    it('rejects negative commission rates', () => {
      expect(() => validatePlatformConfig({ enabled: true, commissionRate: -0.05 })).toThrow(
        RangeError
      );
      expect(() => validatePlatformConfig({ enabled: true, commissionRate: -1 })).toThrow(
        RangeError
      );
    });

    it('rejects commission rates strictly greater than 1', () => {
      expect(() => validatePlatformConfig({ enabled: true, commissionRate: 1.05 })).toThrow(
        RangeError
      );
      expect(() => validatePlatformConfig({ enabled: true, commissionRate: 20 })).toThrow(
        RangeError
      );
    });

    it('rejects NaN, Infinity, and non-numeric commission rates', () => {
      expect(() => validatePlatformConfig({ enabled: true, commissionRate: NaN })).toThrow(
        TypeError
      );
      expect(() => validatePlatformConfig({ enabled: true, commissionRate: Infinity })).toThrow(
        TypeError
      );
      expect(() => validatePlatformConfig({ enabled: true, commissionRate: '0.2' })).toThrow(
        TypeError
      );
    });

    it('creates immutable platform config with defaults and overrides', () => {
      const def = createPlatformConfig();
      expect(def).toEqual({
        enabled: false,
        commissionRate: 0.2,
      });
      expect(Object.isFrozen(def)).toBe(true);

      const enabledCustom = createPlatformConfig({
        enabled: true,
        commissionRate: 0.25,
      });
      expect(enabledCustom).toEqual({
        enabled: true,
        commissionRate: 0.25,
      });
      expect(Object.isFrozen(enabledCustom)).toBe(true);

      const partialOverride = createPlatformConfig({ enabled: true });
      expect(partialOverride).toEqual({
        enabled: true,
        commissionRate: 0.2,
      });
    });

    it('rejects invalid overrides in createPlatformConfig', () => {
      expect(() => createPlatformConfig(null)).toThrow(TypeError);
      expect(() => createPlatformConfig({ commissionRate: 1.5 })).toThrow(RangeError);
      expect(() => createPlatformConfig({ enabled: 'yes' })).toThrow(TypeError);
    });
  });

  describe('2. Pure Commission Calculation & Edge Cases', () => {
    // TEST B — BASIC COMMISSION
    it('TEST B: calculates standard commission (price=200, deliveryDemand=100, m=0.20 -> 4,000)', () => {
      const commission = calculatePlatformCommission({
        price: 200,
        deliveryDemand: 100,
        config: { enabled: true, commissionRate: 0.2 },
      });
      expect(commission).toBe(4000);
    });

    // TEST C — ZERO DELIVERY DEMAND
    it('TEST C: returns zero commission when delivery demand is zero', () => {
      const commission = calculatePlatformCommission({
        price: 200,
        deliveryDemand: 0,
        config: { enabled: true, commissionRate: 0.2 },
      });
      expect(commission).toBe(0);
    });

    // TEST D — PLATFORM DISABLED
    it('TEST D: returns zero commission when platform is disabled regardless of commission rate', () => {
      const commission = calculatePlatformCommission({
        price: 200,
        deliveryDemand: 100,
        config: { enabled: false, commissionRate: 0.35 },
      });
      expect(commission).toBe(0);

      // Default config has enabled: false
      const commissionDef = calculatePlatformCommission({
        price: 200,
        deliveryDemand: 100,
      });
      expect(commissionDef).toBe(0);
    });

    it('returns zero commission when commission rate is 0.0', () => {
      const commission = calculatePlatformCommission({
        price: 200,
        deliveryDemand: 100,
        config: { enabled: true, commissionRate: 0.0 },
      });
      expect(commission).toBe(0);
    });

    it('returns zero commission when restaurant price is 0', () => {
      const commission = calculatePlatformCommission({
        price: 0,
        deliveryDemand: 100,
        config: { enabled: true, commissionRate: 0.2 },
      });
      expect(commission).toBe(0);
    });

    it('calculates full delivery revenue when commission rate is 1.0', () => {
      const commission = calculatePlatformCommission({
        price: 150,
        deliveryDemand: 50,
        config: { enabled: true, commissionRate: 1.0 },
      });
      // 1.0 * 150 * 50 = 7,500
      expect(commission).toBe(7500);
    });

    it('preserves exact fractional delivery demand', () => {
      const commission = calculatePlatformCommission({
        price: 250,
        deliveryDemand: 12.5,
        config: { enabled: true, commissionRate: 0.15 },
      });
      // 0.15 * 250 * 12.5 = 37.5 * 12.5 = 468.75
      expect(commission).toBeCloseTo(468.75, 9);
    });

    // TEST H — COMMISSION RATE SCALING
    it('TEST H: commission scales linearly with commission rate', () => {
      const price = 200;
      const deliveryDemand = 100;

      const c10 = calculatePlatformCommission({
        price,
        deliveryDemand,
        config: { enabled: true, commissionRate: 0.1 },
      });
      const c20 = calculatePlatformCommission({
        price,
        deliveryDemand,
        config: { enabled: true, commissionRate: 0.2 },
      });
      const c30 = calculatePlatformCommission({
        price,
        deliveryDemand,
        config: { enabled: true, commissionRate: 0.3 },
      });

      expect(c10).toBe(2000);
      expect(c20).toBe(4000);
      expect(c30).toBe(6000);
      expect(c20 - c10).toBe(2000);
      expect(c30 - c20).toBe(2000);
    });

    // TEST I — DELIVERY DEMAND SCALING
    it('TEST I: doubling delivery customers doubles platform commission', () => {
      const price = 200;
      const config = { enabled: true, commissionRate: 0.2 };

      const c10 = calculatePlatformCommission({
        price,
        deliveryDemand: 10,
        config,
      });
      const c20 = calculatePlatformCommission({
        price,
        deliveryDemand: 20,
        config,
      });

      expect(c10).toBe(400);
      expect(c20).toBe(800);
      expect(c20).toBe(2 * c10);
    });

    // TEST J — PRICE SCALING
    it('TEST J: doubling restaurant food price doubles platform commission', () => {
      const deliveryDemand = 100;
      const config = { enabled: true, commissionRate: 0.2 };

      const c100 = calculatePlatformCommission({
        price: 100,
        deliveryDemand,
        config,
      });
      const c200 = calculatePlatformCommission({
        price: 200,
        deliveryDemand,
        config,
      });

      expect(c100).toBe(2000);
      expect(c200).toBe(4000);
      expect(c200).toBe(2 * c100);
    });

    it('rejects invalid inputs in calculatePlatformCommission', () => {
      expect(() => calculatePlatformCommission(null)).toThrow(TypeError);

      expect(() =>
        calculatePlatformCommission({
          price: -50,
          deliveryDemand: 10,
        })
      ).toThrow(RangeError);

      expect(() =>
        calculatePlatformCommission({
          price: NaN,
          deliveryDemand: 10,
        })
      ).toThrow(TypeError);

      expect(() =>
        calculatePlatformCommission({
          price: 100,
          deliveryDemand: -10,
        })
      ).toThrow(RangeError);

      expect(() =>
        calculatePlatformCommission({
          price: 100,
          deliveryDemand: Infinity,
        })
      ).toThrow(TypeError);
    });
  });
});
