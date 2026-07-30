import "server-only";
import { getAdminSql } from "@/lib/db/client-admin";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { recordPlatformAdminAction } from "@/lib/services/platform-admin";
import { AppError } from "@/lib/errors";
import type { OrganizationRow } from "@/lib/db/database.types";

/**
 * Phase 28: a single, explicitly-flagged organization (`organizations.
 * is_demo`) used for sales/prospect walkthroughs. Every function here
 * is platform-admin-gated — flagging/unflagging/reseeding the demo
 * workspace is an operational action, not something any tenant admin
 * can trigger for their own organization.
 *
 * Content deliberately stays small and clearly synthetic (mirroring
 * scripts/seed-dev-data.mjs's "Northstar Property Group" fixture),
 * inserted directly through the admin client rather than through each
 * domain's own service layer — there is no real organization_member
 * this seed can safely act "as," so it writes rows the same way
 * platform-admin.ts's other cross-tenant actions already do.
 */

const DEPARTMENTS = ["Operations", "Compliance"];
const LOCATIONS = ["Demo HQ"];
const KNOWLEDGE_DOCUMENT_TITLE = "Customer Onboarding Checklist (Demo)";
const PROCESS_TITLE = "Customer Onboarding (Demo)";

export async function getDemoOrganization(): Promise<OrganizationRow | null> {
  await requirePlatformAdmin();
  const sql = getAdminSql();
  const [organization] = await sql<OrganizationRow[]>`
    select * from organizations where is_demo = true
  `;
  return organization ?? null;
}

export async function markOrganizationAsDemo(organizationId: string): Promise<void> {
  const admin = await requirePlatformAdmin();
  const sql = getAdminSql();

  await sql.begin(async (tx) => {
    const [organization] = await tx<OrganizationRow[]>`
      select * from organizations where id = ${organizationId}
    `;
    if (!organization) throw new AppError("not_found", "Organization not found.");
    if (organization.is_demo) return;

    try {
      await tx`update organizations set is_demo = true where id = ${organizationId}`;
    } catch {
      throw new AppError(
        "conflict",
        "A demo organization already exists. Unmark it before flagging a new one.",
      );
    }

    await recordPlatformAdminAction(tx, {
      actorProfileId: admin.id,
      action: "organization.marked_demo",
      targetOrganizationId: organizationId,
    });
  });

  await seedDemoWorkspaceContent(organizationId);
}

export async function unmarkOrganizationAsDemo(organizationId: string): Promise<void> {
  const admin = await requirePlatformAdmin();
  const sql = getAdminSql();

  await sql.begin(async (tx) => {
    const [organization] = await tx<OrganizationRow[]>`
      update organizations set is_demo = false
      where id = ${organizationId} and is_demo = true
      returning *
    `;
    if (!organization)
      throw new AppError("not_found", "This organization is not the demo workspace.");

    await recordPlatformAdminAction(tx, {
      actorProfileId: admin.id,
      action: "organization.unmarked_demo",
      targetOrganizationId: organizationId,
    });
  });
}

/**
 * Idempotent upsert of the demo workspace's baseline content (matched
 * by natural key, same "on conflict do update" pattern
 * scripts/seed-dev-data.mjs already uses) — safe to call repeatedly.
 * Guarded to organizations actually flagged `is_demo`, so a wrong id
 * can never seed synthetic content into a real customer's tenant.
 *
 * Known gap (documented in docs/architecture/demo-workspace.md): this
 * restores the seeded baseline only. It does not purge ad-hoc content
 * (workflows/tasks/exceptions/etc.) a demo session may have created —
 * safely wiping every organization-scoped table without a dedicated
 * cascade-delete security review is exactly the risk Phase 21's
 * organization-deletion finalization was deliberately deferred for
 * (see organization-administration.md's known gaps); this phase
 * doesn't attempt to build that review-gated mechanism.
 */
export async function seedDemoWorkspaceContent(organizationId: string): Promise<void> {
  await requirePlatformAdmin();
  const sql = getAdminSql();

  const [organization] = await sql<OrganizationRow[]>`
    select * from organizations where id = ${organizationId}
  `;
  if (!organization?.is_demo) {
    throw new AppError("forbidden", "This organization is not flagged as the demo workspace.");
  }

  await sql.begin(async (tx) => {
    for (const name of DEPARTMENTS) {
      await tx`
        insert into departments (organization_id, name)
        values (${organizationId}, ${name})
        on conflict (organization_id, lower(name)) where archived_at is null
        do update set updated_at = now()
      `;
    }

    for (const name of LOCATIONS) {
      await tx`
        insert into organization_locations (organization_id, name)
        values (${organizationId}, ${name})
        on conflict (organization_id, lower(name)) where archived_at is null
        do update set updated_at = now()
      `;
    }

    let [document] = await tx<{ id: string; current_version_id: string | null }[]>`
      select id, current_version_id from knowledge_documents
      where organization_id = ${organizationId} and title = ${KNOWLEDGE_DOCUMENT_TITLE}
    `;
    if (!document) {
      [document] = await tx<{ id: string; current_version_id: string | null }[]>`
        insert into knowledge_documents (organization_id, title, category, status)
        values (${organizationId}, ${KNOWLEDGE_DOCUMENT_TITLE}, 'Onboarding', 'published')
        returning id, current_version_id
      `;
    }
    if (!document.current_version_id) {
      const [version] = await tx<{ id: string }[]>`
        insert into document_versions (
          organization_id, document_id, version_number, title, source, content, status, published_at
        ) values (
          ${organizationId}, ${document.id}, 1, ${KNOWLEDGE_DOCUMENT_TITLE}, 'authored',
          'A short, deterministic walkthrough document seeded for demo purposes. Not real company content.',
          'published', now()
        )
        returning id
      `;
      await tx`update knowledge_documents set current_version_id = ${version.id} where id = ${document.id}`;
    }

    let [process] = await tx<{ id: string; current_version_id: string | null }[]>`
      select id, current_version_id from processes
      where organization_id = ${organizationId} and title = ${PROCESS_TITLE}
    `;
    if (!process) {
      [process] = await tx<{ id: string; current_version_id: string | null }[]>`
        insert into processes (organization_id, title, status)
        values (${organizationId}, ${PROCESS_TITLE}, 'published')
        returning id, current_version_id
      `;
    }
    if (!process.current_version_id) {
      const definition = {
        nodes: [
          { id: "start-1", type: "start", position: { x: 0, y: 0 }, data: { label: "Start" } },
          {
            id: "task-1",
            type: "human_task",
            position: { x: 200, y: 0 },
            data: { label: "Welcome the new customer", required: true },
          },
          { id: "end-1", type: "end", position: { x: 400, y: 0 }, data: { label: "Done" } },
        ],
        edges: [
          { id: "e1", source: "start-1", target: "task-1" },
          { id: "e2", source: "task-1", target: "end-1" },
        ],
      };
      const [version] = await tx<{ id: string }[]>`
        insert into process_versions (
          organization_id, process_id, version_number, title, definition, status, published_at
        ) values (
          ${organizationId}, ${process.id}, 1, ${PROCESS_TITLE},
          ${tx.json(definition as unknown as Parameters<typeof tx.json>[0])}, 'published', now()
        )
        returning id
      `;
      await tx`update processes set current_version_id = ${version.id} where id = ${process.id}`;
    }
  });
}

export async function resetDemoWorkspace(): Promise<void> {
  const admin = await requirePlatformAdmin();
  const sql = getAdminSql();

  const [organization] = await sql<OrganizationRow[]>`
    select * from organizations where is_demo = true
  `;
  if (!organization) throw new AppError("not_found", "No demo organization is currently flagged.");

  await seedDemoWorkspaceContent(organization.id);

  await sql.begin((tx) =>
    recordPlatformAdminAction(tx, {
      actorProfileId: admin.id,
      action: "organization.demo_reset",
      targetOrganizationId: organization.id,
    }),
  );
}
