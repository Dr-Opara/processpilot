import Link from "next/link";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listScimTokens } from "@/lib/services/scim";
import { AppError } from "@/lib/errors";
import { createScimTokenAction, revokeScimTokenAction } from "./actions";

export default async function ScimPage({
  searchParams,
}: {
  searchParams: Promise<{ newToken?: string; error?: string }>;
}) {
  const { newToken, error } = await searchParams;

  let tokens: Awaited<ReturnType<typeof listScimTokens>> = [];
  let loadError: string | null = null;
  try {
    tokens = await listScimTokens();
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load SCIM tokens.";
  }

  return (
    <Stack className="mx-auto max-w-2xl gap-8">
      <Stack className="gap-1">
        <Link href={{ pathname: "/app/integrations" }} className="text-sm text-cobalt">
          ← Integrations
        </Link>
        <Heading as="h1">SCIM provisioning</Heading>
        <Text className="text-muted">
          A minimal, real SCIM 2.0 Users list resource at <code>GET /api/scim/v2/Users</code>,
          authenticated by a bearer token below. Not yet validated against a real identity provider
          — no PATCH, Groups, or ServiceProviderConfig endpoint. See
          docs/architecture/organization-administration.md.
        </Text>
      </Stack>

      {newToken && (
        <Alert title="Copy this token now — it won't be shown again" description={newToken} />
      )}
      {(error ?? loadError) && (
        <Alert title="Could not complete that action" description={error ?? loadError ?? ""} />
      )}

      {!loadError && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Create a token</Heading>
          <form action={createScimTokenAction} className="flex items-end gap-2">
            <Stack className="flex-1 gap-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Okta SCIM connector" />
            </Stack>
            <Button type="submit" variant="secondary">
              Create token
            </Button>
          </form>
        </Stack>
      )}

      {!loadError && (
        <Stack className="gap-2">
          <Heading as="h2">Tokens</Heading>
          {tokens.length === 0 ? (
            <Text className="text-sm text-muted">No SCIM tokens yet.</Text>
          ) : (
            tokens.map((token) => (
              <Cluster
                key={token.id}
                className="justify-between rounded-md border border-border p-3"
              >
                <Stack className="gap-0">
                  <Cluster className="items-center gap-2">
                    <Text className="font-semibold">{token.name}</Text>
                    <StatusBadge status={token.status === "active" ? "success" : "neutral"}>
                      {token.status}
                    </StatusBadge>
                  </Cluster>
                  <Text className="text-xs text-muted">{token.token_prefix}…</Text>
                </Stack>
                {token.status === "active" && (
                  <form action={revokeScimTokenAction.bind(null, token.id)}>
                    <Button type="submit" variant="quiet">
                      Revoke
                    </Button>
                  </form>
                )}
              </Cluster>
            ))
          )}
        </Stack>
      )}
    </Stack>
  );
}
