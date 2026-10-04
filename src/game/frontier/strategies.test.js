/**
 * @file strategies.test.js
 * @description Comprehensive unit tests for Frontier strategy space, generation, and validation.
 */

import { describe, it, expect } from 'vitest';
import {
  validateFrontierLocation,
  validateFrontierPrice,
  validateFrontierStrategy,
  createFrontierStrategy,
  getFrontierStrategies,
} from './strategies.js';
import { DEFAULT_ALLOWED_PRICES } from '../types.js';

describe('LOCUS Frontier Engine — Phase 6E: Strategies', () => {
  describe('validateFrontierLocation', () => {
    it('accepts valid grid coordinates', () => {
      expect(validateFrontierLocation({ x: 0, y: 0 })).toBe(true);
      expect(validateFrontierLocation({ x: 9, y: 9 })).toBe(true);
      expect(validateFrontierLocation({ x: 5, y: 3 })).toBe(true);
    });

    it('rejects out of bounds coordinates', () => {
      expect(validateFrontierLocation({ x: -1, y: 0 })).toBe(false);
      expect(validateFrontierLocation({ x: 0, y: -1 })).toBe(false);
      expect(validateFrontierLocation({ x: 10, y: 0 })).toBe(false);
      expect(validateFrontierLocation({ x: 0, y: 10 })).toBe(false);
      expect(validateFrontierLocation({ x: 10, y: 10 })).toBe(false);
    });

    it('rejects non-integer, non-number, and malformed inputs', () => {
      expect(validateFrontierLocation({ x: 1.5, y: 2 })).toBe(false);
      expect(validateFrontierLocation({ x: 2, y: '3' })).toBe(false);
      expect(validateFrontierLocation({ x: NaN, y: 2 })).toBe(false);
      expect(validateFrontierLocation(null)).toBe(false);
      expect(validateFrontierLocation(undefined)).toBe(false);
      expect(validateFrontierLocation('0,0')).toBe(false);
    });

    it('supports custom grid dimensions', () => {
      expect(validateFrontierLocation({ x: 14, y: 14 }, { width: 15, height: 15 })).toBe(true);
      expect(validateFrontierLocation({ x: 15, y: 14 }, { width: 15, height: 15 })).toBe(false);
    });
  });

  describe('validateFrontierPrice', () => {
    it('accepts default discrete prices [150, 200, 250, 300, 350]', () => {
      for (const p of DEFAULT_ALLOWED_PRICES) {
        expect(validateFrontierPrice(p)).toBe(true);
      }
    });

    it('rejects prices not in the discrete set', () => {
      expect(validateFrontierPrice(100)).toBe(false);
      expect(validateFrontierPrice(175)).toBe(false);
      expect(validateFrontierPrice(400)).toBe(false);
      expect(validateFrontierPrice(-50)).toBe(false);
      expect(validateFrontierPrice(NaN)).toBe(false);
      expect(validateFrontierPrice('200')).toBe(false);
      expect(validateFrontierPrice(null)).toBe(false);
    });

    it('supports custom allowed prices', () => {
      expect(validateFrontierPrice(99, [50, 99, 150])).toBe(true);
      expect(validateFrontierPrice(200, [50, 99, 150])).toBe(false);
    });
  });

  describe('validateFrontierStrategy', () => {
    it('validates canonical strategy schema', () => {
      const valid = { location: { x: 3, y: 4 }, price: 200 };
      expect(validateFrontierStrategy(valid)).toBe(true);
    });

    it('rejects legacy top-level coordinate keys', () => {
      const legacy = { x: 3, y: 4, location: { x: 3, y: 4 }, price: 200 };
      expect(validateFrontierStrategy(legacy)).toBe(false);
    });

    it('rejects invalid location or price', () => {
      expect(validateFrontierStrategy({ location: { x: 10, y: 0 }, price: 200 })).toBe(false);
      expect(validateFrontierStrategy({ location: { x: 0, y: 0 }, price: 175 })).toBe(false);
      expect(validateFrontierStrategy(null)).toBe(false);
      expect(validateFrontierStrategy({})).toBe(false);
    });
  });

  describe('createFrontierStrategy', () => {
    it('creates an immutable canonical strategy from location and price', () => {
      const strat = createFrontierStrategy({ x: 2, y: 3 }, 250);
      expect(strat).toEqual({
        location: { x: 2, y: 3 },
        price: 250,
      });
      expect(Object.isFrozen(strat)).toBe(true);
      expect(Object.isFrozen(strat.location)).toBe(true);

      // Verify immutability
      expect(() => {
        // @ts-ignore
        strat.price = 300;
      }).toThrow();
      expect(() => {
        // @ts-ignore
        strat.location.x = 5;
      }).toThrow();
    });

    it('creates from existing strategy object', () => {
      const strat = createFrontierStrategy({ location: { x: 4, y: 7 }, price: 300 });
      expect(strat.location).toEqual({ x: 4, y: 7 });
      expect(strat.price).toBe(300);
    });

    it('throws TypeError for invalid location', () => {
      expect(() => createFrontierStrategy({ x: -1, y: 0 }, 200)).toThrow(TypeError);
      expect(() => createFrontierStrategy({ x: 10, y: 0 }, 200)).toThrow(TypeError);
      expect(() => createFrontierStrategy(null, 200)).toThrow(TypeError);
    });

    it('throws RangeError for invalid price', () => {
      expect(() => createFrontierStrategy({ x: 0, y: 0 }, 999)).toThrow(RangeError);
      expect(() => createFrontierStrategy({ x: 0, y: 0 }, 180)).toThrow(RangeError);
    });
  });

  describe('getFrontierStrategies', () => {
    it('generates exactly 500 strategies for default 10x10 grid and 5 prices', () => {
      const strategies = getFrontierStrategies();
      expect(strategies).toHaveLength(500);
      expect(Object.isFrozen(strategies)).toBe(true);
    });

    it('ensures every strategy has valid location and price', () => {
      const strategies = getFrontierStrategies();
      for (const strat of strategies) {
        expect(validateFrontierStrategy(strat)).toBe(true);
        expect(Object.isFrozen(strat)).toBe(true);
        expect(Object.isFrozen(strat.location)).toBe(true);
      }
    });

    it('contains no duplicate strategies', () => {
      const strategies = getFrontierStrategies();
      const keys = new Set();
      for (const strat of strategies) {
        const key = `${strat.location.x},${strat.location.y},${strat.price}`;
        expect(keys.has(key)).toBe(false);
        keys.add(key);
      }
      expect(keys.size).toBe(500);
    });

    it('generates strategies in a deterministic order', () => {
      const run1 = getFrontierStrategies();
      const run2 = getFrontierStrategies();

      expect(run1.length).toBe(run2.length);
      for (let i = 0; i < run1.length; i++) {
        expect(run1[i].location.x).toBe(run2[i].location.x);
        expect(run1[i].location.y).toBe(run2[i].location.y);
        expect(run1[i].price).toBe(run2[i].price);
      }

      // Check first and last elements
      expect(run1[0]).toEqual({ location: { x: 0, y: 0 }, price: 150 });
      expect(run1[499]).toEqual({ location: { x: 9, y: 9 }, price: 350 });
    });

    it('supports custom grid dimensions and prices', () => {
      const custom = getFrontierStrategies({
        width: 3,
        height: 2,
        allowedPrices: [100, 200],
      });
      // 3 * 2 * 2 = 12
      expect(custom).toHaveLength(12);
    });
  });
});
