/**
 * @file bottlenecks.js
 * @description Frontier shortest-path bottleneck-frequency analysis engine (Phase 6C.4).
 *
 * Mathematical Definition:
 * For a supplied set of origin-destination pairs (OD):
 *
 *   B(e) = (number of evaluated shortest paths containing edge e) / (number of reachable evaluated OD pairs)
 *
 * Context & Scope:
 * This metric B(e) measures empirical route convergence over an evaluated OD set
 * in LOCUS Frontier road networks. It is a domain-specific shortest-path route
 * utilization frequency, designed to assess how structural topographies (corridors,
 * passes, bridges, and bottlenecks) concentrate spatial traffic.
 *
 * NOTE: This is an empirical shortest-path utilization metric for LOCUS scenarios,
 * and is NOT claimed to be a universal graph-theoretic centrality metric (such as
 * Brandes all-pairs betweenness centrality).
 */

import { createNodeId } from './roadNetwork.js';
import { findShortestPath } from './shortestPath.js';

/**
 * Analyzes empirical bottleneck frequencies over a set of OD pairs on a road network.
 *
 * @param {Object} network - Validated road network graph
 * @param {Array<Object|Array>} odPairs - Array of { from, to }, { origin, destination }, or [from, to]
 * @returns {Readonly<{
 *   evaluatedPairs: number,
 *   reachablePairs: number,
 *   unreachablePairs: number,
 *   edgeUsageCounts: Map<string, number>,
 *   edgeUsage: Record<string, number>,
 *   normalizedFrequencies: Map<string, number>,
 *   frequencies: Record<string, number>,
 *   designatedBottleneckEdges: Array<{
 *     from: string,
 *     to: string,
 *     weight: number,
 *     name?: string,
 *     count: number,
 *     frequency: number
 *   }>,
 *   designatedBottlenecks: Array<{
 *     from: string,
 *     to: string,
 *     weight: number,
 *     name?: string,
 *     count: number,
 *     frequency: number
 *   }>,
 *   ranking: Array<{
 *     rank: number,
 *     from: string,
 *     to: string,
 *     weight: number,
 *     name?: string,
 *     count: number,
 *     frequency: number
 *   }>
 * }>}
 */
export function analyzeBottlenecks(network, odPairs) {
  if (!network || typeof network !== 'object' || !network.adjacency) {
    throw new TypeError('analyzeBottlenecks requires a valid road network object.');
  }
  if (!Array.isArray(odPairs)) {
    throw new TypeError('odPairs must be an array of origin-destination pairs.');
  }

  const evaluatedPairs = odPairs.length;
  let reachablePairs = 0;
  let unreachablePairs = 0;

  const edgeUsageCounts = new Map();

  for (let i = 0; i < evaluatedPairs; i++) {
    const pair = odPairs[i];
    if (!pair || typeof pair !== 'object') {
      throw new TypeError(`Invalid OD pair at index ${i}: expected object or array.`);
    }

    const from = pair.from ?? pair.origin ?? pair.start ?? pair[0];
    const to = pair.to ?? pair.destination ?? pair.end ?? pair[1];

    if (from === undefined || to === undefined) {
      throw new TypeError(
        `Invalid OD pair at index ${i}: missing "from" or "to" property.`
      );
    }

    const pathResult = findShortestPath(network, from, to);

    if (!pathResult.reachable || pathResult.distance === Infinity) {
      unreachablePairs++;
      continue;
    }

    reachablePairs++;

    // Reconstruct distinct edges traversed for this OD pair
    const path = pathResult.path;
    if (path.length >= 2) {
      const traversedEdgesInPair = new Set();
      for (let k = 0; k < path.length - 1; k++) {
        const u = path[k];
        const v = path[k + 1];
        const fromId = createNodeId(u.x, u.y);
        const toId = createNodeId(v.x, v.y);
        traversedEdgesInPair.add(`${fromId}->${toId}`);
      }

      // Count each evaluated OD pair once per edge
      for (const edgeKey of traversedEdgesInPair) {
        edgeUsageCounts.set(
          edgeKey,
          (edgeUsageCounts.get(edgeKey) ?? 0) + 1
        );
      }
    }
  }

  // Calculate normalized frequencies B(e) = count(e) / reachablePairs
  const normalizedFrequencies = new Map();
  const edgeUsage = {};
  const frequencies = {};

  for (const [edgeKey, count] of edgeUsageCounts.entries()) {
    edgeUsage[edgeKey] = count;
    const freq = reachablePairs > 0 ? count / reachablePairs : 0;
    normalizedFrequencies.set(edgeKey, freq);
    frequencies[edgeKey] = freq;
  }

  // Identify designated bottleneck edges from network metadata
  const networkBottlenecks = network.bottlenecks ?? [];
  const designatedBottleneckEdges = networkBottlenecks.map((bEdge) => {
    const key = `${bEdge.from}->${bEdge.to}`;
    const count = edgeUsageCounts.get(key) ?? 0;
    const frequency = reachablePairs > 0 ? count / reachablePairs : 0;
    return {
      from: bEdge.from,
      to: bEdge.to,
      weight: bEdge.weight ?? 1,
      name: bEdge.name,
      count,
      frequency,
    };
  });

  // Rank designated bottlenecks descending by frequency, then count, then edgeKey tie-breaker
  const sortedBottlenecks = [...designatedBottleneckEdges].sort((a, b) => {
    if (b.frequency !== a.frequency) {
      return b.frequency - a.frequency;
    }
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    const keyA = `${a.from}->${a.to}`;
    const keyB = `${b.from}->${b.to}`;
    return keyA.localeCompare(keyB);
  });

  const ranking = sortedBottlenecks.map((item, idx) => ({
    rank: idx + 1,
    ...item,
  }));

  return Object.freeze({
    evaluatedPairs,
    reachablePairs,
    unreachablePairs,
    edgeUsageCounts,
    edgeUsage: Object.freeze(edgeUsage),
    normalizedFrequencies,
    frequencies: Object.freeze(frequencies),
    designatedBottleneckEdges: Object.freeze(designatedBottleneckEdges),
    designatedBottlenecks: Object.freeze(designatedBottleneckEdges),
    ranking: Object.freeze(ranking),
  });
}

/**
 * Looks up the bottleneck frequency of a specific edge from an analysis result.
 *
 * @param {Object} analysisResult - Result returned by analyzeBottlenecks
 * @param {string|{x: number, y: number}} from
 * @param {string|{x: number, y: number}} to
 * @returns {number} Frequency between 0.0 and 1.0
 */
export function getEdgeBottleneckFrequency(analysisResult, from, to) {
  if (!analysisResult) return 0;
  const fromId = typeof from === 'string' ? from : createNodeId(from.x, from.y);
  const toId = typeof to === 'string' ? to : createNodeId(to.x, to.y);
  const key = `${fromId}->${toId}`;
  return analysisResult.normalizedFrequencies?.get(key) ?? 0;
}
