import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { ImportWizard } from "./ImportWizard";

export default function MemberImportPage() {
  return (
    <Stack className="mx-auto max-w-3xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Import members</Heading>
          <Text className="text-muted">Bulk-invite employees from a CSV file.</Text>
        </Stack>
        <Cluster className="gap-2">
          <Button href="/app/members/import/history" variant="secondary">
            Import history
          </Button>
          <Button href="/app/members/import/template" variant="secondary">
            Download template
          </Button>
        </Cluster>
      </Cluster>

      <ImportWizard />
    </Stack>
  );
}
