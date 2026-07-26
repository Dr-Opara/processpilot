"use client";

import { Label, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import type { ProcessNodeFormField } from "@/lib/db/database.types";
import { NODE_PALETTE } from "./nodePalette";
import type { CanvasEdge, CanvasEdgeData, CanvasNode, CanvasNodeData } from "./graphTypes";

interface Option {
  id: string;
  name: string;
}

export function NodeConfigPanel({
  selection,
  roles,
  teams,
  forms,
  approvalPolicies,
  slaDefinitions,
  onChangeNode,
  onChangeEdge,
  onDelete,
  onDuplicate,
}: {
  selection: { kind: "node"; node: CanvasNode } | { kind: "edge"; edge: CanvasEdge } | null;
  roles: Option[];
  teams: Option[];
  forms: Option[];
  approvalPolicies: Option[];
  slaDefinitions: Option[];
  onChangeNode: (id: string, data: Partial<CanvasNodeData>) => void;
  onChangeEdge: (id: string, data: Partial<CanvasEdgeData> & { label?: string }) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  if (!selection) {
    return (
      <Stack className="gap-2 p-4">
        <Text className="text-sm font-semibold text-ink">Nothing selected</Text>
        <Text className="text-xs text-muted">
          Click a step to edit its configuration, or an arrow to edit a connection.
        </Text>
      </Stack>
    );
  }

  if (selection.kind === "edge") {
    const { edge } = selection;
    return (
      <Stack className="gap-4 p-4">
        <Cluster className="justify-between">
          <Text className="text-sm font-semibold text-ink">Connection</Text>
          <Button variant="quiet" className="px-2 py-1 text-xs" onClick={onDelete}>
            Delete
          </Button>
        </Cluster>
        <Stack className="gap-1">
          <Label htmlFor="edge-label">Label (optional)</Label>
          <Input
            id="edge-label"
            defaultValue={typeof edge.label === "string" ? edge.label : ""}
            onChange={(e) => onChangeEdge(edge.id, { label: e.target.value })}
          />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="edge-condition">Branch condition</Label>
          <Input
            id="edge-condition"
            placeholder="e.g. amount > 1000"
            defaultValue={edge.data?.condition ?? ""}
            onChange={(e) => onChangeEdge(edge.id, { condition: e.target.value || null })}
          />
          <Text className="text-xs text-muted">
            Required on every branch leaving a decision step.
          </Text>
        </Stack>
      </Stack>
    );
  }

  const { node } = selection;
  const meta = NODE_PALETTE.find((item) => item.type === node.data.nodeType);
  const data = node.data;

  function update(patch: Partial<CanvasNodeData>) {
    onChangeNode(node.id, patch);
  }

  function updateFormField(index: number, patch: Partial<ProcessNodeFormField>) {
    const fields = [...(data.formFields ?? [])];
    fields[index] = { ...fields[index], ...patch };
    update({ formFields: fields });
  }

  function addFormField() {
    update({ formFields: [...(data.formFields ?? []), { label: "", type: "text" }] });
  }

  function removeFormField(index: number) {
    update({ formFields: (data.formFields ?? []).filter((_, i) => i !== index) });
  }

  return (
    <Stack className="gap-4 p-4">
      <Cluster className="justify-between">
        <Text className="text-sm font-semibold text-ink">{meta?.label ?? node.data.nodeType}</Text>
        <Cluster className="gap-2">
          <Button variant="quiet" className="px-2 py-1 text-xs" onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button variant="quiet" className="px-2 py-1 text-xs" onClick={onDelete}>
            Delete
          </Button>
        </Cluster>
      </Cluster>

      <Stack className="gap-1">
        <Label htmlFor="node-label">Label</Label>
        <Input
          id="node-label"
          value={data.label}
          onChange={(e) => update({ label: e.target.value })}
        />
      </Stack>

      {(data.nodeType === "human_task" || data.nodeType === "approval") && (
        <Stack className="gap-2 rounded-md border border-border p-3">
          <Label htmlFor="assignee-type">Assignee</Label>
          <Select
            id="assignee-type"
            value={data.assigneeType ?? ""}
            onChange={(e) =>
              update({
                assigneeType: (e.target.value || null) as CanvasNodeData["assigneeType"],
                assigneeRoleId: null,
                assigneeTeamId: null,
              })
            }
          >
            <option value="">Not set</option>
            <option value="role">Role</option>
            <option value="team">Team</option>
          </Select>
          {data.assigneeType === "role" && (
            <Select
              value={data.assigneeRoleId ?? ""}
              onChange={(e) => update({ assigneeRoleId: e.target.value || null })}
            >
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          )}
          {data.assigneeType === "team" && (
            <Select
              value={data.assigneeTeamId ?? ""}
              onChange={(e) => update({ assigneeTeamId: e.target.value || null })}
            >
              <option value="">Select a team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          )}
        </Stack>
      )}

      {data.nodeType !== "start" && data.nodeType !== "end" && (
        <Cluster className="items-center gap-2">
          <Checkbox
            id="node-required"
            checked={Boolean(data.required)}
            onChange={(e) => update({ required: e.target.checked })}
          />
          <Label htmlFor="node-required">Required</Label>
        </Cluster>
      )}

      {data.nodeType === "approval" && (
        <Stack className="gap-1">
          <Label htmlFor="node-approval-policy-id">Approval policy (optional)</Label>
          <Select
            id="node-approval-policy-id"
            value={data.approvalPolicyId ?? ""}
            onChange={(e) => update({ approvalPolicyId: e.target.value || null })}
          >
            <option value="">Single assignee (no policy)</option>
            {approvalPolicies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.name}
              </option>
            ))}
          </Select>
          <Text className="text-xs text-muted">
            When set, this step requires the policy&rsquo;s configured multi-approver chain instead
            of the assignee above.
          </Text>
        </Stack>
      )}

      {data.nodeType !== "start" &&
        data.nodeType !== "end" &&
        data.nodeType !== "parallel_split" &&
        data.nodeType !== "parallel_join" &&
        data.nodeType !== "decision" && (
          <Stack className="gap-1">
            <Label htmlFor="node-sla-definition-id">SLA (optional)</Label>
            <Select
              id="node-sla-definition-id"
              value={data.slaDefinitionId ?? ""}
              onChange={(e) => update({ slaDefinitionId: e.target.value || null })}
            >
              <option value="">No SLA target</option>
              {slaDefinitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </Select>
          </Stack>
        )}

      {data.nodeType === "form" && (
        <Stack className="gap-1">
          <Label htmlFor="node-form-id">Linked form (optional)</Label>
          <Select
            id="node-form-id"
            value={data.formId ?? ""}
            onChange={(e) => update({ formId: e.target.value || null })}
          >
            <option value="">Generic capture (no linked form)</option>
            {forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.name}
              </option>
            ))}
          </Select>
          <Text className="text-xs text-muted">
            When set, this step renders the linked published form (Forms) instead of the generic
            fields below.
          </Text>
        </Stack>
      )}

      {data.nodeType === "form" && (
        <Stack className="gap-2 rounded-md border border-border p-3">
          <Text className="text-xs font-semibold text-muted">
            Generic fields (used only when no form is linked above)
          </Text>
          {(data.formFields ?? []).map((field, index) => (
            <Cluster key={index} className="gap-2">
              <Input
                placeholder="Field label"
                value={field.label}
                onChange={(e) => updateFormField(index, { label: e.target.value })}
              />
              <Select
                value={field.type}
                onChange={(e) =>
                  updateFormField(index, { type: e.target.value as ProcessNodeFormField["type"] })
                }
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="checkbox">Checkbox</option>
              </Select>
              <Button
                variant="quiet"
                className="px-2 py-1 text-xs"
                onClick={() => removeFormField(index)}
              >
                Remove
              </Button>
            </Cluster>
          ))}
          <Button variant="secondary" className="w-fit" onClick={addFormField}>
            Add field
          </Button>
        </Stack>
      )}

      {data.nodeType === "evidence" && (
        <Stack className="gap-1">
          <Label htmlFor="evidence-description">What evidence is required</Label>
          <Textarea
            id="evidence-description"
            rows={3}
            value={data.evidenceDescription ?? ""}
            onChange={(e) => update({ evidenceDescription: e.target.value })}
          />
        </Stack>
      )}

      {data.nodeType === "timer" && (
        <Stack className="gap-1">
          <Label htmlFor="timer-duration">Duration (minutes)</Label>
          <Input
            id="timer-duration"
            type="number"
            min={1}
            value={data.timerDurationMinutes ?? ""}
            onChange={(e) => update({ timerDurationMinutes: Number(e.target.value) || null })}
          />
        </Stack>
      )}

      {data.nodeType === "notification" && (
        <Stack className="gap-1">
          <Label htmlFor="notification-message">Message</Label>
          <Textarea
            id="notification-message"
            rows={3}
            value={data.notificationMessage ?? ""}
            onChange={(e) => update({ notificationMessage: e.target.value })}
          />
        </Stack>
      )}

      {data.nodeType === "subprocess" && (
        <Stack className="gap-1">
          <Label htmlFor="subprocess-id">Subprocess id</Label>
          <Input
            id="subprocess-id"
            value={data.subprocessId ?? ""}
            onChange={(e) => update({ subprocessId: e.target.value || null })}
          />
        </Stack>
      )}

      {data.nodeType === "system_action" && (
        <Stack className="gap-1">
          <Label htmlFor="system-action-type">Action type</Label>
          <Input
            id="system-action-type"
            value={data.systemActionType ?? ""}
            onChange={(e) => update({ systemActionType: e.target.value || null })}
          />
        </Stack>
      )}
    </Stack>
  );
}
