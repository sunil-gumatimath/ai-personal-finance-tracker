import {
  authClient,
  getAuthOrigin,
  getAuthedUserId,
  getRequestToken,
  buildSessionCookie,
  buildClearedSessionCookie,
} from "../services/auth.service.js";
import { query, queryOne } from "../repositories/db.js";
import { ensureDefaultCategories } from "../utils/default-categories.js";
import { checkRateLimit, recordFailedAttempt } from "../middleware/rate-limit.js";
import type { ApiRequest, ApiResponse } from "../utils/types.js";
import { logEvent } from "../services/audit-log.service.js";

type ErrorWithDetails = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
  cause?: unknown;
  stack?: unknown;
};

function asErrorDetails(error: unknown): ErrorWithDetails {
  return typeof error === "object" && error !== null ? error : {};
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getClientId(req: ApiRequest): string {
  return (
    req.headers?.["x-forwarded-for"] || req.headers?.["x-real-ip"] || "unknown"
  );
}

async function tryEnsureDefaultCategories(userId: string): Promise<void> {
  try {
    await ensureDefaultCategories(userId);
  } catch (dbError: unknown) {
    console.error("Database sync error (default categories):", dbError);
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const action = req.query?.action;

  // Handle /api/auth?action=me
  if (action === "me") {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const userId = await getAuthedUserId(req);
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const dbUser = await queryOne<{
        id: string;
        email: string;
        full_name: string;
        avatar_url: string | null;
        created_at: string;
      }>(
        "SELECT id, email, full_name, avatar_url, created_at FROM users WHERE id = $1",
        [userId],
      );
      if (!dbUser) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      res.status(200).json({
        user: {
          id: dbUser.id,
          email: dbUser.email,
          user_metadata: {
            full_name: dbUser.full_name,
            avatar_url: dbUser.avatar_url,
          },
          app_metadata: {},
          aud: "authenticated",
          created_at: dbUser.created_at,
        },
      });
    } catch (error) {
      console.error("Auth me error:", error);
      res.status(500).json({ error: "Server error" });
    }
    return;
  }

  // Handle /api/auth?action=logout
  if (action === "logout") {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const token = getRequestToken(req);
    if (token) {
      await query('DELETE FROM neon_auth.session WHERE token = $1', [token]);
    }

    res.setHeader("Set-Cookie", buildClearedSessionCookie(req));

    res.status(200).json({ ok: true });
    return;
  }

  // Handle /api/auth?action=delete-account
  if (action === "delete-account") {
    if (req.method !== "DELETE") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const userId = await getAuthedUserId(req);
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const userToDelete = await queryOne<{ email: string }>("SELECT email FROM users WHERE id = $1", [userId]);
      const userEmail = userToDelete?.email || "unknown";

      console.log(`🗑️ Initiating permanent deletion for user: ${userId}`);

      // Delete from public.users (this triggers ON DELETE CASCADE for everything else)
      await queryOne("DELETE FROM public.users WHERE id = $1", [userId]);

      // Delete from neon_auth.user (this wipes identity and login access)
      await queryOne("DELETE FROM neon_auth.user WHERE id = $1", [userId]);
      res.setHeader("Set-Cookie", buildClearedSessionCookie(req));

      console.log(`✅ Successfully wiped user: ${userId}`);

      await logEvent(null, {
        action: "USER_DELETED",
        resource: "auth/delete-account",
        oldValue: `Wiped all user data and identity for ${userEmail}`,
        userId,
        userEmail,
        severity: "critical",
        status: "success",
      });

      res.status(200).json({ ok: true, message: "Account deleted completely" });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
    return;
  }

  // Handle /api/auth?action=sync
  if (action === "sync") {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const userId = await getAuthedUserId(req);
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Look up the user from our database
      const dbUser = await queryOne<{
        id: string;
        email: string;
        full_name: string;
      }>("SELECT id, email, full_name FROM users WHERE id = $1", [userId]);

      if (!dbUser) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const body = req.body || {};
      const fullName =
        typeof body.fullName === "string"
          ? body.fullName
          : dbUser.full_name || "Unknown";

      // Update user's full_name if provided
      try {
        await queryOne(`UPDATE users SET full_name = $1 WHERE id = $2`, [
          fullName,
          userId,
        ]);
      } catch (dbError: unknown) {
        console.error("Database sync error (users table):", dbError);
      }

      // Ensure profile exists in our database
      try {
        await queryOne(
          "INSERT INTO profiles (user_id, full_name, currency) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING",
          [userId, fullName, "INR"],
        );
      } catch (dbError: unknown) {
        console.error("Database sync error (profiles table):", dbError);
      }

      await tryEnsureDefaultCategories(userId);

      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ error: "Server error" });
    }
    return;
  }

  // Handle /api/auth?action=signup
  if (action === "signup") {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const clientId = getClientId(req);
    const rateCheck = await checkRateLimit(clientId, "signup", true);
    if (!rateCheck.allowed) {
      await logEvent(null, {
        action: "USER_SIGNUP",
        resource: "auth/signup",
        newValue: "Rate limit hit for signup",
        userEmail: typeof req.body?.email === "string" ? req.body.email : "unknown",
        severity: "warning",
        status: "failure",
        metadata: { clientId }
      });
      res
        .status(429)
        .json({ error: "Too many signup attempts. Please try again later." });
      return;
    }

    try {
      const body = req.body || {};
      const email = typeof body.email === "string" ? body.email : "";
      const password = typeof body.password === "string" ? body.password : "";
      const fullName = typeof body.fullName === "string" ? body.fullName : "";

      if (!email || !password || !fullName) {
        await logEvent(null, {
          action: "USER_SIGNUP",
          resource: "auth/signup",
          newValue: "Validation error: Missing fields",
          userEmail: email || "unknown",
          severity: "warning",
          status: "failure",
        });
        res
          .status(400)
          .json({ error: "Email, password, and full name are required" });
        return;
      }

      // Neon Auth requires Origin header even for server-side calls
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name: fullName,
        fetchOptions: {
          headers: {
            Origin: getAuthOrigin(req),
          },
        },
      });

      if (error) {
        console.warn("Neon Auth signup rejected the request");
        await logEvent(null, {
          action: "USER_SIGNUP",
          resource: "auth/signup",
          newValue: error.message || "Signup failed",
          userEmail: email,
          severity: "warning",
          status: "failure",
          metadata: { error }
        });
        res.status(400).json({ error: error.message || "Signup failed" });
        return;
      }

      if (data?.user) {
        const token = data.token;
        if (!token) {
          res.status(502).json({ error: "Authentication session was not created" });
          return;
        }

        await logEvent(null, {
          action: "USER_SIGNUP",
          resource: "auth/signup",
          newValue: "User signed up successfully",
          userId: data.user.id,
          userEmail: email,
          severity: "info",
          status: "success",
          metadata: { fullName }
        });

        // Ensure user exists in our users table (required for foreign key in profiles)
        // Handle email conflict from legacy users
        try {
          await queryOne(
            `INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3)
                         ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
            [data.user.id, email, fullName],
          );
        } catch (dbError: unknown) {
          const details = asErrorDetails(dbError);
          const message =
            typeof details.message === "string" ? details.message : "";
          if (details.code === "23505" && message.includes("email")) {
            // Legacy user migration during signup
            console.warn(
              "Migrating legacy user during signup for Neon Auth ID:",
              data.user.id,
            );
            try {
              const legacy = await queryOne<{ id: string }>(
                "SELECT id FROM users WHERE email = $1 AND id != $2",
                [email, data.user.id],
              );
              if (legacy) {
                const oldId = legacy.id;
                await queryOne(
                  `UPDATE users SET email = 'migrating_' || email WHERE id = $1`,
                  [oldId],
                );
                await queryOne(
                  `INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name`,
                  [data.user.id, email, fullName],
                );
                const childTables = [
                  "debt_payments",
                  "debts",
                  "ai_insights",
                  "goals",
                  "budgets",
                  "transactions",
                  "categories",
                  "accounts",
                  "profiles",
                ];
                for (const table of childTables) {
                  await queryOne(
                    `UPDATE ${table} SET user_id = $1 WHERE user_id = $2`,
                    [data.user.id, oldId],
                  );
                }
                await queryOne("DELETE FROM users WHERE id = $1", [oldId]);
                console.log("Legacy user migration during signup complete.");
              }
            } catch (migrationError) {
              console.error(
                "Legacy user migration during signup failed:",
                migrationError,
              );
            }
          } else {
            console.error(
              "Database sync error during signup (users table):",
              dbError,
            );
          }
        }

        // Ensure profile exists in our database
        try {
          await queryOne(
            "INSERT INTO profiles (user_id, full_name, currency) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING RETURNING user_id",
            [data.user.id, fullName, "INR"],
          );
        } catch (dbError: unknown) {
          console.error(
            "Database sync error during signup (profiles table):",
            dbError,
          );
        }

        await tryEnsureDefaultCategories(data.user.id);

        res.setHeader("Set-Cookie", buildSessionCookie(token, req));
        res.status(201).json({
          user: {
            id: data.user.id,
            email: data.user.email,
            user_metadata: {
              full_name: data.user.name,
              avatar_url: data.user.image,
            },
            app_metadata: {},
            aud: "authenticated",
            created_at: data.user.createdAt,
          },
        });
      } else {
        res.status(500).json({ error: "Failed to create user" });
      }
    } catch (error: unknown) {
      const details = asErrorDetails(error);
      const message = getErrorMessage(error);
      console.error("Signup error:", error);
      if (
        details.status === 400 ||
        details.status === 409 ||
        message.includes("already exists")
      ) {
        res
          .status(400)
          .json({ error: message || "Invalid registration details" });
        return;
      }
      res.status(500).json({ error: "Server error" });
    }
    return;
  }

  // Handle /api/auth?action=login
  if (action === "login") {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const clientId = getClientId(req);
    const rateCheck = await checkRateLimit(clientId, "login", true);
    if (!rateCheck.allowed) {
      await logEvent(null, {
        action: "USER_LOGIN",
        resource: "auth/login",
        newValue: "Rate limit hit for login",
        userEmail: typeof req.body?.email === "string" ? req.body.email : "unknown",
        severity: "warning",
        status: "failure",
        metadata: { clientId }
      });
      res
        .status(429)
        .json({ error: "Too many login attempts. Please try again later." });
      return;
    }

    try {
      const body = req.body || {};
      const email = typeof body.email === "string" ? body.email : "";
      const password = typeof body.password === "string" ? body.password : "";

      if (!email || !password) {
        await logEvent(null, {
          action: "USER_LOGIN",
          resource: "auth/login",
          newValue: "Validation error: Missing email or password",
          userEmail: email || "unknown",
          severity: "warning",
          status: "failure",
        });
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      // Neon Auth requires Origin header even for server-side calls
      const { data, error } = await authClient.signIn.email({
        email,
        password,
        fetchOptions: {
          headers: {
            Origin: getAuthOrigin(req),
          },
        },
      });

      if (error) {
        await recordFailedAttempt(clientId, "login");
        console.warn("Neon Auth rejected a login attempt");
        
        await logEvent(null, {
          action: "USER_LOGIN",
          resource: "auth/login",
          newValue: error.message || "Login failed",
          userEmail: email,
          severity: "warning",
          status: "failure",
          metadata: { clientId, error }
        });

        const message = error.message?.includes(
          "missing authentication credentials",
        )
          ? error.message
          : "Invalid email or password";
        res.status(401).json({ error: message });
        return;
      }

      if (data?.user) {
        try {
          await queryOne(
            `INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3)
                         ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
            [data.user.id, data.user.email, data.user.name || "Unknown"],
          );
        } catch (dbError: unknown) {
          const details = asErrorDetails(dbError);
          const message =
            typeof details.message === "string" ? details.message : "";
          if (details.code === "23505" && message.includes("email")) {
            // Legacy user migration during login
            console.warn(
              "Migrating legacy user during login for Neon Auth ID:",
              data.user.id,
            );
            try {
              const legacy = await queryOne<{ id: string }>(
                "SELECT id FROM users WHERE email = $1 AND id != $2",
                [data.user.email, data.user.id],
              );
              if (legacy) {
                const oldId = legacy.id;
                await queryOne(
                  `UPDATE users SET email = 'migrating_' || email WHERE id = $1`,
                  [oldId],
                );
                await queryOne(
                  `INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name`,
                  [data.user.id, data.user.email, data.user.name || "Unknown"],
                );
                const childTables = [
                  "debt_payments",
                  "debts",
                  "ai_insights",
                  "goals",
                  "budgets",
                  "transactions",
                  "categories",
                  "accounts",
                  "profiles",
                ];
                for (const table of childTables) {
                  await queryOne(
                    `UPDATE ${table} SET user_id = $1 WHERE user_id = $2`,
                    [data.user.id, oldId],
                  );
                }
                await queryOne("DELETE FROM users WHERE id = $1", [oldId]);
                console.log("Legacy user migration during login complete.");
              }
            } catch (migrationError) {
              console.error(
                "Legacy user migration during login failed:",
                migrationError,
              );
            }
          } else {
            console.error(
              "Database sync error during login (users table):",
              dbError,
            );
          }
        }

        // Ensure profile exists in our database
        try {
          await queryOne(
            "INSERT INTO profiles (user_id, full_name, currency) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING",
            [data.user.id, data.user.name || "Unknown", "INR"],
          );
        } catch (dbError: unknown) {
          console.error(
            "Database sync error during login (profiles table):",
            dbError,
          );
        }

        await tryEnsureDefaultCategories(data.user.id);

        if (!data.token) {
          res.status(502).json({ error: "Authentication session was not created" });
          return;
        }

        await logEvent(null, {
          action: "USER_LOGIN",
          resource: "auth/login",
          newValue: "User logged in successfully",
          userId: data.user.id,
          userEmail: data.user.email,
          severity: "info",
          status: "success",
          metadata: { clientId }
        });

        res.setHeader("Set-Cookie", buildSessionCookie(data.token, req));
        res.status(200).json({
          user: {
            id: data.user.id,
            email: data.user.email,
            user_metadata: {
              full_name: data.user.name,
              avatar_url: data.user.image,
            },
            app_metadata: {},
            aud: "authenticated",
            created_at: data.user.createdAt,
          },
        });
      } else {
        res.status(401).json({ error: "Invalid email or password" });
      }
    } catch (error: unknown) {
      const details = asErrorDetails(error);
      const message = getErrorMessage(error);
      console.error("Login failed unexpectedly");

      // better-auth throws APIError for 400/401 responses
      if (message.includes("Email not verified")) {
        res.status(403).json({
          error: "Email not verified. Please verify your email before signing in.",
        });
        return;
      }

      if (
        message === "Invalid email or password" ||
        details.status === 401 ||
        details.status === 400
      ) {
        const responseMessage = message.includes(
          "missing authentication credentials",
        )
          ? message
          : "Invalid email or password";
        res.status(401).json({ error: responseMessage });
        return;
      }

      res.status(500).json({ error: "Server error" });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
