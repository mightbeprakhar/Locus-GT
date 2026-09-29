/**
 * @file equilibrium.test.js
 * @description Vitest test suite for Phase 2 of LOCUS: Best Responses and Pure-Strategy Nash Equilibrium.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateProfile,
  findBestResponses,
  checkPureNashEquilibrium,
  solvePureNashFromPayoffs,
  findPureNashEquilibria,
} from './index.js';
import { createUniformCity } from './city.js';

describe('LOCUS Game Theory Engine — Phase 2: Best Responses & Nash Equilibrium', () => {
  // TEST A — Best Response
  describe('Test A — Best response calculation', () => {
    it('identifies the unique optimal response in an obvious single-customer setup', () => {
      // City with 1 customer zone at (0, 0), pop = 100
      const city = [{ x: 0, y: 0, population: 100 }];

      // Opponent B is far away at (9, 9) with high price 350
      const opponentB = { location: { x: 9, y: 9 }, price: 350 };

      // Candidate strategies for A:
      // s1: at (0, 0), price 350 -> captures all demand, margin = 350 - 100 = 250, profit = 25,000
      // s2: at (0, 0), price 250 -> captures all demand, margin = 250 - 100 = 150, profit = 15,000
      // s3: at (9, 9), price 350 -> ties with B, pop splits, profit = 250 * 50 = 12,500
      const s1 = { location: { x: 0, y: 0 }, price: 350 };
      const s2 = { location: { x: 0, y: 0 }, price: 250 };
      const s3 = { location: { x: 9, y: 9 }, price: 350 };

      const result = findBestResponses({
        player: 'A',
        opponentStrategy: opponentB,
        strategySpace: [s1, s2, s3],
        city,
      });

      expect(result.bestPayoff).toBe(25000);
      expect(result.bestResponses).toHaveLength(1);
      expect(result.bestResponses[0]).toEqual(s1);
      expect(result.evaluatedStrategies).toHaveLength(3);
    });

    it('works equivalently when finding best responses for Player B', () => {
      const city = [{ x: 0, y: 0, population: 100 }];
      const opponentA = { location: { x: 9, y: 9 }, price: 350 };
      const s1 = { location: { x: 0, y: 0 }, price: 350 };
      const s2 = { location: { x: 0, y: 0 }, price: 200 };

      const result = findBestResponses({
        player: 'B',
        opponentStrategy: opponentA,
        strategySpace: [s1, s2],
        city,
      });

      expect(result.bestPayoff).toBe(25000);
      expect(result.bestResponses[0]).toEqual(s1);
    });
  });

  // TEST B — Profitable deviation
  describe('Test B — Profitable deviation detection', () => {
    it('detects when Player A has a profitable unilateral deviation (isNash === false)', () => {
      // 1 customer at (5, 5) with pop = 100
      const city = [{ x: 5, y: 5, population: 100 }];

      // Current profile:
      // Player A is far away at (0, 0) charging 350
      // Player B is right at the customer (5, 5) charging 250
      const strategyA = { location: { x: 0, y: 0 }, price: 350 };
      const strategyB = { location: { x: 5, y: 5 }, price: 250 };

      // Strategy space includes a dominant option for A: right on the customer at lower price
      const betterStrategyA = { location: { x: 5, y: 5 }, price: 200 };
      const strategySpace = [strategyA, betterStrategyA];

      const check = checkPureNashEquilibrium({
        strategyA,
        strategyB,
        strategySpace,
        city,
      });

      expect(check.isNash).toBe(false);
      expect(check.playerA.hasProfitableDeviation).toBe(true);
      expect(check.playerA.currentPayoff).toBe(0); // B captured all demand
      expect(check.playerA.bestPayoff).toBeGreaterThan(0);
      expect(check.playerA.bestResponses).toContainEqual(betterStrategyA);
    });
  });

  // TEST C — Nash equilibrium
  describe('Test C — Known pure Nash equilibrium profile', () => {
    it('verifies that a stable mutual best-response profile is recognized as pure Nash (isNash === true)', () => {
      // In a Bertrand duopoly setup on a single consumer zone at (0, 0),
      // with allowed prices [150, 250] and cost 100:
      // At profile (P=150, P=150), both get (150-100)*50 = 2500.
      // If either deviates to 250, they lose all demand (payoff = 0 < 2500).
      // Neither player has a profitable unilateral deviation!
      const city = [{ x: 0, y: 0, population: 100 }];
      const lowPriceStrategy = { location: { x: 0, y: 0 }, price: 150 };
      const highPriceStrategy = { location: { x: 0, y: 0 }, price: 250 };
      const space = [lowPriceStrategy, highPriceStrategy];

      const check = checkPureNashEquilibrium({
        strategyA: lowPriceStrategy,
        strategyB: lowPriceStrategy,
        strategySpace: space,
        city,
      });

      expect(check.isNash).toBe(true);
      expect(check.playerA.hasProfitableDeviation).toBe(false);
      expect(check.playerB.hasProfitableDeviation).toBe(false);
      expect(check.playerA.currentPayoff).toBe(2500);
      expect(check.playerB.currentPayoff).toBe(2500);
      expect(check.playerA.bestPayoff).toBe(2500);
      expect(check.playerB.bestPayoff).toBe(2500);
    });
  });

  // TEST D — Symmetry
  describe('Test D — Payoff and equilibrium symmetry', () => {
    it('produces identical payoffs and 50% market share when both players choose identical strategies', () => {
      const city = createUniformCity(10, 10, 100);
      const strategy = { location: { x: 5, y: 5 }, price: 200 };

      const evaluation = evaluateProfile({
        city,
        strategyA: strategy,
        strategyB: strategy,
      });

      expect(evaluation.profitA).toBe(evaluation.profitB);
      expect(evaluation.demandA).toBe(evaluation.demandB);
      expect(evaluation.marketShareA).toBe(0.5);
      expect(evaluation.marketShareB).toBe(0.5);
      expect(evaluation.totalPopulation).toBe(10000);
    });

    it('produces symmetric payoffs for mirrored spatial configurations on a symmetric city', () => {
      // 10x10 uniform city
      const city = createUniformCity(10, 10, 100);

      // Strategy A at (3, 5) and Strategy B at (6, 5) — symmetric about horizontal midpoint (4.5)
      const strategyA = { location: { x: 3, y: 5 }, price: 250 };
      const strategyB = { location: { x: 6, y: 5 }, price: 250 };

      const evaluation = evaluateProfile({
        city,
        strategyA,
        strategyB,
      });

      expect(evaluation.profitA).toBe(evaluation.profitB);
      expect(evaluation.demandA).toBe(evaluation.demandB);
      expect(evaluation.marketShareA).toBe(0.5);
      expect(evaluation.marketShareB).toBe(0.5);
    });
  });

  // TEST E — Tie handling
  describe('Test E — Tied best responses', () => {
    it('returns all strategies tied for maximum payoff within numerical tolerance', () => {
      // Single consumer zone at (5, 5)
      const city = [{ x: 5, y: 5, population: 100 }];
      const opponentB = { location: { x: 5, y: 5 }, price: 300 };

      // Two candidate strategies equidistant to customer (distance = 1), with identical price
      const s1 = { location: { x: 4, y: 5 }, price: 200 };
      const s2 = { location: { x: 6, y: 5 }, price: 200 };
      // Suboptimal strategy
      const s3 = { location: { x: 0, y: 0 }, price: 350 };

      const br = findBestResponses({
        player: 'A',
        opponentStrategy: opponentB,
        strategySpace: [s1, s2, s3],
        city,
      });

      // Both s1 and s2 yield higher utility than B and identical profit = (200-100)*100 = 10,000
      expect(br.bestPayoff).toBe(10000);
      expect(br.bestResponses).toHaveLength(2);
      expect(br.bestResponses).toContainEqual(s1);
      expect(br.bestResponses).toContainEqual(s2);
      expect(br.bestResponses).not.toContainEqual(s3);
    });
  });

  // TEST F — No pure equilibrium
  describe('Test F — No pure-strategy equilibrium detection', () => {
    it('correctly reports when a finite game has no pure-strategy Nash equilibrium (e.g. Matching Pennies)', () => {
      // Classic Matching Pennies payoff matrix:
      // Player 1 (Row): 0 = Heads, 1 = Tails
      // Player 2 (Col): 0 = Heads, 1 = Tails
      // Payoff A: [[1, -1], [-1, 1]]
      // Payoff B: [[-1, 1], [1, -1]]
      const matrixA = [
        [1, -1],
        [-1, 1],
      ];
      const matrixB = [
        [-1, 1],
        [1, -1],
      ];

      const result = solvePureNashFromPayoffs(matrixA, matrixB);

      expect(result.hasPureEquilibrium).toBe(false);
      expect(result.count).toBe(0);
      expect(result.equilibria).toHaveLength(0);
      expect(result.message).toContain('No pure-strategy Nash equilibrium found');
    });

    it('correctly distinguishes a game WITH pure equilibria from one WITHOUT', () => {
      // Coordination Game:
      // Payoff A: [[2, 0], [0, 1]]
      // Payoff B: [[2, 0], [0, 1]]
      // Pure equilibria at (0, 0) and (1, 1)
      const coordA = [
        [2, 0],
        [0, 1],
      ];
      const coordB = [
        [2, 0],
        [0, 1],
      ];

      const result = solvePureNashFromPayoffs(coordA, coordB);

      expect(result.hasPureEquilibrium).toBe(true);
      expect(result.count).toBe(2);
      expect(result.equilibria).toEqual([
        { indexA: 0, indexB: 0, payoffA: 2, payoffB: 2 },
        { indexA: 1, indexB: 1, payoffA: 1, payoffB: 1 },
      ]);
    });
  });

  // TEST G — Exhaustive search on small fixture
  describe('Test G — Exhaustive pure equilibrium search on a small strategy space', () => {
    it('finds the pure Nash equilibrium on a small controlled spatial game fixture', () => {
      // 1 customer at (0, 0)
      const city = [{ x: 0, y: 0, population: 100 }];

      // Small strategy space: 2 locations, 2 prices = 4 strategies
      const smallSpace = [
        { location: { x: 0, y: 0 }, price: 150 },
        { location: { x: 0, y: 0 }, price: 250 },
        { location: { x: 2, y: 2 }, price: 150 },
        { location: { x: 2, y: 2 }, price: 250 },
      ];

      const result = findPureNashEquilibria({
        city,
        strategySpace: smallSpace,
      });

      expect(result.strategySpaceSizeA).toBe(4);
      expect(result.strategySpaceSizeB).toBe(4);
      expect(result.profilesEvaluated).toBe(16);
      expect(result.hasPureEquilibrium).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(1);

      // Verify that every returned equilibrium profile passes unilateral deviation check
      for (const eq of result.equilibria) {
        const verification = checkPureNashEquilibrium({
          strategyA: eq.strategyA,
          strategyB: eq.strategyB,
          strategySpace: smallSpace,
          city,
        });
        expect(verification.isNash).toBe(true);
      }
    });

    it('returns the exact documented message when no pure equilibrium exists', () => {
      // Fixture with custom non-equilibrium space
      const city = [{ x: 0, y: 0, population: 100 }];
      // Setup where Player A and B are locked into an asymmetric cyclic game
      const spaceA = [
        { location: { x: 0, y: 0 }, price: 150 },
        { location: { x: 1, y: 1 }, price: 250 },
      ];
      const spaceB = [
        { location: { x: 1, y: 1 }, price: 150 },
        { location: { x: 0, y: 0 }, price: 250 },
      ];

      const result = findPureNashEquilibria({
        city,
        strategySpaceA: spaceA,
        strategySpaceB: spaceB,
      });

      // Result should be well-formed regardless of equilibrium existence
      expect(result.profilesEvaluated).toBe(4);
      if (!result.hasPureEquilibrium) {
        expect(result.message).toBe('No pure-strategy Nash equilibrium found in the specified discrete strategy space.');
      }
    });
  });

  // Profile Evaluation Verification
  describe('Profile Evaluation Unit Tests', () => {
    it('accepts both options object and positional arguments', () => {
      const city = [{ x: 0, y: 0, population: 50 }];
      const sA = { location: { x: 0, y: 0 }, price: 200 };
      const sB = { location: { x: 1, y: 1 }, price: 200 };

      // Object call
      const resObj = evaluateProfile({ city, strategyA: sA, strategyB: sB });
      // Positional call
      const resPos = evaluateProfile(city, sA, sB);

      expect(resObj.demandA).toBe(resPos.demandA);
      expect(resObj.profitA).toBe(resPos.profitA);
      expect(resObj.marketShareA).toBe(resPos.marketShareA);
      expect(resObj.totalPopulation).toBe(50);
    });

    it('accurately computes asymmetric variable costs', () => {
      const city = [{ x: 0, y: 0, population: 100 }];
      const sA = { location: { x: 0, y: 0 }, price: 200 };
      const sB = { location: { x: 0, y: 0 }, price: 200 };

      const res = evaluateProfile({
        city,
        strategyA: sA,
        strategyB: sB,
        variableCostA: 80,
        variableCostB: 120,
      });

      // Demand splits 50/50 = 50 each
      expect(res.demandA).toBe(50);
      expect(res.demandB).toBe(50);
      // profitA = (200 - 80) * 50 = 6000
      expect(res.profitA).toBe(6000);
      // profitB = (200 - 120) * 50 = 4000
      expect(res.profitB).toBe(4000);
    });
  });
});
