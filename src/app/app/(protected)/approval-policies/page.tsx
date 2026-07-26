import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listApprovalPolicies } from "@/lib/services/approval-policies";
import { AppError } from "@/lib/errors";
import { archiveApprovalPolicyAction, restoreApprovalPolicyAction } from "./actions";

export default async function ApprovalPoliciesPage() {
  let policies: Awaited<ReturnType<typeof listApprovalPolicies>> = [];
  let loadError: string | null = null;
  try {
    policies = await listApprovalPolicies({ status: "all" });
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load approval policies.";
  }

  return (
    <Stack className="mx-auto max-w-4xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Approval policies</Heading>
          <Text className="text-muted">
            Reusable multi-approver strategies for process approval steps.
          </Text>
        </Stack>
        <Button href="/app/approval-policies/new">Add policy</Button>
      </Cluster>

      {loadError && <Alert title="Could not load approval policies" description={loadError} />}
      {!loadError && policies.length === 0 && (
        <Alert
          title="No approval policies yet"
          description="Add one to enable configurable approval chains."
        />
      )}

      {!loadError && policies.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Strategy</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-medium">{policy.name}</td>
                  <td className="py-3 pr-4">{policy.strategy}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={policy.status === "active" ? "success" : "neutral"}>
                      {policy.status}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4">
                    {policy.status === "active" ? (
                      <form action={archiveApprovalPolicyAction.bind(null, policy.id)}>
                        <Button type="submit" variant="secondary">
                          Archive
                        </Button>
                      </form>
                    ) : (
                      <form action={restoreApprovalPolicyAction.bind(null, policy.id)}>
                        <Button type="submit" variant="secondary">
                          Restore
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </Stack>
  );
}
