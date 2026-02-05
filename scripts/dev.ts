
import { spawn } from "child_process";

console.log("Starting Fullstack Development Server...");

const api = spawn("bun", ["--watch", "api/_server.ts"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, PORT: "3001" }
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
