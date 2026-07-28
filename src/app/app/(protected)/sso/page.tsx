import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listSsoConnections } from "@/lib/services/sso";
import { AppError } from "@/lib/errors";
import {
  createSsoConnectionAction,
  deleteSsoConnectionAction,
  setSsoConnectionActiveAction,
} from "./actions";

const inputClassName =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/20";

export default async function SsoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  let connections: Awaited<ReturnType<typeof listSsoConnections>> = [];
  let loadError: string | null = null;
  try {
    connections = await listSsoConnections();
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load SSO connections.";
  }

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Stack className="gap-1">
        <Heading as="h1">Single sign-on</Heading>
        <Text className="text-muted">
          Connect a SAML or OIDC identity provider for a specific email domain. Password and
          Clerk-native sign-in remain available for every member regardless of what&apos;s
          configured here.
        </Text>
      </Stack>

      <Alert
        title="Credentials are stored by Clerk, not ProcessPilot"
        description="The certificate/client secret you enter below is sent directly to Clerk's Enterprise Connections API and is never persisted in ProcessPilot's own database — see docs/architecture/integration-architecture.md."
      />

      {(error || loadError) && (
        <Alert title="Something went wrong" description={error ?? loadError ?? ""} />
      )}

      {!loadError && (
        <Stack className="gap-3">
          <Heading as="h2">Connections</Heading>
          {connections.length === 0 ? (
            <Text className="text-sm text-muted">No SSO connections configured yet.</Text>
          ) : (
            <Stack className="gap-2">
              {connections.map((connection) => (
                <Stack key={connection.id} className="gap-2 rounded-md border border-border p-4">
                  <Cluster className="justify-between">
                    <Cluster className="items-center gap-2">
                      <Text className="font-semibold">{connection.name}</Text>
                      <StatusBadge status={connection.active ? "success" : "neutral"}>
                        {connection.active ? "active" : "inactive"}
                      </StatusBadge>
                    </Cluster>
                    <Text className="text-sm text-muted">{connection.domain}</Text>
                  </Cluster>
                  <Text className="text-xs text-muted">{connection.provider}</Text>
                  <Cluster className="gap-2">
                    <form
                      action={setSsoConnectionActiveAction.bind(
                        null,
                        connection.id,
                        !connection.active,
                      )}
                    >
                      <Button type="submit" variant="quiet">
                        {connection.active ? "Deactivate" : "Activate"}
                      </Button>
                    </form>
                    <form action={deleteSsoConnectionAction.bind(null, connection.id)}>
                      <Button type="submit" variant="quiet">
                        Delete
                      </Button>
                    </form>
                  </Cluster>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      )}

      <Stack className="gap-3 rounded-md border border-border p-4">
        <Heading as="h2">Add a connection</Heading>
        <form action={createSsoConnectionAction} className="grid gap-3">
          <Stack className="gap-1">
            <label htmlFor="name" className="text-xs font-medium text-muted">
              Label
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="Acme Okta"
              className={inputClassName}
            />
          </Stack>
          <Stack className="gap-1">
            <label htmlFor="domain" className="text-xs font-medium text-muted">
              Email domain
            </label>
            <input
              id="domain"
              name="domain"
              required
              placeholder="acme.com"
              className={inputClassName}
            />
          </Stack>
          <Stack className="gap-1">
            <label htmlFor="provider" className="text-xs font-medium text-muted">
              Provider type
            </label>
            <Select id="provider" name="provider" defaultValue="saml_custom">
              <option value="saml_custom">SAML (custom)</option>
              <option value="oidc_custom">OIDC (custom)</option>
            </Select>
          </Stack>

          <Text className="text-xs font-medium text-muted">
            SAML — fill if provider type is SAML
          </Text>
          <Stack className="gap-1">
            <label htmlFor="idpEntityId" className="text-xs font-medium text-muted">
              IdP Entity ID
            </label>
            <input id="idpEntityId" name="idpEntityId" className={inputClassName} />
          </Stack>
          <Stack className="gap-1">
            <label htmlFor="idpSsoUrl" className="text-xs font-medium text-muted">
              IdP SSO URL
            </label>
            <input id="idpSsoUrl" name="idpSsoUrl" className={inputClassName} />
          </Stack>
          <Stack className="gap-1">
            <label htmlFor="idpCertificate" className="text-xs font-medium text-muted">
              IdP certificate (PEM) — or provide a metadata URL below instead
            </label>
            <textarea
              id="idpCertificate"
              name="idpCertificate"
              rows={4}
              className={inputClassName}
            />
          </Stack>
          <Stack className="gap-1">
            <label htmlFor="idpMetadataUrl" className="text-xs font-medium text-muted">
              IdP metadata URL (alternative to a pasted certificate)
            </label>
            <input id="idpMetadataUrl" name="idpMetadataUrl" className={inputClassName} />
          </Stack>

          <Text className="text-xs font-medium text-muted">
            OIDC — fill if provider type is OIDC
          </Text>
          <Stack className="gap-1">
            <label htmlFor="clientId" className="text-xs font-medium text-muted">
              Client ID
            </label>
            <input id="clientId" name="clientId" className={inputClassName} />
          </Stack>
          <Stack className="gap-1">
            <label htmlFor="clientSecret" className="text-xs font-medium text-muted">
              Client secret
            </label>
            <input
              id="clientSecret"
              name="clientSecret"
              type="password"
              className={inputClassName}
            />
          </Stack>
          <Stack className="gap-1">
            <label htmlFor="discoveryUrl" className="text-xs font-medium text-muted">
              Discovery URL
            </label>
            <input id="discoveryUrl" name="discoveryUrl" className={inputClassName} />
          </Stack>

          <Button type="submit" variant="secondary" className="self-start">
            Add connection
          </Button>
        </form>
      </Stack>
    </Stack>
  );
}
