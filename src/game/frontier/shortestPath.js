/**
 * @file shortestPath.js
 * @description Dijkstra shortest-path engine on weighted road network graphs
 * for LOCUS Frontier (Phase 6B.3).
 * Computes exact deterministic minimum-cost routes and returns complete node trajectories.
 */

import { createNodeId, parseNodeId, isValidCoordinate } from './roadNetwork.js';

/**
 * Deterministic Binary Min-Heap Priority Queue.
 * Uses lexicographical string tie-breaking to ensure reproducible path selection.
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
 * Normalizes and validates a spatial point input against network dimensions.
 *
 * @param {Object|string} pt - Point object {x, y} or id "x,y"
 * @param {number} width - Network width
 * @param {number} height - Network height
 * @param {string} paramName - "start" or "end" for error reporting
 * @returns {{ id: string, x: number, y: number }}
 */
function normalizePoint(pt, width, height, paramName) {
  if (pt === null || pt === undefined) {
    throw new TypeError(`Invalid ${paramName} point: must not be null or undefined.`);
  }

  let x, y;
  if (typeof pt === 'string') {
    const parsed = parseNodeId(pt);
    x = parsed.x;
    y = parsed.y;
  } else if (typeof pt === 'object') {
    x = pt.x;
    y = pt.y;
  } else {
    throw new TypeError(`Invalid ${paramName} point: expected {x, y} object or "x,y" string.`);
  }

  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y)) {
    throw new TypeError(`Invalid ${paramName} coordinates: {x, y} must be integers.`);
  }

  if (!isValidCoordinate(x, y, width, height)) {
    throw new RangeError(
      `Point ${paramName} (${x}, ${y}) is outside the grid dimensions (${width}x${height}).`
    );
  }

  return {
    id: createNodeId(x, y),
    x,
    y,
  };
}

/**
 * Computes the shortest path between start and end nodes on a weighted road network
 * using Dijkstra's algorithm.
 *
 * @param {Object} network - Validated road network graph
 * @param {{x: number, y: number}|string} start - Origin location {x, y} or "x,y"
 * @param {{x: number, y: number}|string} end - Destination location {x, y} or "x,y"
 * @returns {{
 *   reachable: boolean,
 *   distance: number,
 *   path: Array<{x: number, y: number}>
 * }}
 */
export function findShortestPath(network, start, end) {
  if (!network || typeof network !== 'object' || !network.adjacency) {
    throw new TypeError('findShortestPath requires a valid road network object.');
  }

  const { width = 10, height = 10, adjacency } = network;

  const startPt = normalizePoint(start, width, height, 'start');
  const endPt = normalizePoint(end, width, height, 'end');

  // Edge case: start and destination are the exact same node
  if (startPt.id === endPt.id) {
    return {
      reachable: true,
      distance: 0,
      path: [{ x: startPt.x, y: startPt.y }],
    };
  }

  // Dijkstra data structures
  const distances = new Map();
  const previous = new Map();
  const visited = new Set();
  const pq = new PriorityQueue();

  distances.set(startPt.id, 0);
  previous.set(startPt.id, null);
  pq.push(startPt.id, 0, startPt.id);

  while (!pq.isEmpty()) {
    const current = pq.pop();
    const currId = current.item;
    const currDist = current.priority;

    if (visited.has(currId)) continue;
    visited.add(currId);

    // Early exit when destination node is popped
    if (currId === endPt.id) {
      break;
    }

    const neighbors = adjacency.get(currId) ?? [];
    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i];
      const nextId = neighbor.to;

      if (visited.has(nextId)) continue;
      if (neighbor.isBlocked) continue;

      const edgeWeight = neighbor.weight;
      const newDist = currDist + edgeWeight;
      const oldDist = distances.get(nextId) ?? Infinity;

      if (newDist < oldDist) {
        distances.set(nextId, newDist);
        previous.set(nextId, currId);
        pq.push(nextId, newDist, nextId);
      }
    }
  }

  // Check if destination was reached
  if (!distances.has(endPt.id) || distances.get(endPt.id) === Infinity) {
    return {
      reachable: false,
      distance: Infinity,
      path: [],
    };
  }

  // Reconstruct path backward from destination to origin
  const path = [];
  let curr = endPt.id;
  while (curr !== null) {
    const coords = parseNodeId(curr);
    path.unshift(coords);
    curr = previous.get(curr) ?? null;
  }

  return {
    reachable: true,
    distance: distances.get(endPt.id),
    path,
  };
}

/**
 * Returns the shortest-path road distance between two nodes.
 *
 * @param {Object} network
 * @param {{x: number, y: number}|string} start
 * @param {{x: number, y: number}|string} end
 * @returns {number} Shortest path distance or Infinity if unreachable
 */
export function getRoadDistance(network, start, end) {
  const result = findShortestPath(network, start, end);
  return result.distance;
}
