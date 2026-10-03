/**
 * @file bottlenecks.test.js
 * @description Unit and mathematical validation tests for LOCUS Frontier:
 * Shortest-Path Bottleneck-Frequency Analysis (Phase 6C.4).
 */

import { describe, it, expect } from 'vitest';
import {
  createRoadNetwork,
  ROAD_SCENARIO_IDS,
  analyzeBottlenecks,
  getEdgeBottleneckFrequency,
} from './index.js';

describe('LOCUS Frontier Engine — Phase 6C.4: Bottleneck Analysis', () => {
  const gridNetwork = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });
  const bottleneckNetwork = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BOTTLENECK });

  describe('Validation & Edge Cases', () => {
    it('throws TypeError if network is invalid', () => {
      expect(() => analyzeBottlenecks(null, [])).toThrow(TypeError);
      expect(() => analyzeBottlenecks(undefined, [])).toThrow(TypeError);
      expect(() => analyzeBottlenecks({}, [])).toThrow(TypeError);
    });

    it('throws TypeError if odPairs is not an array', () => {
      expect(() => analyzeBottlenecks(gridNetwork, null)).toThrow(TypeError);
      expect(() => analyzeBottlenecks(gridNetwork, 'invalid')).toThrow(TypeError);
      expect(() => analyzeBottlenecks(gridNetwork, 123)).toThrow(TypeError);
    });

    it('throws TypeError for malformed OD pairs', () => {
      expect(() => analyzeBottlenecks(gridNetwork, [null])).toThrow(TypeError);
      expect(() => analyzeBottlenecks(gridNetwork, [{ from: { x: 0, y: 0 } }])).toThrow(
        TypeError
      );
      expect(() => analyzeBottlenecks(gridNetwork, [{ to: { x: 1, y: 1 } }])).toThrow(
        TypeError
      );
    });

    it('handles empty odPairs cleanly', () => {
      const result = analyzeBottlenecks(gridNetwork, []);
      expect(result.evaluatedPairs).toBe(0);
      expect(result.reachablePairs).toBe(0);
      expect(result.unreachablePairs).toBe(0);
      expect(result.edgeUsageCounts.size).toBe(0);
      expect(result.normalizedFrequencies.size).toBe(0);
      expect(result.ranking).toEqual([]);
    });

    it('supports alternative OD pair representations ({from, to}, {origin, destination}, [from, to])', () => {
      const pairs = [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { origin: { x: 2, y: 2 }, destination: { x: 3, y: 2 } },
        { start: '5,5', end: '6,5' },
        [{ x: 8, y: 8 }, { x: 9, y: 8 }],
      ];

      const result = analyzeBottlenecks(gridNetwork, pairs);
      expect(result.evaluatedPairs).toBe(4);
      expect(result.reachablePairs).toBe(4);
      expect(result.unreachablePairs).toBe(0);
      expect(result.edgeUsageCounts.get('0,0->1,0')).toBe(1);
      expect(result.edgeUsageCounts.get('2,2->3,2')).toBe(1);
      expect(result.edgeUsageCounts.get('5,5->6,5')).toBe(1);
      expect(result.edgeUsageCounts.get('8,8->9,8')).toBe(1);
    });
  });

  describe('Mathematical Properties & Bottleneck Frequency B(e)', () => {
    it('accurately counts edge usage for known OD paths', () => {
      // Pair 1: (0,0) -> (2,0) uses '0,0->1,0' and '1,0->2,0'
      // Pair 2: (0,0) -> (1,0) uses '0,0->1,0'
      const pairs = [
        { from: { x: 0, y: 0 }, to: { x: 2, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      ];

      const result = analyzeBottlenecks(gridNetwork, pairs);
      expect(result.evaluatedPairs).toBe(2);
      expect(result.reachablePairs).toBe(2);
      expect(result.unreachablePairs).toBe(0);

      // '0,0->1,0' is used by both pairs => count = 2, frequency = 2 / 2 = 1.0
      expect(result.edgeUsageCounts.get('0,0->1,0')).toBe(2);
      expect(result.normalizedFrequencies.get('0,0->1,0')).toBe(1.0);
      expect(getEdgeBottleneckFrequency(result, '0,0', '1,0')).toBe(1.0);

      // '1,0->2,0' is used by only pair 1 => count = 1, frequency = 1 / 2 = 0.5
      expect(result.edgeUsageCounts.get('1,0->2,0')).toBe(1);
      expect(result.normalizedFrequencies.get('1,0->2,0')).toBe(0.5);
      expect(getEdgeBottleneckFrequency(result, '1,0', '2,0')).toBe(0.5);

      // Unused edge has frequency 0
      expect(getEdgeBottleneckFrequency(result, '3,3', '3,4')).toBe(0);
    });

    it('counts each evaluated OD pair at most once per edge', () => {
      const pairs = [{ from: { x: 0, y: 0 }, to: { x: 3, y: 0 } }];
      const result = analyzeBottlenecks(gridNetwork, pairs);

      expect(result.edgeUsageCounts.get('0,0->1,0')).toBe(1);
      expect(result.edgeUsageCounts.get('1,0->2,0')).toBe(1);
      expect(result.edgeUsageCounts.get('2,0->3,0')).toBe(1);
      expect(result.normalizedFrequencies.get('0,0->1,0')).toBe(1.0);
    });

    it('unreachable OD pairs do NOT corrupt the frequency denominator', () => {
      // Disconnected network: (0,0) connected to (1,0), (9,9) isolated
      const disconnectedNetwork = {
        width: 10,
        height: 10,
        adjacency: new Map([
          ['0,0', [{ to: '1,0', weight: 1, x: 1, y: 0 }]],
          ['1,0', [{ to: '0,0', weight: 1, x: 0, y: 0 }]],
          ['9,9', []],
        ]),
        bottlenecks: [],
      };

      const pairs = [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, // Reachable
        { from: { x: 0, y: 0 }, to: { x: 9, y: 9 } }, // Unreachable
      ];

      const result = analyzeBottlenecks(disconnectedNetwork, pairs);

      expect(result.evaluatedPairs).toBe(2);
      expect(result.reachablePairs).toBe(1);
      expect(result.unreachablePairs).toBe(1);

      // Crucial: B(e) denominator is reachablePairs (1), NOT evaluatedPairs (2)
      // So frequency is 1 / 1 = 1.0, not 1 / 2 = 0.5
      expect(result.edgeUsageCounts.get('0,0->1,0')).toBe(1);
      expect(result.normalizedFrequencies.get('0,0->1,0')).toBe(1.0);
    });

    it('computes designated bottleneck frequency and rankings on the BOTTLENECK scenario', () => {
      // Cross-river pairs between northern sector (y <= 3) and southern sector (y >= 6)
      // On the BOTTLENECK network, all north-south crossings must pass through either
      // '4,4->4,5' or '5,4->5,5'
      const pairs = [
        // West sector flows
        { from: { x: 1, y: 1 }, to: { x: 1, y: 8 } },
        { from: { x: 2, y: 2 }, to: { x: 2, y: 7 } },
        // East sector flows
        { from: { x: 7, y: 1 }, to: { x: 7, y: 8 } },
        { from: { x: 8, y: 2 }, to: { x: 8, y: 7 } },
      ];

      const result = analyzeBottlenecks(bottleneckNetwork, pairs);

      expect(result.evaluatedPairs).toBe(4);
      expect(result.reachablePairs).toBe(4);
      expect(result.unreachablePairs).toBe(0);

      // The two designated corridor links capture all 4 cross-city flows
      const freqWest = getEdgeBottleneckFrequency(result, '4,4', '4,5');
      const freqEast = getEdgeBottleneckFrequency(result, '5,4', '5,5');

      expect(freqWest).toBe(0.5); // 2 out of 4 pairs
      expect(freqEast).toBe(0.5); // 2 out of 4 pairs
      expect(freqWest + freqEast).toBe(1.0); // 100% of flows passed through the two bottlenecks

      // Verify designated bottlenecks metadata list
      expect(result.designatedBottleneckEdges.length).toBeGreaterThanOrEqual(2);
      const westEntry = result.designatedBottleneckEdges.find(
        (b) => b.from === '4,4' && b.to === '4,5'
      );
      expect(westEntry).toBeDefined();
      expect(westEntry.count).toBe(2);
      expect(westEntry.frequency).toBe(0.5);

      // Verify rankings
      expect(result.ranking).toHaveLength(result.designatedBottleneckEdges.length);
      expect(result.ranking[0].rank).toBe(1);
      expect(result.ranking[0].frequency).toBeGreaterThanOrEqual(result.ranking[1].frequency);
    });

    it('is completely deterministic with zero randomness on repeated runs', () => {
      const pairs = [
        { from: { x: 1, y: 2 }, to: { x: 8, y: 7 } },
        { from: { x: 3, y: 1 }, to: { x: 4, y: 9 } },
        { from: { x: 0, y: 5 }, to: { x: 9, y: 5 } },
      ];

      const res1 = analyzeBottlenecks(bottleneckNetwork, pairs);
      const res2 = analyzeBottlenecks(bottleneckNetwork, pairs);

      expect(res1.evaluatedPairs).toBe(res2.evaluatedPairs);
      expect(res1.reachablePairs).toBe(res2.reachablePairs);
      expect(res1.unreachablePairs).toBe(res2.unreachablePairs);
      expect(res1.edgeUsage).toEqual(res2.edgeUsage);
      expect(res1.frequencies).toEqual(res2.frequencies);
      expect(res1.ranking).toEqual(res2.ranking);
    });
  });
});
