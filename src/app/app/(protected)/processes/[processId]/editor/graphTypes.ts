import type { Edge, Node } from "@xyflow/react";
import type {
  ProcessEdge,
  ProcessGraphDefinition,
  ProcessNode,
  ProcessNodeData,
  ProcessNodeType,
} from "@/lib/db/database.types";

/**
 * xyflow's Node.type selects which renderer component to use — every
 * node in this editor renders through the single "processNode"
 * component, so our own semantic type (human_task, approval, ...) is
 * carried inside `data.nodeType` instead of xyflow's `type` field.
 */
export type CanvasNodeData = ProcessNodeData & { nodeType: ProcessNodeType } & Record<
    string,
    unknown
  >;
export type CanvasNode = Node<CanvasNodeData>;
export type CanvasEdgeData = { condition?: string | null } & Record<string, unknown>;
export type CanvasEdge = Edge<CanvasEdgeData>;

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export function toCanvasNodes(nodes: ProcessNode[]): CanvasNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "processNode",
    position: node.position,
    data: { ...node.data, nodeType: node.type },
  }));
}

export function toCanvasEdges(edges: ProcessEdge[]): CanvasEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label ?? undefined,
    data: { condition: edge.condition ?? null },
  }));
}

export function fromCanvas(nodes: CanvasNode[], edges: CanvasEdge[]): ProcessGraphDefinition {
  return {
    nodes: nodes.map((node) => {
      const { nodeType, ...data } = node.data;
      return { id: node.id, type: nodeType, position: node.position, data };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: String(edge.source),
      target: String(edge.target),
      label: edge.label ? String(edge.label) : null,
      condition: edge.data?.condition ?? null,
    })),
  };
}
