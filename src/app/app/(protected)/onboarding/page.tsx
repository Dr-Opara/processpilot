import Image from "next/image";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { getOnboardingState } from "@/lib/services/organizations";
import { listLocations } from "@/lib/services/locations";
import { listDepartments } from "@/lib/services/departments";
import { listTeams } from "@/lib/services/teams";
import { listMembers } from "@/lib/services/members";
import { AppError } from "@/lib/errors";
import { advanceOnboardingStepAction, saveCompanyProfileAction } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  let state;
  try {
    state = await getOnboardingState();
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Could not load onboarding status.";
    return (
      <Stack className="mx-auto max-w-xl gap-6">
        <Alert title="Could not load onboarding" description={message} />
      </Stack>
    );
  }

  const step = state.settings.onboarding_step;

  return (
    <Stack className="mx-auto max-w-xl gap-6">
      <Image
        src="/brand/branding/processpilot-logo.png"
        alt="ProcessPilot"
        width={166}
        height={32}
        className="h-8 w-auto"
      />
      {error && <Alert title="Something went wrong" description={error} />}

      {step === "welcome" && (
        <Stack className="gap-6">
          <Stack className="gap-1">
            <Heading as="h1">Welcome to ProcessPilot</Heading>
            <Text className="text-muted">
              Let&apos;s set up your organization — company profile, locations, departments, teams,
              and your first invitations.
            </Text>
          </Stack>
          <form action={advanceOnboardingStepAction.bind(null, "company_profile")}>
            <Button type="submit">Get started</Button>
          </form>
        </Stack>
      )}

      {step === "company_profile" && (
        <Stack className="gap-6">
          <Stack className="gap-1">
            <Heading as="h1">Company profile</Heading>
            <Text className="text-muted">Tell us about your organization.</Text>
          </Stack>
          <form action={saveCompanyProfileAction} className="flex flex-col gap-4">
            <Stack className="gap-1">
              <Label htmlFor="name">Operating name</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={200}
                defaultValue={state.organization.name}
              />
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="legalName">Legal name (optional)</Label>
              <Input
                id="legalName"
                name="legalName"
                maxLength={200}
                defaultValue={state.organization.legal_name ?? ""}
              />
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="slug">Workspace slug</Label>
              <Input
                id="slug"
                name="slug"
                required
                maxLength={63}
                defaultValue={state.organization.slug}
              />
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="industry">Industry (optional)</Label>
              <Input
                id="industry"
                name="industry"
                maxLength={100}
                defaultValue={state.organization.industry ?? ""}
              />
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="employeeCountRange">Employee count (optional)</Label>
              <Input
                id="employeeCountRange"
                name="employeeCountRange"
                maxLength={50}
                placeholder="e.g. 11-50"
                defaultValue={state.organization.employee_count_range ?? ""}
              />
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="websiteUrl">Website (optional)</Label>
              <Input
                id="websiteUrl"
                name="websiteUrl"
                type="url"
                maxLength={300}
                defaultValue={state.organization.website_url ?? ""}
              />
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="country">Country (optional)</Label>
              <Input
                id="country"
                name="country"
                maxLength={100}
                defaultValue={state.organization.country ?? ""}
              />
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                name="timezone"
                required
                maxLength={100}
                defaultValue={state.settings.timezone}
              />
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="dateFormat">Date format</Label>
              <Input
                id="dateFormat"
                name="dateFormat"
                required
                maxLength={20}
                defaultValue={state.settings.date_format}
              />
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="weekStart">Week starts on</Label>
              <Select id="weekStart" name="weekStart" defaultValue={state.settings.week_start}>
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </Select>
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="primaryUseCase">What brings you to ProcessPilot? (optional)</Label>
              <Input id="primaryUseCase" name="primaryUseCase" maxLength={200} />
            </Stack>
            <Cluster className="justify-end">
              <Button type="submit">Continue</Button>
            </Cluster>
          </form>
        </Stack>
      )}

      {step === "locations" && (
        <SetupStep
          title="Locations"
          description="Add the physical or logical sites your organization operates from."
          count={(await listLocations({ status: "active" }).catch(() => [])).length}
          noun="location"
          addHref="/app/locations/new"
          nextStep="departments"
        />
      )}

      {step === "departments" && (
        <SetupStep
          title="Departments"
          description="Group employees by function — Kitchen, Front Desk, Accounts Payable."
          count={(await listDepartments({ status: "active" }).catch(() => [])).length}
          noun="department"
          addHref="/app/departments/new"
          nextStep="teams"
        />
      )}

      {step === "teams" && (
        <SetupStep
          title="Teams"
          description="Create smaller, fluid groups of members for day-to-day assignment."
          count={(await listTeams({ status: "active" }).catch(() => [])).length}
          noun="team"
          addHref="/app/teams/new"
          nextStep="invite_employees"
        />
      )}

      {step === "invite_employees" && (
        <Stack className="gap-6">
          <Stack className="gap-1">
            <Heading as="h1">Invite your team</Heading>
            <Text className="text-muted">
              Invite people one at a time, or import a CSV of employees.
            </Text>
          </Stack>
          <Cluster className="gap-3">
            <Button href="/app/members/invite" variant="secondary">
              Invite a member
            </Button>
            <Button href="/app/members/import" variant="secondary">
              Import CSV
            </Button>
          </Cluster>
          <Cluster className="justify-end gap-3">
            <form action={advanceOnboardingStepAction.bind(null, "review")}>
              <Button type="submit" variant="secondary">
                Skip
              </Button>
            </form>
            <form action={advanceOnboardingStepAction.bind(null, "review")}>
              <Button type="submit">Continue</Button>
            </form>
          </Cluster>
        </Stack>
      )}

      {step === "review" && <ReviewStep />}

      {step === "finished" && (
        <Stack className="gap-6">
          <Stack className="gap-1">
            <Heading as="h1">You&apos;re all set</Heading>
            <Text className="text-muted">Your organization is ready to go.</Text>
          </Stack>
          <Button href="/app">Go to dashboard</Button>
        </Stack>
      )}
    </Stack>
  );
}

function SetupStep({
  title,
  description,
  count,
  noun,
  addHref,
  nextStep,
}: {
  title: string;
  description: string;
  count: number;
  noun: string;
  addHref: string;
  nextStep: "departments" | "teams" | "invite_employees";
}) {
  return (
    <Stack className="gap-6">
      <Stack className="gap-1">
        <Heading as="h1">{title}</Heading>
        <Text className="text-muted">{description}</Text>
      </Stack>
      <Text>
        {count} active {count === 1 ? noun : `${noun}s`} so far.
      </Text>
      <Button href={addHref} variant="secondary">
        Add a {noun}
      </Button>
      <Cluster className="justify-end gap-3">
        <form action={advanceOnboardingStepAction.bind(null, nextStep)}>
          <Button type="submit" variant="secondary">
            Skip
          </Button>
        </form>
        <form action={advanceOnboardingStepAction.bind(null, nextStep)}>
          <Button type="submit">Continue</Button>
        </form>
      </Cluster>
    </Stack>
  );
}

async function ReviewStep() {
  const [locations, departments, teams, members] = await Promise.all([
    listLocations({ status: "active" }).catch(() => []),
    listDepartments({ status: "active" }).catch(() => []),
    listTeams({ status: "active" }).catch(() => []),
    listMembers({ status: "active", pageSize: 1 }).catch(() => ({ members: [], total: 0 })),
  ]);

  return (
    <Stack className="gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Review</Heading>
        <Text className="text-muted">Here&apos;s what you&apos;ve set up so far.</Text>
      </Stack>
      <Stack className="gap-2 rounded-md border border-border p-4">
        <Cluster className="justify-between">
          <Text>Locations</Text>
          <Text className="text-muted">{locations.length}</Text>
        </Cluster>
        <Cluster className="justify-between">
          <Text>Departments</Text>
          <Text className="text-muted">{departments.length}</Text>
        </Cluster>
        <Cluster className="justify-between">
          <Text>Teams</Text>
          <Text className="text-muted">{teams.length}</Text>
        </Cluster>
        <Cluster className="justify-between">
          <Text>Members</Text>
          <Text className="text-muted">{members.total}</Text>
        </Cluster>
      </Stack>
      <Cluster className="justify-end">
        <form action={advanceOnboardingStepAction.bind(null, "finished")}>
          <Button type="submit">Finish setup</Button>
        </form>
      </Cluster>
    </Stack>
  );
}
