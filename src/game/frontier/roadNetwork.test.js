/**
 * @file roadNetwork.test.js
 * @description Unit and mathematical validation tests for LOCUS Frontier:
 * Road Network & Shortest Paths (Phase 6B.1 - 6B.3).
 */

import { describe, it, expect } from 'vitest';
import {
  createRoadNetwork,
  ROAD_SCENARIO_IDS,
  ROAD_SCENARIOS,
  createNodeId,
  parseNodeId,
  isValidCoordinate,
  createNode,
  createEdge,
  validateRoadNetwork,
  getNeighbors,
  getEdgeWeight,
  findShortestPath,
  getRoadDistance,
  isBridgeEdge,
  isBottleneckEdge,
  isBlockedEdge,
  createReadOnlySet,
} from './index.js';

describe('LOCUS Frontier Engine — Phase 6B: Road Network & Shortest Paths', () => {
  describe('6B.1 — Road Graph Data Model & Helpers', () => {
    it('creates canonical node IDs and parses them correctly', () => {
      expect(createNodeId(3, 7)).toBe('3,7');
      expect(parseNodeId('3,7')).toEqual({ x: 3, y: 7 });

      expect(() => parseNodeId('invalid')).toThrow(TypeError);
      expect(() => parseNodeId(123)).toThrow(TypeError);
      expect(() => parseNodeId('1.5,2')).toThrow(TypeError);
    });

    it('validates spatial grid coordinates within bounds', () => {
      expect(isValidCoordinate(0, 0, 10, 10)).toBe(true);
      expect(isValidCoordinate(9, 9, 10, 10)).toBe(true);
      expect(isValidCoordinate(5, 5, 10, 10)).toBe(true);

      expect(isValidCoordinate(-1, 0, 10, 10)).toBe(false);
      expect(isValidCoordinate(0, -1, 10, 10)).toBe(false);
      expect(isValidCoordinate(10, 5, 10, 10)).toBe(false);
      expect(isValidCoordinate(5, 10, 10, 10)).toBe(false);
      expect(isValidCoordinate(1.5, 2, 10, 10)).toBe(false);
    });

    it('creates valid node and edge objects', () => {
      const node = createNode(4, 5);
      expect(node).toEqual({ id: '4,5', x: 4, y: 5 });
      expect(Object.isFrozen(node)).toBe(true);

      const edge = createEdge('4,5', '4,6', 1.5);
      expect(edge).toEqual({ from: '4,5', to: '4,6', weight: 1.5 });
      expect(Object.isFrozen(edge)).toBe(true);
    });

    it('rejects invalid edges (self-loops, negative or zero weight, non-numeric)', () => {
      expect(() => createEdge('4,5', '4,5', 1)).toThrow(RangeError);
      expect(() => createEdge('4,5', '4,6', 0)).toThrow(RangeError);
      expect(() => createEdge('4,5', '4,6', -2)).toThrow(RangeError);
      expect(() => createEdge('4,5', '4,6', Infinity)).toThrow(RangeError);
      expect(() => createEdge(123, '4,6', 1)).toThrow(TypeError);
    });

    it('validates graph structure and detects corruption or invalid geometry', () => {
      const network = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });
      expect(() => validateRoadNetwork(network)).not.toThrow();

      // Test bad network object
      expect(() => validateRoadNetwork(null)).toThrow(TypeError);
      expect(() => validateRoadNetwork({ width: 0, height: 10, nodes: [], edges: [], scenario: 'grid' })).toThrow(
        RangeError
      );

      // Diagonal edge corruption test
      const corruptNetwork = {
        width: 10,
        height: 10,
        scenario: 'test',
        nodes: network.nodes,
        edges: [{ from: '0,0', to: '1,1', weight: 1 }], // Diagonal (Manhattan = 2)
      };
      expect(() => validateRoadNetwork(corruptNetwork)).toThrow(RangeError);
    });

    it('provides fast neighbor and edge weight lookups', () => {
      const network = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });

      // Corner node (0,0) has 2 neighbors: (1,0) and (0,1)
      const cornerNeighbors = getNeighbors(network, { x: 0, y: 0 });
      expect(cornerNeighbors).toHaveLength(2);
      expect(cornerNeighbors.map((n) => n.to).sort()).toEqual(['0,1', '1,0']);

      // Interior node (5,5) has 4 neighbors
      const interiorNeighbors = getNeighbors(network, '5,5');
      expect(interiorNeighbors).toHaveLength(4);

      // Edge weight queries
      expect(getEdgeWeight(network, '0,0', '1,0')).toBe(1);
      expect(getEdgeWeight(network, '0,0', '2,0')).toBeNull(); // Not adjacent
    });

    it('validates scenario parameter in createRoadNetwork: defaults to GRID or throws on invalid ID', () => {
      // Default when omitted
      const defaultNet = createRoadNetwork();
      expect(defaultNet.scenario).toBe(ROAD_SCENARIO_IDS.GRID);

      const emptyOptsNet = createRoadNetwork({});
      expect(emptyOptsNet.scenario).toBe(ROAD_SCENARIO_IDS.GRID);

      const undefNet = createRoadNetwork({ scenario: undefined });
      expect(undefNet.scenario).toBe(ROAD_SCENARIO_IDS.GRID);

      // Valid explicit scenarios continue to work
      expect(createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID }).scenario).toBe('grid');
      expect(createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.ARTERIAL }).scenario).toBe('arterial');
      expect(createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.RING_ARTERIAL }).scenario).toBe('ring-arterial');

      // Invalid explicit scenario throws RangeError
      expect(() => createRoadNetwork({ scenario: 'unknown-scenario' })).toThrow(RangeError);
      expect(() => createRoadNetwork({ scenario: 'unknown-scenario' })).toThrow(
        /Invalid road network scenario "unknown-scenario"/
      );

      // Non-string scenario throws TypeError
      expect(() => createRoadNetwork({ scenario: 123 })).toThrow(TypeError);
      expect(() => createRoadNetwork({ scenario: null })).toThrow(TypeError);
    });
  });

  describe('6B.2 — GRID Road Network Scenario', () => {
    const grid = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });

    it('produces 10x10 dimensions with exactly 100 unique nodes', () => {
      expect(grid.width).toBe(10);
      expect(grid.height).toBe(10);
      expect(grid.nodes).toHaveLength(100);

      const seenIds = new Set();
      for (const node of grid.nodes) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThan(10);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeLessThan(10);
        expect(seenIds.has(node.id)).toBe(false);
        seenIds.add(node.id);
      }
      expect(seenIds.size).toBe(100);
    });

    it('produces bidirectional 4-neighbour edges with strictly positive unit weights', () => {
      // 10x10 grid has:
      // Horizontal undirected edges: 10 rows * 9 = 90
      // Vertical undirected edges: 10 cols * 9 = 90
      // Total undirected = 180 => 360 bidirectional directed edges
      expect(grid.edges).toHaveLength(360);

      for (const edge of grid.edges) {
        expect(edge.weight).toBe(1);
        expect(edge.from).not.toBe(edge.to);

        // Verify reverse edge exists with identical weight
        const reverseWeight = getEdgeWeight(grid, edge.to, edge.from);
        expect(reverseWeight).toBe(1);
      }
    });

    it('is fully connected across all zones', () => {
      // Pick corner (0,0), verify all other 99 nodes are reachable
      const start = { x: 0, y: 0 };
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const res = findShortestPath(grid, start, { x, y });
          expect(res.reachable).toBe(true);
          expect(res.distance).toBe(x + y); // In unit grid, distance from (0,0) is x + y
        }
      }
    });

    it('computes exact known Manhattan shortest paths on the GRID network', () => {
      // (0,0) -> (3,4) = 7
      const res1 = findShortestPath(grid, { x: 0, y: 0 }, { x: 3, y: 4 });
      expect(res1.reachable).toBe(true);
      expect(res1.distance).toBe(7);
      expect(res1.path).toHaveLength(8); // 7 steps = 8 nodes
      expect(res1.path[0]).toEqual({ x: 0, y: 0 });
      expect(res1.path[res1.path.length - 1]).toEqual({ x: 3, y: 4 });

      // (1,1) -> (5,5) = |5-1| + |5-1| = 8
      const res2 = findShortestPath(grid, { x: 1, y: 1 }, { x: 5, y: 5 });
      expect(res2.distance).toBe(8);

      // (0,0) -> (9,9) = 18
      const res3 = findShortestPath(grid, { x: 0, y: 0 }, { x: 9, y: 9 });
      expect(res3.distance).toBe(18);
    });

    it('guarantees path symmetry for bidirectional roads (d(A, B) === d(B, A))', () => {
      const pairs = [
        [{ x: 0, y: 0 }, { x: 7, y: 3 }],
        [{ x: 2, y: 8 }, { x: 9, y: 1 }],
        [{ x: 4, y: 4 }, { x: 6, y: 9 }],
      ];

      for (const [pA, pB] of pairs) {
        const dAB = getRoadDistance(grid, pA, pB);
        const dBA = getRoadDistance(grid, pB, pA);
        expect(dAB).toBe(dBA);
      }
    });
  });

  describe('6B.2 — ARTERIAL Road Network Scenario', () => {
    const arterial = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.ARTERIAL });
    const grid = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });

    it('produces a connected 10x10 network with differentiated weights', () => {
      expect(arterial.width).toBe(10);
      expect(arterial.height).toBe(10);
      expect(arterial.nodes).toHaveLength(100);
      expect(arterial.edges).toHaveLength(360);

      // All nodes reachable
      const res = findShortestPath(arterial, { x: 0, y: 0 }, { x: 9, y: 9 });
      expect(res.reachable).toBe(true);

      // Check weights along arterial columns 4, 5 vs outside
      const arterialEdgeWeight = getEdgeWeight(arterial, '4,0', '4,1');
      const localEdgeWeight = getEdgeWeight(arterial, '0,0', '0,1');

      expect(arterialEdgeWeight).toBe(1.0); // Arterial express corridor
      expect(localEdgeWeight).toBe(2.0); // Local street friction
    });

    it('produces road distances that differ meaningfully from the uniform GRID network', () => {
      // Local street OD pair: (0,0) -> (0,1)
      const dGridLocal = getRoadDistance(grid, { x: 0, y: 0 }, { x: 0, y: 1 });
      const dArterialLocal = getRoadDistance(arterial, { x: 0, y: 0 }, { x: 0, y: 1 });

      expect(dGridLocal).toBe(1);
      expect(dArterialLocal).toBe(2);
      expect(dArterialLocal).not.toBe(dGridLocal);

      // Cross-grid travel: (0,0) -> (9,9)
      const dGridCross = getRoadDistance(grid, { x: 0, y: 0 }, { x: 9, y: 9 });
      const dArterialCross = getRoadDistance(arterial, { x: 0, y: 0 }, { x: 9, y: 9 });

      expect(dGridCross).toBe(18);
      // In arterial, taking feeder roads to the central arterial and taking arterial corridor
      // yields a total travel cost strictly greater than pure unit grid:
      expect(dArterialCross).toBeGreaterThan(dGridCross);
    });

    it('Dijkstra selects the lower-cost route via arterial corridors when detouring is beneficial', () => {
      // Consider traveling horizontally between (1, 3) and (8, 3) (6 grid steps across row 3).
      // Row 3 is a local street (weight = 2 per step). Direct path cost = 7 * 2 = 14.
      // But row 4 is an Arterial corridor (weight = 1 per step)!
      // Detouring: (1, 3) -> (1, 4) [cost 2]
      //            (1, 4) -> (8, 4) along arterial [7 steps * 1 = 7]
      //            (8, 4) -> (8, 3) [cost 2]
      // Detour total cost = 2 + 7 + 2 = 11 < 14!
      const result = findShortestPath(arterial, { x: 1, y: 3 }, { x: 8, y: 3 });

      expect(result.reachable).toBe(true);
      expect(result.distance).toBe(11); // Strictly less than the direct local path of 14

      // Verify the path actually detoured through row 4 (the arterial corridor)
      const usedArterial = result.path.some((pt) => pt.y === 4);
      expect(usedArterial).toBe(true);
    });
  });

  describe('6B.2 — RING_ARTERIAL Road Network Scenario', () => {
    const ring = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.RING_ARTERIAL });

    it('provides perimeter beltway with lower edge weight on the ring corridor', () => {
      expect(ring.scenario).toBe('ring-arterial');
      expect(ROAD_SCENARIOS['ring-arterial']).toBeDefined();

      // Top ring edge between (3,2) and (4,2)
      const ringEdge = getEdgeWeight(ring, '3,2', '4,2');
      expect(ringEdge).toBe(1.0);

      // Outside edge between (0,0) and (1,0)
      const localEdge = getEdgeWeight(ring, '0,0', '1,0');
      expect(localEdge).toBe(2.0);
    });
  });

  describe('6B.3 — Shortest Path Engine Edge Cases & Correctness', () => {
    const network = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });

    it('returns distance 0 and single-node path when start === end', () => {
      const same1 = findShortestPath(network, { x: 5, y: 5 }, { x: 5, y: 5 });
      expect(same1.reachable).toBe(true);
      expect(same1.distance).toBe(0);
      expect(same1.path).toEqual([{ x: 5, y: 5 }]);

      // String format input
      const same2 = findShortestPath(network, '2,3', '2,3');
      expect(same2.distance).toBe(0);
      expect(same2.path).toEqual([{ x: 2, y: 3 }]);
    });

    it('throws clear descriptive errors for invalid origin or destination coordinates', () => {
      expect(() => findShortestPath(network, null, { x: 5, y: 5 })).toThrow(TypeError);
      expect(() => findShortestPath(network, { x: 5, y: 5 }, undefined)).toThrow(TypeError);
      expect(() => findShortestPath(network, { x: -1, y: 5 }, { x: 5, y: 5 })).toThrow(RangeError);
      expect(() => findShortestPath(network, { x: 5, y: 5 }, { x: 10, y: 5 })).toThrow(RangeError);
      expect(() => findShortestPath(network, { x: 'a', y: 5 }, { x: 5, y: 5 })).toThrow(TypeError);
      expect(() => findShortestPath(network, 'bad-format', { x: 5, y: 5 })).toThrow(TypeError);
    });

    it('handles disconnected/unreachable graph configurations gracefully', () => {
      // Create a disconnected network with no edges
      const disconnected = {
        width: 10,
        height: 10,
        scenario: 'disconnected',
        nodes: network.nodes,
        edges: [],
        adjacency: new Map(network.nodes.map((n) => [n.id, []])),
        edgeMap: new Map(),
      };

      const res = findShortestPath(disconnected, { x: 0, y: 0 }, { x: 5, y: 5 });
      expect(res.reachable).toBe(false);
      expect(res.distance).toBe(Infinity);
      expect(res.path).toEqual([]);

      const dist = getRoadDistance(disconnected, { x: 0, y: 0 }, { x: 5, y: 5 });
      expect(dist).toBe(Infinity);
    });

    it('returned path consists only of valid connected edges and sum of weights equals distance', () => {
      const arterial = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.ARTERIAL });
      const testCases = [
        [{ x: 0, y: 0 }, { x: 9, y: 9 }],
        [{ x: 2, y: 8 }, { x: 8, y: 2 }],
        [{ x: 4, y: 1 }, { x: 5, y: 9 }],
      ];

      for (const [start, end] of testCases) {
        const { reachable, distance, path } = findShortestPath(arterial, start, end);
        expect(reachable).toBe(true);
        expect(path.length).toBeGreaterThan(1);
        expect(path[0]).toEqual(start);
        expect(path[path.length - 1]).toEqual(end);

        let weightSum = 0;
        for (let i = 0; i < path.length - 1; i++) {
          const fromPt = path[i];
          const toPt = path[i + 1];
          const weight = getEdgeWeight(arterial, fromPt, toPt);
          expect(weight).not.toBeNull();
          expect(weight).toBeGreaterThan(0);
          weightSum += weight;
        }

        expect(weightSum).toBe(distance);
      }
    });

    it('produces strictly deterministic output across repeated executions', () => {
      const arterial = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.ARTERIAL });
      const run1 = findShortestPath(arterial, { x: 1, y: 2 }, { x: 8, y: 7 });
      const run2 = findShortestPath(arterial, { x: 1, y: 2 }, { x: 8, y: 7 });

      expect(run1.distance).toBe(run2.distance);
      expect(run1.path).toEqual(run2.path);
    });
  });

  describe('6C — Barriers, Bridges & Bottlenecks Topology', () => {
    const barrierNet = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BARRIER });
    const bridgeNet = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BRIDGE });
    const bottleneckNet = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BOTTLENECK });

    describe('6C.1 & 6C.2 — Topology Scenarios & Metadata', () => {
      it('preserves existing GRID, ARTERIAL, and RING_ARTERIAL scenarios with zero blocked/bridge/bottleneck edges', () => {
        const grid = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });
        const arterial = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.ARTERIAL });
        const ring = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.RING_ARTERIAL });

        for (const net of [grid, arterial, ring]) {
          expect(net.edges).toHaveLength(360);
          expect(net.blockedEdges).toEqual([]);
          expect(net.bridges).toEqual([]);
          expect(net.bottlenecks).toEqual([]);
        }
      });

      it('BARRIER scenario explicitly marks and removes blocked river edges while preserving row 4 crossing', () => {
        expect(barrierNet.blockedEdges).toHaveLength(18); // 9 bidirectional pairs
        expect(barrierNet.edges).toHaveLength(342); // 360 - 18 = 342

        // Blocked edges: horizontal links between col 4 and col 5 for y != 4
        for (let y = 0; y < 10; y++) {
          if (y === 4) {
            // Crossing link preserved
            expect(isBlockedEdge(barrierNet, `4,${y}`, `5,${y}`)).toBe(false);
            expect(getEdgeWeight(barrierNet, `4,${y}`, `5,${y}`)).toBe(1.0);
            expect(getNeighbors(barrierNet, `4,${y}`).some((n) => n.to === `5,${y}`)).toBe(true);
          } else {
            // Blocked by river
            expect(isBlockedEdge(barrierNet, `4,${y}`, `5,${y}`)).toBe(true);
            expect(isBlockedEdge(barrierNet, `5,${y}`, `4,${y}`)).toBe(true);
            expect(getEdgeWeight(barrierNet, `4,${y}`, `5,${y}`)).toBeNull();
            expect(getNeighbors(barrierNet, `4,${y}`).some((n) => n.to === `5,${y}`)).toBe(false);
          }
        }
      });

      it('BRIDGE scenario establishes explicit bridge links and blocks other canal crossings', () => {
        // Bridges at columns 2 and 7 across rows 4 and 5
        expect(bridgeNet.bridges).toHaveLength(4); // 2 bidirectional bridge pairs
        expect(bridgeNet.blockedEdges).toHaveLength(16); // 8 bidirectional blocked canal pairs
        expect(bridgeNet.edges).toHaveLength(344); // 360 - 16 = 344

        // Identified bridge edges
        expect(isBridgeEdge(bridgeNet, '2,4', '2,5')).toBe(true);
        expect(isBridgeEdge(bridgeNet, '2,5', '2,4')).toBe(true);
        expect(isBridgeEdge(bridgeNet, '7,4', '7,5')).toBe(true);
        expect(isBridgeEdge(bridgeNet, '7,5', '7,4')).toBe(true);

        // Bridge edge is traversable
        expect(getEdgeWeight(bridgeNet, '2,4', '2,5')).toBe(1.0);
        expect(getEdgeWeight(bridgeNet, '7,4', '7,5')).toBe(1.0);

        // Non-bridge crossing is blocked
        expect(isBridgeEdge(bridgeNet, '4,4', '4,5')).toBe(false);
        expect(isBlockedEdge(bridgeNet, '4,4', '4,5')).toBe(true);
        expect(getEdgeWeight(bridgeNet, '4,4', '4,5')).toBeNull();
      });

      it('BOTTLENECK scenario designates central corridor links and blocks flanking crossings', () => {
        expect(bottleneckNet.bottlenecks).toHaveLength(4); // 2 bidirectional bottleneck corridors
        expect(bottleneckNet.blockedEdges).toHaveLength(16); // 8 bidirectional flanking barriers
        expect(bottleneckNet.edges).toHaveLength(344);

        // Identified bottleneck corridors at cols 4 and 5
        expect(isBottleneckEdge(bottleneckNet, '4,4', '4,5')).toBe(true);
        expect(isBottleneckEdge(bottleneckNet, '4,5', '4,4')).toBe(true);
        expect(isBottleneckEdge(bottleneckNet, '5,4', '5,5')).toBe(true);
        expect(isBottleneckEdge(bottleneckNet, '5,5', '5,4')).toBe(true);

        // Bottleneck edge is traversable
        expect(getEdgeWeight(bottleneckNet, '4,4', '4,5')).toBe(1.0);

        // Flanking crossing is blocked
        expect(isBottleneckEdge(bottleneckNet, '0,4', '0,5')).toBe(false);
        expect(isBlockedEdge(bottleneckNet, '0,4', '0,5')).toBe(true);
        expect(getEdgeWeight(bottleneckNet, '0,4', '0,5')).toBeNull();
      });

      it('scenario creation is strictly deterministic', () => {
        const b1 = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BARRIER });
        const b2 = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BARRIER });

        expect(b1.edges.length).toBe(b2.edges.length);
        expect(b1.blockedEdges.length).toBe(b2.blockedEdges.length);
        expect(b1.edges.map((e) => `${e.from}->${e.to}`)).toEqual(
          b2.edges.map((e) => `${e.from}->${e.to}`)
        );
      });

      it('guarantees Set immutability: blockedSet, bridgeSet, and bottleneckSet reject mutation', () => {
        // 1. Verify read methods work in O(1) time
        expect(bridgeNet.bridgeSet.has('2,4->2,5')).toBe(true);
        expect(bridgeNet.bridgeSet.has('0,0->1,0')).toBe(false);
        expect(bridgeNet.bridgeSet.size).toBe(4);
        expect([...bridgeNet.bridgeSet]).toHaveLength(4);

        let count = 0;
        bridgeNet.bridgeSet.forEach(() => {
          count++;
        });
        expect(count).toBe(4);

        // 2. Verify mutation attempts on bridgeSet throw TypeError
        expect(() => bridgeNet.bridgeSet.add('0,0->1,0')).toThrow(TypeError);
        expect(() => bridgeNet.bridgeSet.add('0,0->1,0')).toThrow(
          /Cannot mutate a read-only Set: add\(\) is not allowed/
        );
        expect(() => bridgeNet.bridgeSet.delete('2,4->2,5')).toThrow(TypeError);
        expect(() => bridgeNet.bridgeSet.delete('2,4->2,5')).toThrow(
          /Cannot mutate a read-only Set: delete\(\) is not allowed/
        );
        expect(() => bridgeNet.bridgeSet.clear()).toThrow(TypeError);
        expect(() => bridgeNet.bridgeSet.clear()).toThrow(
          /Cannot mutate a read-only Set: clear\(\) is not allowed/
        );

        // 3. Verify mutation attempts on blockedSet throw TypeError
        expect(() => barrierNet.blockedSet.add('0,0->1,0')).toThrow(TypeError);
        expect(() => barrierNet.blockedSet.delete('4,0->5,0')).toThrow(TypeError);
        expect(() => barrierNet.blockedSet.clear()).toThrow(TypeError);

        // 4. Verify mutation attempts on bottleneckSet throw TypeError
        expect(() => bottleneckNet.bottleneckSet.add('0,0->1,0')).toThrow(TypeError);
        expect(() => bottleneckNet.bottleneckSet.delete('4,4->4,5')).toThrow(TypeError);
        expect(() => bottleneckNet.bottleneckSet.clear()).toThrow(TypeError);

        // 5. Verify property addition is forbidden (frozen object)
        expect(() => {
          bridgeNet.bridgeSet.customProperty = 123;
        }).toThrow(TypeError);

        // 6. Standalone createReadOnlySet behavior
        const customSet = createReadOnlySet(['linkA', 'linkB']);
        expect(customSet.has('linkA')).toBe(true);
        expect(customSet.size).toBe(2);
        expect(() => customSet.add('linkC')).toThrow(TypeError);
        expect(() => customSet.delete('linkA')).toThrow(TypeError);
        expect(() => customSet.clear()).toThrow(TypeError);
      });
    });

    describe('6C.3 — Shortest Paths on Topological Scenarios', () => {
      it('BARRIER scenario forces expected detours around the river barrier', () => {
        // Direct adjacent nodes across the river barrier at row 0
        // In GRID: distance is 1 (direct horizontal step)
        // In BARRIER: (4,0) -> (5,0) is blocked. Route must travel down to row 4 crossing:
        // (4,0) -> (4,4) [4 steps] + (4,4) -> (5,4) [1 step] + (5,4) -> (5,0) [4 steps] = 9 steps
        const { reachable, distance, path } = findShortestPath(
          barrierNet,
          { x: 4, y: 0 },
          { x: 5, y: 0 }
        );

        expect(reachable).toBe(true);
        expect(distance).toBe(9);
        expect(path).toHaveLength(10);
        expect(path[0]).toEqual({ x: 4, y: 0 });
        expect(path[4]).toEqual({ x: 4, y: 4 }); // Reaches crossing
        expect(path[5]).toEqual({ x: 5, y: 4 }); // Crosses river
        expect(path[9]).toEqual({ x: 5, y: 0 }); // Reaches destination
      });

      it('BRIDGE scenario restores connectivity across canal barrier (unreachable without bridges)', () => {
        // Start in northern region (y <= 4), end in southern region (y >= 5)
        const start = { x: 2, y: 2 };
        const end = { x: 2, y: 7 };

        const resWithBridges = findShortestPath(bridgeNet, start, end);
        expect(resWithBridges.reachable).toBe(true);
        expect(resWithBridges.distance).toBe(5); // (2,2) -> (2,3) -> (2,4) -> (2,5) -> (2,6) -> (2,7)

        // Traverses the designated West Bridge
        const traversesWestBridge = resWithBridges.path.some((pt, idx) => {
          if (idx === resWithBridges.path.length - 1) return false;
          const next = resWithBridges.path[idx + 1];
          return pt.x === 2 && pt.y === 4 && next.x === 2 && next.y === 5;
        });
        expect(traversesWestBridge).toBe(true);

        // Disconnected network without bridges: North and South are unreachable
        const disconnectedNoBridges = {
          width: 10,
          height: 10,
          adjacency: new Map(
            [...bridgeNet.adjacency.entries()].map(([id, neighbors]) => [
              id,
              neighbors.filter((n) => !n.isBridge),
            ])
          ),
        };

        const resNoBridges = findShortestPath(disconnectedNoBridges, start, end);
        expect(resNoBridges.reachable).toBe(false);
        expect(resNoBridges.distance).toBe(Infinity);
        expect(resNoBridges.path).toEqual([]);
      });

      it('BOTTLENECK scenario routes cross-city traffic through designated bottleneck corridors', () => {
        // Flow from (1, 1) in North-West to (1, 8) in South-West
        const { reachable, distance, path } = findShortestPath(
          bottleneckNet,
          { x: 1, y: 1 },
          { x: 1, y: 8 }
        );

        expect(reachable).toBe(true);
        expect(distance).toBeGreaterThan(0);

        // Path must pass through the central bottleneck pass at (4,4) -> (4,5)
        let passedBottleneck = false;
        for (let i = 0; i < path.length - 1; i++) {
          const from = `${path[i].x},${path[i].y}`;
          const to = `${path[i + 1].x},${path[i + 1].y}`;
          if (isBottleneckEdge(bottleneckNet, from, to)) {
            passedBottleneck = true;
            break;
          }
        }
        expect(passedBottleneck).toBe(true);
      });

      it('path weight sums strictly match calculated distance on all topology networks', () => {
        const scenarios = [barrierNet, bridgeNet, bottleneckNet];

        for (const net of scenarios) {
          const { reachable, distance, path } = findShortestPath(
            net,
            { x: 0, y: 0 },
            { x: 9, y: 9 }
          );
          expect(reachable).toBe(true);

          let sum = 0;
          for (let i = 0; i < path.length - 1; i++) {
            const w = getEdgeWeight(net, path[i], path[i + 1]);
            expect(w).not.toBeNull();
            sum += w;
          }
          expect(sum).toBe(distance);
        }
      });
    });
  });
});
