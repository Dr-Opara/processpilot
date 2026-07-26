import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { listSlaDefinitions } from "@/lib/services/sla-config";
import { AppError } from "@/lib/errors";

export default async function SlaDefinitionsPage() {
  let definitions: Awaited<ReturnType<typeof listSlaDefinitions>> = [];
  let loadError: string | null = null;
  try {
    definitions = await listSlaDefinitions();
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load SLA definitions.";
  }

  return (
    <Stack className="mx-auto max-w-4xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">SLA definitions</Heading>
          <Text className="text-muted">
            Reusable target times and escalation rules for tasks, approvals, and workflows.
          </Text>
        </Stack>
        <Button href="/app/sla/definitions/new">Add SLA definition</Button>
      </Cluster>

      {loadError && <Alert title="Could not load SLA definitions" description={loadError} />}
      {!loadError && definitions.length === 0 && (
        <Alert
          title="No SLA definitions yet"
          description="Add one to enable due-date tracking and escalation."
        />
      )}

      {!loadError && definitions.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Applies to</th>
                <th className="py-2 pr-4 font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {definitions.map((definition) => (
                <tr key={definition.id} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <a
                      href={`/app/sla/definitions/${definition.id}`}
                      className="font-medium text-cobalt"
                    >
                      {definition.name}
                    </a>
                  </td>
                  <td className="py-3 pr-4">{definition.target_type}</td>
                  <td className="py-3 pr-4">{definition.target_minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </Stack>
  );
}
