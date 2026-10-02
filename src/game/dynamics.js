/**
 * @file dynamics.js
 * @description Sequential best-response dynamics and cycle detection
 * for the LOCUS Game Theory Engine.
 */

import { generateStrategySpace } from './strategies.js';
import { evaluateProfile } from './payoff.js';
import { findBestResponses, checkPureNashEquilibrium } from './equilibrium.js';
import {
  DEFAULT_PARAMS,
  DEFAULT_VARIABLE_COST,
  DEFAULT_FIXED_COST,
} from './types.js';

/**
 * Creates a defensive, deep clone of a canonical strategy object.
 *
 * @param {{location: {x: number, y: number}, price: number}} strategy
 * @returns {{location: {x: number, y: number}, price: number}}
 */
function cloneStrategy(strategy) {
  return {
    location: { x: strategy.location.x, y: strategy.location.y },
    price: strategy.price,
  };
}

/**
 * Compares two strategies for exact canonical value equality.
 *
 * @param {{location: {x: number, y: number}, price: number}} s1
 * @param {{location: {x: number, y: number}, price: number}} s2
 * @returns {boolean} True if coordinates and price are identical
 */
function areStrategiesEqual(s1, s2) {
  if (!s1 || !s2) return false;
  return (
    s1.location.x === s2.location.x &&
    s1.location.y === s2.location.y &&
    s1.price === s2.price
  );
}

/**
 * Generates a deterministic, unique string key representing a joint strategy profile.
 * Format: "x_A,y_A,p_A|x_B,y_B,p_B"
 * Example: "2,5,250|7,5,250"
 *
 * Independent of object identity and whitespace.
 *
 * @param {{location: {x: number, y: number}, price: number}} strategyA - Firm A strategy
 * @param {{location: {x: number, y: number}, price: number}} strategyB - Firm B strategy
 * @returns {string} Deterministic state key
 */
export function createStrategyProfileKey(strategyA, strategyB) {
  if (!strategyA?.location || !strategyB?.location) {
    throw new TypeError(
      'createStrategyProfileKey: both strategies must be valid objects with a location.'
    );
  }
  return `${strategyA.location.x},${strategyA.location.y},${strategyA.price}|${strategyB.location.x},${strategyB.location.y},${strategyB.price}`;
}

/**
 * Executes a single unilateral best-response step for the acting player against
 * the opponent's fixed strategy.
 *
 * Deterministic Tie-Breaking with Inertia:
 * 1. If the acting player's current strategy is already in the set of tied best responses
 *    (i.e. achieves the maximum payoff within numerical tolerance), the firm retains its
 *    current strategy (inertia).
 * 2. If the current strategy is not a best response, the firm selects the first best response
 *    returned by findBestResponses(), which corresponds to the lowest canonical index
 *    in the deterministically ordered strategySpace.
 *
 * @param {Object} params
 * @param {Array<Object>|{cells: Array<Object>}} params.city - City customer grid
 * @param {{location: {x: number, y: number}, price: number}} params.strategyA - Current strategy of Firm A
 * @param {{location: {x: number, y: number}, price: number}} params.strategyB - Current strategy of Firm B
 * @param {'A'|'B'} [params.actingPlayer='A'] - Firm that unilaterally optimizes its strategy
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpace] - Shared candidate space
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpaceA] - Space for Firm A
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpaceB] - Space for Firm B
 * @param {{V?: number, alpha?: number}} [params.config=DEFAULT_PARAMS] - Economic parameters
 * @param {number} [params.variableCost=DEFAULT_VARIABLE_COST] - Marginal cost
 * @param {number} [params.fixedCost=DEFAULT_FIXED_COST] - Fixed overhead cost
 * @param {number} [params.variableCostA] - Marginal cost for A
 * @param {number} [params.variableCostB] - Marginal cost for B
 * @param {number} [params.fixedCostA] - Fixed cost for A
 * @param {number} [params.fixedCostB] - Fixed cost for B
 * @returns {{
 *   actingPlayer: 'A'|'B',
 *   nextActingPlayer: 'A'|'B',
 *   strategyA: {location: {x: number, y: number}, price: number},
 *   strategyB: {location: {x: number, y: number}, price: number},
 *   previousStrategyA: {location: {x: number, y: number}, price: number},
 *   previousStrategyB: {location: {x: number, y: number}, price: number},
 *   deviationOccurred: boolean,
 *   isNash: boolean,
 *   payoffA: number,
 *   payoffB: number,
 *   demandA: number,
 *   demandB: number,
 *   marketShareA: number,
 *   marketShareB: number,
 *   tiedCount: number,
 *   bestResponses: Array<{location: {x: number, y: number}, price: number}>,
 *   bestResponseDetails: Array<Object>,
 *   stateKey: string
 * }}
 */
export function stepBestResponseDynamics({
  city,
  strategyA,
  strategyB,
  actingPlayer = 'A',
  strategySpace,
  strategySpaceA,
  strategySpaceB,
  config = DEFAULT_PARAMS,
  variableCost = DEFAULT_VARIABLE_COST,
  fixedCost = DEFAULT_FIXED_COST,
  variableCostA,
  variableCostB,
  fixedCostA,
  fixedCostB,
}) {
  if (!strategyA || !strategyB) {
    throw new TypeError('stepBestResponseDynamics requires valid strategyA and strategyB.');
  }

  const spaceA = strategySpaceA ?? strategySpace ?? generateStrategySpace();
  const spaceB = strategySpaceB ?? strategySpace ?? spaceA;

  const prevA = cloneStrategy(strategyA);
  const prevB = cloneStrategy(strategyB);

  const isPlayerA = actingPlayer.toUpperCase() === 'A';
  const player = isPlayerA ? 'A' : 'B';
  const nextActingPlayer = isPlayerA ? 'B' : 'A';

  let nextA;
  let nextB;
  let deviationOccurred = false;
  let brResult;

  if (isPlayerA) {
    // Firm A unilaterally optimizes against fixed strategyB
    brResult = findBestResponses({
      player: 'A',
      opponentStrategy: prevB,
      strategySpace: spaceA,
      city,
      config,
      variableCost,
      fixedCost,
      variableCostA,
      variableCostB,
      fixedCostA,
      fixedCostB,
    });

    // Deterministic tie-breaking with inertia:
    // If current strategy is already among the tied best responses, keep it.
    const isCurrentBestResponse = brResult.bestResponses.some((br) =>
      areStrategiesEqual(prevA, br)
    );

    if (isCurrentBestResponse) {
      nextA = cloneStrategy(prevA);
      deviationOccurred = false;
    } else {
      nextA = cloneStrategy(brResult.bestResponses[0]);
      deviationOccurred = !areStrategiesEqual(prevA, nextA);
    }

    // Opponent strategy B is strictly preserved
    nextB = cloneStrategy(prevB);
  } else {
    // Firm B unilaterally optimizes against fixed strategyA
    brResult = findBestResponses({
      player: 'B',
      opponentStrategy: prevA,
      strategySpace: spaceB,
      city,
      config,
      variableCost,
      fixedCost,
      variableCostA,
      variableCostB,
      fixedCostA,
      fixedCostB,
    });

    // Deterministic tie-breaking with inertia
    const isCurrentBestResponse = brResult.bestResponses.some((br) =>
      areStrategiesEqual(prevB, br)
    );

    if (isCurrentBestResponse) {
      nextB = cloneStrategy(prevB);
      deviationOccurred = false;
    } else {
      nextB = cloneStrategy(brResult.bestResponses[0]);
      deviationOccurred = !areStrategiesEqual(prevB, nextB);
    }

    // Opponent strategy A is strictly preserved
    nextA = cloneStrategy(prevA);
  }

  // Evaluate the resulting strategy profile
  const evaluation = evaluateProfile({
    city,
    strategyA: nextA,
    strategyB: nextB,
    config,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
  });

  // Verify pure Nash equilibrium status of the resulting profile
  const nashCheck = checkPureNashEquilibrium({
    strategyA: nextA,
    strategyB: nextB,
    strategySpaceA: spaceA,
    strategySpaceB: spaceB,
    city,
    config,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
  });

  return {
    actingPlayer: player,
    nextActingPlayer,
    strategyA: nextA,
    strategyB: nextB,
    previousStrategyA: prevA,
    previousStrategyB: prevB,
    deviationOccurred,
    isNash: nashCheck.isNash,
    payoffA: evaluation.profitA,
    payoffB: evaluation.profitB,
    demandA: evaluation.demandA,
    demandB: evaluation.demandB,
    marketShareA: evaluation.marketShareA,
    marketShareB: evaluation.marketShareB,
    tiedCount: brResult.bestResponses.length,
    bestResponses: brResult.bestResponses,
    bestResponseDetails: brResult.bestResponseDetails,
    stateKey: createStrategyProfileKey(nextA, nextB),
  };
}

/**
 * Runs sequential best-response dynamics from an initial strategy profile until
 * convergence to a pure-strategy Nash equilibrium, detection of a repeated cycle,
 * or reaching the iteration limit.
 *
 * @param {Object} params
 * @param {Array<Object>|{cells: Array<Object>}} params.city - City customer grid
 * @param {{location: {x: number, y: number}, price: number}} params.strategyA - Initial strategy of Firm A
 * @param {{location: {x: number, y: number}, price: number}} params.strategyB - Initial strategy of Firm B
 * @param {'A'|'B'} [params.startingPlayer='A'] - Firm that takes the first unilateral action
 * @param {number} [params.maxIterations=50] - Maximum iterations allowed before terminating
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpace] - Shared candidate space
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpaceA] - Space for Firm A
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpaceB] - Space for Firm B
 * @param {{V?: number, alpha?: number}} [params.config=DEFAULT_PARAMS] - Economic parameters
 * @param {number} [params.variableCost=DEFAULT_VARIABLE_COST] - Marginal cost
 * @param {number} [params.fixedCost=DEFAULT_FIXED_COST] - Fixed overhead cost
 * @param {number} [params.variableCostA] - Marginal cost for A
 * @param {number} [params.variableCostB] - Marginal cost for B
 * @param {number} [params.fixedCostA] - Fixed cost for A
 * @param {number} [params.fixedCostB] - Fixed cost for B
 * @returns {{
 *   status: 'converged' | 'cycle' | 'max-iterations',
 *   history: Array<{
 *     iteration: number,
 *     actingPlayer: 'A'|'B'|null,
 *     strategyA: {location: {x: number, y: number}, price: number},
 *     strategyB: {location: {x: number, y: number}, price: number},
 *     payoffA: number,
 *     payoffB: number,
 *     demandA: number,
 *     demandB: number,
 *     marketShareA: number,
 *     marketShareB: number,
 *     isNash: boolean,
 *     deviationOccurred: boolean,
 *     tiedCount: number,
 *     stateKey: string
 *   }>,
 *   iterationCount: number,
 *   converged: boolean,
 *   cycleDetected: boolean,
 *   cycleStartIndex: number | null,
 *   cycleLength: number | null,
 *   finalState: Object,
 *   message: string
 * }}
 */
export function runBestResponseDynamics({
  city,
  strategyA,
  strategyB,
  startingPlayer = 'A',
  maxIterations = 50,
  strategySpace,
  strategySpaceA,
  strategySpaceB,
  config = DEFAULT_PARAMS,
  variableCost = DEFAULT_VARIABLE_COST,
  fixedCost = DEFAULT_FIXED_COST,
  variableCostA,
  variableCostB,
  fixedCostA,
  fixedCostB,
}) {
  if (!strategyA || !strategyB) {
    throw new TypeError('runBestResponseDynamics requires valid strategyA and strategyB.');
  }

  const spaceA = strategySpaceA ?? strategySpace ?? generateStrategySpace();
  const spaceB = strategySpaceB ?? strategySpace ?? spaceA;

  let currentA = cloneStrategy(strategyA);
  let currentB = cloneStrategy(strategyB);

  // 1. Evaluate Initial Profile (Iteration 0)
  const initialEvaluation = evaluateProfile({
    city,
    strategyA: currentA,
    strategyB: currentB,
    config,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
  });

  const initialNashCheck = checkPureNashEquilibrium({
    strategyA: currentA,
    strategyB: currentB,
    strategySpaceA: spaceA,
    strategySpaceB: spaceB,
    city,
    config,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
  });

  const key0 = createStrategyProfileKey(currentA, currentB);

  const state0 = {
    iteration: 0,
    actingPlayer: null,
    strategyA: cloneStrategy(currentA),
    strategyB: cloneStrategy(currentB),
    payoffA: initialEvaluation.profitA,
    payoffB: initialEvaluation.profitB,
    demandA: initialEvaluation.demandA,
    demandB: initialEvaluation.demandB,
    marketShareA: initialEvaluation.marketShareA,
    marketShareB: initialEvaluation.marketShareB,
    isNash: initialNashCheck.isNash,
    deviationOccurred: false,
    tiedCount: 1,
    stateKey: key0,
  };

  const history = [state0];

  // Immediate termination if starting profile is already pure Nash equilibrium
  if (initialNashCheck.isNash) {
    return {
      status: 'converged',
      history,
      iterationCount: 0,
      converged: true,
      cycleDetected: false,
      cycleStartIndex: null,
      cycleLength: null,
      finalState: state0,
      message: 'Initial strategy profile is already a pure-strategy Nash equilibrium.',
    };
  }

  // Visited states tracking for cycle detection: Map<stateKey, iterationIndex>
  // Initial state (iteration 0) is explicitly included to detect loops returning to start
  const visitedStates = new Map();
  visitedStates.set(key0, 0);

  let currentActingPlayer = startingPlayer.toUpperCase() === 'B' ? 'B' : 'A';
  let iteration = 0;

  // Sequential dynamics loop
  while (iteration < maxIterations) {
    iteration += 1;

    const stepResult = stepBestResponseDynamics({
      city,
      strategyA: currentA,
      strategyB: currentB,
      actingPlayer: currentActingPlayer,
      strategySpaceA: spaceA,
      strategySpaceB: spaceB,
      config,
      variableCost,
      fixedCost,
      variableCostA,
      variableCostB,
      fixedCostA,
      fixedCostB,
    });

    currentA = stepResult.strategyA;
    currentB = stepResult.strategyB;

    const state = {
      iteration,
      actingPlayer: stepResult.actingPlayer,
      strategyA: cloneStrategy(currentA),
      strategyB: cloneStrategy(currentB),
      payoffA: stepResult.payoffA,
      payoffB: stepResult.payoffB,
      demandA: stepResult.demandA,
      demandB: stepResult.demandB,
      marketShareA: stepResult.marketShareA,
      marketShareB: stepResult.marketShareB,
      isNash: stepResult.isNash,
      deviationOccurred: stepResult.deviationOccurred,
      tiedCount: stepResult.tiedCount,
      stateKey: stepResult.stateKey,
    };

    history.push(state);

    // 1. Check for pure Nash equilibrium convergence
    if (state.isNash) {
      return {
        status: 'converged',
        history,
        iterationCount: iteration,
        converged: true,
        cycleDetected: false,
        cycleStartIndex: null,
        cycleLength: null,
        finalState: state,
        message: `Best-response dynamics converged to a pure-strategy Nash equilibrium at iteration ${iteration}.`,
      };
    }

    // 2. Check for cycle detection (repeated strategic state)
    // In alternating sequential dynamics, a true cycle requires an alternating round-trip (cycleLength >= 2).
    // If the acting player did not deviate at step 1 (deviationOccurred: false), they were simply
    // already playing a best response to the initial state; the turn passes to the opponent.
    if (visitedStates.has(state.stateKey)) {
      const cycleStartIndex = visitedStates.get(state.stateKey);
      const cycleLength = iteration - cycleStartIndex;
      if (cycleLength >= 2) {
        return {
          status: 'cycle',
          history,
          iterationCount: iteration,
          converged: false,
          cycleDetected: true,
          cycleStartIndex,
          cycleLength,
          finalState: state,
          message: `Best-response dynamics entered a cycle of period ${cycleLength} starting at iteration ${cycleStartIndex}.`,
        };
      }
    }

    // Record visited state
    visitedStates.set(state.stateKey, iteration);

    // Alternate acting player
    currentActingPlayer = currentActingPlayer === 'A' ? 'B' : 'A';
  }

  // Terminated due to iteration limit
  const finalState = history[history.length - 1];
  return {
    status: 'max-iterations',
    history,
    iterationCount: iteration,
    converged: false,
    cycleDetected: false,
    cycleStartIndex: null,
    cycleLength: null,
    finalState,
    message: `Best-response dynamics reached the maximum iteration limit (${maxIterations}) without converging to a pure Nash equilibrium or repeating a state.`,
  };
}
