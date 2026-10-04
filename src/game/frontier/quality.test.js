/**
 * @file quality.test.js
 * @description Comprehensive unit tests for Frontier restaurant quality validation,
 * canonical defaults, configuration, and utility contributions (Phase 7A).
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_QUALITY,
  DEFAULT_GAMMA,
  DEFAULT_QUALITY_SCALE,
  validateFrontierQuality,
  createFrontierQuality,
  calculateQualityUtilityContribution,
  validateQualityConfig,
} from './quality.js';

describe('LOCUS Frontier Engine — Phase 7A: Quality Model', () => {
  describe('Canonical Constants', () => {
    it('defines standard default quality = 5', () => {
      expect(DEFAULT_QUALITY).toBe(5);
    });

    it('defines default gamma sensitivity = 10', () => {
      expect(DEFAULT_GAMMA).toBe(10);
    });

    it('defines bounded default scale [0, 10]', () => {
      expect(DEFAULT_QUALITY_SCALE).toEqual({ min: 0, max: 10 });
      expect(Object.isFrozen(DEFAULT_QUALITY_SCALE)).toBe(true);
    });
  });

  describe('validateFrontierQuality', () => {
    it('accepts valid quality values in default scale [0, 10]', () => {
      expect(validateFrontierQuality(0)).toBe(true);
      expect(validateFrontierQuality(5)).toBe(true);
      expect(validateFrontierQuality(10)).toBe(true);
      expect(validateFrontierQuality(7.5)).toBe(true);
      expect(validateFrontierQuality(3.2)).toBe(true);
    });

    it('rejects out of bounds quality values', () => {
      expect(validateFrontierQuality(-0.1)).toBe(false);
      expect(validateFrontierQuality(-5)).toBe(false);
      expect(validateFrontierQuality(10.1)).toBe(false);
      expect(validateFrontierQuality(15)).toBe(false);
    });

    it('rejects non-numeric and non-finite values', () => {
      expect(validateFrontierQuality(NaN)).toBe(false);
      expect(validateFrontierQuality(Infinity)).toBe(false);
      expect(validateFrontierQuality(-Infinity)).toBe(false);
      expect(validateFrontierQuality('5')).toBe(false);
      expect(validateFrontierQuality(null)).toBe(false);
      expect(validateFrontierQuality(undefined)).toBe(false);
      expect(validateFrontierQuality({})).toBe(false);
    });

    it('supports custom quality scales', () => {
      const customScale = { min: 1, max: 5 };
      expect(validateFrontierQuality(3, customScale)).toBe(true);
      expect(validateFrontierQuality(0, customScale)).toBe(false);
      expect(validateFrontierQuality(6, customScale)).toBe(false);
    });
  });

  describe('createFrontierQuality', () => {
    it('returns default quality (5) when omitted', () => {
      expect(createFrontierQuality()).toBe(DEFAULT_QUALITY);
      expect(createFrontierQuality(undefined)).toBe(DEFAULT_QUALITY);
    });

    it('returns validated quality for valid numbers', () => {
      expect(createFrontierQuality(0)).toBe(0);
      expect(createFrontierQuality(8)).toBe(8);
      expect(createFrontierQuality(10)).toBe(10);
    });

    it('throws TypeError for non-numeric or non-finite inputs', () => {
      expect(() => createFrontierQuality('8')).toThrow(TypeError);
      expect(() => createFrontierQuality(NaN)).toThrow(TypeError);
      expect(() => createFrontierQuality(Infinity)).toThrow(TypeError);
      expect(() => createFrontierQuality(null)).toThrow(TypeError);
    });

    it('throws RangeError for out of bounds quality', () => {
      expect(() => createFrontierQuality(-1)).toThrow(RangeError);
      expect(() => createFrontierQuality(11)).toThrow(RangeError);
    });
  });

  describe('calculateQualityUtilityContribution', () => {
    it('applies the standard linear utility term: gamma * Q', () => {
      // Default gamma = 10
      expect(calculateQualityUtilityContribution(5)).toBe(50);
      expect(calculateQualityUtilityContribution(8)).toBe(80);
      expect(calculateQualityUtilityContribution(0)).toBe(0);
      expect(calculateQualityUtilityContribution(10)).toBe(100);
    });

    it('supports configurable gamma parameter', () => {
      // gamma = 20
      expect(calculateQualityUtilityContribution(4, 20)).toBe(80);
      // gamma = 0
      expect(calculateQualityUtilityContribution(7, 0)).toBe(0);
    });

    it('throws on invalid quality or gamma', () => {
      expect(() => calculateQualityUtilityContribution(15)).toThrow(RangeError);
      expect(() => calculateQualityUtilityContribution(-1)).toThrow(RangeError);
      expect(() => calculateQualityUtilityContribution(5, NaN)).toThrow(TypeError);
      expect(() => calculateQualityUtilityContribution(5, '10')).toThrow(TypeError);
    });
  });

  describe('validateQualityConfig', () => {
    it('returns default frozen configuration when called without arguments', () => {
      const cfg = validateQualityConfig();
      expect(cfg.gamma).toBe(DEFAULT_GAMMA);
      expect(cfg.qualityScale).toEqual(DEFAULT_QUALITY_SCALE);
      expect(Object.isFrozen(cfg)).toBe(true);
      expect(Object.isFrozen(cfg.qualityScale)).toBe(true);
    });

    it('validates custom gamma and quality scale', () => {
      const cfg = validateQualityConfig({
        gamma: 15,
        qualityScale: { min: 1, max: 20 },
      });
      expect(cfg.gamma).toBe(15);
      expect(cfg.qualityScale).toEqual({ min: 1, max: 20 });
    });

    it('throws TypeError on non-numeric gamma or scale boundaries', () => {
      expect(() => validateQualityConfig({ gamma: NaN })).toThrow(TypeError);
      expect(() => validateQualityConfig({ qualityScale: { min: '0', max: 10 } })).toThrow(TypeError);
    });

    it('throws RangeError when scale min exceeds max', () => {
      expect(() => validateQualityConfig({ qualityScale: { min: 10, max: 5 } })).toThrow(RangeError);
    });
  });
});
