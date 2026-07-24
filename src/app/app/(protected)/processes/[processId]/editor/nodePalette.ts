import type { ProcessNodeType } from "@/lib/db/database.types";

export interface NodeTypeMeta {
  type: ProcessNodeType;
  label: string;
  color: string;
  description: string;
}

/** Palette order/metadata for every node type the visual editor supports. */
export const NODE_PALETTE: NodeTypeMeta[] = [
  { type: "start", label: "Start", color: "#16a34a", description: "Where the workflow begins" },
  { type: "end", label: "End", color: "#dc2626", description: "Where the workflow completes" },
  {
    type: "human_task",
    label: "Human Task",
    color: "#2563eb",
    description: "Work assigned to a role or team",
  },
  {
    type: "approval",
    label: "Approval",
    color: "#7c3aed",
    description: "A decision to approve or reject",
  },
  {
    type: "decision",
    label: "Decision",
    color: "#d97706",
    description: "Branches based on a condition",
  },
  {
    type: "parallel_split",
    label: "Parallel Split",
    color: "#0891b2",
    description: "Starts concurrent branches",
  },
  {
    type: "parallel_join",
    label: "Parallel Join",
    color: "#0e7490",
    description: "Waits for concurrent branches",
  },
  { type: "timer", label: "Timer", color: "#64748b", description: "Waits a fixed duration" },
  { type: "notification", label: "Notification", color: "#db2777", description: "Sends a message" },
  {
    type: "subprocess",
    label: "Subprocess",
    color: "#4f46e5",
    description: "Runs another process",
  },
  { type: "form", label: "Form", color: "#0d9488", description: "Collects structured data" },
  {
    type: "evidence",
    label: "Evidence",
    color: "#ca8a04",
    description: "Requires an uploaded artifact",
  },
  {
    type: "system_action",
    label: "System Action",
    color: "#334155",
    description: "An automated action",
  },
];

export const NODE_TYPE_META: Record<ProcessNodeType, NodeTypeMeta> = Object.fromEntries(
  NODE_PALETTE.map((meta) => [meta.type, meta]),
) as Record<ProcessNodeType, NodeTypeMeta>;
