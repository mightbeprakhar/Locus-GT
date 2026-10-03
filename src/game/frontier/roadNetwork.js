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
  BARRIER: 'barrier',
  BRIDGE: 'bridge',
  BOTTLENECK: 'bottleneck',
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
  [ROAD_SCENARIO_IDS.BARRIER]: Object.freeze({
    id: ROAD_SCENARIO_IDS.BARRIER,
    name: 'River Barrier Network',
    tagline: 'Natural dividing river barrier with a single controlled central crossing.',
    description:
      'A vertical river barrier along the midline between columns 4 and 5 blocks all east-west street connections except for a single preserved crossing at row 4, forcing significant geographical detours for cross-city travel.',
  }),
  [ROAD_SCENARIO_IDS.BRIDGE]: Object.freeze({
    id: ROAD_SCENARIO_IDS.BRIDGE,
    name: 'Dual-Region Bridge Network',
    tagline: 'Two distinct urban regions separated by a water barrier, connected via explicit bridge spans.',
    description:
      'A horizontal canal barrier along row boundary y in {4, 5} completely bisects the northern and southern urban sectors. Dual designated bridge links at columns x = 2 and x = 7 provide the sole traversable connections between the regions.',
  }),
  [ROAD_SCENARIO_IDS.BOTTLENECK]: Object.freeze({
    id: ROAD_SCENARIO_IDS.BOTTLENECK,
    name: 'Bottleneck Corridor Network',
    tagline: 'Urban topography channeling cross-city flows through designated bottleneck passes.',
    description:
      'Topographical barriers channel north-south transit flows into a designated central bottleneck corridor between rows 4 and 5 at columns 4 and 5, creating high structural traffic concentration.',
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
 * @param {Object} [metadata] - Optional edge metadata (isBridge, isBottleneck, name)
 * @returns {Readonly<{ from: string, to: string, weight: number, isBridge?: boolean, isBottleneck?: boolean, name?: string }>}
 */
export function createEdge(from, to, weight, metadata = {}) {
  if (typeof from !== 'string' || typeof to !== 'string') {
    throw new TypeError('Edge "from" and "to" must be strings.');
  }
  if (from === to) {
    throw new RangeError(`Self-edges are not permitted: "${from}" -> "${to}".`);
  }
  if (typeof weight !== 'number' || weight <= 0 || !Number.isFinite(weight)) {
    throw new RangeError(`Edge weight must be a positive finite number, received ${weight}.`);
  }

  const edge = {
    from,
    to,
    weight,
    ...(metadata.isBridge ? { isBridge: true } : {}),
    ...(metadata.isBottleneck ? { isBottleneck: true } : {}),
    ...(metadata.name ? { name: metadata.name } : {}),
  };

  return Object.freeze(edge);
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

  if (network.blockedEdges && !Array.isArray(network.blockedEdges)) {
    throw new TypeError('Network blockedEdges must be an array.');
  }
  if (network.bridges && !Array.isArray(network.bridges)) {
    throw new TypeError('Network bridges must be an array.');
  }
  if (network.bottlenecks && !Array.isArray(network.bottlenecks)) {
    throw new TypeError('Network bottlenecks must be an array.');
  }

  if (network.blockedSet && typeof network.blockedSet.has !== 'function') {
    throw new TypeError('Network blockedSet must have a has() method.');
  }
  if (network.bridgeSet && typeof network.bridgeSet.has !== 'function') {
    throw new TypeError('Network bridgeSet must have a has() method.');
  }
  if (network.bottleneckSet && typeof network.bottleneckSet.has !== 'function') {
    throw new TypeError('Network bottleneckSet must have a has() method.');
  }
}

/**
 * Creates an immutable, read-only Set wrapper around an iterable or Set.
 * Mutation methods (add, delete, clear) throw a TypeError.
 * Read operations (has, size, values, keys, entries, forEach, iterator) delegate in O(1) time.
 *
 * @template T
 * @param {Iterable<T>} [iterable]
 * @returns {Readonly<{
 *   has: (value: T) => boolean,
 *   readonly size: number,
 *   add: () => never,
 *   delete: () => never,
 *   clear: () => never,
 *   values: () => IterableIterator<T>,
 *   keys: () => IterableIterator<T>,
 *   entries: () => IterableIterator<[T, T]>,
 *   forEach: (callbackfn: (value: T, value2: T, set: any) => void, thisArg?: any) => void,
 *   [Symbol.iterator]: () => IterableIterator<T>
 * }>}
 */
export function createReadOnlySet(iterable) {
  const innerSet = new Set(iterable);

  return Object.freeze({
    has(value) {
      return innerSet.has(value);
    },
    get size() {
      return innerSet.size;
    },
    add() {
      throw new TypeError('Cannot mutate a read-only Set: add() is not allowed.');
    },
    delete() {
      throw new TypeError('Cannot mutate a read-only Set: delete() is not allowed.');
    },
    clear() {
      throw new TypeError('Cannot mutate a read-only Set: clear() is not allowed.');
    },
    values() {
      return innerSet.values();
    },
    keys() {
      return innerSet.keys();
    },
    entries() {
      return innerSet.entries();
    },
    forEach(callback, thisArg) {
      return innerSet.forEach((val, val2) => callback.call(thisArg, val, val2, this));
    },
    [Symbol.iterator]() {
      return innerSet[Symbol.iterator]();
    },
    [Symbol.toStringTag]: 'Set',
  });
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
 * Evaluates the topological status of a link between two adjacent nodes.
 *
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {string} scenarioId
 * @returns {{
 *   blocked: boolean,
 *   reason?: string,
 *   weight?: number,
 *   isBridge?: boolean,
 *   isBottleneck?: boolean,
 *   name?: string
 * }}
 */
function getScenarioLinkInfo(x1, y1, x2, y2, scenarioId) {
  switch (scenarioId) {
    case ROAD_SCENARIO_IDS.BARRIER: {
      // River barrier along vertical boundary between columns 4 and 5
      // Blocks horizontal links between col 4 and col 5, EXCEPT row 4 crossing
      const isHorizontalMidline =
        (x1 === 4 && x2 === 5 && y1 === y2) || (x1 === 5 && x2 === 4 && y1 === y2);
      if (isHorizontalMidline) {
        if (y1 === 4) {
          // Controlled central crossing at row 4
          return { blocked: false, weight: 1.0 };
        }
        return { blocked: true, reason: 'river_barrier' };
      }
      return { blocked: false, weight: 1.0 };
    }

    case ROAD_SCENARIO_IDS.BRIDGE: {
      // Water barrier along horizontal boundary between rows 4 and 5
      // Blocks vertical links between row 4 and row 5, EXCEPT bridges at cols 2 and 7
      const isVerticalMidline =
        (y1 === 4 && y2 === 5 && x1 === x2) || (y1 === 5 && y2 === 4 && x1 === x2);
      if (isVerticalMidline) {
        if (x1 === 2) {
          return { blocked: false, weight: 1.0, isBridge: true, name: 'West Bridge' };
        }
        if (x1 === 7) {
          return { blocked: false, weight: 1.0, isBridge: true, name: 'East Bridge' };
        }
        return { blocked: true, reason: 'canal_barrier' };
      }
      return { blocked: false, weight: 1.0 };
    }

    case ROAD_SCENARIO_IDS.BOTTLENECK: {
      // Topographical pass channeling north-south traffic through central corridor
      // Blocks vertical links between row 4 and row 5, EXCEPT bottleneck passes at cols 4 and 5
      const isVerticalMidline =
        (y1 === 4 && y2 === 5 && x1 === x2) || (y1 === 5 && y2 === 4 && x1 === x2);
      if (isVerticalMidline) {
        if (x1 === 4) {
          return {
            blocked: false,
            weight: 1.0,
            isBottleneck: true,
            name: 'Central Bottleneck Corridor West',
          };
        }
        if (x1 === 5) {
          return {
            blocked: false,
            weight: 1.0,
            isBottleneck: true,
            name: 'Central Bottleneck Corridor East',
          };
        }
        return { blocked: true, reason: 'flanking_barrier' };
      }
      return { blocked: false, weight: 1.0 };
    }

    case ROAD_SCENARIO_IDS.ARTERIAL:
    case ROAD_SCENARIO_IDS.RING_ARTERIAL:
    case ROAD_SCENARIO_IDS.GRID:
    default: {
      const weight = getScenarioEdgeWeight(x1, y1, x2, y2, scenarioId);
      return { blocked: false, weight };
    }
  }
}

/**
 * Creates a deterministic road network graph for a given scenario.
 *
 * @param {Object} [options]
 * @param {number} [options.width=DEFAULT_GRID.width] - Number of columns (default 10)
 * @param {number} [options.height=DEFAULT_GRID.height] - Number of rows (default 10)
 * @param {'grid'|'arterial'|'ring-arterial'|'barrier'|'bridge'|'bottleneck'} [options.scenario=ROAD_SCENARIO_IDS.GRID]
 * @returns {Readonly<{
 *   width: number,
 *   height: number,
 *   scenario: string,
 *   scenarioName: string,
 *   scenarioDescription: string,
 *   nodes: Array<{ id: string, x: number, y: number }>,
 *   nodeMap: Map<string, { id: string, x: number, y: number }>,
 *   edges: Array<{ from: string, to: string, weight: number, isBridge?: boolean, isBottleneck?: boolean, name?: string }>,
 *   adjacency: Map<string, Array<{ to: string, weight: number, x: number, y: number, isBridge?: boolean, isBottleneck?: boolean }>>,
 *   edgeMap: Map<string, number>,
 *   blockedEdges: Array<{ from: string, to: string, reason?: string }>,
 *   bridges: Array<{ from: string, to: string, weight: number, isBridge: boolean, name?: string }>,
 *   bottlenecks: Array<{ from: string, to: string, weight: number, isBottleneck: boolean, name?: string }>,
 *   blockedSet: Set<string>,
 *   bridgeSet: Set<string>,
 *   bottleneckSet: Set<string>
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

  const blockedEdges = [];
  const bridges = [];
  const bottlenecks = [];
  const blockedSet = new Set();
  const bridgeSet = new Set();
  const bottleneckSet = new Set();

  // 1. Generate nodes for 10x10 spatial grid
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const node = createNode(x, y);
      nodes.push(node);
      nodeMap.set(node.id, node);
      adjacency.set(node.id, []);
    }
  }

  // Link processor for adjacent grid links
  const processLink = (x1, y1, x2, y2) => {
    const fromId = createNodeId(x1, y1);
    const toId = createNodeId(x2, y2);
    const linkInfo = getScenarioLinkInfo(x1, y1, x2, y2, scenarioMeta.id);

    if (linkInfo.blocked) {
      const b1 = Object.freeze({ from: fromId, to: toId, reason: linkInfo.reason });
      const b2 = Object.freeze({ from: toId, to: fromId, reason: linkInfo.reason });
      blockedEdges.push(b1);
      blockedEdges.push(b2);
      blockedSet.add(`${fromId}->${toId}`);
      blockedSet.add(`${toId}->${fromId}`);
      return;
    }

    const weight = linkInfo.weight ?? 1.0;

    // Forward edge (x1, y1) -> (x2, y2)
    const edgeForward = createEdge(fromId, toId, weight, linkInfo);
    edges.push(edgeForward);
    edgeMap.set(`${fromId}->${toId}`, weight);
    adjacency.get(fromId).push({
      to: toId,
      weight,
      x: x2,
      y: y2,
      ...(linkInfo.isBridge ? { isBridge: true } : {}),
      ...(linkInfo.isBottleneck ? { isBottleneck: true } : {}),
    });

    // Backward edge (x2, y2) -> (x1, y1) (bidirectional)
    const edgeBackward = createEdge(toId, fromId, weight, linkInfo);
    edges.push(edgeBackward);
    edgeMap.set(`${toId}->${fromId}`, weight);
    adjacency.get(toId).push({
      to: fromId,
      weight,
      x: x1,
      y: y1,
      ...(linkInfo.isBridge ? { isBridge: true } : {}),
      ...(linkInfo.isBottleneck ? { isBottleneck: true } : {}),
    });

    if (linkInfo.isBridge) {
      bridges.push(edgeForward);
      bridges.push(edgeBackward);
      bridgeSet.add(`${fromId}->${toId}`);
      bridgeSet.add(`${toId}->${fromId}`);
    }

    if (linkInfo.isBottleneck) {
      bottlenecks.push(edgeForward);
      bottlenecks.push(edgeBackward);
      bottleneckSet.add(`${fromId}->${toId}`);
      bottleneckSet.add(`${toId}->${fromId}`);
    }
  };

  // 2. Generate 4-neighbour bidirectional edges
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Horizontal edge to right neighbour (x + 1, y)
      if (x + 1 < width) {
        processLink(x, y, x + 1, y);
      }

      // Vertical edge to bottom neighbour (x, y + 1)
      if (y + 1 < height) {
        processLink(x, y, x, y + 1);
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
    blockedEdges: Object.freeze(blockedEdges),
    bridges: Object.freeze(bridges),
    bottlenecks: Object.freeze(bottlenecks),
    blockedSet: createReadOnlySet(blockedSet),
    bridgeSet: createReadOnlySet(bridgeSet),
    bottleneckSet: createReadOnlySet(bottleneckSet),
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

/**
 * Checks whether a directed link is a designated bridge edge.
 *
 * @param {Object} network
 * @param {string|{x: number, y: number}} from
 * @param {string|{x: number, y: number}} to
 * @returns {boolean}
 */
export function isBridgeEdge(network, from, to) {
  if (!network) return false;
  const fromId = typeof from === 'string' ? from : createNodeId(from.x, from.y);
  const toId = typeof to === 'string' ? to : createNodeId(to.x, to.y);
  return network.bridgeSet?.has(`${fromId}->${toId}`) ?? false;
}

/**
 * Checks whether a directed link is a designated bottleneck edge.
 *
 * @param {Object} network
 * @param {string|{x: number, y: number}} from
 * @param {string|{x: number, y: number}} to
 * @returns {boolean}
 */
export function isBottleneckEdge(network, from, to) {
  if (!network) return false;
  const fromId = typeof from === 'string' ? from : createNodeId(from.x, from.y);
  const toId = typeof to === 'string' ? to : createNodeId(to.x, to.y);
  return network.bottleneckSet?.has(`${fromId}->${toId}`) ?? false;
}

/**
 * Checks whether a directed link is a blocked / barrier edge.
 *
 * @param {Object} network
 * @param {string|{x: number, y: number}} from
 * @param {string|{x: number, y: number}} to
 * @returns {boolean}
 */
export function isBlockedEdge(network, from, to) {
  if (!network) return false;
  const fromId = typeof from === 'string' ? from : createNodeId(from.x, from.y);
  const toId = typeof to === 'string' ? to : createNodeId(to.x, to.y);
  return network.blockedSet?.has(`${fromId}->${toId}`) ?? false;
}
