/**
 * @file roadNetwork.js
 * @description Weighted graph data model and deterministic road-network scenarios
 * for LOCUS Frontier (Phase 6B.1 - 6B.2).
 * Represents spatial grid street topographies with bidirectional, positive-weighted connections.
 */

import { DEFAULT_GRID } from '../types.js';

/**
 * Valid road network scenario identifiers.
 */
export const ROAD_SCENARIO_IDS = Object.freeze({
  GRID: 'grid',
  ARTERIAL: 'arterial',
  RING_ARTERIAL: 'ring-arterial',
});

/**
 * Road network scenario metadata definitions.
 */
export const ROAD_SCENARIOS = Object.freeze({
  [ROAD_SCENARIO_IDS.GRID]: Object.freeze({
    id: ROAD_SCENARIO_IDS.GRID,
    name: 'Uniform Grid Network',
    tagline: 'Standard 4-neighbour orthogonal street network with uniform travel cost.',
    description:
      'Every horizontally and vertically adjacent zone is connected by a standard two-way street with unit travel friction (weight = 1). Shortest-path distances correspond exactly to Manhattan metric.',
  }),
  [ROAD_SCENARIO_IDS.ARTERIAL]: Object.freeze({
    id: ROAD_SCENARIO_IDS.ARTERIAL,
    name: 'Central Arterial Network',
    tagline: 'Dual-carriageway central boulevards with secondary local streets.',
    description:
      'Features high-capacity central thoroughfares along columns 4-5 and rows 4-5 (weight = 1), while residential and feeder streets have higher friction (weight = 2), incentivizing route diversions.',
  }),
  [ROAD_SCENARIO_IDS.RING_ARTERIAL]: Object.freeze({
    id: ROAD_SCENARIO_IDS.RING_ARTERIAL,
    name: 'Beltway / Ring Arterial Network',
    tagline: 'Perimeter bypass highway enclosing an urban street grid.',
    description:
      'An outer ring beltway along coordinate lines x,y in {2, 7} provides high-speed circumferential bypass routes (weight = 1) around local interior zones (weight = 2).',
  }),
});

/**
 * Creates a canonical node ID from grid coordinates.
 *
 * @param {number} x
 * @param {number} y
 * @returns {string} e.g. "4,5"
 */
export function createNodeId(x, y) {
  return `${x},${y}`;
}

/**
 * Parses a node ID string into coordinate numbers.
 *
 * @param {string} id
 * @returns {{ x: number, y: number }}
 */
export function parseNodeId(id) {
  if (typeof id !== 'string') {
    throw new TypeError(`Node id must be a string, received ${typeof id}.`);
  }
  const parts = id.split(',');
  if (parts.length !== 2) {
    throw new TypeError(`Invalid node id format "${id}". Expected "x,y".`);
  }
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new TypeError(`Node coordinates in id "${id}" must be integers.`);
  }
  return { x, y };
}

/**
 * Checks whether coordinates lie strictly within grid bounds.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} [width=DEFAULT_GRID.width]
 * @param {number} [height=DEFAULT_GRID.height]
 * @returns {boolean}
 */
export function isValidCoordinate(x, y, width = DEFAULT_GRID.width, height = DEFAULT_GRID.height) {
  return (
    typeof x === 'number' &&
    typeof y === 'number' &&
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    x < width &&
    y >= 0 &&
    y < height
  );
}

/**
 * Creates an immutable node object.
 *
 * @param {number} x
 * @param {number} y
 * @returns {Readonly<{ id: string, x: number, y: number }>}
 */
export function createNode(x, y) {
  return Object.freeze({
    id: createNodeId(x, y),
    x,
    y,
  });
}

/**
 * Creates an edge object representing a traversable directed road connection.
 *
 * @param {string} from - Source node id "x,y"
 * @param {string} to - Destination node id "x,y"
 * @param {number} weight - Positive travel friction / cost (> 0)
 * @returns {Readonly<{ from: string, to: string, weight: number }>}
 */
export function createEdge(from, to, weight) {
  if (typeof from !== 'string' || typeof to !== 'string') {
    throw new TypeError('Edge "from" and "to" must be strings.');
  }
  if (from === to) {
    throw new RangeError(`Self-edges are not permitted: "${from}" -> "${to}".`);
  }
  if (typeof weight !== 'number' || weight <= 0 || !Number.isFinite(weight)) {
    throw new RangeError(`Edge weight must be a positive finite number, received ${weight}.`);
  }

  return Object.freeze({
    from,
    to,
    weight,
  });
}

/**
 * Validates a road network data structure.
 *
 * @param {Object} network
 * @throws {TypeError|RangeError} if validation fails
 */
export function validateRoadNetwork(network) {
  if (!network || typeof network !== 'object') {
    throw new TypeError('Road network must be an object.');
  }

  const { width, height, nodes, edges, scenario } = network;

  if (!Number.isInteger(width) || width <= 0) {
    throw new RangeError('Network width must be a positive integer.');
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new RangeError('Network height must be a positive integer.');
  }
  if (!Array.isArray(nodes)) {
    throw new TypeError('Network nodes must be an array.');
  }
  if (!Array.isArray(edges)) {
    throw new TypeError('Network edges must be an array.');
  }
  if (typeof scenario !== 'string') {
    throw new TypeError('Network scenario must be a string.');
  }

  const expectedNodeCount = width * height;
  if (nodes.length !== expectedNodeCount) {
    throw new RangeError(
      `Expected ${expectedNodeCount} nodes for ${width}x${height} grid, found ${nodes.length}.`
    );
  }

  const nodeSet = new Set();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!isValidCoordinate(node.x, node.y, width, height)) {
      throw new RangeError(`Node (${node.x}, ${node.y}) out of grid bounds.`);
    }
    if (node.id !== createNodeId(node.x, node.y)) {
      throw new TypeError(`Node id "${node.id}" does not match coordinates (${node.x}, ${node.y}).`);
    }
    if (nodeSet.has(node.id)) {
      throw new RangeError(`Duplicate node id "${node.id}".`);
    }
    nodeSet.add(node.id);
  }

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!nodeSet.has(edge.from)) {
      throw new RangeError(`Edge from node "${edge.from}" does not exist in graph.`);
    }
    if (!nodeSet.has(edge.to)) {
      throw new RangeError(`Edge to node "${edge.to}" does not exist in graph.`);
    }
    if (edge.from === edge.to) {
      throw new RangeError(`Edge has identical from and to "${edge.from}".`);
    }
    if (typeof edge.weight !== 'number' || edge.weight <= 0 || !Number.isFinite(edge.weight)) {
      throw new RangeError(`Edge weight must be positive finite number, received ${edge.weight}.`);
    }

    // Verify 4-neighbour adjacency (no diagonal edges)
    const pFrom = parseNodeId(edge.from);
    const pTo = parseNodeId(edge.to);
    const manhattan = Math.abs(pFrom.x - pTo.x) + Math.abs(pFrom.y - pTo.y);
    if (manhattan !== 1) {
      throw new RangeError(
        `Edge between "${edge.from}" and "${edge.to}" is not a valid 4-neighbour grid link (Manhattan distance ${manhattan} != 1).`
      );
    }
  }
}

/**
 * Calculates edge weight between two adjacent 4-neighbour nodes based on the scenario.
 *
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {string} scenarioId
 * @returns {number}
 */
function getScenarioEdgeWeight(x1, y1, x2, y2, scenarioId) {
  switch (scenarioId) {
    case ROAD_SCENARIO_IDS.ARTERIAL: {
      // High-capacity Central Boulevards:
      // Vertical arterial along cols 4 and 5
      const isNorthSouthArterial = (x1 === 4 && x2 === 4) || (x1 === 5 && x2 === 5);
      // Horizontal arterial along rows 4 and 5
      const isEastWestArterial = (y1 === 4 && y2 === 4) || (y1 === 5 && y2 === 5);

      if (isNorthSouthArterial || isEastWestArterial) {
        return 1.0; // Major arterial corridor
      }
      return 2.0; // Standard local street
    }

    case ROAD_SCENARIO_IDS.RING_ARTERIAL: {
      // Outer bypass ring corridor along x in {2, 7} and y in {2, 7}
      const onTopRing = y1 === 2 && y2 === 2 && x1 >= 2 && x1 <= 7 && x2 >= 2 && x2 <= 7;
      const onBottomRing = y1 === 7 && y2 === 7 && x1 >= 2 && x1 <= 7 && x2 >= 2 && x2 <= 7;
      const onLeftRing = x1 === 2 && x2 === 2 && y1 >= 2 && y1 <= 7 && y2 >= 2 && y2 <= 7;
      const onRightRing = x1 === 7 && x2 === 7 && y1 >= 2 && y1 <= 7 && y2 >= 2 && y2 <= 7;

      if (onTopRing || onBottomRing || onLeftRing || onRightRing) {
        return 1.0; // Ring highway
      }
      return 2.0; // Local street
    }

    case ROAD_SCENARIO_IDS.GRID:
    default:
      return 1.0; // Standard uniform grid
  }
}

/**
 * Creates a deterministic road network graph for a given scenario.
 *
 * @param {Object} [options]
 * @param {number} [options.width=DEFAULT_GRID.width] - Number of columns (default 10)
 * @param {number} [options.height=DEFAULT_GRID.height] - Number of rows (default 10)
 * @param {'grid'|'arterial'|'ring-arterial'} [options.scenario=ROAD_SCENARIO_IDS.GRID]
 * @returns {Readonly<{
 *   width: number,
 *   height: number,
 *   scenario: string,
 *   scenarioName: string,
 *   scenarioDescription: string,
 *   nodes: Array<{ id: string, x: number, y: number }>,
 *   nodeMap: Map<string, { id: string, x: number, y: number }>,
 *   edges: Array<{ from: string, to: string, weight: number }>,
 *   adjacency: Map<string, Array<{ to: string, weight: number, x: number, y: number }>>,
 *   edgeMap: Map<string, number>
 * }>}
 */
export function createRoadNetwork({
  width = DEFAULT_GRID.width,
  height = DEFAULT_GRID.height,
  scenario = ROAD_SCENARIO_IDS.GRID,
} = {}) {
  if (typeof scenario !== 'string') {
    throw new TypeError(
      `Scenario must be a string identifier, received ${typeof scenario}.`
    );
  }

  const scenarioMeta = ROAD_SCENARIOS[scenario];
  if (!scenarioMeta) {
    const allowed = Object.values(ROAD_SCENARIO_IDS).join(', ');
    throw new RangeError(
      `Invalid road network scenario "${scenario}". Allowed scenarios: ${allowed}.`
    );
  }

  const nodes = [];
  const nodeMap = new Map();
  const adjacency = new Map();
  const edgeMap = new Map();
  const edges = [];

  // 1. Generate nodes for 10x10 spatial grid
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const node = createNode(x, y);
      nodes.push(node);
      nodeMap.set(node.id, node);
      adjacency.set(node.id, []);
    }
  }

  // 2. Generate 4-neighbour bidirectional edges
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const fromId = createNodeId(x, y);

      // Horizontal edge to right neighbour (x + 1, y)
      if (x + 1 < width) {
        const toId = createNodeId(x + 1, y);
        const weight = getScenarioEdgeWeight(x, y, x + 1, y, scenarioMeta.id);

        // Forward edge (x, y) -> (x+1, y)
        const edgeForward = createEdge(fromId, toId, weight);
        edges.push(edgeForward);
        edgeMap.set(`${fromId}->${toId}`, weight);
        adjacency.get(fromId).push({
          to: toId,
          weight,
          x: x + 1,
          y,
        });

        // Backward edge (x+1, y) -> (x, y) (bidirectional)
        const edgeBackward = createEdge(toId, fromId, weight);
        edges.push(edgeBackward);
        edgeMap.set(`${toId}->${fromId}`, weight);
        adjacency.get(toId).push({
          to: fromId,
          weight,
          x,
          y,
        });
      }

      // Vertical edge to bottom neighbour (x, y + 1)
      if (y + 1 < height) {
        const toId = createNodeId(x, y + 1);
        const weight = getScenarioEdgeWeight(x, y, x, y + 1, scenarioMeta.id);

        // Forward edge (x, y) -> (x, y+1)
        const edgeForward = createEdge(fromId, toId, weight);
        edges.push(edgeForward);
        edgeMap.set(`${fromId}->${toId}`, weight);
        adjacency.get(fromId).push({
          to: toId,
          weight,
          x,
          y: y + 1,
        });

        // Backward edge (x, y+1) -> (x, y) (bidirectional)
        const edgeBackward = createEdge(toId, fromId, weight);
        edges.push(edgeBackward);
        edgeMap.set(`${toId}->${fromId}`, weight);
        adjacency.get(toId).push({
          to: fromId,
          weight,
          x,
          y,
        });
      }
    }
  }

  const network = {
    width,
    height,
    scenario: scenarioMeta.id,
    scenarioName: scenarioMeta.name,
    scenarioDescription: scenarioMeta.description,
    nodes: Object.freeze(nodes),
    nodeMap,
    edges: Object.freeze(edges),
    adjacency,
    edgeMap,
  };

  validateRoadNetwork(network);

  return Object.freeze(network);
}

/**
 * Returns outgoing neighbor edges from a given node in the road network.
 *
 * @param {Object} network
 * @param {string|{x: number, y: number}} node
 * @returns {Array<{ to: string, weight: number, x: number, y: number }>}
 */
export function getNeighbors(network, node) {
  if (!network || !network.adjacency) {
    throw new TypeError('Invalid road network object.');
  }
  const nodeId = typeof node === 'string' ? node : createNodeId(node.x, node.y);
  return network.adjacency.get(nodeId) ?? [];
}

/**
 * Looks up the directed edge weight between two nodes if connected.
 *
 * @param {Object} network
 * @param {string|{x: number, y: number}} from
 * @param {string|{x: number, y: number}} to
 * @returns {number|null} Weight if edge exists, null otherwise
 */
export function getEdgeWeight(network, from, to) {
  if (!network || !network.edgeMap) {
    throw new TypeError('Invalid road network object.');
  }
  const fromId = typeof from === 'string' ? from : createNodeId(from.x, from.y);
  const toId = typeof to === 'string' ? to : createNodeId(to.x, to.y);
  return network.edgeMap.get(`${fromId}->${toId}`) ?? null;
}
