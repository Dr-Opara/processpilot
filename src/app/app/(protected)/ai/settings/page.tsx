import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Alert";
import { isAiConfigured } from "@/lib/ai/availability";
import { isAiCopilotEnabledForOrg } from "@/lib/services/ai-settings";
import { setAiCopilotEnabledAction } from "./actions";

export default async function AiSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = isAiConfigured();
  const enabled = configured ? await isAiCopilotEnabledForOrg() : false;

  return (
    <Stack className="mx-auto max-w-xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">AI copilot settings</Heading>
        <Text className="text-muted">
          Controls whether AI-assisted features are available to this organization.
        </Text>
      </Stack>

      {error && <Alert title="Could not update this setting" description={error} />}

      {!configured && (
        <Alert
          title="AI is not configured"
          description="No AI provider credential is set up in this environment yet. The copilot will remain unavailable regardless of this setting until one is configured."
        />
      )}

      <form action={setAiCopilotEnabledAction} className="flex flex-col gap-3">
        <Cluster className="items-center gap-2">
          <Checkbox id="enabled" name="enabled" defaultChecked={enabled} disabled={!configured} />
          <Label htmlFor="enabled">Enable the AI copilot for this organization</Label>
        </Cluster>
        <Cluster className="justify-end">
          <Button type="submit" variant="secondary" disabled={!configured}>
            Save
          </Button>
        </Cluster>
      </form>
    </Stack>
  );
}
