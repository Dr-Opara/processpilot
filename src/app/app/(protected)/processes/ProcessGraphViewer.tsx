import { Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ProcessGraphDefinition } from "@/lib/db/database.types";
import { NODE_TYPE_META } from "./[processId]/editor/nodePalette";

/**
 * Read-only rendering of a process graph as a node list and an edge
 * list, standing in for a real graph view until the visual canvas
 * (see ProcessGraphForm) is built.
 */
export function ProcessGraphViewer({
  graph,
  roleNames,
  teamNames,
}: {
  graph: ProcessGraphDefinition;
  roleNames: Map<string, string>;
  teamNames: Map<string, string>;
}) {
  return (
    <Stack className="gap-4">
      <Stack className="gap-3">
        {graph.nodes.map((node) => {
          const meta = NODE_TYPE_META[node.type];
          const assigneeName =
            node.data.assigneeType === "role"
              ? (node.data.assigneeRoleId && roleNames.get(node.data.assigneeRoleId)) ||
                "No role selected"
              : node.data.assigneeType === "team"
                ? (node.data.assigneeTeamId && teamNames.get(node.data.assigneeTeamId)) ||
                  "No team selected"
                : null;

          return (
            <Stack key={node.id} className="gap-1 rounded-md border border-border p-3">
              <Cluster className="justify-between">
                <Text>{node.data.label || "Untitled step"}</Text>
                <StatusBadge status="neutral">{meta?.label ?? node.type}</StatusBadge>
              </Cluster>
              {assigneeName && (
                <Text className="text-xs text-muted">Assigned to {assigneeName}</Text>
              )}
              {node.type === "evidence" && node.data.evidenceDescription && (
                <Text className="text-xs text-muted">{node.data.evidenceDescription}</Text>
              )}
              {node.type === "timer" && node.data.timerDurationMinutes && (
                <Text className="text-xs text-muted">
                  Waits {node.data.timerDurationMinutes} minutes
                </Text>
              )}
            </Stack>
          );
        })}
      </Stack>

      {graph.edges.length > 0 && (
        <Stack className="gap-2">
          <Text className="text-xs font-semibold text-muted">Connections</Text>
          {graph.edges.map((edge) => (
            <Text key={edge.id} className="text-xs text-muted">
              {edge.source} → {edge.target}
              {edge.condition ? ` (when "${edge.condition}")` : ""}
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
