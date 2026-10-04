/**
 * @file dynamics.js
 * @description Sequential best-response dynamics and cycle detection for LOCUS Frontier.
 *
 * Implements alternating unilateral best-response adjustments between competing firms
 * on a Frontier urban landscape with deterministic tie-breaking and inertia.
 *
 * Process:
 * 1. Firm A evaluates best response against Firm B's fixed strategy.
 * 2. Deterministic selection with inertia: if current strategy achieves maximum payoff,
 *    firm maintains its current strategy; otherwise chooses the first strategy in canonical order.
 * 3. Firm B evaluates best response against Firm A's updated strategy.
 * 4. Deterministic selection with inertia.
 * 5. Terminate if:
 *    - Convergence: current profile is a pure-strategy Nash equilibrium.
 *    - Cycle: an identical joint strategy profile is repeated (period >= 2).
 *    - Max iterations: upper bound reached without convergence or cycle.
 */

import { DEFAULT_PARAMS, DEFAULT_VARIABLE_COST, DEFAULT_FIXED_COST, FLOAT_EPSILON } from '../types.js';
import { TRAVEL_COST_MODES } from './travelCost.js';
import { getFrontierStrategies } from './strategies.js';
import { calculateFrontierPayoff } from './payoff.js';
import { findFrontierBestResponses, checkFrontierPureNashEquilibrium } from './equilibrium.js';

/**
 * Creates a defensive, deep clone of a canonical Frontier strategy object.
 *
 * @param {{ location: { x: number, y: number }, price: number }} strategy
 * @returns {{ location: { x: number, y: number }, price: number }}
 */
function cloneFrontierStrategy(strategy) {
  return {
    location: { x: strategy.location.x, y: strategy.location.y },
    price: strategy.price,
  };
}

/**
 * Compares two Frontier strategies for value equality.
 *
 * @param {Object} s1
 * @param {Object} s2
 * @returns {boolean}
 */
function areFrontierStrategiesEqual(s1, s2) {
  if (!s1 || !s2) return false;
  return (
    s1.location.x === s2.location.x &&
    s1.location.y === s2.location.y &&
    s1.price === s2.price
  );
}

/**
 * Generates a unique, deterministic string representation of a joint strategy profile.
 * Format: "x_A,y_A,p_A|x_B,y_B,p_B"
 *
 * @param {Object} strategyA
 * @param {Object} strategyB
 * @returns {string}
 */
export function createFrontierStrategyProfileKey(strategyA, strategyB) {
  if (!strategyA?.location || !strategyB?.location) {
    throw new TypeError(
      'createFrontierStrategyProfileKey: both strategies must be valid objects with a location.'
    );
  }
  return `${strategyA.location.x},${strategyA.location.y},${strategyA.price}|${strategyB.location.x},${strategyB.location.y},${strategyB.price}`;
}

/**
 * Executes a single unilateral best-response step for the acting firm.
 *
 * Deterministic Tie-Breaking with Inertia:
 * - If current strategy is among the tied best responses (within tolerance), retain current strategy.
 * - Otherwise, switch to the first strategy in the canonical ordering of tied best responses.
 *
 * @param {Object} options
 * @param {Object} options.city - Frontier city object
 * @param {Object} options.strategyA - Current strategy of Firm A
 * @param {Object} options.strategyB - Current strategy of Firm B
 * @param {'A'|'B'} [options.actingPlayer='A'] - Player taking the unilateral step
 * @param {Array<Object>} [options.strategySpace] - Shared strategy space (default: 500)
 * @param {Array<Object>} [options.strategySpaceA] - Space for Firm A
 * @param {Array<Object>} [options.strategySpaceB] - Space for Firm B
 * @param {'euclidean'|'road'} [options.mode=TRAVEL_COST_MODES.EUCLIDEAN] - Travel cost mode
 * @param {Object} [options.roadNetwork] - Required when mode is 'road'
 * @param {{ V?: number, alpha?: number }} [options.config=DEFAULT_PARAMS]
 * @param {number} [options.variableCost=DEFAULT_VARIABLE_COST]
 * @param {number} [options.fixedCost=DEFAULT_FIXED_COST]
 * @param {number} [options.variableCostA]
 * @param {number} [options.variableCostB]
 * @param {number} [options.fixedCostA]
 * @param {number} [options.fixedCostB]
 * @param {number} [options.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   actingPlayer: 'A'|'B',
 *   nextActingPlayer: 'A'|'B',
 *   strategyA: Object,
 *   strategyB: Object,
 *   previousStrategyA: Object,
 *   previousStrategyB: Object,
 *   deviationOccurred: boolean,
 *   isNash: boolean,
 *   payoffA: number,
 *   payoffB: number,
 *   demandA: number,
 *   demandB: number,
 *   marketShareA: number,
 *   marketShareB: number,
 *   tiedCount: number,
 *   bestResponses: Array<Object>,
 *   stateKey: string,
 *   travelCostMode: string
 * }>}
 */
export function stepFrontierBestResponseDynamics(options = {}) {
  const {
    city,
    strategyA,
    strategyB,
    actingPlayer = 'A',
    strategySpace,
    strategySpaceA,
    strategySpaceB,
    mode = TRAVEL_COST_MODES.EUCLIDEAN,
    roadNetwork,
    config = DEFAULT_PARAMS,
    variableCost = DEFAULT_VARIABLE_COST,
    fixedCost = DEFAULT_FIXED_COST,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance = FLOAT_EPSILON,
  } = options;

  if (!strategyA || !strategyB) {
    throw new TypeError('stepFrontierBestResponseDynamics requires valid strategyA and strategyB.');
  }

  const spaceA = strategySpaceA ?? strategySpace ?? getFrontierStrategies();
  const spaceB = strategySpaceB ?? strategySpace ?? spaceA;

  const prevA = cloneFrontierStrategy(strategyA);
  const prevB = cloneFrontierStrategy(strategyB);

  const isPlayerA = actingPlayer.toUpperCase() === 'A';
  const player = isPlayerA ? 'A' : 'B';
  const nextActingPlayer = isPlayerA ? 'B' : 'A';

  let nextA;
  let nextB;
  let deviationOccurred = false;
  let brResult;

  if (isPlayerA) {
    // Firm A unilaterally optimizes against fixed strategyB
    brResult = findFrontierBestResponses({
      player: 'A',
      opponentStrategy: prevB,
      strategySpace: spaceA,
      city,
      mode,
      roadNetwork,
      config,
      variableCost,
      fixedCost,
      variableCostA,
      variableCostB,
      fixedCostA,
      fixedCostB,
      tolerance,
    });

    const isCurrentBest = brResult.bestResponses.some((br) =>
      areFrontierStrategiesEqual(prevA, br)
    );

    if (isCurrentBest) {
      nextA = cloneFrontierStrategy(prevA);
      deviationOccurred = false;
    } else {
      nextA = cloneFrontierStrategy(brResult.bestResponses[0]);
      deviationOccurred = !areFrontierStrategiesEqual(prevA, nextA);
    }
    nextB = cloneFrontierStrategy(prevB);
  } else {
    // Firm B unilaterally optimizes against fixed strategyA
    brResult = findFrontierBestResponses({
      player: 'B',
      opponentStrategy: prevA,
      strategySpace: spaceB,
      city,
      mode,
      roadNetwork,
      config,
      variableCost,
      fixedCost,
      variableCostA,
      variableCostB,
      fixedCostA,
      fixedCostB,
      tolerance,
    });

    const isCurrentBest = brResult.bestResponses.some((br) =>
      areFrontierStrategiesEqual(prevB, br)
    );

    if (isCurrentBest) {
      nextB = cloneFrontierStrategy(prevB);
      deviationOccurred = false;
    } else {
      nextB = cloneFrontierStrategy(brResult.bestResponses[0]);
      deviationOccurred = !areFrontierStrategiesEqual(prevB, nextB);
    }
    nextA = cloneFrontierStrategy(prevA);
  }

  // Evaluate profile outcomes
  const payoffResult = calculateFrontierPayoff({
    city,
    strategyA: nextA,
    strategyB: nextB,
    mode,
    roadNetwork,
    config,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance,
  });

  // Verify pure Nash equilibrium status of resulting profile
  const nashCheck = checkFrontierPureNashEquilibrium({
    strategyA: nextA,
    strategyB: nextB,
    strategySpaceA: spaceA,
    strategySpaceB: spaceB,
    city,
    mode,
    roadNetwork,
    config,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance,
  });

  return Object.freeze({
    actingPlayer: player,
    nextActingPlayer,
    strategyA: Object.freeze(nextA),
    strategyB: Object.freeze(nextB),
    previousStrategyA: Object.freeze(prevA),
    previousStrategyB: Object.freeze(prevB),
    deviationOccurred,
    isNash: nashCheck.isNash,
    payoffA: payoffResult.restaurantA.profit,
    payoffB: payoffResult.restaurantB.profit,
    demandA: payoffResult.restaurantA.demand,
    demandB: payoffResult.restaurantB.demand,
    marketShareA: payoffResult.restaurantA.marketShare,
    marketShareB: payoffResult.restaurantB.marketShare,
    tiedCount: brResult.bestResponses.length,
    bestResponses: brResult.bestResponses,
    stateKey: createFrontierStrategyProfileKey(nextA, nextB),
    travelCostMode: mode,
  });
}

/**
 * Runs sequential best-response dynamics for Frontier until:
 * 1. Convergence to a pure-strategy Nash equilibrium.
 * 2. Detection of a cycle of repeated states.
 * 3. Max iterations reached.
 *
 * @param {Object} options
 * @param {Object} options.city - Frontier city object
 * @param {Object} options.strategyA - Initial strategy of Firm A
 * @param {Object} options.strategyB - Initial strategy of Firm B
 * @param {'A'|'B'} [options.startingPlayer='A'] - First player to act
 * @param {number} [options.maxIterations=50] - Maximum iterations allowed
 * @param {Array<Object>} [options.strategySpace] - Shared strategy space
 * @param {Array<Object>} [options.strategySpaceA] - Space for Firm A
 * @param {Array<Object>} [options.strategySpaceB] - Space for Firm B
 * @param {'euclidean'|'road'} [options.mode=TRAVEL_COST_MODES.EUCLIDEAN] - Travel cost mode
 * @param {Object} [options.roadNetwork] - Required when mode is 'road'
 * @param {{ V?: number, alpha?: number }} [options.config=DEFAULT_PARAMS]
 * @param {number} [options.variableCost=DEFAULT_VARIABLE_COST]
 * @param {number} [options.fixedCost=DEFAULT_FIXED_COST]
 * @param {number} [options.variableCostA]
 * @param {number} [options.variableCostB]
 * @param {number} [options.fixedCostA]
 * @param {number} [options.fixedCostB]
 * @param {number} [options.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   status: 'converged' | 'cycle' | 'max-iterations',
 *   iterations: number,
 *   iterationCount: number,
 *   trajectory: Array<Object>,
 *   history: Array<Object>,
 *   finalProfile: { restaurantA: Object, restaurantB: Object, strategyA: Object, strategyB: Object },
 *   finalPayoffs: { payoffA: number, payoffB: number },
 *   converged: boolean,
 *   cycleDetected: boolean,
 *   cycleStart: number | null,
 *   cycleStartIndex: number | null,
 *   cycleLength: number | null,
 *   message: string,
 *   travelCostMode: string
 * }>}
 */
export function runFrontierBestResponseDynamics(options = {}) {
  const {
    city,
    strategyA,
    strategyB,
    startingPlayer = 'A',
    maxIterations = 50,
    strategySpace,
    strategySpaceA,
    strategySpaceB,
    mode = TRAVEL_COST_MODES.EUCLIDEAN,
    roadNetwork,
    config = DEFAULT_PARAMS,
    variableCost = DEFAULT_VARIABLE_COST,
    fixedCost = DEFAULT_FIXED_COST,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance = FLOAT_EPSILON,
  } = options;

  if (!strategyA || !strategyB) {
    throw new TypeError('runFrontierBestResponseDynamics requires valid strategyA and strategyB.');
  }

  const spaceA = strategySpaceA ?? strategySpace ?? getFrontierStrategies();
  const spaceB = strategySpaceB ?? strategySpace ?? spaceA;

  let currentA = cloneFrontierStrategy(strategyA);
  let currentB = cloneFrontierStrategy(strategyB);

  // Iteration 0: Initial profile evaluation
  const initialPayoff = calculateFrontierPayoff({
    city,
    strategyA: currentA,
    strategyB: currentB,
    mode,
    roadNetwork,
    config,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance,
  });

  const initialNash = checkFrontierPureNashEquilibrium({
    strategyA: currentA,
    strategyB: currentB,
    strategySpaceA: spaceA,
    strategySpaceB: spaceB,
    city,
    mode,
    roadNetwork,
    config,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance,
  });

  const key0 = createFrontierStrategyProfileKey(currentA, currentB);

  const state0 = Object.freeze({
    iteration: 0,
    actingPlayer: null,
    strategyA: Object.freeze(cloneFrontierStrategy(currentA)),
    strategyB: Object.freeze(cloneFrontierStrategy(currentB)),
    payoffA: initialPayoff.restaurantA.profit,
    payoffB: initialPayoff.restaurantB.profit,
    demandA: initialPayoff.restaurantA.demand,
    demandB: initialPayoff.restaurantB.demand,
    marketShareA: initialPayoff.restaurantA.marketShare,
    marketShareB: initialPayoff.restaurantB.marketShare,
    isNash: initialNash.isNash,
    deviationOccurred: false,
    tiedCount: 1,
    stateKey: key0,
  });

  const trajectory = [state0];

  // Immediate convergence if starting profile is already pure Nash equilibrium
  if (initialNash.isNash) {
    return Object.freeze({
      status: 'converged',
      iterations: 0,
      iterationCount: 0,
      trajectory: Object.freeze(trajectory),
      history: Object.freeze(trajectory),
      finalProfile: Object.freeze({
        restaurantA: state0.strategyA,
        restaurantB: state0.strategyB,
        strategyA: state0.strategyA,
        strategyB: state0.strategyB,
      }),
      finalPayoffs: Object.freeze({
        payoffA: state0.payoffA,
        payoffB: state0.payoffB,
      }),
      converged: true,
      cycleDetected: false,
      cycleStart: null,
      cycleStartIndex: null,
      cycleLength: null,
      message: 'Initial strategy profile is already a pure-strategy Nash equilibrium.',
      travelCostMode: mode,
    });
  }

  // Visited states tracking: Map<stateKey, iterationIndex>
  const visitedStates = new Map();
  visitedStates.set(key0, 0);

  let currentActingPlayer = startingPlayer.toUpperCase() === 'B' ? 'B' : 'A';
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration += 1;

    const stepResult = stepFrontierBestResponseDynamics({
      city,
      strategyA: currentA,
      strategyB: currentB,
      actingPlayer: currentActingPlayer,
      strategySpaceA: spaceA,
      strategySpaceB: spaceB,
      mode,
      roadNetwork,
      config,
      variableCost,
      fixedCost,
      variableCostA,
      variableCostB,
      fixedCostA,
      fixedCostB,
      tolerance,
    });

    currentA = stepResult.strategyA;
    currentB = stepResult.strategyB;

    const state = Object.freeze({
      iteration,
      actingPlayer: stepResult.actingPlayer,
      strategyA: Object.freeze(cloneFrontierStrategy(currentA)),
      strategyB: Object.freeze(cloneFrontierStrategy(currentB)),
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
    });

    trajectory.push(state);

    // 1. Check for pure Nash equilibrium convergence
    if (state.isNash) {
      return Object.freeze({
        status: 'converged',
        iterations: iteration,
        iterationCount: iteration,
        trajectory: Object.freeze(trajectory),
        history: Object.freeze(trajectory),
        finalProfile: Object.freeze({
          restaurantA: state.strategyA,
          restaurantB: state.strategyB,
          strategyA: state.strategyA,
          strategyB: state.strategyB,
        }),
        finalPayoffs: Object.freeze({
          payoffA: state.payoffA,
          payoffB: state.payoffB,
        }),
        converged: true,
        cycleDetected: false,
        cycleStart: null,
        cycleStartIndex: null,
        cycleLength: null,
        message: `Best-response dynamics converged to a pure-strategy Nash equilibrium at iteration ${iteration}.`,
        travelCostMode: mode,
      });
    }

    // 2. Check for cycle detection
    if (visitedStates.has(state.stateKey)) {
      const cycleStart = visitedStates.get(state.stateKey);
      const cycleLength = iteration - cycleStart;
      if (cycleLength >= 2) {
        return Object.freeze({
          status: 'cycle',
          iterations: iteration,
          iterationCount: iteration,
          trajectory: Object.freeze(trajectory),
          history: Object.freeze(trajectory),
          finalProfile: Object.freeze({
            restaurantA: state.strategyA,
            restaurantB: state.strategyB,
            strategyA: state.strategyA,
            strategyB: state.strategyB,
          }),
          finalPayoffs: Object.freeze({
            payoffA: state.payoffA,
            payoffB: state.payoffB,
          }),
          converged: false,
          cycleDetected: true,
          cycleStart,
          cycleStartIndex: cycleStart,
          cycleLength,
          message: `Best-response dynamics entered a cycle of period ${cycleLength} starting at iteration ${cycleStart}.`,
          travelCostMode: mode,
        });
      }
    }

    visitedStates.set(state.stateKey, iteration);
    currentActingPlayer = currentActingPlayer === 'A' ? 'B' : 'A';
  }

  // Max iterations reached
  const finalState = trajectory[trajectory.length - 1];
  return Object.freeze({
    status: 'max-iterations',
    iterations: iteration,
    iterationCount: iteration,
    trajectory: Object.freeze(trajectory),
    history: Object.freeze(trajectory),
    finalProfile: Object.freeze({
      restaurantA: finalState.strategyA,
      restaurantB: finalState.strategyB,
      strategyA: finalState.strategyA,
      strategyB: finalState.strategyB,
    }),
    finalPayoffs: Object.freeze({
      payoffA: finalState.payoffA,
      payoffB: finalState.payoffB,
    }),
    converged: false,
    cycleDetected: false,
    cycleStart: null,
    cycleStartIndex: null,
    cycleLength: null,
    message: `Best-response dynamics reached the maximum iteration limit (${maxIterations}) without converging to a pure Nash equilibrium or repeating a state.`,
    travelCostMode: mode,
  });
}
