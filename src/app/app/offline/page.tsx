import { Heading, Text } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Layout";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <Stack className="mx-auto max-w-md gap-3 py-16 text-center">
      <Heading as="h1">You&apos;re offline</Heading>
      <Text className="text-muted">
        ProcessPilot needs a live connection to show current, authorized data — reconnect to
        continue working. Any page you had already loaded before losing connection remains visible
        if you go back.
      </Text>
    </Stack>
  );
}
