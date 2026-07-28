import "server-only";
import { SlackProvider } from "@/lib/integrations/providers/slack-provider";
import { NotImplementedProvider } from "@/lib/integrations/providers/not-implemented-provider";
import type { IntegrationAdapter } from "@/lib/integrations/adapter";
import type { IntegrationProviderKey } from "@/lib/db/database.types";

/**
 * The full integration catalog for this phase — Slack is the one real
 * (OAuth-connectable) adapter; the other six are named, documented
 * catalog entries with no working connection yet (NotImplementedProvider),
 * per the "initial mocked scaffolding" requirement — listed, not faked.
 */
const registry: Record<IntegrationProviderKey, IntegrationAdapter> = {
  slack: new SlackProvider(),
  microsoft_teams: new NotImplementedProvider(
    "microsoft_teams",
    "Microsoft Teams",
    "Post notifications to a Teams channel.",
  ),
  microsoft_365: new NotImplementedProvider(
    "microsoft_365",
    "Microsoft 365",
    "Sync calendar, files, and directory data.",
  ),
  google_workspace: new NotImplementedProvider(
    "google_workspace",
    "Google Workspace",
    "Sync calendar, files, and directory data.",
  ),
  jira: new NotImplementedProvider(
    "jira",
    "Jira",
    "Create and link Jira issues from exceptions/CAPA.",
  ),
  servicenow: new NotImplementedProvider(
    "servicenow",
    "ServiceNow",
    "Create and sync ServiceNow incidents/change requests.",
  ),
  zapier: new NotImplementedProvider(
    "zapier",
    "Zapier",
    "Trigger Zaps from ProcessPilot events via the public API/webhooks.",
  ),
};

export function getIntegrationAdapter(provider: IntegrationProviderKey): IntegrationAdapter {
  return registry[provider];
}

export function listIntegrationCatalog(): IntegrationAdapter[] {
  return Object.values(registry);
}
