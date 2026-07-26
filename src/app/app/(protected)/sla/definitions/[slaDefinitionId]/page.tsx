import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { getSlaDefinition } from "@/lib/services/sla-config";
import { listEscalationRules } from "@/lib/services/escalation";
import { AppError } from "@/lib/errors";
import { createEscalationRuleAction, deleteEscalationRuleAction } from "../../actions";

export default async function SlaDefinitionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slaDefinitionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slaDefinitionId } = await params;
  const { error } = await searchParams;

  let definition;
  try {
    definition = await getSlaDefinition(slaDefinitionId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }
  const rules = await listEscalationRules(slaDefinitionId).catch(() => []);

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Stack className="gap-1">
        <Heading as="h1">{definition.name}</Heading>
        <Text className="text-muted">
          {definition.target_type} · {definition.target_minutes} min target
          {definition.reminder_minutes_before_due.length > 0
            ? ` · reminders at ${definition.reminder_minutes_before_due.join(", ")} min before due`
            : ""}
        </Text>
      </Stack>

      {error && <Alert title="Could not save" description={error} />}

      <Stack className="gap-3 rounded-md border border-border p-4">
        <Heading as="h2">Add escalation level</Heading>
        <form
          action={createEscalationRuleAction.bind(null, slaDefinitionId)}
          className="flex flex-col gap-3"
        >
          <Cluster className="gap-3">
            <Stack className="gap-1">
              <Label htmlFor="level">Level</Label>
              <Input
                id="level"
                name="level"
                type="number"
                min={1}
                defaultValue={rules.length + 1}
                required
                className="w-24"
              />
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="triggerAfterMinutesPastDue">Minutes past due</Label>
              <Input
                id="triggerAfterMinutesPastDue"
                name="triggerAfterMinutesPastDue"
                type="number"
                min={0}
                required
                className="w-32"
              />
            </Stack>
          </Cluster>
          <Stack className="gap-1">
            <Label htmlFor="action">Action</Label>
            <Select id="action" name="action" defaultValue="remind" className="w-56">
              <option value="remind">Remind</option>
              <option value="reassign">Reassign to a specific member</option>
              <option value="escalate_manager">Escalate to assignee&rsquo;s manager</option>
              <option value="escalate_process_owner">Escalate to process owner</option>
              <option value="escalate_admin">Escalate to an organization admin</option>
            </Select>
          </Stack>
          <Stack className="gap-1">
            <Label htmlFor="reassignValue">
              Reassign target member id (only for &quot;Reassign&quot;)
            </Label>
            <Input id="reassignValue" name="reassignValue" />
          </Stack>
          <Cluster className="justify-end">
            <Button type="submit">Add level</Button>
          </Cluster>
        </form>
      </Stack>

      <Stack className="gap-3">
        <Heading as="h2">Escalation levels</Heading>
        {rules.length === 0 ? (
          <Text className="text-muted">No escalation levels configured yet.</Text>
        ) : (
          <ScrollArea>
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4 font-medium">Level</th>
                  <th className="py-2 pr-4 font-medium">Trigger</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-border/60">
                    <td className="py-2 pr-4">{rule.level}</td>
                    <td className="py-2 pr-4">
                      {rule.trigger_after_minutes_past_due} min past due
                    </td>
                    <td className="py-2 pr-4">{rule.action}</td>
                    <td className="py-2 pr-4">
                      <form
                        action={deleteEscalationRuleAction.bind(null, slaDefinitionId, rule.id)}
                      >
                        <Button type="submit" variant="secondary">
                          Remove
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Stack>
    </Stack>
  );
}
