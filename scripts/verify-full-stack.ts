import { spawn } from "child_process";
import { query, queryOne } from "../api/_db.ts";
import crypto from "crypto";

console.log("====================================================");
console.log("🕵️‍♂️  STARTING E2E ENDPOINT & NEONDB VERIFICATION  🕵️‍♂️");
console.log("====================================================\n");

async function main() {
    let testSessionToken = "";
    let testSessionId = "";
    let testUserId = "";
    let createdTempSession = false;

    // --- STEP 1: Verify NeonDB Connectivity & Obtain Active Session ---
    console.log("📡 [1/4] Verifying NeonDB Database Connectivity...");
    try {
        // Query to check connectivity
        const usersCount = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users");
        console.log(`✅ Database connection successful! Total users in database: ${usersCount?.count || 0}`);

        // Search for an active session to use for authenticated endpoints
        console.log("🔍 Looking for an active session in the database...");
        const activeSession = await queryOne<{ token: string; userId: string }>(
            `SELECT token, "userId" FROM neon_auth.session WHERE "expiresAt" > NOW() ORDER BY "expiresAt" DESC LIMIT 1`
        );

        if (activeSession) {
            testSessionToken = activeSession.token;
            testUserId = activeSession.userId;
            console.log(`✅ Found active session for userId: ${testUserId}`);
        } else {
            console.log("⚠️ No active session found. Creating a temporary test session...");
            // Get first available user to assign session to
            const firstUser = await queryOne<{ id: string }>("SELECT id FROM users LIMIT 1");
            if (!firstUser) {
                throw new Error("Cannot run E2E tests: No users exist in the database!");
            }
            
            testUserId = firstUser.id;
            testSessionToken = "test_verification_session_" + crypto.randomBytes(8).toString("hex");
            testSessionId = crypto.randomUUID();

            await query(
                `INSERT INTO neon_auth.session (id, token, "userId", "expiresAt", "createdAt", "updatedAt", "ipAddress", "userAgent")
                 VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour', NOW(), NOW(), '127.0.0.1', 'Verification E2E Agent')`,
                [testSessionId, testSessionToken, testUserId]
            );

            createdTempSession = true;
            console.log(`✅ Temporary session created successfully (Session ID: ${testSessionId})`);
        }
    } catch (dbError) {
        console.error("❌ NeonDB Verification Failed!");
        console.error(dbError);
        process.exit(1);
    }

    // --- STEP 2: Launch local API server ---
    console.log("\n🚀 [2/4] Starting Local API Server on Port 3001...");
    const apiServer = spawn("bun", ["api/_server.ts"], {
        env: { ...process.env, PORT: "3001", USE_MOCK_DB: "false" },
        shell: true
    });

    // Wait for server to bind to port
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log("✅ API Server started and ready for requests.");

    // --- STEP 3: E2E Endpoint Testing ---
    console.log("\n🧪 [3/4] Running End-To-End HTTP Tests against API Endpoints...");
    
    const endpointsToTest = [
        { name: "Auth (Me)", path: "/api/auth?action=me", method: "GET" },
        { name: "Accounts", path: "/api/accounts", method: "GET" },
        { name: "Categories", path: "/api/categories", method: "GET" },
        { name: "Budgets", path: "/api/budgets", method: "GET" },
        { name: "Goals", path: "/api/goals", method: "GET" },
        { name: "Debts", path: "/api/debts", method: "GET" },
        { name: "Notifications", path: "/api/notifications", method: "GET" },
        { name: "Profile", path: "/api/profile", method: "GET" },
        { name: "Transactions", path: "/api/transactions", method: "GET" },
        { name: "AI Insights", path: "/api/ai/insights", method: "GET" }
    ];

    const results: { name: string; path: string; method: string; status: number; ok: boolean; responseTimeMs: number; error?: string }[] = [];

    // Helper to request each endpoint
    async function testEndpoint(name: string, path: string, method: string, body?: any) {
        const url = `http://localhost:3001${path}`;
        const start = Date.now();
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${testSessionToken}`,
                    "Cookie": `better-auth.session_token=${testSessionToken}`,
                    "Origin": "http://localhost:5173" // Valid origin required by _server.ts CORS check
                },
                body: body ? JSON.stringify(body) : undefined
            });

            const duration = Date.now() - start;
            let responseText = "";
            try {
                responseText = await response.text();
            } catch {}

            const isOk = response.ok;
            results.push({
                name,
                path,
                method,
                status: response.status,
                ok: isOk,
                responseTimeMs: duration,
                error: isOk ? undefined : `Response: ${responseText.substring(0, 100)}`
            });
        } catch (err: any) {
            results.push({
                name,
                path,
                method,
                status: 0,
                ok: false,
                responseTimeMs: Date.now() - start,
                error: err.message || String(err)
            });
        }
    }

    // Run GET requests
    for (const ep of endpointsToTest) {
        await testEndpoint(ep.name, ep.path, ep.method);
    }

    // Test POST AI Chat endpoint
    console.log("🤖 Testing AI Chat Endpoint with Gemini key...");
    const geminiKey = process.env.GEMINI_API_KEY || "demo-key";
    await testEndpoint(
        "AI Chat (POST)",
        "/api/ai/chat",
        "POST",
        {
            message: "Hello! Show me a summary of my active budgets.",
            aiPreferences: {
                aiProvider: "gemini",
                geminiApiKey: geminiKey
            }
        }
    );

    // --- STEP 4: Cleanup & Output Dashboard ---
    console.log("\n🧹 [4/4] Cleaning Up Dev Processes & Test Sessions...");
    
    // Kill the spawned API server
    apiServer.kill("SIGINT");

    // Delete temp session if created
    if (createdTempSession && testSessionId) {
        try {
            await query('DELETE FROM neon_auth.session WHERE id = $1', [testSessionId]);
            console.log(`✅ Temporary session token (${testSessionId}) successfully deleted from NeonDB.`);
        } catch (cleanupErr) {
            console.warn("⚠️ Failed to clean up temporary session token:", cleanupErr);
        }
    }

    // --- PRINT DETAILED DASHBOARD ---
    console.log("\n====================================================");
    console.log("📊              VERIFICATION RESULTS               📊");
    console.log("====================================================");
    
    let allPassed = true;
    for (const res of results) {
        const statusEmoji = res.ok ? "🟢 PASSED" : "🔴 FAILED";
        const latency = `${res.responseTimeMs}ms`.padStart(6);
        console.log(
            `[${statusEmoji}] ${res.name.padEnd(16)} | ${res.method.padEnd(4)} ${res.path.padEnd(25)} | HTTP ${res.status.toString().padEnd(3)} | ${latency}`
        );
        if (!res.ok) {
            allPassed = false;
            console.log(`          ↳ ❌ Error: ${res.error}`);
        }
    }
    console.log("====================================================");
    
    if (allPassed) {
        console.log("🎉 SUCCESS! NeonDB and all endpoints verified successfully! 🎉");
        process.exit(0);
    } else {
        console.error("⚠️ WARNING: Some endpoints returned error statuses or failed. Please check logs.");
        process.exit(1);
    }
}

main();
