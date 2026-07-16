import { FileText, ArrowRight, Workflow } from "lucide-react";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";
import { Badge } from "@/components/ui/Badge";
import { demoCompany } from "@/content/site";

export function ProcedureTransformDemo() {
  const { exampleProcess } = demoCompany;

  return (
    <Section className="border-t border-border/70 py-16 sm:py-20">
      <Container>
        <Stack className="gap-8">
          <Stack className="max-w-2xl gap-3">
            <Heading as="h2">
              From procedure document to guided workflow
            </Heading>
            <Text className="text-muted">
              ProcessPilot reads an existing procedure document and proposes a
              structured workflow — tasks, roles, approvals, and branches — for
              a process owner to review before anything goes live.
            </Text>
          </Stack>

          <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <FileText size={16} className="text-muted" aria-hidden="true" />
                <Text className="text-sm font-semibold text-ink">
                  New-Employee-Onboarding-SOP.docx
                </Text>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-2 w-full rounded-full bg-border" />
                <div className="h-2 w-5/6 rounded-full bg-border" />
                <div className="h-2 w-full rounded-full bg-border" />
                <div className="h-2 w-2/3 rounded-full bg-border" />
                <div className="h-2 w-4/5 rounded-full bg-border" />
              </div>
            </div>

            <div
              className="flex items-center justify-center rounded-full border border-border bg-paper p-3"
              aria-hidden="true"
            >
              <ArrowRight size={20} className="text-cobalt" />
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Workflow size={16} className="text-muted" aria-hidden="true" />
                <Text className="text-sm font-semibold text-ink">
                  {exampleProcess.name} — draft workflow
                </Text>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <dt className="text-xs text-muted">Tasks</dt>
                  <dd className="text-lg font-semibold text-ink">
                    {exampleProcess.taskCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Roles</dt>
                  <dd className="text-lg font-semibold text-ink">
                    {exampleProcess.responsibleRoles}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Approvals</dt>
                  <dd className="text-lg font-semibold text-ink">
                    {exampleProcess.approvals}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Branches</dt>
                  <dd className="text-lg font-semibold text-ink">
                    {exampleProcess.conditionalBranches}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Evidence</dt>
                  <dd className="text-lg font-semibold text-ink">
                    {exampleProcess.evidenceRequirements}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Training</dt>
                  <dd className="text-lg font-semibold text-ink">
                    {exampleProcess.trainingAssignments}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <Badge className="w-fit border-cobalt/30 bg-cobalt/5 text-cobalt">
            Product demonstration data · {demoCompany.name}, not a customer
            outcome
          </Badge>
        </Stack>
      </Container>
    </Section>
  );
}
