/**
 * @file equilibrium.js
 * @description Frontier best-response analysis and pure-strategy Nash equilibrium search.
 *
 * Game Theory Foundations:
 * In the finite discrete Frontier location-price game:
 * - Each firm chooses a pure strategy s_j = (location, price) from strategy space S_j (|S_j| = 500).
 * - A pure strategy profile is (s_A, s_B) in S_A x S_B (250,000 profiles).
 *
 * Best Response:
 *   BR_A(s_B) = argmax_{s_A in S_A} pi_A(s_A, s_B)
 *   BR_B(s_A) = argmax_{s_B in S_B} pi_B(s_A, s_B)
 *
 * Pure-Strategy Nash Equilibrium:
 *   (s_A*, s_B*) is a pure Nash equilibrium iff:
 *     pi_A(s_A*, s_B*) >= pi_A(s_A', s_B*) for all s_A' in S_A
 *     AND
 *     pi_B(s_A*, s_B*) >= pi_B(s_A*, s_B') for all s_B' in S_B
 *
 * Optimization & Separation Architecture:
 * - Location-dependent travel costs T(c, L) are independent of restaurant prices.
 * - For a fixed city and road network, all-pairs travel costs between all 100 customer zones
 *   and all 100 candidate restaurant locations are precomputed into a fast flat distance matrix.
 * - This avoids re-running Dijkstra shortest paths across the 250,000 strategy profiles.
 */

import {
  DEFAULT_GRID,
  DEFAULT_PARAMS,
  DEFAULT_VARIABLE_COST,
  DEFAULT_FIXED_COST,
  FLOAT_EPSILON,
} from '../types.js';
import { TRAVEL_COST_MODES } from './travelCost.js';
import { createNodeId, parseNodeId } from './roadNetwork.js';
import { getFrontierStrategies } from './strategies.js';
import { calculateFrontierPayoff } from './payoff.js';

/**
 * Deterministic Binary Min-Heap Priority Queue for Dijkstra precomputations.
 */
class PriorityQueue {
  constructor() {
    this.heap = [];
  }

  push(item, priority, tieBreaker = '') {
    this.heap.push({ item, priority, tieBreaker });
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._sinkDown(0);
    }
    return top;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  _compare(a, b) {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.tieBreaker.localeCompare(b.tieBreaker);
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1;
      if (this._compare(this.heap[idx], this.heap[parentIdx]) < 0) {
        const tmp = this.heap[idx];
        this.heap[idx] = this.heap[parentIdx];
        this.heap[parentIdx] = tmp;
        idx = parentIdx;
      } else {
        break;
      }
    }
  }

  _sinkDown(idx) {
    const length = this.heap.length;
    while (true) {
      const leftIdx = (idx << 1) + 1;
      const rightIdx = leftIdx + 1;
      let smallest = idx;

      if (leftIdx < length && this._compare(this.heap[leftIdx], this.heap[smallest]) < 0) {
        smallest = leftIdx;
      }
      if (rightIdx < length && this._compare(this.heap[rightIdx], this.heap[smallest]) < 0) {
        smallest = rightIdx;
      }
      if (smallest !== idx) {
        const tmp = this.heap[idx];
        this.heap[idx] = this.heap[smallest];
        this.heap[smallest] = tmp;
        idx = smallest;
      } else {
        break;
      }
    }
  }
}

/**
 * Builds a deterministic travel cost distance matrix mapping every location (0..width*height-1)
 * to every customer zone (0..width*height-1).
 *
 * Matrix format: Float64Array of size (totalNodes * totalNodes).
 * Access: distMatrix[locIndex * totalNodes + cellIndex]
 *
 * @param {Object} params
 * @param {number} params.width
 * @param {number} params.height
 * @param {'euclidean'|'road'} params.mode
 * @param {Object} [params.roadNetwork]
 * @returns {Float64Array}
 */
export function buildFrontierTravelCostMatrix({
  width = DEFAULT_GRID.width,
  height = DEFAULT_GRID.height,
  mode = TRAVEL_COST_MODES.EUCLIDEAN,
  roadNetwork,
}) {
  const totalNodes = width * height;
  const matrix = new Float64Array(totalNodes * totalNodes);

  if (mode === TRAVEL_COST_MODES.EUCLIDEAN) {
    for (let ly = 0; ly < height; ly++) {
      for (let lx = 0; lx < width; lx++) {
        const locIdx = ly * width + lx;
        const rowOffset = locIdx * totalNodes;
        for (let cy = 0; cy < height; cy++) {
          for (let cx = 0; cx < width; cx++) {
            const cellIdx = cy * width + cx;
            const dx = cx - lx;
            const dy = cy - ly;
            matrix[rowOffset + cellIdx] = Math.hypot(dx, dy);
          }
        }
      }
    }
    return matrix;
  }

  if (mode === TRAVEL_COST_MODES.ROAD) {
    if (!roadNetwork || typeof roadNetwork !== 'object' || !roadNetwork.adjacency) {
      throw new TypeError('Road travel cost mode requires a valid roadNetwork object.');
    }

    const adjacency = roadNetwork.adjacency;
    matrix.fill(Infinity);

    // Compute Dijkstra from each node to all other nodes
    for (let ly = 0; ly < height; ly++) {
      for (let lx = 0; lx < width; lx++) {
        const locIdx = ly * width + lx;
        const rowOffset = locIdx * totalNodes;
        const startId = createNodeId(lx, ly);

        // Distance map and PQ
        const pq = new PriorityQueue();
        matrix[rowOffset + locIdx] = 0;
        pq.push(startId, 0, startId);

        const visited = new Set();

        while (!pq.isEmpty()) {
          const current = pq.pop();
          const currId = current.item;
          const currDist = current.priority;

          if (visited.has(currId)) continue;
          visited.add(currId);

          const { x: cx, y: cy } = parseNodeId(currId);
          const cellIdx = cy * width + cx;
          matrix[rowOffset + cellIdx] = currDist;

          const neighbors = adjacency.get(currId) ?? [];
          for (let i = 0; i < neighbors.length; i++) {
            const edge = neighbors[i];
            if (edge.isBlocked) continue;

            const nextId = edge.to;
            if (visited.has(nextId)) continue;

            const { x: nx, y: ny } = parseNodeId(nextId);
            const nextIdx = ny * width + nx;
            const oldDist = matrix[rowOffset + nextIdx];
            const newDist = currDist + edge.weight;

            if (newDist < oldDist) {
              matrix[rowOffset + nextIdx] = newDist;
              pq.push(nextId, newDist, nextId);
            }
          }
        }
      }
    }

    return matrix;
  }

  const allowed = Object.values(TRAVEL_COST_MODES).join(', ');
  throw new RangeError(`Invalid travel cost mode "${mode}". Allowed modes: ${allowed}.`);
}

/**
 * Validates travel cost mode and ensures roadNetwork is present if road mode is requested.
 *
 * @param {string} mode
 * @param {Object} [roadNetwork]
 */
function validateModeAndNetwork(mode, roadNetwork) {
  if (typeof mode !== 'string') {
    throw new TypeError('Travel cost mode must be a string identifier.');
  }
  if (mode !== TRAVEL_COST_MODES.EUCLIDEAN && mode !== TRAVEL_COST_MODES.ROAD) {
    const allowed = Object.values(TRAVEL_COST_MODES).join(', ');
    throw new RangeError(`Invalid travel cost mode "${mode}". Allowed modes: ${allowed}.`);
  }
  if (mode === TRAVEL_COST_MODES.ROAD && (!roadNetwork || typeof roadNetwork !== 'object')) {
    throw new TypeError('Road travel cost mode requires a valid roadNetwork object.');
  }
}

/**
 * Evaluates candidate strategies for a responding player against a fixed opponent strategy.
 * Returns all tied best-response strategies that maximize profit within numerical tolerance.
 *
 * BR_j(s_{-j}) = argmax_{s_j in S_j} pi_j(s_j, s_{-j})
 *
 * @param {Object} options
 * @param {'A'|'B'} [options.player='A'] - Optimizing player ('A' or 'B')
 * @param {Object} options.opponentStrategy - Fixed strategy of the opponent { location: {x,y}, price }
 * @param {Array<Object>} [options.strategySpace] - Strategy space available to responding player (default: 500)
 * @param {Object} options.city - Frontier city object
 * @param {'euclidean'|'road'} [options.mode=TRAVEL_COST_MODES.EUCLIDEAN] - Travel cost mode
 * @param {Object} [options.roadNetwork] - Road network graph (required when mode is 'road')
 * @param {{ V?: number, alpha?: number }} [options.config=DEFAULT_PARAMS]
 * @param {number} [options.variableCost=DEFAULT_VARIABLE_COST]
 * @param {number} [options.fixedCost=DEFAULT_FIXED_COST]
 * @param {number} [options.variableCostA]
 * @param {number} [options.variableCostB]
 * @param {number} [options.fixedCostA]
 * @param {number} [options.fixedCostB]
 * @param {number} [options.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   player: 'A'|'B',
 *   opponentStrategy: Object,
 *   bestPayoff: number,
 *   strategies: Array<Object>,
 *   bestResponses: Array<Object>,
 *   evaluatedStrategies: Array<{ strategy: Object, payoff: number, demand: number, marketShare: number }>,
 *   travelCostMode: string
 * }>}
 */
export function findFrontierBestResponses(options = {}) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('findFrontierBestResponses requires an options object.');
  }

  const {
    player = 'A',
    opponentStrategy,
    strategySpace,
    city,
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

  if (!opponentStrategy || typeof opponentStrategy !== 'object') {
    throw new TypeError('findFrontierBestResponses requires a valid opponentStrategy object.');
  }

  const oppLoc = opponentStrategy.location;
  if (!oppLoc || typeof oppLoc.x !== 'number' || typeof oppLoc.y !== 'number') {
    throw new TypeError('findFrontierBestResponses: opponentStrategy must have a valid {x, y} location.');
  }
  if (typeof opponentStrategy.price !== 'number' || !Number.isFinite(opponentStrategy.price)) {
    throw new TypeError('findFrontierBestResponses: opponentStrategy must have a finite numeric price.');
  }

  if (!city || typeof city !== 'object' || !Array.isArray(city.cells)) {
    throw new TypeError('findFrontierBestResponses requires a valid Frontier city with cells.');
  }

  validateModeAndNetwork(mode, roadNetwork);

  const isPlayerA = player.toUpperCase() === 'A';
  const space = strategySpace ?? getFrontierStrategies();
  if (!Array.isArray(space) || space.length === 0) {
    throw new RangeError('Strategy space must be a non-empty array of strategies.');
  }

  const width = city.width ?? DEFAULT_GRID.width;
  const height = city.height ?? DEFAULT_GRID.height;
  const totalNodes = width * height;

  // Precompute distance matrix
  const distMatrix = buildFrontierTravelCostMatrix({
    width,
    height,
    mode,
    roadNetwork,
  });

  // Extract cell populations
  const cells = city.cells;
  const cellPops = new Float64Array(totalNodes);
  let totalPop = 0;
  for (let c = 0; c < cells.length; c++) {
    const cell = cells[c];
    const idx = cell.y * width + cell.x;
    cellPops[idx] = cell.population;
    totalPop += cell.population;
  }

  const V = config?.V ?? DEFAULT_PARAMS.V;
  const alpha = config?.alpha ?? DEFAULT_PARAMS.alpha;

  const costA_var = variableCostA ?? variableCost;
  const costB_var = variableCostB ?? variableCost;
  const costA_fix = fixedCostA ?? fixedCost;
  const costB_fix = fixedCostB ?? fixedCost;

  const oppLocIdx = oppLoc.y * width + oppLoc.x;
  const oppPrice = opponentStrategy.price;
  const oppOffset = oppLocIdx * totalNodes;

  let bestPayoff = -Infinity;
  const bestResponses = [];
  const evaluatedStrategies = [];

  for (let s = 0; s < space.length; s++) {
    const candidate = space[s];
    const candLoc = candidate.location;
    const candPrice = candidate.price;
    const candLocIdx = candLoc.y * width + candLoc.x;
    const candOffset = candLocIdx * totalNodes;

    const priceA = isPlayerA ? candPrice : oppPrice;
    const priceB = isPlayerA ? oppPrice : candPrice;
    const offsetA = isPlayerA ? candOffset : oppOffset;
    const offsetB = isPlayerA ? oppOffset : candOffset;

    let demandCand = 0;

    for (let c = 0; c < totalNodes; c++) {
      const pop = cellPops[c];
      if (pop <= 0) continue;

      const tcA = distMatrix[offsetA + c];
      const tcB = distMatrix[offsetB + c];

      let shareCand = 0;

      if (tcA === Infinity && tcB === Infinity) {
        shareCand = 0;
      } else if (tcA < Infinity && tcB === Infinity) {
        shareCand = isPlayerA ? 1.0 : 0.0;
      } else if (tcA === Infinity && tcB < Infinity) {
        shareCand = isPlayerA ? 0.0 : 1.0;
      } else {
        const uA = V - priceA - alpha * tcA;
        const uB = V - priceB - alpha * tcB;
        const diff = uA - uB;

        if (Math.abs(diff) <= tolerance) {
          shareCand = 0.5;
        } else if (diff > 0) {
          shareCand = isPlayerA ? 1.0 : 0.0;
        } else {
          shareCand = isPlayerA ? 0.0 : 1.0;
        }
      }

      demandCand += pop * shareCand;
    }

    const varCostCand = isPlayerA ? costA_var : costB_var;
    const fixCostCand = isPlayerA ? costA_fix : costB_fix;
    const payoff = (candPrice - varCostCand) * demandCand - fixCostCand;
    const marketShare = totalPop > 0 ? demandCand / totalPop : 0;

    const evaluatedItem = {
      strategy: candidate,
      payoff,
      demand: demandCand,
      marketShare,
    };
    evaluatedStrategies.push(evaluatedItem);

    if (payoff > bestPayoff + tolerance) {
      bestPayoff = payoff;
      bestResponses.length = 0;
      bestResponses.push(candidate);
    } else if (Math.abs(payoff - bestPayoff) <= tolerance) {
      bestResponses.push(candidate);
    }
  }

  return Object.freeze({
    player: isPlayerA ? 'A' : 'B',
    opponentStrategy: Object.freeze({
      location: Object.freeze({ x: oppLoc.x, y: oppLoc.y }),
      price: oppPrice,
    }),
    bestPayoff,
    strategies: Object.freeze([...bestResponses]),
    bestResponses: Object.freeze([...bestResponses]),
    evaluatedStrategies: Object.freeze(evaluatedStrategies),
    travelCostMode: mode,
  });
}

/**
 * Checks whether a given strategy profile (strategyA, strategyB) is a pure-strategy Nash equilibrium.
 *
 * @param {Object} options
 * @returns {Readonly<Object>}
 */
export function checkFrontierPureNashEquilibrium(options = {}) {
  const {
    strategyA,
    strategyB,
    strategySpace,
    strategySpaceA,
    strategySpaceB,
    city,
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
    throw new TypeError('checkFrontierPureNashEquilibrium requires both strategyA and strategyB.');
  }

  const spaceA = strategySpaceA ?? strategySpace ?? getFrontierStrategies();
  const spaceB = strategySpaceB ?? strategySpace ?? spaceA;

  // Payoff at current profile
  const currentPayoffResult = calculateFrontierPayoff({
    city,
    strategyA,
    strategyB,
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

  const currentPayoffA = currentPayoffResult.restaurantA.profit;
  const currentPayoffB = currentPayoffResult.restaurantB.profit;

  // Best responses for A against strategyB
  const brA = findFrontierBestResponses({
    player: 'A',
    opponentStrategy: strategyB,
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

  // Best responses for B against strategyA
  const brB = findFrontierBestResponses({
    player: 'B',
    opponentStrategy: strategyA,
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

  const hasProfitableDeviationA = brA.bestPayoff > currentPayoffA + tolerance;
  const hasProfitableDeviationB = brB.bestPayoff > currentPayoffB + tolerance;

  const isNash = !hasProfitableDeviationA && !hasProfitableDeviationB;

  return Object.freeze({
    isNash,
    strategyA: Object.freeze({
      location: Object.freeze({ x: strategyA.location.x, y: strategyA.location.y }),
      price: strategyA.price,
    }),
    strategyB: Object.freeze({
      location: Object.freeze({ x: strategyB.location.x, y: strategyB.location.y }),
      price: strategyB.price,
    }),
    payoffA: currentPayoffA,
    payoffB: currentPayoffB,
    demandA: currentPayoffResult.restaurantA.demand,
    demandB: currentPayoffResult.restaurantB.demand,
    playerA: Object.freeze({
      currentPayoff: currentPayoffA,
      bestPayoff: brA.bestPayoff,
      hasProfitableDeviation: hasProfitableDeviationA,
      bestResponses: brA.bestResponses,
    }),
    playerB: Object.freeze({
      currentPayoff: currentPayoffB,
      bestPayoff: brB.bestPayoff,
      hasProfitableDeviation: hasProfitableDeviationB,
      bestResponses: brB.bestResponses,
    }),
    travelCostMode: mode,
  });
}

/**
 * Searches the entire pure strategy space (default: 500 x 500 = 250,000 profiles)
 * for all pure-strategy Nash equilibria in Frontier.
 *
 * Algorithm:
 * 1. Precomputes the all-pairs travel cost distance matrix.
 * 2. Evaluates the payoffs of all profiles in O(M * N) time using precomputed spatial distances.
 * 3. Identifies mutual best responses using column and row maxima.
 * 4. Returns all pure equilibria found, or reports that no pure-strategy Nash equilibrium was found.
 *
 * @param {Object} options
 * @param {Object} options.city - Frontier city object
 * @param {Array<Object>} [options.strategySpace] - Shared strategy space (default: 500)
 * @param {Array<Object>} [options.strategySpaceA] - Player A strategy space
 * @param {Array<Object>} [options.strategySpaceB] - Player B strategy space
 * @param {'euclidean'|'road'} [options.mode=TRAVEL_COST_MODES.EUCLIDEAN] - Travel cost mode
 * @param {Object} [options.roadNetwork] - Road network graph (required when mode is 'road')
 * @param {{ V?: number, alpha?: number }} [options.config=DEFAULT_PARAMS]
 * @param {number} [options.variableCost=DEFAULT_VARIABLE_COST]
 * @param {number} [options.fixedCost=DEFAULT_FIXED_COST]
 * @param {number} [options.variableCostA]
 * @param {number} [options.variableCostB]
 * @param {number} [options.fixedCostA]
 * @param {number} [options.fixedCostB]
 * @param {number} [options.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   equilibria: Array<{
 *     restaurantA: { location: { x: number, y: number }, price: number },
 *     restaurantB: { location: { x: number, y: number }, price: number },
 *     strategyA: { location: { x: number, y: number }, price: number },
 *     strategyB: { location: { x: number, y: number }, price: number },
 *     payoffA: number,
 *     payoffB: number,
 *     demandA: number,
 *     demandB: number,
 *     marketShareA: number,
 *     marketShareB: number
 *   }>,
 *   count: number,
 *   evaluatedProfiles: number,
 *   hasPureEquilibrium: boolean,
 *   message: string,
 *   config: { V: number, alpha: number },
 *   travelCostMode: string
 * }>}
 */
export function findFrontierPureNashEquilibria(options = {}) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('findFrontierPureNashEquilibria requires an options object.');
  }

  const {
    city,
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

  if (!city || typeof city !== 'object' || !Array.isArray(city.cells)) {
    throw new TypeError('findFrontierPureNashEquilibria requires a valid Frontier city with cells.');
  }

  validateModeAndNetwork(mode, roadNetwork);

  const spaceA = strategySpaceA ?? strategySpace ?? getFrontierStrategies();
  const spaceB = strategySpaceB ?? strategySpace ?? spaceA;

  const M = spaceA.length;
  const N = spaceB.length;
  const totalProfiles = M * N;

  const width = city.width ?? DEFAULT_GRID.width;
  const height = city.height ?? DEFAULT_GRID.height;
  const totalNodes = width * height;

  // Step 1: Precompute distance matrix
  const distMatrix = buildFrontierTravelCostMatrix({
    width,
    height,
    mode,
    roadNetwork,
  });

  // Extract cell populations
  const cells = city.cells;
  const cellPops = new Float64Array(totalNodes);
  let totalPop = 0;
  for (let c = 0; c < cells.length; c++) {
    const cell = cells[c];
    const idx = cell.y * width + cell.x;
    cellPops[idx] = cell.population;
    totalPop += cell.population;
  }

  const V = config?.V ?? DEFAULT_PARAMS.V;
  const alpha = config?.alpha ?? DEFAULT_PARAMS.alpha;

  const costA_var = variableCostA ?? variableCost;
  const costB_var = variableCostB ?? variableCost;
  const costA_fix = fixedCostA ?? fixedCost;
  const costB_fix = fixedCostB ?? fixedCost;

  // Unpack strategy properties for rapid inner-loop indexing
  const locIndexA = new Int32Array(M);
  const priceA = new Float64Array(M);
  for (let i = 0; i < M; i++) {
    const s = spaceA[i];
    locIndexA[i] = s.location.y * width + s.location.x;
    priceA[i] = s.price;
  }

  const locIndexB = new Int32Array(N);
  const priceB = new Float64Array(N);
  for (let j = 0; j < N; j++) {
    const s = spaceB[j];
    locIndexB[j] = s.location.y * width + s.location.x;
    priceB[j] = s.price;
  }

  // Pre-allocate payoff and demand matrices
  const payoffsA = new Float64Array(totalProfiles);
  const payoffsB = new Float64Array(totalProfiles);
  const demandsA = new Float64Array(totalProfiles);
  const demandsB = new Float64Array(totalProfiles);

  const maxPayoffA = new Float64Array(N).fill(-Infinity);
  const maxPayoffB = new Float64Array(M).fill(-Infinity);

  // Step 2: Compute full profile payoffs and column/row maxima
  for (let i = 0; i < M; i++) {
    const lA = locIndexA[i];
    const prA = priceA[i];
    const offsetA = lA * totalNodes;
    const marginA = prA - costA_var;

    for (let j = 0; j < N; j++) {
      const lB = locIndexB[j];
      const prB = priceB[j];
      const offsetB = lB * totalNodes;
      const marginB = prB - costB_var;

      let demA = 0;
      let demB = 0;

      for (let c = 0; c < totalNodes; c++) {
        const pop = cellPops[c];
        if (pop <= 0) continue;

        const tcA = distMatrix[offsetA + c];
        const tcB = distMatrix[offsetB + c];

        if (tcA === Infinity && tcB === Infinity) {
          continue;
        } else if (tcA < Infinity && tcB === Infinity) {
          demA += pop;
        } else if (tcA === Infinity && tcB < Infinity) {
          demB += pop;
        } else {
          const uA = V - prA - alpha * tcA;
          const uB = V - prB - alpha * tcB;
          const diff = uA - uB;

          if (Math.abs(diff) <= tolerance) {
            demA += pop * 0.5;
            demB += pop * 0.5;
          } else if (diff > 0) {
            demA += pop;
          } else {
            demB += pop;
          }
        }
      }

      const profA = marginA * demA - costA_fix;
      const profB = marginB * demB - costB_fix;

      const profileIdx = i * N + j;
      payoffsA[profileIdx] = profA;
      payoffsB[profileIdx] = profB;
      demandsA[profileIdx] = demA;
      demandsB[profileIdx] = demB;

      if (profA > maxPayoffA[j]) maxPayoffA[j] = profA;
      if (profB > maxPayoffB[i]) maxPayoffB[i] = profB;
    }
  }

  // Step 3: Find mutual best responses
  const equilibria = [];

  for (let i = 0; i < M; i++) {
    const bestPayoffB = maxPayoffB[i];
    const rowOffset = i * N;

    for (let j = 0; j < N; j++) {
      const profileIdx = rowOffset + j;
      const profA = payoffsA[profileIdx];
      const bestPayoffA = maxPayoffA[j];

      // Unilateral deviation condition:
      // Player A is playing a best response against j
      if (profA >= bestPayoffA - tolerance) {
        const profB = payoffsB[profileIdx];
        // Player B is playing a best response against i
        if (profB >= bestPayoffB - tolerance) {
          const stratA = spaceA[i];
          const stratB = spaceB[j];
          const demA = demandsA[profileIdx];
          const demB = demandsB[profileIdx];

          const eqItem = Object.freeze({
            restaurantA: Object.freeze({
              location: Object.freeze({ x: stratA.location.x, y: stratA.location.y }),
              price: stratA.price,
            }),
            restaurantB: Object.freeze({
              location: Object.freeze({ x: stratB.location.x, y: stratB.location.y }),
              price: stratB.price,
            }),
            strategyA: Object.freeze({
              location: Object.freeze({ x: stratA.location.x, y: stratA.location.y }),
              price: stratA.price,
            }),
            strategyB: Object.freeze({
              location: Object.freeze({ x: stratB.location.x, y: stratB.location.y }),
              price: stratB.price,
            }),
            payoffA: profA,
            payoffB: profB,
            demandA: demA,
            demandB: demB,
            marketShareA: totalPop > 0 ? demA / totalPop : 0,
            marketShareB: totalPop > 0 ? demB / totalPop : 0,
          });

          equilibria.push(eqItem);
        }
      }
    }
  }

  const count = equilibria.length;
  const hasPureEquilibrium = count > 0;
  const message = hasPureEquilibrium
    ? `Found ${count} pure-strategy Nash equilibria.`
    : 'No pure-strategy Nash equilibrium found in the specified discrete strategy space.';

  return Object.freeze({
    equilibria: Object.freeze(equilibria),
    count,
    evaluatedProfiles: totalProfiles,
    hasPureEquilibrium,
    message,
    config: Object.freeze({ V, alpha }),
    travelCostMode: mode,
  });
}
