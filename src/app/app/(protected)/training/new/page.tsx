import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { createTrainingCourseAction } from "../actions";

export default async function NewTrainingCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Add a training course</Heading>
        <Text className="text-muted">Create the course shell — add content in a version next.</Text>
      </Stack>

      {error && <Alert title="Could not create this course" description={error} />}

      <form action={createTrainingCourseAction} className="flex flex-col gap-6">
        <Stack className="gap-1">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required maxLength={300} autoFocus />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={4} />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" maxLength={100} />
        </Stack>
        <Cluster className="justify-end gap-3">
          <Button href="/app/training" variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Create course</Button>
        </Cluster>
      </form>
    </Stack>
  );
}
