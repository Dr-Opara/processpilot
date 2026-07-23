import { Heading, Text } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { listDepartments } from "@/lib/services/departments";
import { listMembers } from "@/lib/services/members";
import { memberDisplayName } from "@/lib/services/member-display";
import { NewDocumentForm } from "./NewDocumentForm";

export default async function NewKnowledgeDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [departments, membersResult] = await Promise.all([
    listDepartments({ status: "active" }).catch(() => []),
    listMembers({ status: "active", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
  ]);
  const members = membersResult.members.map((member) => ({
    id: member.id,
    label: memberDisplayName(member),
  }));

  return (
    <Stack className="mx-auto max-w-xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Add a document</Heading>
        <Text className="text-muted">
          Author content directly, or upload a PDF, DOCX, or text file.
        </Text>
      </Stack>

      {error && <Alert title="Could not create document" description={error} />}

      <NewDocumentForm departments={departments} members={members} />
    </Stack>
  );
}
