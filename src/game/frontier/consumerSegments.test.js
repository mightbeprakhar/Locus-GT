/**
 * @file consumerSegments.test.js
 * @description Comprehensive unit tests for Frontier heterogeneous consumer segment preferences,
 * validation, canonical defaults, and built-in presets (Phase 7B).
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BETA,
  DEFAULT_DELTA,
  SHARE_SUM_EPSILON,
  DEFAULT_CONSUMER_SEGMENT,
  DEFAULT_CONSUMER_SEGMENTS,
  CONSUMER_SEGMENT_PRESET_IDS,
  CONSUMER_SEGMENT_PRESETS,
  validateConsumerSegment,
  createConsumerSegment,
  createDefaultConsumerSegment,
  getDefaultConsumerSegments,
  validateConsumerSegments,
  getConsumerSegmentPresets,
} from './consumerSegments.js';

describe('LOCUS Frontier Engine — Phase 7B & 8A: Consumer Segments Model', () => {
  describe('Canonical Constants', () => {
    it('defines standard default beta (price sensitivity) = 1', () => {
      expect(DEFAULT_BETA).toBe(1);
    });

    it('defines standard default delta (delivery-time sensitivity) = 1', () => {
      expect(DEFAULT_DELTA).toBe(1);
    });

    it('defines share sum epsilon = 1e-6', () => {
      expect(SHARE_SUM_EPSILON).toBe(1e-6);
    });

    it('defines canonical default homogeneous segment reproducing Phase 7A & 8A defaults', () => {
      expect(DEFAULT_CONSUMER_SEGMENT).toEqual({
        id: 'general',
        name: 'General Consumers',
        populationShare: 1.0,
        V: 500,
        beta: 1,
        gamma: 10,
        alpha: 10,
        delta: 1,
      });
      expect(Object.isFrozen(DEFAULT_CONSUMER_SEGMENT)).toBe(true);
    });

    it('defines frozen collection of default consumer segments', () => {
      expect(DEFAULT_CONSUMER_SEGMENTS).toHaveLength(1);
      expect(DEFAULT_CONSUMER_SEGMENTS[0]).toBe(DEFAULT_CONSUMER_SEGMENT);
      expect(Object.isFrozen(DEFAULT_CONSUMER_SEGMENTS)).toBe(true);
    });

    it('defines standard preset identifiers and preset library with delivery sensitivity delta', () => {
      expect(CONSUMER_SEGMENT_PRESET_IDS).toEqual({
        BUDGET_SEEKERS: 'budget-seekers',
        QUALITY_SEEKERS: 'quality-seekers',
        CONVENIENCE_SEEKERS: 'convenience-seekers',
        BALANCED: 'balanced',
      });
      expect(Object.isFrozen(CONSUMER_SEGMENT_PRESET_IDS)).toBe(true);

      const presets = getConsumerSegmentPresets();
      expect(presets).toBe(CONSUMER_SEGMENT_PRESETS);
      expect(Object.isFrozen(presets)).toBe(true);

      expect(presets[CONSUMER_SEGMENT_PRESET_IDS.BUDGET_SEEKERS].beta).toBeGreaterThan(1);
      expect(presets[CONSUMER_SEGMENT_PRESET_IDS.BUDGET_SEEKERS].delta).toBe(1.0);
      expect(presets[CONSUMER_SEGMENT_PRESET_IDS.QUALITY_SEEKERS].gamma).toBeGreaterThan(10);
      expect(presets[CONSUMER_SEGMENT_PRESET_IDS.QUALITY_SEEKERS].delta).toBe(1.0);
      expect(presets[CONSUMER_SEGMENT_PRESET_IDS.CONVENIENCE_SEEKERS].alpha).toBeGreaterThan(10);
      expect(presets[CONSUMER_SEGMENT_PRESET_IDS.CONVENIENCE_SEEKERS].delta).toBe(2.5);
      expect(presets[CONSUMER_SEGMENT_PRESET_IDS.BALANCED].beta).toBe(1);
      expect(presets[CONSUMER_SEGMENT_PRESET_IDS.BALANCED].delta).toBe(1.0);
    });
  });

  describe('validateConsumerSegment', () => {
    it('accepts valid segment definitions', () => {
      const seg = {
        id: 'tech-workers',
        name: 'Tech Workers',
        populationShare: 0.25,
        V: 600,
        beta: 0.8,
        gamma: 15,
        alpha: 12,
      };
      expect(validateConsumerSegment(seg)).toBe(true);
    });

    it('throws TypeError for non-object or null input', () => {
      expect(() => validateConsumerSegment(null)).toThrow(TypeError);
      expect(() => validateConsumerSegment(undefined)).toThrow(TypeError);
      expect(() => validateConsumerSegment('segment')).toThrow(TypeError);
      expect(() => validateConsumerSegment(123)).toThrow(TypeError);
    });

    it('throws TypeError for missing or empty id and name', () => {
      expect(() => validateConsumerSegment({ id: '', name: 'A', populationShare: 1, V: 500, beta: 1, gamma: 10, alpha: 10 })).toThrow(TypeError);
      expect(() => validateConsumerSegment({ id: '   ', name: 'A', populationShare: 1, V: 500, beta: 1, gamma: 10, alpha: 10 })).toThrow(TypeError);
      expect(() => validateConsumerSegment({ name: 'A', populationShare: 1, V: 500, beta: 1, gamma: 10, alpha: 10 })).toThrow(TypeError);
      expect(() => validateConsumerSegment({ id: 'a', name: '', populationShare: 1, V: 500, beta: 1, gamma: 10, alpha: 10 })).toThrow(TypeError);
      expect(() => validateConsumerSegment({ id: 'a', name: '   ', populationShare: 1, V: 500, beta: 1, gamma: 10, alpha: 10 })).toThrow(TypeError);
      expect(() => validateConsumerSegment({ id: 'a', populationShare: 1, V: 500, beta: 1, gamma: 10, alpha: 10 })).toThrow(TypeError);
    });

    it('throws TypeError / RangeError for invalid populationShare', () => {
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: '0.5', V: 500, beta: 1, gamma: 10, alpha: 10 })).toThrow(TypeError);
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: NaN, V: 500, beta: 1, gamma: 10, alpha: 10 })).toThrow(TypeError);
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: 0, V: 500, beta: 1, gamma: 10, alpha: 10 })).toThrow(RangeError);
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: -0.1, V: 500, beta: 1, gamma: 10, alpha: 10 })).toThrow(RangeError);
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1.05, V: 500, beta: 1, gamma: 10, alpha: 10 })).toThrow(RangeError);
    });

    it('throws TypeError / RangeError for invalid preference parameters', () => {
      // V
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1, V: '500', beta: 1, gamma: 10, alpha: 10 })).toThrow(TypeError);
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1, V: -10, beta: 1, gamma: 10, alpha: 10 })).toThrow(RangeError);

      // beta
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1, V: 500, beta: NaN, gamma: 10, alpha: 10 })).toThrow(TypeError);
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1, V: 500, beta: -1, gamma: 10, alpha: 10 })).toThrow(RangeError);

      // gamma
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1, V: 500, beta: 1, gamma: Infinity, alpha: 10 })).toThrow(TypeError);
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1, V: 500, beta: 1, gamma: -5, alpha: 10 })).toThrow(RangeError);

      // alpha
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1, V: 500, beta: 1, gamma: 10, alpha: null })).toThrow(TypeError);
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1, V: 500, beta: 1, gamma: 10, alpha: -0.5 })).toThrow(RangeError);

      // delta
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1, V: 500, beta: 1, gamma: 10, alpha: 10, delta: 'fast' })).toThrow(TypeError);
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1, V: 500, beta: 1, gamma: 10, alpha: 10, delta: NaN })).toThrow(TypeError);
      expect(() => validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1, V: 500, beta: 1, gamma: 10, alpha: 10, delta: -1 })).toThrow(RangeError);
      expect(validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1, V: 500, beta: 1, gamma: 10, alpha: 10, delta: 0 })).toBe(true);
      expect(validateConsumerSegment({ id: 'a', name: 'A', populationShare: 1, V: 500, beta: 1, gamma: 10, alpha: 10, delta: 3.5 })).toBe(true);
    });
  });

  describe('createConsumerSegment', () => {
    it('creates and freezes a normalized segment with default values including delta', () => {
      const seg = createConsumerSegment({ id: 'students' });
      expect(seg).toEqual({
        id: 'students',
        name: 'students',
        populationShare: 1.0,
        V: 500,
        beta: 1,
        gamma: 10,
        alpha: 10,
        delta: 1,
      });
      expect(Object.isFrozen(seg)).toBe(true);
    });

    it('preserves explicitly supplied parameters including delta', () => {
      const seg = createConsumerSegment({
        id: 'seniors',
        name: 'Senior Citizens',
        populationShare: 0.3,
        V: 400,
        beta: 1.5,
        gamma: 12,
        alpha: 20,
        delta: 2.0,
      });
      expect(seg).toEqual({
        id: 'seniors',
        name: 'Senior Citizens',
        populationShare: 0.3,
        V: 400,
        beta: 1.5,
        gamma: 12,
        alpha: 20,
        delta: 2.0,
      });
    });
  });

  describe('createDefaultConsumerSegment & getDefaultConsumerSegments', () => {
    it('creates default segment without arguments', () => {
      const def = createDefaultConsumerSegment();
      expect(def).toEqual(DEFAULT_CONSUMER_SEGMENT);
    });

    it('inherits market config overrides (V, beta, gamma, alpha, delta)', () => {
      const custom = createDefaultConsumerSegment({
        V: 700,
        beta: 1.2,
        gamma: 15,
        alpha: 8,
        delta: 3.0,
      });
      expect(custom).toEqual({
        id: 'general',
        name: 'General Consumers',
        populationShare: 1.0,
        V: 700,
        beta: 1.2,
        gamma: 15,
        alpha: 8,
        delta: 3.0,
      });
    });

    it('getDefaultConsumerSegments returns frozen array with default segment', () => {
      const segments = getDefaultConsumerSegments({ gamma: 25 });
      expect(Array.isArray(segments)).toBe(true);
      expect(segments).toHaveLength(1);
      expect(segments[0].gamma).toBe(25);
      expect(Object.isFrozen(segments)).toBe(true);
    });
  });

  describe('validateConsumerSegments', () => {
    it('validates a single segment summing to 1.0', () => {
      const single = [createConsumerSegment({ id: 'all', populationShare: 1.0 })];
      const validated = validateConsumerSegments(single);
      expect(validated).toHaveLength(1);
      expect(Object.isFrozen(validated)).toBe(true);
    });

    it('validates multiple segments whose population shares sum to 1.0', () => {
      const segments = [
        createConsumerSegment({ id: 'budget', populationShare: 0.4, beta: 2.0 }),
        createConsumerSegment({ id: 'quality', populationShare: 0.35, gamma: 20 }),
        createConsumerSegment({ id: 'convenience', populationShare: 0.25, alpha: 25 }),
      ];
      const validated = validateConsumerSegments(segments);
      expect(validated).toHaveLength(3);
      expect(Object.isFrozen(validated)).toBe(true);
    });

    it('throws TypeError for non-array input', () => {
      expect(() => validateConsumerSegments(null)).toThrow(TypeError);
      expect(() => validateConsumerSegments({})).toThrow(TypeError);
    });

    it('throws RangeError for empty segments array', () => {
      expect(() => validateConsumerSegments([])).toThrow(RangeError);
    });

    it('throws RangeError for duplicate segment IDs', () => {
      const dupes = [
        createConsumerSegment({ id: 'seg1', populationShare: 0.5 }),
        createConsumerSegment({ id: 'seg1', populationShare: 0.5 }),
      ];
      expect(() => validateConsumerSegments(dupes)).toThrow(RangeError);
    });

    it('throws RangeError when population shares do not sum to 1.0', () => {
      // Sum = 0.8
      const under = [
        createConsumerSegment({ id: 'seg1', populationShare: 0.4 }),
        createConsumerSegment({ id: 'seg2', populationShare: 0.4 }),
      ];
      expect(() => validateConsumerSegments(under)).toThrow(RangeError);

      // Sum = 1.2
      const over = [
        createConsumerSegment({ id: 'seg1', populationShare: 0.6 }),
        createConsumerSegment({ id: 'seg2', populationShare: 0.6 }),
      ];
      expect(() => validateConsumerSegments(over)).toThrow(RangeError);
    });
  });
});
