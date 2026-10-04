/**
 * @file dynamics.test.js
 * @description Comprehensive unit and behavioral validation tests for Frontier
 * sequential best-response dynamics, cycle detection, and inertia.
 */

import { describe, it, expect } from 'vitest';
import {
  createFrontierStrategyProfileKey,
  stepFrontierBestResponseDynamics,
  runFrontierBestResponseDynamics,
} from './dynamics.js';
import { createFrontierCity, SCENARIO_IDS } from './frontierCity.js';
import { createRoadNetwork, ROAD_SCENARIO_IDS } from './roadNetwork.js';
import { TRAVEL_COST_MODES } from './travelCost.js';

describe('LOCUS Frontier Engine — Phase 6E: Best-Response Dynamics', () => {
  const cityBalanced = createFrontierCity({ scenario: SCENARIO_IDS.BALANCED });
  const roadGrid = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });

  describe('createFrontierStrategyProfileKey', () => {
    it('generates canonical deterministic key: "x_A,y_A,p_A|x_B,y_B,p_B"', () => {
      const sA = { location: { x: 2, y: 5 }, price: 200 };
      const sB = { location: { x: 7, y: 5 }, price: 250 };
      expect(createFrontierStrategyProfileKey(sA, sB)).toBe('2,5,200|7,5,250');
    });

    it('throws TypeError for missing or malformed strategies', () => {
      expect(() => createFrontierStrategyProfileKey(null, { location: { x: 0, y: 0 }, price: 200 })).toThrow(
        TypeError
      );
      expect(() => createFrontierStrategyProfileKey({ location: { x: 0, y: 0 } }, null)).toThrow(
        TypeError
      );
    });
  });

  describe('stepFrontierBestResponseDynamics', () => {
    it('allows acting player to unilaterally optimize while holding opponent fixed', () => {
      const sA = { location: { x: 0, y: 0 }, price: 350 };
      const sB = { location: { x: 5, y: 5 }, price: 200 };

      const step = stepFrontierBestResponseDynamics({
        city: cityBalanced,
        strategyA: sA,
        strategyB: sB,
        actingPlayer: 'A',
      });

      expect(step.actingPlayer).toBe('A');
      expect(step.nextActingPlayer).toBe('B');
      expect(step.strategyB).toEqual(sB); // Opponent strategy held strictly fixed
      expect(step.deviationOccurred).toBe(true);
      expect(step.payoffA).toBeGreaterThan(0);
      expect(step.stateKey).toBe(createFrontierStrategyProfileKey(step.strategyA, step.strategyB));
    });

    it('exhibits inertia when current strategy is already a best response', () => {
      // Co-located central equilibrium: current strategy is already an optimal best response
      const sA = { location: { x: 5, y: 5 }, price: 200 };
      const sB = { location: { x: 5, y: 5 }, price: 200 };

      const step = stepFrontierBestResponseDynamics({
        city: cityBalanced,
        strategyA: sA,
        strategyB: sB,
        actingPlayer: 'A',
      });

      expect(step.deviationOccurred).toBe(false);
      expect(step.strategyA).toEqual(sA);
      expect(step.isNash).toBe(true);
    });
  });

  describe('runFrontierBestResponseDynamics', () => {
    it('immediately terminates at iteration 0 if starting profile is already pure Nash', () => {
      const sA = { location: { x: 5, y: 5 }, price: 200 };
      const sB = { location: { x: 5, y: 5 }, price: 200 };

      const result = runFrontierBestResponseDynamics({
        city: cityBalanced,
        strategyA: sA,
        strategyB: sB,
      });

      expect(result.status).toBe('converged');
      expect(result.converged).toBe(true);
      expect(result.iterations).toBe(0);
      expect(result.trajectory).toHaveLength(1);
      expect(result.trajectory[0].isNash).toBe(true);
      expect(result.finalProfile.restaurantA).toEqual(sA);
      expect(result.finalProfile.restaurantB).toEqual(sB);
    });

    it('converges to a pure Nash equilibrium from a non-equilibrium starting profile', () => {
      // Start slightly off-center
      const sA = { location: { x: 4, y: 5 }, price: 200 };
      const sB = { location: { x: 6, y: 5 }, price: 200 };

      const result = runFrontierBestResponseDynamics({
        city: cityBalanced,
        strategyA: sA,
        strategyB: sB,
        maxIterations: 20,
      });

      expect(result.status).toBe('converged');
      expect(result.converged).toBe(true);
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.finalPayoffs.payoffA).toBeGreaterThan(0);
      expect(result.finalPayoffs.payoffB).toBeGreaterThan(0);

      // Verify the last trajectory element is marked as Nash
      const finalState = result.trajectory[result.trajectory.length - 1];
      expect(finalState.isNash).toBe(true);
    });

    it('supports road network travel cost mode during dynamics', () => {
      const sA = { location: { x: 4, y: 5 }, price: 200 };
      const sB = { location: { x: 6, y: 5 }, price: 200 };

      const result = runFrontierBestResponseDynamics({
        city: cityBalanced,
        strategyA: sA,
        strategyB: sB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: roadGrid,
        maxIterations: 20,
      });

      expect(result.travelCostMode).toBe(TRAVEL_COST_MODES.ROAD);
      expect(result.converged).toBe(true);
    });

    it('detects cycles when dynamics repeat an earlier strategic profile', () => {
      // Small controlled 2-zone city and 2-action strategy spaces
      // producing a periodic cycle with no pure-strategy Nash equilibrium
      const miniCity = {
        width: 10,
        height: 10,
        cells: [
          { x: 0, y: 0, population: 100 },
          { x: 6, y: 0, population: 100 },
        ],
      };
      const spaceA = [
        { location: { x: 0, y: 0 }, price: 150 },
        { location: { x: 0, y: 0 }, price: 250 },
      ];
      const spaceB = [
        { location: { x: 0, y: 0 }, price: 200 },
        { location: { x: 6, y: 0 }, price: 200 },
      ];

      const result = runFrontierBestResponseDynamics({
        city: miniCity,
        strategyA: spaceA[0],
        strategyB: spaceB[0],
        startingPlayer: 'B',
        strategySpaceA: spaceA,
        strategySpaceB: spaceB,
        maxIterations: 20,
      });

      expect(result.status).toBe('cycle');
      expect(result.converged).toBe(false);
      expect(result.cycleDetected).toBe(true);
      expect(typeof result.cycleStart).toBe('number');
      expect(result.cycleStart).toBeGreaterThanOrEqual(0);
      expect(result.cycleLength).toBeGreaterThanOrEqual(2);
      expect(result.cycleLength).toBe(4);
      expect(result.iterations).toBe(4);
      expect(result.message).toContain('cycle of period 4');

      // Verify that the detected cycle is genuinely a repeated joint profile
      expect(result.trajectory[result.cycleStart].stateKey).toBe(
        result.trajectory[result.cycleStart + result.cycleLength].stateKey
      );
    });

    it('terminates cleanly with max-iterations status when iteration cap is reached', () => {
      const sA = { location: { x: 0, y: 0 }, price: 350 };
      const sB = { location: { x: 9, y: 9 }, price: 150 };

      const result = runFrontierBestResponseDynamics({
        city: cityBalanced,
        strategyA: sA,
        strategyB: sB,
        maxIterations: 2,
      });

      expect(result.status).toBe('max-iterations');
      expect(result.converged).toBe(false);
      expect(result.cycleDetected).toBe(false);
      expect(result.iterations).toBe(2);
      expect(result.iterationCount).toBe(2);
      expect(result.trajectory).toHaveLength(3); // iteration 0, 1, 2
      expect(result.message).toContain('maximum iteration limit (2)');
    });

    it('preserves immutability of returned trajectory and profile objects', () => {
      const sA = { location: { x: 5, y: 5 }, price: 200 };
      const sB = { location: { x: 5, y: 5 }, price: 200 };

      const result = runFrontierBestResponseDynamics({
        city: cityBalanced,
        strategyA: sA,
        strategyB: sB,
      });

      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.trajectory)).toBe(true);
      expect(Object.isFrozen(result.finalProfile)).toBe(true);
      expect(Object.isFrozen(result.finalPayoffs)).toBe(true);
    });
  });
});
