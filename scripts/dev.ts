
import { spawn, execSync } from "child_process";

console.log("Starting Fullstack Development Server...");

const PORT = 3001;

// Gracefully free port 3001 if already in use
try {
    if (process.platform === "win32") {
        const output = execSync(`netstat -ano | findstr :${PORT}`, { encoding: "utf8" });
        const match = output.match(/LISTENING\s+(\d+)/);
        if (match && match[1]) {
            const pid = match[1];
            console.log(`Port ${PORT} is in use by PID ${pid}. Terminating process to free the port...`);
            execSync(`taskkill /F /PID ${pid}`);
        }
    } else {
        const pid = execSync(`lsof -t -i:${PORT}`, { encoding: "utf8" }).trim();
        if (pid) {
            console.log(`Port ${PORT} is in use by PID ${pid}. Terminating process to free the port...`);
            execSync(`kill -9 ${pid}`);
        }
    }
} catch (_e) {
    // Port is free or commands failed (meaning no process was found listening)
}

const api = spawn("bun", ["--watch", "api/server.ts"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, PORT: String(PORT) }
});

const vite = spawn("bunx", ["--bun", "vite"], {
    stdio: "inherit",
    shell: true
});

process.on("SIGINT", () => {
    api.kill();
    vite.kill();
    process.exit();
});

process.on("exit", () => {
    api.kill();
    vite.kill();
});
