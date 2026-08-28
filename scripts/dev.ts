import { spawn, execSync } from "child_process";

console.log("Starting Fullstack Development Server...");

const PORT = 3001;

function freePort(port: number) {
	try {
		if (process.platform === "win32") {
			const output = execSync(`netstat -ano | findstr :${port}`, {
				encoding: "utf8",
			});
			const lines = output.trim().split("\n");
			for (const line of lines) {
				const match = line.match(/LISTENING\s+(\d+)/);
				if (match && match[1]) {
					const pid = match[1];
					console.log(
						`Port ${port} is in use by PID ${pid}. Terminating process to free the port...`,
					);
					execSync(`taskkill /F /PID ${pid}`);
				}
			}
		} else {
			const pid = execSync(`lsof -t -i:${port}`, { encoding: "utf8" }).trim();
			if (pid) {
				console.log(
					`Port ${port} is in use by PID ${pid}. Terminating process to free the port...`,
				);
				execSync(`kill -9 ${pid}`);
			}
		}
	} catch (_e) {
		// Port is free
	}
}

freePort(3001);
freePort(5173);

const api = spawn("bun", ["--watch", "api/_server.ts"], {
	stdio: "inherit",
	shell: true,
	env: { ...process.env, PORT: String(PORT) },
});

const vite = spawn("bunx", ["--bun", "vite"], {
	stdio: "inherit",
	shell: true,
});

api.on("close", (code) => {
	vite.kill();
	process.exit(code ?? 0);
});

vite.on("close", (code) => {
	api.kill();
	process.exit(code ?? 0);
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
