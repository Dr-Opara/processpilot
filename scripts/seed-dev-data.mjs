#!/usr/bin/env node
// Development-only seed data: Northstar Property Group (fictional),
// 3 locations, 5 departments, 4 teams. Idempotent (safe to run more than
// once — upserts on each table's natural key). Refuses to run against
// anything that looks like a production database, checked multiple
// independent ways rather than trusting any single signal.
//
// Usage: npm run db:seed -- --yes-seed-dev [--reset]

import postgres from "postgres";

const YES_FLAG = "--yes-seed-dev";
const RESET_FLAG = "--reset";

function assertSafeToSeed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV is 'production'.");
  }
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to seed: VERCEL_ENV is 'production'.");
  }
  const dbUrl = process.env.SUPABASE_DB_URL ?? "";
  if (/prod/i.test(dbUrl)) {
    throw new Error(
      "Refusing to seed: SUPABASE_DB_URL looks like it may point at a production project " +
        "(matched /prod/i). Use a dev/preview project's connection string instead.",
    );
  }
  if (!process.argv.includes(YES_FLAG)) {
    throw new Error(
      `Refusing to seed: pass ${YES_FLAG} to confirm this is a development database.`,
    );
  }
}

const ORG = {
  clerkOrgId: "org_dev_seed_northstar",
  name: "Northstar Property Group",
  slug: "northstar-property-group",
};

const LOCATIONS = ["Houston", "Dallas", "Austin"];
const DEPARTMENTS = ["People Operations", "IT", "Finance", "Operations", "Compliance"];
const TEAMS = [
  { name: "Employee Experience", department: "People Operations" },
  { name: "Systems Administration", department: "IT" },
  { name: "Accounts Payable", department: "Finance" },
  { name: "Property Operations", department: "Operations" },
];

async function resetSeed(sql) {
  const [org] = await sql`
    select id from organizations where clerk_org_id = ${ORG.clerkOrgId}
  `;
  if (!org) return;
  await sql`delete from organizations where id = ${org.id}`;
  console.log("Reset: removed prior Northstar Property Group seed data.");
}

async function seed(sql) {
  const [organization] = await sql`
    insert into organizations (clerk_org_id, name, slug)
    values (${ORG.clerkOrgId}, ${ORG.name}, ${ORG.slug})
    on conflict (clerk_org_id) do update set
      name = excluded.name,
      slug = excluded.slug,
      updated_at = now()
    returning id
  `;

  await sql`
    insert into organization_settings (organization_id)
    values (${organization.id})
    on conflict (organization_id) do nothing
  `;

  const departmentIds = new Map();
  for (const name of DEPARTMENTS) {
    const [department] = await sql`
      insert into departments (organization_id, name)
      values (${organization.id}, ${name})
      on conflict (organization_id, lower(name)) where archived_at is null
      do update set updated_at = now()
      returning id
    `;
    departmentIds.set(name, department.id);
  }

  for (const name of LOCATIONS) {
    await sql`
      insert into organization_locations (organization_id, name)
      values (${organization.id}, ${name})
      on conflict (organization_id, lower(name)) where archived_at is null
      do update set updated_at = now()
    `;
  }

  for (const team of TEAMS) {
    const departmentId = departmentIds.get(team.department) ?? null;
    await sql`
      insert into teams (organization_id, department_id, name)
      values (${organization.id}, ${departmentId}, ${team.name})
      on conflict (organization_id, lower(name)) where archived_at is null
      do update set updated_at = now()
    `;
  }

  console.log(
    `Seeded "${ORG.name}": ${LOCATIONS.length} locations, ${DEPARTMENTS.length} departments, ${TEAMS.length} teams.`,
  );
}

async function main() {
  assertSafeToSeed();

  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    throw new Error("SUPABASE_DB_URL is not set — see docs/development/supabase-setup.md.");
  }

  const sql = postgres(dbUrl, { max: 1 });

  try {
    if (process.argv.includes(RESET_FLAG)) {
      await resetSeed(sql);
    }
    await seed(sql);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
