import { queryOne } from "../_repositories/db.js";

/**
 * Legacy-user migration.
 *
 * Historical accounts exist in public.users with emails that later collide
 * with a fresh Neon Auth identity. When Neon Auth hands us a NEW user id for
 * an email that is already taken by a legacy row, we adopt the legacy data:
 * the new identity takes over the email, every child record is re-parented,
 * and the legacy user row disappears.
 *
 * This used to run as ~12 sequential statements (duplicated verbatim in the
 * signup and login handlers), which could leave half-migrated data behind on
 * a mid-flight crash. The Neon HTTP driver cannot run multi-statement
 * transactions, so it is expressed as ONE data-modifying CTE statement —
 * PostgreSQL executes it all-or-nothing.
 *
 * Ordering notes:
 *  - `stash` (email rename) is chained before `new_user` via INSERT…SELECT,
 *    forcing the rename to apply first so the unique(email) index never sees
 *    the collision that triggered the migration.
 *  - Foreign-key checks fire at end-of-statement, after all CTEs applied.
 */
export async function migrateLegacyUser({
  newUserId,
  email,
  fullName,
}: {
  newUserId: string;
  email: string;
  fullName: string;
}): Promise<{ migrated: boolean }> {
  // Children of public.users. system_logs uses ON DELETE SET NULL, so it is
  // re-parented explicitly to preserve audit history instead of orphaning it.
  const CHILD_TABLES = [
    "debt_payments",
    "debts",
    "ai_insights",
    "goals",
    "budgets",
    "transactions",
    "categories",
    "accounts",
    "profiles",
    "system_logs",
  ] as const;

  const reparentCtes = CHILD_TABLES.map(
    (table, i) => `
    m${i} AS (
      UPDATE ${table} SET user_id = $1
      WHERE user_id IN (SELECT id FROM stash)
    )`,
  );

  const row = await queryOne<{ migrated: boolean }>(
    `
    WITH legacy AS (
      SELECT id FROM users WHERE email = $2 AND id <> $1 LIMIT 1
    ),
    stash AS (
      UPDATE users SET email = 'migrating_' || email
      WHERE id IN (SELECT id FROM legacy)
      RETURNING id
    ),
    new_user AS (
      INSERT INTO users (id, email, full_name)
      SELECT $1, $2, $3 FROM stash
      ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email, full_name = EXCLUDED.full_name
    )${reparentCtes.join(",")}
    SELECT (SELECT COUNT(*) FROM stash) > 0 AS migrated
    `,
    [newUserId, email, fullName],
  );

  return { migrated: Boolean(row?.migrated) };
}
