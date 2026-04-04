/**
 * Salesforce Dependency Traverser
 * Traverses and analyzes dependency graphs
 */

import { logWarn } from "./lib/loggerStructured.js";
import type {
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
  TraversalOptions,
  CycleDetectionResult,
} from "./types/sfDependencyTypes.js";

/**
 * Traverse dependencies using depth-first search
 *
 * @param graph - Dependency graph to traverse
 * @param options - Traversal options
 * @returns Visited nodes in order
 */
export function traverseDependencies(
  graph: DependencyGraph,
  options: TraversalOptions,
): DependencyNode[] {
  const visited = new Set<string>();
  const result: DependencyNode[] = [];
  const stack: string[] = [];

  function dfs(nodeId: string, depth: number): void {
    if (depth > options.maxDepth) {
      return;
    }

    if (visited.has(nodeId)) {
      if (options.detectCycles && stack.includes(nodeId)) {
        const cycleStart = stack.indexOf(nodeId);
        const cyclePath = [...stack.slice(cycleStart), nodeId];

        logWarn("Cycle detected", { path: cyclePath });

        if (options.onCycleDetected) {
          options.onCycleDetected(cyclePath);
        }
      }
      return;
    }

    visited.add(nodeId);
    stack.push(nodeId);

    const node = graph.nodes.get(nodeId);
    if (node) {
      result.push(node);

      if (options.onNodeVisit) {
        options.onNodeVisit(node);
      }

      // Find outgoing edges
      const outgoingEdges = graph.edges.filter((e) => e.sourceId === nodeId);

      for (const edge of outgoingEdges) {
        dfs(edge.targetId, depth + 1);
      }
    }

    stack.pop();
  }

  dfs(graph.rootId, 0);
  return result;
}

/**
 * Detect cycles in the dependency graph
 *
 * @param nodes - Map of nodes
 * @param edges - Array of edges
 * @param startNodeId - Starting node ID
 * @returns Cycle detection result
 */
export function detectCycles(
  nodes: Map<string, DependencyNode>,
  edges: DependencyEdge[],
  _startNodeId: string,
): CycleDetectionResult {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  // Build adjacency list
  const adjacencyList = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adjacencyList.has(edge.sourceId)) {
      adjacencyList.set(edge.sourceId, []);
    }
    adjacencyList.get(edge.sourceId)!.push(edge.targetId);
  }

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = adjacencyList.get(nodeId) ?? [];

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recursionStack.has(neighbor)) {
        // Cycle found
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          cycle.push(neighbor); // Complete the cycle
          cycles.push(cycle);
        }
      }
    }

    recursionStack.delete(nodeId);
  }

  // Start DFS from all nodes to catch disconnected components
  for (const nodeId of nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId, []);
    }
  }

  return {
    hasCycles: cycles.length > 0,
    cycles,
    visitedNodes: visited,
  };
}

/**
 * Get all nodes at a specific depth
 *
 * @param graph - Dependency graph
 * @param depth - Target depth
 * @returns Nodes at the specified depth
 */
export function getNodesAtDepth(graph: DependencyGraph, depth: number): DependencyNode[] {
  return Array.from(graph.nodes.values()).filter((n) => n.depth === depth);
}

/**
 * Get all leaf nodes (nodes with no outgoing edges)
 *
 * @param graph - Dependency graph
 * @returns Leaf nodes
 */
export function getLeafNodes(graph: DependencyGraph): DependencyNode[] {
  const nodesWithOutgoing = new Set(graph.edges.map((e) => e.sourceId));

  return Array.from(graph.nodes.values()).filter((n) => !nodesWithOutgoing.has(n.id));
}

/**
 * Get all root nodes (nodes with no incoming edges)
 *
 * @param graph - Dependency graph
 * @returns Root nodes
 */
export function getRootNodes(graph: DependencyGraph): DependencyNode[] {
  const nodesWithIncoming = new Set(graph.edges.map((e) => e.targetId));

  return Array.from(graph.nodes.values()).filter((n) => !nodesWithIncoming.has(n.id));
}

/**
 * Get the path from root to a specific node
 *
 * @param graph - Dependency graph
 * @param targetNodeId - Target node ID
 * @returns Path of node IDs from root to target
 */
export function getPathToNode(graph: DependencyGraph, targetNodeId: string): string[] | null {
  const visited = new Set<string>();
  const parent = new Map<string, string>();

  function bfs(): boolean {
    const queue: string[] = [graph.rootId];
    visited.add(graph.rootId);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === targetNodeId) {
        return true;
      }

      const outgoingEdges = graph.edges.filter((e) => e.sourceId === current);

      for (const edge of outgoingEdges) {
        if (!visited.has(edge.targetId)) {
          visited.add(edge.targetId);
          parent.set(edge.targetId, current);
          queue.push(edge.targetId);
        }
      }
    }

    return false;
  }

  if (!bfs()) {
    return null;
  }

  // Reconstruct path
  const path: string[] = [];
  let current: string | undefined = targetNodeId;

  while (current !== undefined) {
    path.unshift(current);
    current = parent.get(current);
  }

  return path;
}

/**
 * Get all dependencies of a node (direct and transitive)
 *
 * @param graph - Dependency graph
 * @param nodeId - Node ID
 * @returns Set of dependency node IDs
 */
export function getAllDependencies(graph: DependencyGraph, nodeId: string): Set<string> {
  const dependencies = new Set<string>();
  const visited = new Set<string>();

  function collect(currentId: string): void {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const outgoingEdges = graph.edges.filter((e) => e.sourceId === currentId);

    for (const edge of outgoingEdges) {
      dependencies.add(edge.targetId);
      collect(edge.targetId);
    }
  }

  collect(nodeId);
  return dependencies;
}

/**
 * Get all dependents of a node (nodes that depend on this node)
 *
 * @param graph - Dependency graph
 * @param nodeId - Node ID
 * @returns Set of dependent node IDs
 */
export function getAllDependents(graph: DependencyGraph, nodeId: string): Set<string> {
  const dependents = new Set<string>();
  const visited = new Set<string>();

  function collect(currentId: string): void {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const incomingEdges = graph.edges.filter((e) => e.targetId === currentId);

    for (const edge of incomingEdges) {
      dependents.add(edge.sourceId);
      collect(edge.sourceId);
    }
  }

  collect(nodeId);
  return dependents;
}

/**
 * Calculate the impact score for a node
 * Higher score = more components depend on this node
 *
 * @param graph - Dependency graph
 * @param nodeId - Node ID
 * @returns Impact score
 */
export function calculateImpactScore(graph: DependencyGraph, nodeId: string): number {
  const dependents = getAllDependents(graph, nodeId);
  return dependents.size;
}

/**
 * Sort nodes by impact score (most impactful first)
 *
 * @param graph - Dependency graph
 * @returns Sorted array of nodes with scores
 */
export function sortByImpact(
  graph: DependencyGraph,
): Array<{ node: DependencyNode; score: number }> {
  const results: Array<{ node: DependencyNode; score: number }> = [];

  for (const node of graph.nodes.values()) {
    const score = calculateImpactScore(graph, node.id);
    results.push({ node, score });
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Get subgraph for a specific node and its dependencies
 *
 * @param graph - Original dependency graph
 * @param nodeId - Node ID to extract subgraph for
 * @param includeDepth - How many levels of dependencies to include
 * @returns Subgraph
 */
export function extractSubgraph(
  graph: DependencyGraph,
  nodeId: string,
  includeDepth: number = Infinity,
): DependencyGraph {
  const subNodes = new Map<string, DependencyNode>();
  const subEdges: DependencyEdge[] = [];
  const visited = new Set<string>();

  function collect(currentId: string, depth: number): void {
    if (visited.has(currentId) || depth > includeDepth) return;
    visited.add(currentId);

    const node = graph.nodes.get(currentId);
    if (node) {
      subNodes.set(currentId, { ...node, depth });
    }

    const outgoingEdges = graph.edges.filter((e) => e.sourceId === currentId);

    for (const edge of outgoingEdges) {
      subEdges.push(edge);
      collect(edge.targetId, depth + 1);
    }
  }

  collect(nodeId, 0);

  return {
    nodes: subNodes,
    edges: subEdges,
    rootId: nodeId,
    metadata: {
      ...graph.metadata,
      rootName: graph.nodes.get(nodeId)?.name ?? nodeId,
      nodeCount: subNodes.size,
      edgeCount: subEdges.length,
    },
  };
}
