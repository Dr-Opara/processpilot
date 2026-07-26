"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Text } from "@/components/ui/Typography";
import { Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import type { ProcessGraphDefinition } from "@/lib/db/database.types";
import { NODE_PALETTE, NODE_TYPE_META } from "./nodePalette";
import { TEMPLATE_LABELS, buildTemplateGraph, type TemplateKey } from "./templates";
import {
  toCanvasNodes,
  toCanvasEdges,
  fromCanvas,
  nextId,
  type CanvasNode,
  type CanvasNodeData,
  type CanvasEdge,
  type CanvasEdgeData,
} from "./graphTypes";
import { NodeConfigPanel } from "./NodeConfigPanel";
import { validateGraphAction } from "../../actions";
import type { GraphValidationError } from "@/lib/services/process-graph-validation";

interface Option {
  id: string;
  name: string;
}

function ProcessNodeRenderer({ data, selected }: NodeProps<CanvasNode>) {
  const meta = NODE_TYPE_META[(data as CanvasNodeData).nodeType];
  const nodeData = data as CanvasNodeData;
  return (
    <div
      className={`min-w-[170px] rounded-xl border-2 bg-surface px-3 py-2 shadow-sm ${selected ? "border-cobalt" : "border-border"}`}
      style={{ borderLeftColor: meta.color, borderLeftWidth: 6 }}
    >
      {nodeData.nodeType !== "start" && (
        <Handle type="target" position={Position.Top} className="!bg-muted" />
      )}
      <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {meta.label}
      </Text>
      <Text className="text-sm font-medium text-ink">{nodeData.label || "Untitled step"}</Text>
      {nodeData.nodeType !== "end" && (
        <Handle type="source" position={Position.Bottom} className="!bg-muted" />
      )}
    </div>
  );
}

const nodeTypes = { processNode: ProcessNodeRenderer };

type Selection = { kind: "node"; id: string } | { kind: "edge"; id: string } | null;

function CanvasInner({
  draftKey,
  initialGraph,
  roles,
  teams,
  forms,
  approvalPolicies,
  slaDefinitions,
  onGraphChange,
}: {
  draftKey: string;
  initialGraph: ProcessGraphDefinition;
  roles: Option[];
  teams: Option[];
  forms: Option[];
  approvalPolicies: Option[];
  slaDefinitions: Option[];
  onGraphChange: (graph: ProcessGraphDefinition) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(
    toCanvasNodes(initialGraph.nodes),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>(
    toCanvasEdges(initialGraph.edges),
  );
  const [selection, setSelection] = useState<Selection>(null);
  const [errors, setErrors] = useState<GraphValidationError[]>([]);
  const [isValidating, startValidating] = useTransition();
  const [hasLocalDraft, setHasLocalDraft] = useState(() => {
    try {
      return Boolean(localStorage.getItem(draftKey));
    } catch {
      return false;
    }
  });
  const { fitView } = useReactFlow();

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const historyRef = useRef<{ nodes: CanvasNode[]; edges: CanvasEdge[] }[]>([{ nodes, edges }]);
  const historyIndexRef = useRef(0);
  const applyingHistoryRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePush = useCallback(() => {
    if (applyingHistoryRef.current) return;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      const snapshot = { nodes: nodesRef.current, edges: edgesRef.current };
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(snapshot);
      if (historyRef.current.length > 50) historyRef.current.shift();
      historyIndexRef.current = historyRef.current.length - 1;
    }, 400);
  }, []);

  useEffect(() => {
    schedulePush();
    onGraphChange(fromCanvas(nodes, edges));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // Live validation, debounced — mirrors the server-side rules submitForReview enforces.
  useEffect(() => {
    const timer = setTimeout(() => {
      const graph = fromCanvas(nodesRef.current, edgesRef.current);
      startValidating(async () => {
        try {
          const result = await validateGraphAction(graph);
          setErrors(result);
        } catch {
          // Invalid shape mid-edit (e.g. a node briefly missing required fields) — ignore until it settles.
        }
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [nodes, edges]);

  // Local-draft crash recovery: saved on every change, offered back only on explicit request.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            savedAt: Date.now(),
            graph: fromCanvas(nodesRef.current, edgesRef.current),
          }),
        );
      } catch {
        // Storage unavailable/full — autosave is a convenience, not a requirement.
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [nodes, edges, draftKey]);

  function applySnapshot(snapshot: { nodes: CanvasNode[]; edges: CanvasEdge[] }) {
    applyingHistoryRef.current = true;
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setSelection(null);
    setTimeout(() => {
      applyingHistoryRef.current = false;
    }, 0);
  }

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge<CanvasEdge>({ ...connection, id: nextId("edge"), data: { condition: null } }, eds),
      );
    },
    [setEdges],
  );

  function addNode(type: (typeof NODE_PALETTE)[number]) {
    const id = nextId("node");
    const offset = nodes.length * 40;
    const node: CanvasNode = {
      id,
      type: "processNode",
      position: { x: 120 + (offset % 480), y: 120 + Math.floor(offset / 480) * 140 },
      data: { label: type.label, nodeType: type.type },
    };
    setNodes((nds) => [...nds, node]);
    setSelection({ kind: "node", id });
  }

  function deleteSelected() {
    if (!selection) return;
    if (selection.kind === "node") {
      setNodes((nds) => nds.filter((n) => n.id !== selection.id));
      setEdges((eds) => eds.filter((e) => e.source !== selection.id && e.target !== selection.id));
    } else {
      setEdges((eds) => eds.filter((e) => e.id !== selection.id));
    }
    setSelection(null);
  }

  function duplicateSelected() {
    if (!selection || selection.kind !== "node") return;
    const source = nodes.find((n) => n.id === selection.id);
    if (!source) return;
    const id = nextId("node");
    const clone: CanvasNode = {
      ...source,
      id,
      selected: false,
      position: { x: source.position.x + 40, y: source.position.y + 40 },
    };
    setNodes((nds) => [...nds, clone]);
    setSelection({ kind: "node", id });
  }

  function applyTemplate(key: TemplateKey) {
    const graph = buildTemplateGraph(key);
    setNodes(toCanvasNodes(graph.nodes));
    setEdges(toCanvasEdges(graph.edges));
    setSelection(null);
  }

  function restoreLocalDraft() {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { graph: ProcessGraphDefinition };
      setNodes(toCanvasNodes(parsed.graph.nodes));
      setEdges(toCanvasEdges(parsed.graph.edges));
      setSelection(null);
      setHasLocalDraft(false);
    } catch {
      // Corrupt/incompatible saved draft — leave the current graph untouched.
    }
  }

  function updateNodeData(id: string, patch: Partial<CanvasNodeData>) {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  }

  function updateEdgeData(id: string, patch: Partial<CanvasEdgeData> & { label?: string }) {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== id) return e;
        const { label, ...rest } = patch;
        return {
          ...e,
          ...(label !== undefined ? { label } : {}),
          data: { ...e.data, ...rest },
        };
      }),
    );
  }

  const currentSelection = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "node") {
      const node = nodes.find((n) => n.id === selection.id);
      return node ? ({ kind: "node", node } as const) : null;
    }
    const edge = edges.find((e) => e.id === selection.id);
    return edge ? ({ kind: "edge", edge } as const) : null;
  }, [selection, nodes, edges]);

  return (
    <div
      className="flex flex-col gap-2"
      onKeyDown={(e) => {
        const meta = e.ctrlKey || e.metaKey;
        if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (
          meta &&
          (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))
        ) {
          e.preventDefault();
          redo();
        } else if (meta && e.key.toLowerCase() === "d" && selection?.kind === "node") {
          e.preventDefault();
          duplicateSelected();
        }
      }}
    >
      <Cluster className="flex-wrap items-center gap-2">
        <Select
          className="w-44"
          defaultValue=""
          onChange={(e) => {
            if (!e.target.value) return;
            addNode(NODE_PALETTE.find((n) => n.type === e.target.value)!);
            e.target.value = "";
          }}
        >
          <option value="">Add a step…</option>
          {NODE_PALETTE.map((item) => (
            <option key={item.type} value={item.type}>
              {item.label}
            </option>
          ))}
        </Select>
        <Select
          className="w-44"
          defaultValue=""
          onChange={(e) => {
            if (!e.target.value) return;
            applyTemplate(e.target.value as TemplateKey);
            e.target.value = "";
          }}
        >
          <option value="">Load a template…</option>
          {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Button type="button" variant="quiet" onClick={undo}>
          Undo
        </Button>
        <Button type="button" variant="quiet" onClick={redo}>
          Redo
        </Button>
        <Button type="button" variant="quiet" onClick={() => fitView({ duration: 200 })}>
          Fit to screen
        </Button>
        {hasLocalDraft && (
          <Button type="button" variant="quiet" onClick={restoreLocalDraft}>
            Restore autosaved draft
          </Button>
        )}
      </Cluster>

      <div className="grid grid-cols-[1fr_280px] gap-3">
        <div style={{ height: 560 }} className="overflow-hidden rounded-2xl border border-border">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelection({ kind: "node", id: node.id })}
            onEdgeClick={(_, edge) => setSelection({ kind: "edge", id: edge.id })}
            onPaneClick={() => setSelection(null)}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
            <Panel position="top-right">
              <Text className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
                {isValidating
                  ? "Validating…"
                  : errors.length === 0
                    ? "No validation errors"
                    : `${errors.length} validation issue${errors.length === 1 ? "" : "s"}`}
              </Text>
            </Panel>
          </ReactFlow>
        </div>
        <div className="overflow-y-auto rounded-2xl border border-border" style={{ height: 560 }}>
          <NodeConfigPanel
            selection={currentSelection}
            roles={roles}
            teams={teams}
            forms={forms}
            approvalPolicies={approvalPolicies}
            slaDefinitions={slaDefinitions}
            onChangeNode={updateNodeData}
            onChangeEdge={updateEdgeData}
            onDelete={deleteSelected}
            onDuplicate={duplicateSelected}
          />
        </div>
      </div>

      {errors.length > 0 && (
        <Alert
          title={`${errors.length} validation issue${errors.length === 1 ? "" : "s"}`}
          description={errors.map((e) => e.message).join(" · ")}
        />
      )}
    </div>
  );
}

export function ProcessCanvas({
  draftKey,
  initialGraph,
  roles,
  teams,
  forms,
  approvalPolicies,
  slaDefinitions,
  onGraphChange,
}: {
  draftKey: string;
  initialGraph?: ProcessGraphDefinition;
  roles: Option[];
  teams: Option[];
  forms: Option[];
  approvalPolicies: Option[];
  slaDefinitions: Option[];
  onGraphChange: (graph: ProcessGraphDefinition) => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner
        draftKey={draftKey}
        initialGraph={initialGraph ?? buildTemplateGraph("blank")}
        roles={roles}
        teams={teams}
        forms={forms}
        approvalPolicies={approvalPolicies}
        slaDefinitions={slaDefinitions}
        onGraphChange={onGraphChange}
      />
    </ReactFlowProvider>
  );
}
