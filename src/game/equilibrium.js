/**
 * @file equilibrium.js
 * @description Best-response analysis and pure-strategy Nash equilibrium detection for the LOCUS Game Theory Engine.
 */

import { evaluateProfile } from './payoff.js';
import { calculateDemandFast } from './consumers.js';
import { generateStrategySpace } from './strategies.js';
import {
  DEFAULT_PARAMS,
  DEFAULT_VARIABLE_COST,
  DEFAULT_FIXED_COST,
  FLOAT_EPSILON,
} from './types.js';

/**
 * Calculates all pure best responses for a specified player against a fixed opponent strategy.
 *
 * For a fixed opponent strategy:
 * BR_A(s_B) = argmax_{s_A \in S_A} \pi_A(s_A, s_B)
 * BR_B(s_A) = argmax_{s_B \in S_B} \pi_B(s_A, s_B)
 *
 * All strategies tied within numerical tolerance (FLOAT_EPSILON) of the maximum payoff are returned.
 *
 * @param {Object} params
 * @param {'A'|'B'} [params.player='A'] - The optimizing player ('A' or 'B')
 * @param {{location: {x: number, y: number}, price: number}} params.opponentStrategy - Fixed strategy of the opponent
 * @param {Array<{location: {x: number, y: number}, price: number}>} params.strategySpace - Candidate strategies available to the player
 * @param {Array<Object>|{cells: Array<Object>}} params.city - City customer grid
 * @param {{V?: number, alpha?: number}} [params.config=DEFAULT_PARAMS] - Economic parameters
 * @param {number} [params.variableCost=DEFAULT_VARIABLE_COST] - Marginal cost per customer
 * @param {number} [params.fixedCost=DEFAULT_FIXED_COST] - Fixed overhead cost
 * @param {number} [params.variableCostA] - Marginal cost specific to A
 * @param {number} [params.variableCostB] - Marginal cost specific to B
 * @param {number} [params.fixedCostA] - Fixed cost specific to A
 * @param {number} [params.fixedCostB] - Fixed cost specific to B
 * @returns {{
 *   player: 'A'|'B',
 *   opponentStrategy: {location: {x: number, y: number}, price: number},
 *   bestPayoff: number,
 *   bestResponses: Array<{location: {x: number, y: number}, price: number}>,
 *   evaluatedStrategies: Array<{
 *     strategy: {location: {x: number, y: number}, price: number},
 *     payoff: number,
 *     demand: number,
 *     marketShare: number
 *   }>
 * }}
 */
export function findBestResponses({
  player = 'A',
  opponentStrategy,
  strategySpace,
  city,
  config = DEFAULT_PARAMS,
  variableCost = DEFAULT_VARIABLE_COST,
  fixedCost = DEFAULT_FIXED_COST,
  variableCostA,
  variableCostB,
  fixedCostA,
  fixedCostB,
}) {
  if (!opponentStrategy || typeof opponentStrategy !== 'object') {
    throw new TypeError('findBestResponses: opponentStrategy must be a valid strategy object.');
  }
  if (!strategySpace || !Array.isArray(strategySpace) || strategySpace.length === 0) {
    throw new TypeError('findBestResponses: strategySpace must be a non-empty array of strategies.');
  }

  const isPlayerA = player.toUpperCase() === 'A';
  let bestPayoff = -Infinity;
  let bestResponses = [];
  let bestResponseDetails = [];
  const evaluatedStrategies = [];

  for (let i = 0; i < strategySpace.length; i++) {
    const candidate = strategySpace[i];
    const sA = isPlayerA ? candidate : opponentStrategy;
    const sB = isPlayerA ? opponentStrategy : candidate;

    const evaluation = evaluateProfile({
      city,
      strategyA: sA,
      strategyB: sB,
      config,
      variableCost,
      fixedCost,
      variableCostA,
      variableCostB,
      fixedCostA,
      fixedCostB,
    });

    const payoff = isPlayerA ? evaluation.profitA : evaluation.profitB;
    const demand = isPlayerA ? evaluation.demandA : evaluation.demandB;
    const marketShare = isPlayerA ? evaluation.marketShareA : evaluation.marketShareB;

    const evaluatedItem = {
      strategy: candidate,
      payoff,
      demand,
      marketShare,
    };
    evaluatedStrategies.push(evaluatedItem);

    // Check if new strictly better payoff found beyond float tolerance
    if (payoff > bestPayoff + FLOAT_EPSILON) {
      bestPayoff = payoff;
      bestResponses = [candidate];
      bestResponseDetails = [evaluatedItem];
    } else if (Math.abs(payoff - bestPayoff) <= FLOAT_EPSILON) {
      // Tied payoff within tolerance
      bestResponses.push(candidate);
      bestResponseDetails.push(evaluatedItem);
    }
  }

  return {
    player: isPlayerA ? 'A' : 'B',
    opponentStrategy,
    bestPayoff,
    bestResponses,
    bestResponseDetails,
    evaluatedStrategies,
  };
}

/**
 * Checks whether a specific strategy profile (strategyA, strategyB) constitutes a pure-strategy Nash equilibrium.
 *
 * Definition:
 * (sA*, sB*) is a pure Nash equilibrium iff:
 * \pi_A(sA*, sB*) >= \pi_A(sA', sB*) for all sA' \in S_A
 * AND
 * \pi_B(sA*, sB*) >= \pi_B(sA*, sB') for all sB' \in S_B
 *
 * Weak inequality is evaluated using numerical tolerance:
 * A deviation is profitable iff bestPayoff > currentPayoff + FLOAT_EPSILON.
 *
 * @param {Object} params
 * @param {{location: {x: number, y: number}, price: number}} params.strategyA - Player A's strategy
 * @param {{location: {x: number, y: number}, price: number}} params.strategyB - Player B's strategy
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpace] - Shared strategy space
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpaceA] - Player A strategy space
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpaceB] - Player B strategy space
 * @param {Array<Object>|{cells: Array<Object>}} params.city - City customer grid
 * @param {{V?: number, alpha?: number}} [params.config=DEFAULT_PARAMS] - Economic parameters
 * @param {number} [params.variableCost=DEFAULT_VARIABLE_COST] - Marginal cost
 * @param {number} [params.fixedCost=DEFAULT_FIXED_COST] - Fixed cost
 * @param {number} [params.variableCostA] - Specific marginal cost for A
 * @param {number} [params.variableCostB] - Specific marginal cost for B
 * @param {number} [params.fixedCostA] - Specific fixed cost for A
 * @param {number} [params.fixedCostB] - Specific fixed cost for B
 * @returns {{
 *   isNash: boolean,
 *   strategyA: {location: {x: number, y: number}, price: number},
 *   strategyB: {location: {x: number, y: number}, price: number},
 *   evaluation: Object,
 *   playerA: {
 *     currentPayoff: number,
 *     bestPayoff: number,
 *     hasProfitableDeviation: boolean,
 *     bestResponses: Array<Object>
 *   },
 *   playerB: {
 *     currentPayoff: number,
 *     bestPayoff: number,
 *     hasProfitableDeviation: boolean,
 *     bestResponses: Array<Object>
 *   }
 * }}
 */
export function checkPureNashEquilibrium({
  strategyA,
  strategyB,
  strategySpace,
  strategySpaceA,
  strategySpaceB,
  city,
  config = DEFAULT_PARAMS,
  variableCost = DEFAULT_VARIABLE_COST,
  fixedCost = DEFAULT_FIXED_COST,
  variableCostA,
  variableCostB,
  fixedCostA,
  fixedCostB,
}) {
  const spaceA = strategySpaceA ?? strategySpace ?? generateStrategySpace();
  const spaceB = strategySpaceB ?? strategySpace ?? spaceA;

  // Evaluate current profile
  const evaluation = evaluateProfile({
    city,
    strategyA,
    strategyB,
    config,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
  });

  const currentPayoffA = evaluation.profitA;
  const currentPayoffB = evaluation.profitB;

  // Player A's best responses against strategyB
  const brA = findBestResponses({
    player: 'A',
    opponentStrategy: strategyB,
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

  // Player B's best responses against strategyA
  const brB = findBestResponses({
    player: 'B',
    opponentStrategy: strategyA,
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

  const hasProfitableDeviationA = brA.bestPayoff > currentPayoffA + FLOAT_EPSILON;
  const hasProfitableDeviationB = brB.bestPayoff > currentPayoffB + FLOAT_EPSILON;

  const isNash = !hasProfitableDeviationA && !hasProfitableDeviationB;

  return {
    isNash,
    strategyA,
    strategyB,
    evaluation,
    playerA: {
      currentPayoff: currentPayoffA,
      bestPayoff: brA.bestPayoff,
      hasProfitableDeviation: hasProfitableDeviationA,
      bestResponses: brA.bestResponses,
      bestResponseDetails: brA.bestResponseDetails,
    },
    playerB: {
      currentPayoff: currentPayoffB,
      bestPayoff: brB.bestPayoff,
      hasProfitableDeviation: hasProfitableDeviationB,
      bestResponses: brB.bestResponses,
      bestResponseDetails: brB.bestResponseDetails,
    },
  };
}

/**
 * Computes comprehensive unilateral best-response analysis for both firms in a strategy profile.
 *
 * For each firm:
 * - Current strategy and economic outcome (location, price, demand, marketShare, profit)
 * - Optimal best-response strategy(ies) and expected outcomes
 * - Profitable deviation state (boolean)
 * - Maximum profit improvement relative to current strategy
 * - Tied best response details if multiple strategies achieve the optimal payoff
 *
 * @param {Object} params
 * @param {Array<Object>|{cells: Array<Object>}} params.city - City customer grid
 * @param {{location: {x: number, y: number}, price: number}} params.strategyA - Player A strategy
 * @param {{location: {x: number, y: number}, price: number}} params.strategyB - Player B strategy
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpace] - Shared strategy space
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpaceA] - Strategy space for A
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpaceB] - Strategy space for B
 * @param {{V?: number, alpha?: number}} [params.config=DEFAULT_PARAMS] - Economic parameters
 * @param {number} [params.variableCost=DEFAULT_VARIABLE_COST] - Marginal cost
 * @param {number} [params.fixedCost=DEFAULT_FIXED_COST] - Fixed cost
 * @param {number} [params.variableCostA] - Specific marginal cost for A
 * @param {number} [params.variableCostB] - Specific marginal cost for B
 * @param {number} [params.fixedCostA] - Specific fixed cost for A
 * @param {number} [params.fixedCostB] - Specific fixed cost for B
 * @returns {{
 *   isNash: boolean,
 *   currentEvaluation: Object,
 *   restaurant1: {
 *     player: 'A',
 *     current: { location: {x: number, y: number}, price: number, demand: number, marketShare: number, profit: number },
 *     bestResponses: Array<{location: {x: number, y: number}, price: number}>,
 *     bestResponseDetails: Array<{strategy: Object, payoff: number, demand: number, marketShare: number}>,
 *     bestPayoff: number,
 *     hasProfitableDeviation: boolean,
 *     profitImprovement: number,
 *     isBestResponse: boolean,
 *     tiedCount: number
 *   },
 *   restaurant2: {
 *     player: 'B',
 *     current: { location: {x: number, y: number}, price: number, demand: number, marketShare: number, profit: number },
 *     bestResponses: Array<{location: {x: number, y: number}, price: number}>,
 *     bestResponseDetails: Array<{strategy: Object, payoff: number, demand: number, marketShare: number}>,
 *     bestPayoff: number,
 *     hasProfitableDeviation: boolean,
 *     profitImprovement: number,
 *     isBestResponse: boolean,
 *     tiedCount: number
 *   }
 * }}
 */
export function computeBestResponseAnalysis({
  city,
  strategyA,
  strategyB,
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
  const spaceA = strategySpaceA ?? strategySpace ?? generateStrategySpace();
  const spaceB = strategySpaceB ?? strategySpace ?? spaceA;

  // 1. Evaluate current profile
  const currentEvaluation = evaluateProfile({
    city,
    strategyA,
    strategyB,
    config,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
  });

  // 2. Best responses for Player A (Restaurant 1) against strategyB
  const brA = findBestResponses({
    player: 'A',
    opponentStrategy: strategyB,
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

  // 3. Best responses for Player B (Restaurant 2) against strategyA
  const brB = findBestResponses({
    player: 'B',
    opponentStrategy: strategyA,
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

  const profitA = currentEvaluation.profitA;
  const profitB = currentEvaluation.profitB;

  const hasProfitableDeviationA = brA.bestPayoff > profitA + FLOAT_EPSILON;
  const hasProfitableDeviationB = brB.bestPayoff > profitB + FLOAT_EPSILON;

  const profitImprovementA = hasProfitableDeviationA ? brA.bestPayoff - profitA : 0;
  const profitImprovementB = hasProfitableDeviationB ? brB.bestPayoff - profitB : 0;

  const isNash = !hasProfitableDeviationA && !hasProfitableDeviationB;

  return {
    isNash,
    currentEvaluation,
    restaurant1: {
      player: 'A',
      current: {
        location: strategyA.location,
        price: strategyA.price,
        demand: currentEvaluation.demandA,
        marketShare: currentEvaluation.marketShareA,
        profit: profitA,
      },
      bestResponses: brA.bestResponses,
      bestResponseDetails: brA.bestResponseDetails,
      bestPayoff: brA.bestPayoff,
      hasProfitableDeviation: hasProfitableDeviationA,
      profitImprovement: profitImprovementA,
      isBestResponse: !hasProfitableDeviationA,
      tiedCount: brA.bestResponses.length,
    },
    restaurant2: {
      player: 'B',
      current: {
        location: strategyB.location,
        price: strategyB.price,
        demand: currentEvaluation.demandB,
        marketShare: currentEvaluation.marketShareB,
        profit: profitB,
      },
      bestResponses: brB.bestResponses,
      bestResponseDetails: brB.bestResponseDetails,
      bestPayoff: brB.bestPayoff,
      hasProfitableDeviation: hasProfitableDeviationB,
      profitImprovement: profitImprovementB,
      isBestResponse: !hasProfitableDeviationB,
      tiedCount: brB.bestResponses.length,
    },
  };
}

/**
 * Pure mathematical solver for finding all pure-strategy Nash equilibria from arbitrary payoff matrices.
 *
 * Supports both 2D array representation:
 * matrixA[i][j], matrixB[i][j]
 * and 1D flat typed arrays:
 * payoffsA[i * N + j], payoffsB[i * N + j]
 *
 * Time Complexity: O(M * N) — precomputes column and row maxes in a single pass.
 *
 * @param {Array<Array<number>>|Float64Array|number[]} matrixOrFlatA - Player 1 payoff matrix
 * @param {Array<Array<number>>|Float64Array|number[]} matrixOrFlatB - Player 2 payoff matrix
 * @param {Object} [options]
 * @param {number} [options.M] - Number of actions for Player 1 (required if flat array)
 * @param {number} [options.N] - Number of actions for Player 2 (required if flat array)
 * @param {number} [options.epsilon=FLOAT_EPSILON] - Numerical tolerance for weak inequality
 * @returns {{
 *   equilibria: Array<{indexA: number, indexB: number, payoffA: number, payoffB: number}>,
 *   count: number,
 *   hasPureEquilibrium: boolean,
 *   message: string
 * }}
 */
export function solvePureNashFromPayoffs(matrixOrFlatA, matrixOrFlatB, options = {}) {
  const epsilon = options.epsilon ?? FLOAT_EPSILON;
  let M, N;
  let getPayoffA, getPayoffB;

  if (Array.isArray(matrixOrFlatA) && Array.isArray(matrixOrFlatA[0])) {
    M = matrixOrFlatA.length;
    N = matrixOrFlatA[0].length;
    getPayoffA = (i, j) => matrixOrFlatA[i][j];
    getPayoffB = (i, j) => matrixOrFlatB[i][j];
  } else {
    M = options.M;
    N = options.N;
    if (!M || !N) {
      throw new Error('solvePureNashFromPayoffs requires dimensions M and N for 1D arrays.');
    }
    getPayoffA = (i, j) => matrixOrFlatA[i * N + j];
    getPayoffB = (i, j) => matrixOrFlatB[i * N + j];
  }

  // Precompute column max for Player A (best response to each column j)
  const maxPayoffA = new Float64Array(N).fill(-Infinity);
  // Precompute row max for Player B (best response to each row i)
  const maxPayoffB = new Float64Array(M).fill(-Infinity);

  for (let i = 0; i < M; i++) {
    for (let j = 0; j < N; j++) {
      const pA = getPayoffA(i, j);
      const pB = getPayoffB(i, j);
      if (pA > maxPayoffA[j]) maxPayoffA[j] = pA;
      if (pB > maxPayoffB[i]) maxPayoffB[i] = pB;
    }
  }

  // Identify mutual best responses
  const equilibria = [];
  for (let i = 0; i < M; i++) {
    const bestB = maxPayoffB[i];
    for (let j = 0; j < N; j++) {
      const pA = getPayoffA(i, j);
      const bestA = maxPayoffA[j];

      // Player A is playing a best response to j
      if (pA >= bestA - epsilon) {
        const pB = getPayoffB(i, j);
        // Player B is playing a best response to i
        if (pB >= bestB - epsilon) {
          equilibria.push({
            indexA: i,
            indexB: j,
            payoffA: pA,
            payoffB: pB,
          });
        }
      }
    }
  }

  const hasPureEquilibrium = equilibria.length > 0;
  const message = hasPureEquilibrium
    ? `Found ${equilibria.length} pure-strategy Nash equilibrium profile(s).`
    : 'No pure-strategy Nash equilibrium found in the specified discrete strategy space.';

  return {
    equilibria,
    count: equilibria.length,
    hasPureEquilibrium,
    message,
  };
}

/**
 * Exhaustively searches finite strategy spaces for all pure-strategy Nash equilibria.
 *
 * Algorithmic Optimization & Complexity:
 * - Naive deviation testing performs O(|S_A| * |S_B| * (|S_A| + |S_B|)) evaluations = 250,000,000 evaluations.
 * - This optimized implementation evaluates each profile (s_A, s_B) exactly ONCE in O(|S_A| * |S_B|) = 250,000 evaluations.
 * - Uses zero-allocation fast demand calculations and compact flat Float64Arrays (~8 MB total for the four payoff and demand buffers).
 * - Identifies equilibria via mutual best-response intersections:
 *   (s_A, s_B) \in NE \iff s_A \in BR_A(s_B) \land s_B \in BR_B(s_A).
 *
 * Theoretical Distinction:
 * Reports whether pure-strategy equilibria exist in the discrete strategy space.
 * If none exist, does NOT claim no equilibrium exists overall, as mixed-strategy equilibria may exist.
 *
 * @param {Object} params
 * @param {Array<Object>|{cells: Array<Object>}} params.city - City customer grid
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpace] - Shared strategy space
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpaceA] - Strategy space for A
 * @param {Array<{location: {x: number, y: number}, price: number}>} [params.strategySpaceB] - Strategy space for B
 * @param {{V?: number, alpha?: number}} [params.config=DEFAULT_PARAMS] - Economic parameters
 * @param {number} [params.variableCost=DEFAULT_VARIABLE_COST] - Default marginal cost
 * @param {number} [params.fixedCost=DEFAULT_FIXED_COST] - Default fixed cost
 * @param {number} [params.variableCostA] - Specific marginal cost for A
 * @param {number} [params.variableCostB] - Specific marginal cost for B
 * @param {number} [params.fixedCostA] - Specific fixed cost for A
 * @param {number} [params.fixedCostB] - Specific fixed cost for B
 * @returns {{
 *   equilibria: Array<{
 *     strategyA: {location: {x: number, y: number}, price: number},
 *     strategyB: {location: {x: number, y: number}, price: number},
 *     indexA: number,
 *     indexB: number,
 *     payoffA: number,
 *     payoffB: number,
 *     demandA: number,
 *     demandB: number
 *   }>,
 *   count: number,
 *   hasPureEquilibrium: boolean,
 *   strategySpaceSizeA: number,
 *   strategySpaceSizeB: number,
 *   profilesEvaluated: number,
 *   message: string
 * }}
 */
export function findPureNashEquilibria({
  city,
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
  const spaceA = strategySpaceA ?? strategySpace ?? generateStrategySpace();
  const spaceB = strategySpaceB ?? strategySpace ?? spaceA;

  const M = spaceA.length;
  const N = spaceB.length;

  const cells = Array.isArray(city) ? city : (city?.cells ?? []);
  if (!cells || cells.length === 0) {
    throw new Error('findPureNashEquilibria requires a city with cells.');
  }

  const V = config.V ?? DEFAULT_PARAMS.V;
  const alpha = config.alpha ?? DEFAULT_PARAMS.alpha;

  const varCostA = variableCostA ?? variableCost;
  const varCostB = variableCostB ?? variableCost;
  const fixCostA = fixedCostA ?? fixedCost;
  const fixCostB = fixedCostB ?? fixedCost;

  const totalProfiles = M * N;

  // Compact flat typed arrays for payoffs and demands
  const payoffsA = new Float64Array(totalProfiles);
  const payoffsB = new Float64Array(totalProfiles);
  const demandsA = new Float64Array(totalProfiles);
  const demandsB = new Float64Array(totalProfiles);

  // Precompute payoffs in a single O(M * N) pass
  for (let i = 0; i < M; i++) {
    const sA = spaceA[i];
    const locA = sA.location;
    const priceA = sA.price;
    const rowOffset = i * N;

    for (let j = 0; j < N; j++) {
      const sB = spaceB[j];
      const { demandA, demandB } = calculateDemandFast(
        cells,
        locA,
        priceA,
        sB.location,
        sB.price,
        V,
        alpha
      );

      const piA = (priceA - varCostA) * demandA - fixCostA;
      const piB = (sB.price - varCostB) * demandB - fixCostB;

      const idx = rowOffset + j;
      demandsA[idx] = demandA;
      demandsB[idx] = demandB;
      payoffsA[idx] = piA;
      payoffsB[idx] = piB;
    }
  }

  // Solve for pure Nash equilibria using precomputed payoff matrices
  const matrixResult = solvePureNashFromPayoffs(payoffsA, payoffsB, { M, N });

  // Map indices back to full strategy objects and outcomes
  const equilibria = matrixResult.equilibria.map((eq, index) => {
    const idx = eq.indexA * N + eq.indexB;
    const dA = demandsA[idx];
    const dB = demandsB[idx];
    const totalD = dA + dB;
    return {
      id: index + 1,
      strategyA: spaceA[eq.indexA],
      strategyB: spaceB[eq.indexB],
      indexA: eq.indexA,
      indexB: eq.indexB,
      payoffA: eq.payoffA,
      payoffB: eq.payoffB,
      demandA: dA,
      demandB: dB,
      marketShareA: totalD > 0 ? dA / totalD : 0.5,
      marketShareB: totalD > 0 ? dB / totalD : 0.5,
    };
  });

  return {
    equilibria,
    count: equilibria.length,
    hasPureEquilibrium: matrixResult.hasPureEquilibrium,
    strategySpaceSizeA: M,
    strategySpaceSizeB: N,
    profilesEvaluated: totalProfiles,
    message: matrixResult.message,
  };
}
