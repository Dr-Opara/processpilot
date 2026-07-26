import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getCurrentMembership } from "@/lib/authz";
import { listAllCertifications, listMyCertifications } from "@/lib/services/certifications";
import { listMembers } from "@/lib/services/members";
import { memberDisplayName } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import type { CertificationStatus } from "@/lib/db/database.types";
import { renewCertificationAction, revokeCertificationAction } from "./actions";

function statusBadgeStatus(
  status: CertificationStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "revoked") return "danger";
  return "neutral";
}

export default async function CertificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const currentMembership = await getCurrentMembership().catch(() => null);
  const canManage = Boolean(
    currentMembership?.permissions.includes("training.manage") ||
    currentMembership?.scopedPermissions.includes("training.manage"),
  );

  let certifications: Awaited<ReturnType<typeof listAllCertifications>> = [];
  let loadError: string | null = null;
  try {
    certifications = canManage ? await listAllCertifications() : await listMyCertifications();
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load certifications.";
  }

  const membersResult = canManage
    ? await listMembers({ status: "active", pageSize: 100 }).catch(() => ({
        members: [],
        total: 0,
      }))
    : { members: [], total: 0 };
  const memberName = (memberId: string) => {
    const member = membersResult.members.find((m) => m.id === memberId);
    return member ? memberDisplayName(member) : memberId;
  };

  return (
    <Stack className="mx-auto max-w-3xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Certifications</Heading>
        <Text className="text-muted">
          {canManage ? "Certifications issued across the organization." : "Your certifications."}
        </Text>
      </Stack>

      {(error || loadError) && (
        <Alert title="Could not load certifications" description={error ?? loadError ?? ""} />
      )}
      {!loadError && certifications.length === 0 && (
        <Alert title="No certifications yet" description="Nothing issued so far." />
      )}

      {!loadError && certifications.length > 0 && (
        <Stack className="gap-3">
          {certifications.map((certification) => (
            <Stack key={certification.id} className="gap-2 rounded-md border border-border p-3">
              <Cluster className="justify-between">
                <Text className="text-sm font-medium">
                  {canManage ? memberName(certification.member_id) : "Certification"}
                </Text>
                <StatusBadge status={statusBadgeStatus(certification.status)}>
                  {certification.status}
                </StatusBadge>
              </Cluster>
              <Text className="text-xs text-muted">
                Issued {new Date(certification.issued_at).toLocaleDateString()}
                {certification.expires_at
                  ? ` · Expires ${new Date(certification.expires_at).toLocaleDateString()}`
                  : " · Does not expire"}
              </Text>
              {canManage && certification.status === "active" && (
                <Cluster className="flex-wrap gap-2">
                  <form
                    action={renewCertificationAction.bind(null, certification.id)}
                    className="flex items-center gap-2"
                  >
                    <Input name="newExpiresAt" type="date" />
                    <Button type="submit" variant="secondary">
                      Renew
                    </Button>
                  </form>
                  <form
                    action={revokeCertificationAction.bind(null, certification.id)}
                    className="flex items-center gap-2"
                  >
                    <Textarea
                      name="reason"
                      rows={1}
                      placeholder="Revocation reason"
                      required
                      className="w-56"
                    />
                    <Button type="submit" variant="secondary">
                      Revoke
                    </Button>
                  </form>
                </Cluster>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
