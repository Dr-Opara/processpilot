import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getExtendedOrganizationSettings } from "@/lib/services/organization-settings-extended";
import { listApprovedDomains, verificationRecordFor } from "@/lib/services/approved-domains";
import { getActiveOrganizationDeletionRequest } from "@/lib/services/organization-deletion";
import { getCurrentMembership } from "@/lib/authz";
import { listMembers } from "@/lib/services/members";
import { memberDisplayName } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import {
  addApprovedDomainAction,
  cancelOrganizationDeletionAction,
  removeApprovedDomainAction,
  requestOrganizationDeletionAction,
  transferOwnershipAction,
  updateBrandingAction,
  updateDataRetentionSettingsAction,
  updateSecuritySettingsAction,
  verifyApprovedDomainAction,
} from "./actions";

export default async function OrganizationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const membership = await getCurrentMembership();
  const isOwner = membership.permissions.includes("organization.manage");

  let extended: Awaited<ReturnType<typeof getExtendedOrganizationSettings>> | null = null;
  let domains: Awaited<ReturnType<typeof listApprovedDomains>> = [];
  let deletionRequest: Awaited<ReturnType<typeof getActiveOrganizationDeletionRequest>> = null;
  let loadError: string | null = null;
  try {
    [extended, domains, deletionRequest] = await Promise.all([
      getExtendedOrganizationSettings(),
      listApprovedDomains(),
      getActiveOrganizationDeletionRequest(),
    ]);
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load organization settings.";
  }

  const otherActiveMembers = isOwner
    ? (
        await listMembers({ status: "active", pageSize: 100 }).catch(() => ({ members: [] }))
      ).members.filter((m) => m.id !== membership.member.id)
    : [];

  return (
    <Stack className="mx-auto max-w-2xl gap-8">
      <Stack className="gap-1">
        <Heading as="h1">Organization settings</Heading>
        <Text className="text-muted">Branding, security, data retention, and domains.</Text>
      </Stack>

      {(loadError ?? error) && (
        <Alert title="Something went wrong" description={loadError ?? error ?? ""} />
      )}

      {extended && (
        <>
          <Stack className="gap-3 rounded-md border border-border p-4">
            <Heading as="h2" className="text-lg">
              Branding
            </Heading>
            <form action={updateBrandingAction} className="flex flex-col gap-3">
              <Stack className="gap-1">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  name="logoUrl"
                  type="url"
                  defaultValue={extended.branding.logoUrl ?? ""}
                />
              </Stack>
              <Stack className="gap-1">
                <Label htmlFor="brandColor">Brand color</Label>
                <Input
                  id="brandColor"
                  name="brandColor"
                  placeholder="#1A2B3C"
                  defaultValue={extended.branding.brandColor ?? ""}
                />
              </Stack>
              <Stack className="gap-1">
                <Label htmlFor="locale">Locale</Label>
                <Input id="locale" name="locale" defaultValue={extended.branding.locale} required />
              </Stack>
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Save branding
                </Button>
              </Cluster>
            </form>
          </Stack>

          <Stack className="gap-3 rounded-md border border-border p-4">
            <Heading as="h2" className="text-lg">
              Security &amp; session policy
            </Heading>
            <Text className="text-xs text-muted">
              Stored preferences only — session lifetime is governed by the identity provider at the
              instance level today, not enforced per-organization yet. See
              docs/architecture/organization-administration.md.
            </Text>
            <form action={updateSecuritySettingsAction} className="flex flex-col gap-3">
              <Stack className="gap-1">
                <Label htmlFor="sessionIdleTimeoutMinutes">Session idle timeout (minutes)</Label>
                <Input
                  id="sessionIdleTimeoutMinutes"
                  name="sessionIdleTimeoutMinutes"
                  type="number"
                  min={5}
                  max={10080}
                  defaultValue={extended.security.sessionIdleTimeoutMinutes ?? ""}
                />
              </Stack>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  name="requireVerifiedDomainSignup"
                  defaultChecked={extended.security.requireVerifiedDomainSignup}
                />
                Require a verified approved domain for new sign-ups
              </label>
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Save security settings
                </Button>
              </Cluster>
            </form>
          </Stack>

          <Stack className="gap-3 rounded-md border border-border p-4">
            <Heading as="h2" className="text-lg">
              Data retention
            </Heading>
            <Text className="text-xs text-muted">
              Stored preferences only — not yet wired to an automatic purge job.
            </Text>
            <form action={updateDataRetentionSettingsAction} className="flex flex-col gap-3">
              <Stack className="gap-1">
                <Label htmlFor="auditRetentionDays">Audit event retention (days)</Label>
                <Input
                  id="auditRetentionDays"
                  name="auditRetentionDays"
                  type="number"
                  min={30}
                  max={3650}
                  defaultValue={extended.dataRetention.auditRetentionDays ?? ""}
                />
              </Stack>
              <Stack className="gap-1">
                <Label htmlFor="evidenceRetentionDays">Evidence retention (days)</Label>
                <Input
                  id="evidenceRetentionDays"
                  name="evidenceRetentionDays"
                  type="number"
                  min={30}
                  max={3650}
                  defaultValue={extended.dataRetention.evidenceRetentionDays ?? ""}
                />
              </Stack>
              <Stack className="gap-1">
                <Label htmlFor="exceptionRetentionDays">Exception retention (days)</Label>
                <Input
                  id="exceptionRetentionDays"
                  name="exceptionRetentionDays"
                  type="number"
                  min={30}
                  max={3650}
                  defaultValue={extended.dataRetention.exceptionRetentionDays ?? ""}
                />
              </Stack>
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Save retention settings
                </Button>
              </Cluster>
            </form>
          </Stack>

          <Stack className="gap-3 rounded-md border border-border p-4">
            <Heading as="h2" className="text-lg">
              Approved domains
            </Heading>
            <Text className="text-xs text-muted">
              Verified with a real DNS TXT lookup — add the domain, publish the shown TXT record,
              then verify.
            </Text>
            {domains.length === 0 && <Text className="text-sm text-muted">No domains added.</Text>}
            {domains.map((domain) => {
              const record = verificationRecordFor(domain.domain, domain.verification_token);
              return (
                <Stack key={domain.id} className="gap-1 rounded-md border border-border/60 p-3">
                  <Cluster className="justify-between">
                    <Text className="font-medium">{domain.domain}</Text>
                    <StatusBadge status={domain.verified_at ? "success" : "warning"}>
                      {domain.verified_at ? "Verified" : "Unverified"}
                    </StatusBadge>
                  </Cluster>
                  {!domain.verified_at && (
                    <Text className="break-all font-mono text-xs text-muted">
                      TXT {record.host} = &quot;{record.value}&quot;
                    </Text>
                  )}
                  <Cluster className="gap-2">
                    {!domain.verified_at && (
                      <form action={verifyApprovedDomainAction.bind(null, domain.id)}>
                        <Button type="submit" variant="secondary">
                          Check DNS &amp; verify
                        </Button>
                      </form>
                    )}
                    <form action={removeApprovedDomainAction.bind(null, domain.id)}>
                      <Button type="submit" variant="secondary">
                        Remove
                      </Button>
                    </form>
                  </Cluster>
                </Stack>
              );
            })}
            <form action={addApprovedDomainAction} className="flex items-end gap-2">
              <Stack className="flex-1 gap-1">
                <Label htmlFor="domain">Add a domain</Label>
                <Input id="domain" name="domain" placeholder="example.com" required />
              </Stack>
              <Button type="submit" variant="secondary">
                Add
              </Button>
            </form>
          </Stack>

          {isOwner && (
            <Stack className="gap-3 rounded-md border border-border p-4">
              <Heading as="h2" className="text-lg">
                Transfer ownership
              </Heading>
              <Text className="text-xs text-muted">
                Immediately makes the selected member the sole organization owner and removes your
                own owner role.
              </Text>
              <form action={transferOwnershipAction} className="flex items-end gap-2">
                <Stack className="flex-1 gap-1">
                  <Label htmlFor="newOwnerMemberId">New owner</Label>
                  <select
                    id="newOwnerMemberId"
                    name="newOwnerMemberId"
                    required
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  >
                    <option value="">Select a member</option>
                    {otherActiveMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {memberDisplayName(m)}
                      </option>
                    ))}
                  </select>
                </Stack>
                <Button type="submit" variant="secondary">
                  Transfer ownership
                </Button>
              </form>
            </Stack>
          )}

          {isOwner && (
            <Stack className="gap-3 rounded-md border border-border p-4">
              <Heading as="h2" className="text-lg text-red-700">
                Danger zone
              </Heading>
              {deletionRequest ? (
                <Stack className="gap-2">
                  <Alert
                    title="Deletion requested"
                    description={`Scheduled for ${new Date(deletionRequest.scheduled_delete_at).toLocaleString()}. Cancel any time before then.`}
                  />
                  <form action={cancelOrganizationDeletionAction.bind(null, deletionRequest.id)}>
                    <Button type="submit" variant="secondary">
                      Cancel deletion request
                    </Button>
                  </form>
                </Stack>
              ) : (
                <form action={requestOrganizationDeletionAction} className="flex flex-col gap-3">
                  <Text className="text-sm text-muted">
                    Type the organization&apos;s exact name (
                    <strong>{membership.organization.name}</strong>) to request deletion. There is a
                    14-day grace period during which this can be cancelled.
                  </Text>
                  <Input
                    name="confirmationOrgName"
                    placeholder={membership.organization.name}
                    required
                  />
                  <Input name="reason" placeholder="Reason (optional)" />
                  <Cluster className="justify-end">
                    <Button type="submit" variant="secondary">
                      Request organization deletion
                    </Button>
                  </Cluster>
                </form>
              )}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
