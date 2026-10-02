/**
 * @file dynamics.test.js
 * @description Vitest test suite for Phase 4C: Best-Response Dynamics.
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultCity,
  generateStrategySpace,
  findBestResponses,
  checkPureNashEquilibrium,
  createStrategyProfileKey,
  stepBestResponseDynamics,
  runBestResponseDynamics,
} from './index.js';

describe('LOCUS Game Theory Engine — Phase 4C: Best-Response Dynamics', () => {
  const city = createDefaultCity();
  const baselineA = Object.freeze({ location: { x: 2, y: 5 }, price: 250 });
  const baselineB = Object.freeze({ location: { x: 7, y: 5 }, price: 250 });

  // TEST 1 — Profile Key Determinism
  describe('Test 1 — createStrategyProfileKey', () => {
    it('generates a deterministic string key based on canonical strategy values', () => {
      const sA = { location: { x: 2, y: 5 }, price: 250 };
      const sB = { location: { x: 7, y: 5 }, price: 250 };

      const key1 = createStrategyProfileKey(sA, sB);
      const key2 = createStrategyProfileKey({ ...sA }, { ...sB });

      expect(key1).toBe('2,5,250|7,5,250');
      expect(key1).toBe(key2);
    });

    it('throws TypeError if strategy or location is missing', () => {
      expect(() => createStrategyProfileKey(null, { location: { x: 0, y: 0 }, price: 200 })).toThrow(
        TypeError
      );
      expect(() => createStrategyProfileKey({ price: 200 }, { location: { x: 0, y: 0 }, price: 200 })).toThrow(
        TypeError
      );
    });
  });

  // TEST 2 — Iteration 0 Recording & Structure
  describe('Test 2 — Iteration 0 recording', () => {
    it('records initial state at iteration 0 with null actingPlayer and accurate outcomes', () => {
      const result = runBestResponseDynamics({
        city,
        strategyA: baselineA,
        strategyB: baselineB,
        maxIterations: 5,
      });

      expect(result.history.length).toBeGreaterThan(0);
      const state0 = result.history[0];

      expect(state0.iteration).toBe(0);
      expect(state0.actingPlayer).toBeNull();
      expect(state0.strategyA).toEqual(baselineA);
      expect(state0.strategyB).toEqual(baselineB);
      expect(state0.payoffA).toBe(1049400);
      expect(state0.payoffB).toBe(1049400);
      expect(state0.demandA).toBeGreaterThan(0);
      expect(state0.demandB).toBeGreaterThan(0);
      expect(state0.marketShareA).toBe(0.5);
      expect(state0.marketShareB).toBe(0.5);
      expect(state0.isNash).toBe(false);
      expect(state0.deviationOccurred).toBe(false);
      expect(state0.stateKey).toBe('2,5,250|7,5,250');
    });
  });

  // TEST 3 — Sequential A/B Updates and Opponent Preservation
  describe('Test 3 — Sequential unilateral updates & opponent preservation', () => {
    it('strictly updates only the acting player while preserving the opponent strategy', () => {
      const result = runBestResponseDynamics({
        city,
        strategyA: baselineA,
        strategyB: baselineB,
        startingPlayer: 'A',
        maxIterations: 4,
      });

      // Iteration 1: Firm A acts, Firm B must be unchanged from iteration 0
      const state0 = result.history[0];
      const state1 = result.history[1];
      expect(state1.actingPlayer).toBe('A');
      expect(state1.strategyB).toEqual(state0.strategyB);
      expect(state1.strategyA).not.toEqual(state0.strategyA);

      // Iteration 2: Firm B acts, Firm A must be unchanged from iteration 1
      const state2 = result.history[2];
      expect(state2.actingPlayer).toBe('B');
      expect(state2.strategyA).toEqual(state1.strategyA);
      expect(state2.strategyB).not.toEqual(state1.strategyB);

      // Iteration 3: Firm A acts, Firm B must be unchanged from iteration 2
      const state3 = result.history[3];
      expect(state3.actingPlayer).toBe('A');
      expect(state3.strategyB).toEqual(state2.strategyB);
    });

    it('supports startingPlayer = "B" where Firm B acts first', () => {
      const result = runBestResponseDynamics({
        city,
        strategyA: baselineA,
        strategyB: baselineB,
        startingPlayer: 'B',
        maxIterations: 2,
      });

      const state0 = result.history[0];
      const state1 = result.history[1];
      expect(state1.actingPlayer).toBe('B');
      expect(state1.strategyA).toEqual(state0.strategyA);
      expect(state1.strategyB).not.toEqual(state0.strategyB);
    });
  });

  // TEST 4 — Best-Response Correctness & Inertia
  describe('Test 4 — Best-response correctness & inertia', () => {
    it('ensures each acting firm moves to an optimal best response against current opponent', () => {
      const result = runBestResponseDynamics({
        city,
        strategyA: baselineA,
        strategyB: baselineB,
        maxIterations: 3,
      });

      // At step 1, A acts against baselineB
      const space = generateStrategySpace();
      const brA = findBestResponses({
        player: 'A',
        opponentStrategy: baselineB,
        strategySpace: space,
        city,
      });

      expect(brA.bestResponses).toContainEqual(result.history[1].strategyA);

      // At step 2, B acts against A's step 1 strategy
      const brB = findBestResponses({
        player: 'B',
        opponentStrategy: result.history[1].strategyA,
        strategySpace: space,
        city,
      });

      expect(brB.bestResponses).toContainEqual(result.history[2].strategyB);
    });

    it('implements inertia: retains current strategy when already among tied best responses', () => {
      // Set up a state where Firm A is already playing a best response to Firm B
      // e.g., Firm B at (7, 5) @ 250, Firm A at its best response (6, 5) @ 250
      const sA = { location: { x: 6, y: 5 }, price: 250 };
      const sB = { location: { x: 7, y: 5 }, price: 250 };

      const step = stepBestResponseDynamics({
        city,
        strategyA: sA,
        strategyB: sB,
        actingPlayer: 'A',
      });

      expect(step.strategyA).toEqual(sA);
      expect(step.deviationOccurred).toBe(false);
    });
  });

  // TEST 5 — Immediate Convergence from Known Nash Equilibrium
  describe('Test 5 — Immediate convergence from pure Nash equilibrium', () => {
    it('immediately terminates at iteration 0 when starting profile is already pure Nash', () => {
      // Equilibrium #1 on default city: A(4, 4) @ 150 vs B(4, 4) @ 150
      const eqA = { location: { x: 4, y: 4 }, price: 150 };
      const eqB = { location: { x: 4, y: 4 }, price: 150 };

      // Verify profile is pure Nash
      const check = checkPureNashEquilibrium({ city, strategyA: eqA, strategyB: eqB });
      expect(check.isNash).toBe(true);

      const result = runBestResponseDynamics({
        city,
        strategyA: eqA,
        strategyB: eqB,
      });

      expect(result.status).toBe('converged');
      expect(result.converged).toBe(true);
      expect(result.iterationCount).toBe(0);
      expect(result.history).toHaveLength(1);
      expect(result.history[0].isNash).toBe(true);
      expect(result.cycleDetected).toBe(false);
      expect(result.message).toContain('already a pure-strategy Nash equilibrium');
    });
  });

  // TEST 6 — Convergence from Off-Equilibrium Baseline
  describe('Test 6 — Convergence from off-equilibrium profile', () => {
    it('converges to a pure Nash equilibrium from the initial baseline profile', () => {
      const result = runBestResponseDynamics({
        city,
        strategyA: baselineA,
        strategyB: baselineB,
        maxIterations: 50,
      });

      expect(result.status).toBe('converged');
      expect(result.converged).toBe(true);
      expect(result.cycleDetected).toBe(false);
      expect(result.iterationCount).toBe(11);
      expect(result.finalState.isNash).toBe(true);

      // Verify final profile is indeed recognized by checkPureNashEquilibrium
      const finalCheck = checkPureNashEquilibrium({
        city,
        strategyA: result.finalState.strategyA,
        strategyB: result.finalState.strategyB,
      });
      expect(finalCheck.isNash).toBe(true);
    });
  });

  // TEST 7 — Cycle Detection on Controlled Small Fixture
  describe('Test 7 — Cycle detection on controlled fixture', () => {
    it('detects a periodic cycle in a controlled game with no pure Nash equilibrium', () => {
      // Controlled spatial game fixture with no pure Nash equilibrium
      const miniCity = [
        { x: 0, y: 0, population: 100 },
        { x: 6, y: 0, population: 100 },
      ];
      const spaceA = [
        { location: { x: 0, y: 0 }, price: 150 },
        { location: { x: 0, y: 0 }, price: 250 },
      ];
      const spaceB = [
        { location: { x: 0, y: 0 }, price: 200 },
        { location: { x: 6, y: 0 }, price: 200 },
      ];

      const result = runBestResponseDynamics({
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
      expect(result.cycleStartIndex).toBe(0);
      expect(result.cycleLength).toBe(4);
      expect(result.message).toContain('cycle of period 4');
    });
  });

  // TEST 8 — Maximum Iteration Limit
  describe('Test 8 — Maximum iteration limit', () => {
    it('terminates cleanly with max-iterations status when iteration cap is reached', () => {
      // Run with small maxIterations = 3 on baseline profile (which normally takes 11 steps)
      const result = runBestResponseDynamics({
        city,
        strategyA: baselineA,
        strategyB: baselineB,
        maxIterations: 3,
      });

      expect(result.status).toBe('max-iterations');
      expect(result.converged).toBe(false);
      expect(result.cycleDetected).toBe(false);
      expect(result.iterationCount).toBe(3);
      expect(result.history).toHaveLength(4); // iteration 0, 1, 2, 3
      expect(result.message).toContain('maximum iteration limit (3)');
    });
  });

  // TEST 9 — Determinism and Pure Execution
  describe('Test 9 — Determinism & caller object immutability', () => {
    it('produces identical trajectories across repeated executions with the same inputs', () => {
      const run1 = runBestResponseDynamics({
        city,
        strategyA: baselineA,
        strategyB: baselineB,
        maxIterations: 15,
      });

      const run2 = runBestResponseDynamics({
        city,
        strategyA: baselineA,
        strategyB: baselineB,
        maxIterations: 15,
      });

      expect(run1.status).toBe(run2.status);
      expect(run1.iterationCount).toBe(run2.iterationCount);
      expect(run1.history).toEqual(run2.history);
    });

    it('does not mutate caller-owned input strategy objects', () => {
      const inputA = { location: { x: 2, y: 5 }, price: 250 };
      const inputB = { location: { x: 7, y: 5 }, price: 250 };

      runBestResponseDynamics({
        city,
        strategyA: inputA,
        strategyB: inputB,
        maxIterations: 10,
      });

      expect(inputA).toEqual({ location: { x: 2, y: 5 }, price: 250 });
      expect(inputB).toEqual({ location: { x: 7, y: 5 }, price: 250 });

      stepBestResponseDynamics({
        city,
        strategyA: inputA,
        strategyB: inputB,
        actingPlayer: 'A',
      });

      expect(inputA).toEqual({ location: { x: 2, y: 5 }, price: 250 });
      expect(inputB).toEqual({ location: { x: 7, y: 5 }, price: 250 });
    });

    it('stepBestResponseDynamics produces exact state matching history[1] of runBestResponseDynamics', () => {
      const singleStep = stepBestResponseDynamics({
        city,
        strategyA: baselineA,
        strategyB: baselineB,
        actingPlayer: 'A',
      });

      const fullRun = runBestResponseDynamics({
        city,
        strategyA: baselineA,
        strategyB: baselineB,
        startingPlayer: 'A',
        maxIterations: 2,
      });

      const step1FromRun = fullRun.history[1];

      expect(singleStep.strategyA).toEqual(step1FromRun.strategyA);
      expect(singleStep.strategyB).toEqual(step1FromRun.strategyB);
      expect(singleStep.payoffA).toBe(step1FromRun.payoffA);
      expect(singleStep.payoffB).toBe(step1FromRun.payoffB);
      expect(singleStep.demandA).toBe(step1FromRun.demandA);
      expect(singleStep.demandB).toBe(step1FromRun.demandB);
      expect(singleStep.isNash).toBe(step1FromRun.isNash);
      expect(singleStep.stateKey).toBe(step1FromRun.stateKey);
    });
  });
});
