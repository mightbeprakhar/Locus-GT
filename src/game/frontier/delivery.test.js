/**
 * @file delivery.test.js
 * @description Comprehensive unit tests for Frontier Delivery Economy Foundation —
 * Configuration, Availability, Time, and Utility (Phase 8A).
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DELIVERY_CONFIG,
  CANONICAL_DELIVERY_CONFIG,
  validateDeliveryConfig,
  createDeliveryConfig,
  isDeliveryAvailable,
  calculateDeliveryTime,
  calculateDeliveryUtility,
} from './delivery.js';
import { calculateFrontierUtility } from './consumerChoice.js';

describe('LOCUS Frontier Engine — Phase 8A: Delivery Foundation', () => {
  describe('1. Configuration & Canonical Constants', () => {
    it('1. accepts valid configuration', () => {
      const config = {
        enabled: true,
        radius: 4,
        fee: 40,
        baseTime: 10,
        timePerDistance: 4,
      };
      expect(validateDeliveryConfig(config)).toBe(true);
    });

    it('defines frozen default delivery config with delivery disabled', () => {
      expect(DEFAULT_DELIVERY_CONFIG).toEqual({
        enabled: false,
        radius: 4,
        fee: 40,
        baseTime: 10,
        timePerDistance: 4,
      });
      expect(Object.isFrozen(DEFAULT_DELIVERY_CONFIG)).toBe(true);
    });

    it('defines frozen canonical active delivery config with delivery enabled', () => {
      expect(CANONICAL_DELIVERY_CONFIG).toEqual({
        enabled: true,
        radius: 4,
        fee: 40,
        baseTime: 10,
        timePerDistance: 4,
      });
      expect(Object.isFrozen(CANONICAL_DELIVERY_CONFIG)).toBe(true);
    });

    it('creates normalized frozen configuration with default values', () => {
      const config = createDeliveryConfig();
      expect(config).toEqual(CANONICAL_DELIVERY_CONFIG);
      expect(Object.isFrozen(config)).toBe(true);
    });

    it('preserves explicitly supplied configuration parameters', () => {
      const config = createDeliveryConfig({
        enabled: false,
        radius: 6,
        fee: 25,
        baseTime: 15,
        timePerDistance: 2.5,
      });
      expect(config).toEqual({
        enabled: false,
        radius: 6,
        fee: 25,
        baseTime: 15,
        timePerDistance: 2.5,
      });
      expect(Object.isFrozen(config)).toBe(true);
    });

    it('rejects non-object or null configuration', () => {
      expect(() => validateDeliveryConfig(null)).toThrow(TypeError);
      expect(() => validateDeliveryConfig(undefined)).toThrow(TypeError);
      expect(() => validateDeliveryConfig('delivery')).toThrow(TypeError);
      expect(() => validateDeliveryConfig(123)).toThrow(TypeError);
    });

    it('2. rejects invalid enabled', () => {
      expect(() => validateDeliveryConfig({ enabled: 'true', radius: 4, fee: 40, baseTime: 10, timePerDistance: 4 })).toThrow(TypeError);
      expect(() => validateDeliveryConfig({ enabled: 1, radius: 4, fee: 40, baseTime: 10, timePerDistance: 4 })).toThrow(TypeError);
      expect(() => validateDeliveryConfig({ enabled: null, radius: 4, fee: 40, baseTime: 10, timePerDistance: 4 })).toThrow(TypeError);
    });

    it('3. rejects negative radius', () => {
      expect(() => validateDeliveryConfig({ enabled: true, radius: -1, fee: 40, baseTime: 10, timePerDistance: 4 })).toThrow(RangeError);
      expect(() => validateDeliveryConfig({ enabled: true, radius: -0.001, fee: 40, baseTime: 10, timePerDistance: 4 })).toThrow(RangeError);
    });

    it('4. rejects negative fee', () => {
      expect(() => validateDeliveryConfig({ enabled: true, radius: 4, fee: -10, baseTime: 10, timePerDistance: 4 })).toThrow(RangeError);
    });

    it('5. rejects negative baseTime', () => {
      expect(() => validateDeliveryConfig({ enabled: true, radius: 4, fee: 40, baseTime: -5, timePerDistance: 4 })).toThrow(RangeError);
    });

    it('6. rejects negative timePerDistance', () => {
      expect(() => validateDeliveryConfig({ enabled: true, radius: 4, fee: 40, baseTime: 10, timePerDistance: -2 })).toThrow(RangeError);
    });

    it('7. rejects NaN in numeric fields', () => {
      expect(() => validateDeliveryConfig({ enabled: true, radius: NaN, fee: 40, baseTime: 10, timePerDistance: 4 })).toThrow(TypeError);
      expect(() => validateDeliveryConfig({ enabled: true, radius: 4, fee: NaN, baseTime: 10, timePerDistance: 4 })).toThrow(TypeError);
      expect(() => validateDeliveryConfig({ enabled: true, radius: 4, fee: 40, baseTime: NaN, timePerDistance: 4 })).toThrow(TypeError);
      expect(() => validateDeliveryConfig({ enabled: true, radius: 4, fee: 40, baseTime: 10, timePerDistance: NaN })).toThrow(TypeError);
    });

    it('8. rejects Infinity in numeric fields', () => {
      expect(() => validateDeliveryConfig({ enabled: true, radius: Infinity, fee: 40, baseTime: 10, timePerDistance: 4 })).toThrow(TypeError);
      expect(() => validateDeliveryConfig({ enabled: true, radius: 4, fee: Infinity, baseTime: 10, timePerDistance: 4 })).toThrow(TypeError);
      expect(() => validateDeliveryConfig({ enabled: true, radius: 4, fee: 40, baseTime: Infinity, timePerDistance: 4 })).toThrow(TypeError);
      expect(() => validateDeliveryConfig({ enabled: true, radius: 4, fee: 40, baseTime: 10, timePerDistance: Infinity })).toThrow(TypeError);
    });

    it('9. accepts zero boundaries (radius=0, fee=0, baseTime=0, timePerDistance=0)', () => {
      const zeroConfig = {
        enabled: true,
        radius: 0,
        fee: 0,
        baseTime: 0,
        timePerDistance: 0,
      };
      expect(validateDeliveryConfig(zeroConfig)).toBe(true);
      const created = createDeliveryConfig(zeroConfig);
      expect(created.radius).toBe(0);
      expect(created.fee).toBe(0);
      expect(created.baseTime).toBe(0);
      expect(created.timePerDistance).toBe(0);
    });
  });

  describe('2. Delivery Availability', () => {
    const config = createDeliveryConfig({ enabled: true, radius: 4 });

    it('10. disabled delivery is unavailable', () => {
      const disabledConfig = createDeliveryConfig({ enabled: false, radius: 4 });
      expect(isDeliveryAvailable({ travelCost: 2, deliveryConfig: disabledConfig })).toBe(false);
      expect(isDeliveryAvailable({ travelCost: 0, deliveryConfig: disabledConfig })).toBe(false);
    });

    it('11. reachable destination strictly inside radius is available', () => {
      expect(isDeliveryAvailable({ travelCost: 2.5, deliveryConfig: config })).toBe(true);
      expect(isDeliveryAvailable({ travelCost: 0, deliveryConfig: config })).toBe(true);
    });

    it('12. destination exactly at radius boundary is available (inclusive boundary)', () => {
      expect(isDeliveryAvailable({ travelCost: 4.0, deliveryConfig: config })).toBe(true);
    });

    it('13. destination outside radius is unavailable', () => {
      expect(isDeliveryAvailable({ travelCost: 4.0001, deliveryConfig: config })).toBe(false);
      expect(isDeliveryAvailable({ travelCost: 7, deliveryConfig: config })).toBe(false);
    });

    it('14. unreachable destination (travelCost = Infinity) is unavailable', () => {
      expect(isDeliveryAvailable({ travelCost: Infinity, deliveryConfig: config })).toBe(false);
    });

    it('rejects invalid travelCost inputs in isDeliveryAvailable', () => {
      expect(() => isDeliveryAvailable({ travelCost: '2', deliveryConfig: config })).toThrow(TypeError);
      expect(() => isDeliveryAvailable({ travelCost: NaN, deliveryConfig: config })).toThrow(TypeError);
      expect(() => isDeliveryAvailable({ travelCost: -1, deliveryConfig: config })).toThrow(RangeError);
      expect(() => isDeliveryAvailable({ travelCost: 2, deliveryConfig: null })).toThrow(TypeError);
    });
  });

  describe('3. Delivery Time (tau_ij)', () => {
    const config = createDeliveryConfig({ baseTime: 12, timePerDistance: 3 });

    it('15. zero travel cost gives baseTime exactly', () => {
      const time = calculateDeliveryTime({ travelCost: 0, deliveryConfig: config });
      expect(time).toBe(12);
    });

    it('16. delivery time increases linearly with travel cost', () => {
      // tau = 12 + 3 * 2 = 18
      expect(calculateDeliveryTime({ travelCost: 2, deliveryConfig: config })).toBe(18);
      // tau = 12 + 3 * 4.5 = 25.5
      expect(calculateDeliveryTime({ travelCost: 4.5, deliveryConfig: config })).toBe(25.5);
    });

    it('17. unreachable travel does not produce valid delivery time (throws RangeError)', () => {
      expect(() =>
        calculateDeliveryTime({ travelCost: Infinity, deliveryConfig: config })
      ).toThrow(RangeError);
    });

    it('rejects invalid inputs in calculateDeliveryTime', () => {
      expect(() => calculateDeliveryTime({ travelCost: '0', deliveryConfig: config })).toThrow(TypeError);
      expect(() => calculateDeliveryTime({ travelCost: NaN, deliveryConfig: config })).toThrow(TypeError);
      expect(() => calculateDeliveryTime({ travelCost: -2, deliveryConfig: config })).toThrow(RangeError);
      expect(() => calculateDeliveryTime({ travelCost: 0, deliveryConfig: null })).toThrow(TypeError);
    });
  });

  describe('4. Dine-In vs Delivery Utility Comparison', () => {
    const deliveryConfig = createDeliveryConfig({
      enabled: true,
      radius: 5,
      fee: 30,
      baseTime: 10,
      timePerDistance: 2,
    });

    it('18. dine-in utility exactly follows existing Frontier formula', () => {
      const travelCost = 3;
      const price = 100;
      const quality = 8;
      const V = 500;
      const beta = 1;
      const gamma = 10;
      const alpha = 10;

      // Existing Phase 7A/7B utility
      const dineInUtility = calculateFrontierUtility({
        travelCost,
        price,
        quality,
        V,
        beta,
        gamma,
        alpha,
      });

      // U_D = 500 - 1*100 + 10*8 - 10*3 = 450
      expect(dineInUtility).toBe(500 - 100 + 80 - 30);
      expect(dineInUtility).toBe(450);
    });

    it('19. delivery utility includes consumer delivery fee', () => {
      const travelCost = 2;
      const price = 100;
      const quality = 5;
      const V = 500;
      const beta = 1.5;
      const gamma = 10;
      const alpha = 5;
      const delta = 1;

      const freeDeliveryConfig = createDeliveryConfig({ ...deliveryConfig, fee: 0 });
      const paidDeliveryConfig = createDeliveryConfig({ ...deliveryConfig, fee: 40 });

      const uFree = calculateDeliveryUtility({
        travelCost,
        price,
        quality,
        deliveryConfig: freeDeliveryConfig,
        V,
        beta,
        gamma,
        alpha,
        delta,
      });

      const uPaid = calculateDeliveryUtility({
        travelCost,
        price,
        quality,
        deliveryConfig: paidDeliveryConfig,
        V,
        beta,
        gamma,
        alpha,
        delta,
      });

      // Fee reduction = beta * 40 = 1.5 * 40 = 60
      expect(uFree - uPaid).toBeCloseTo(beta * 40);
    });

    it('20. delivery utility includes delivery time disutility', () => {
      const travelCost = 2;
      const price = 100;
      const quality = 5;
      const V = 500;
      const beta = 1;
      const gamma = 10;
      const alpha = 5;
      const delta = 2;

      // baseTime 10 vs baseTime 25 -> difference in delivery time is 15 duration units
      const fastConfig = createDeliveryConfig({ ...deliveryConfig, baseTime: 10, timePerDistance: 2 });
      const slowConfig = createDeliveryConfig({ ...deliveryConfig, baseTime: 25, timePerDistance: 2 });

      const uFast = calculateDeliveryUtility({
        travelCost,
        price,
        quality,
        deliveryConfig: fastConfig,
        V,
        beta,
        gamma,
        alpha,
        delta,
      });

      const uSlow = calculateDeliveryUtility({
        travelCost,
        price,
        quality,
        deliveryConfig: slowConfig,
        V,
        beta,
        gamma,
        alpha,
        delta,
      });

      // Disutility diff = delta * (25 - 10) = 2 * 15 = 30
      expect(uFast - uSlow).toBeCloseTo(30);
    });

    it('21. delivery utility includes quality contribution (+ gamma * Q)', () => {
      const travelCost = 2;
      const price = 100;
      const V = 500;
      const beta = 1;
      const gamma = 15;
      const alpha = 5;
      const delta = 1;

      const uLowQ = calculateDeliveryUtility({
        travelCost,
        price,
        quality: 3,
        deliveryConfig,
        V,
        beta,
        gamma,
        alpha,
        delta,
      });

      const uHighQ = calculateDeliveryUtility({
        travelCost,
        price,
        quality: 7,
        deliveryConfig,
        V,
        beta,
        gamma,
        alpha,
        delta,
      });

      // Quality difference = gamma * (7 - 3) = 15 * 4 = 60
      expect(uHighQ - uLowQ).toBeCloseTo(60);
    });

    it('22. heterogeneous delta affects delivery utility', () => {
      const travelCost = 2;
      const price = 100;
      const quality = 5;
      const deliveryConfigFixed = createDeliveryConfig({ baseTime: 10, timePerDistance: 2 });
      // tau = 10 + 2*2 = 14

      const uStandard = calculateDeliveryUtility({
        travelCost,
        price,
        quality,
        deliveryConfig: deliveryConfigFixed,
        delta: 1.0,
      });

      const uConvenience = calculateDeliveryUtility({
        travelCost,
        price,
        quality,
        deliveryConfig: deliveryConfigFixed,
        delta: 2.5,
      });

      // Difference = (2.5 - 1.0) * tau = 1.5 * 14 = 21
      expect(uStandard - uConvenience).toBeCloseTo(21);
    });

    it('returns -Infinity when delivery is unavailable or unreachable', () => {
      // Outside radius (radius is 5, travelCost is 6)
      const uOutside = calculateDeliveryUtility({
        travelCost: 6,
        price: 100,
        deliveryConfig,
      });
      expect(uOutside).toBe(-Infinity);

      // Unreachable (travelCost is Infinity)
      const uUnreachable = calculateDeliveryUtility({
        travelCost: Infinity,
        price: 100,
        deliveryConfig,
      });
      expect(uUnreachable).toBe(-Infinity);

      // Disabled delivery
      const disabledConfig = createDeliveryConfig({ enabled: false });
      const uDisabled = calculateDeliveryUtility({
        travelCost: 2,
        price: 100,
        deliveryConfig: disabledConfig,
      });
      expect(uDisabled).toBe(-Infinity);
    });

    it('rejects invalid parameters in calculateDeliveryUtility', () => {
      expect(() => calculateDeliveryUtility({ travelCost: 2, price: -5, deliveryConfig })).toThrow(RangeError);
      expect(() => calculateDeliveryUtility({ travelCost: 2, price: 100, quality: 99, deliveryConfig })).toThrow(RangeError);
      expect(() => calculateDeliveryUtility({ travelCost: 2, price: 100, beta: -1, deliveryConfig })).toThrow(RangeError);
      expect(() => calculateDeliveryUtility({ travelCost: 2, price: 100, delta: -0.5, deliveryConfig })).toThrow(RangeError);
      expect(() => calculateDeliveryUtility({ travelCost: 2, price: 100, deliveryConfig: null })).toThrow(TypeError);
    });
  });
});
