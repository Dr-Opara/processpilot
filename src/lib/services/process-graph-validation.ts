import "server-only";
import type { ProcessGraphDefinition, ProcessNode } from "@/lib/db/database.types";
import { validateConditionSyntax } from "@/lib/services/workflow-condition";

/**
 * Server-side graph validation — never trusts that the canvas editor's
 * own client-side checks were actually run, same "never trust the
 * client" posture as every other untrusted-input boundary in this
 * codebase. Runs before a version can be submitted for review; a
 * version with validation errors can still be saved as a draft (the
 * author can come back to it), but never reaches process.review or
 * process.publish while errors remain.
 */
export interface GraphValidationError {
  message: string;
  nodeId?: string;
}

const NODE_TYPES_REQUIRING_ASSIGNEE = new Set(["human_task", "approval"]);

export function validateProcessGraph(graph: ProcessGraphDefinition): GraphValidationError[] {
  const errors: GraphValidationError[] = [];
  const { nodes, edges } = graph;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  if (nodes.length === 0) {
    return [{ message: "The process has no steps yet." }];
  }

  const startNodes = nodes.filter((node) => node.type === "start");
  if (startNodes.length === 0) {
    errors.push({ message: "The process has no start node." });
  } else if (startNodes.length > 1) {
    errors.push({ message: "The process has more than one start node." });
  }

  const endNodes = nodes.filter((node) => node.type === "end");
  if (endNodes.length === 0) {
    errors.push({ message: "The process has no end node." });
  }

  // Dangling edges — referencing a node id that doesn't exist.
  for (const edge of edges) {
    if (!nodeById.has(edge.source)) {
      errors.push({ message: `An edge references a missing source node "${edge.source}".` });
    }
    if (!nodeById.has(edge.target)) {
      errors.push({ message: `An edge references a missing target node "${edge.target}".` });
    }
  }

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  }

  // Reachability from start — every other node must be reachable, and
  // at least one end node must be reachable (a graph can have
  // unreachable "dead" branches even with an end node present).
  if (startNodes.length === 1) {
    const visited = new Set<string>();
    const queue = [startNodes[0].id];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      for (const next of outgoing.get(current) ?? []) {
        if (!visited.has(next)) queue.push(next);
      }
    }

    const unreachable = nodes.filter((node) => !visited.has(node.id));
    for (const node of unreachable) {
      errors.push({
        message: `Step "${node.data.label || node.id}" is unreachable from the start.`,
        nodeId: node.id,
      });
    }

    if (endNodes.length > 0 && !endNodes.some((node) => visited.has(node.id))) {
      errors.push({ message: "No end node is reachable from the start." });
    }
  }

  // Cycle detection (DFS with a recursion stack) — loops are rejected
  // outright this phase rather than supporting "loop protection" (a
  // max-iteration guard), keeping the graph a DAG Phase 8 can execute
  // deterministically.
  const visiting = new Set<string>();
  const finished = new Set<string>();
  let hasCycle = false;
  function visit(nodeId: string) {
    if (finished.has(nodeId) || hasCycle) return;
    if (visiting.has(nodeId)) {
      hasCycle = true;
      return;
    }
    visiting.add(nodeId);
    for (const next of outgoing.get(nodeId) ?? []) {
      visit(next);
    }
    visiting.delete(nodeId);
    finished.add(nodeId);
  }
  for (const node of nodes) {
    visit(node.id);
  }
  if (hasCycle) {
    errors.push({ message: "The process graph contains a cycle." });
  }

  const outgoingEdgesByNode = new Map<string, typeof edges>();
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    outgoingEdgesByNode.set(edge.source, [...(outgoingEdgesByNode.get(edge.source) ?? []), edge]);
  }

  // Per-node-type structural and configuration rules.
  for (const node of nodes) {
    validateNode(
      node,
      outgoing.get(node.id) ?? [],
      incoming.get(node.id) ?? [],
      outgoingEdgesByNode.get(node.id) ?? [],
      errors,
    );
  }

  return errors;
}

function validateNode(
  node: ProcessNode,
  nodeOutgoing: string[],
  nodeIncoming: string[],
  nodeOutgoingEdges: ProcessGraphDefinition["edges"],
  errors: GraphValidationError[],
): void {
  const label = node.data.label || node.id;

  if (NODE_TYPES_REQUIRING_ASSIGNEE.has(node.type)) {
    const hasAssignee =
      (node.data.assigneeType === "role" && node.data.assigneeRoleId) ||
      (node.data.assigneeType === "team" && node.data.assigneeTeamId);
    if (!hasAssignee) {
      errors.push({ message: `Step "${label}" needs an assigned role or team.`, nodeId: node.id });
    }
  }

  if (node.type === "form" && (!node.data.formFields || node.data.formFields.length === 0)) {
    errors.push({ message: `Form step "${label}" has no fields defined.`, nodeId: node.id });
  }

  if (node.type === "evidence" && !node.data.evidenceDescription?.trim()) {
    errors.push({
      message: `Evidence step "${label}" has no description of what's required.`,
      nodeId: node.id,
    });
  }

  if (node.type === "decision") {
    if (nodeOutgoing.length < 2) {
      errors.push({
        message: `Decision step "${label}" needs at least two outgoing branches.`,
        nodeId: node.id,
      });
    } else if (nodeOutgoingEdges.some((edge) => !edge.condition?.trim())) {
      errors.push({
        message: `Decision step "${label}" has a branch with no condition set.`,
        nodeId: node.id,
      });
    } else {
      for (const edge of nodeOutgoingEdges) {
        const conditionError = validateConditionSyntax(edge.condition as string);
        if (conditionError) {
          errors.push({
            message: `Decision step "${label}": ${conditionError.message}`,
            nodeId: node.id,
          });
        }
      }
    }
  }

  if (node.type === "parallel_split" && nodeOutgoing.length < 2) {
    errors.push({
      message: `Parallel split "${label}" needs at least two outgoing branches.`,
      nodeId: node.id,
    });
  }

  if (node.type === "parallel_join" && nodeIncoming.length < 2) {
    errors.push({
      message: `Parallel join "${label}" needs at least two incoming branches.`,
      nodeId: node.id,
    });
  }

  if (
    node.type === "timer" &&
    (!node.data.timerDurationMinutes || node.data.timerDurationMinutes <= 0)
  ) {
    errors.push({ message: `Timer step "${label}" needs a duration.`, nodeId: node.id });
  }

  if (node.type === "subprocess" && !node.data.subprocessId) {
    errors.push({
      message: `Subprocess step "${label}" doesn't reference a process.`,
      nodeId: node.id,
    });
  }
}
