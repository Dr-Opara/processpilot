"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";

const RULE_TYPES = [
  "user",
  "role",
  "manager",
  "department_owner",
  "process_owner",
  "location_manager",
  "team_manager",
  "runtime_expression",
] as const;

interface RuleDraft {
  type: (typeof RULE_TYPES)[number];
  value: string;
}

export function ApprovalPolicyForm({
  action,
  cancelHref,
}: {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
}) {
  const [rules, setRules] = useState<RuleDraft[]>([{ type: "user", value: "" }]);
  const rulesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rulesRef.current) return;
    rulesRef.current.value = JSON.stringify(
      rules.map((r) => ({ type: r.type, value: r.value.trim() || null })),
    );
  }, [rules]);

  function updateRule(index: number, patch: Partial<RuleDraft>) {
    setRules((current) => current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input ref={rulesRef} type="hidden" name="approverRules" />

      <Stack className="gap-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required maxLength={300} autoFocus />
      </Stack>

      <Stack className="gap-1">
        <Label htmlFor="strategy">Strategy</Label>
        <Select id="strategy" name="strategy" defaultValue="unanimous" className="w-56">
          <option value="sequential">Sequential — approvers act in order</option>
          <option value="parallel">Parallel — everyone must approve, any order</option>
          <option value="unanimous">Unanimous — everyone must approve</option>
          <option value="majority">Majority — resolves on a strict majority</option>
          <option value="first_response">First response — first decision wins</option>
          <option value="any_one">Any one — any single approver can resolve it</option>
        </Select>
      </Stack>

      <Cluster className="gap-4">
        <Cluster className="items-center gap-2">
          <Checkbox id="allowDelegation" name="allowDelegation" defaultChecked />
          <Label htmlFor="allowDelegation">Allow delegation</Label>
        </Cluster>
        <Cluster className="items-center gap-2">
          <Checkbox id="allowAbstain" name="allowAbstain" />
          <Label htmlFor="allowAbstain">Allow abstain</Label>
        </Cluster>
        <Cluster className="items-center gap-2">
          <Checkbox id="preventSelfApproval" name="preventSelfApproval" />
          <Label htmlFor="preventSelfApproval">Prevent self-approval</Label>
        </Cluster>
      </Cluster>

      <Stack className="gap-3">
        <Label>Approvers</Label>
        {rules.map((rule, index) => (
          <Cluster key={index} className="flex-wrap gap-2">
            <Select
              value={rule.type}
              onChange={(e) => updateRule(index, { type: e.target.value as RuleDraft["type"] })}
              className="w-44"
            >
              {RULE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
            <Input
              value={rule.value}
              onChange={(e) => updateRule(index, { value: e.target.value })}
              placeholder="Member/role/location/team id, or nodeId.key for runtime expression (leave blank for manager/department/process owner)"
              className="min-w-[280px] flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRules((current) => current.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </Cluster>
        ))}
        <Cluster>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRules((current) => [...current, { type: "user", value: "" }])}
          >
            Add approver rule
          </Button>
        </Cluster>
      </Stack>

      <Cluster className="justify-end gap-3">
        <Button href={cancelHref} variant="secondary">
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </Cluster>
    </form>
  );
}
