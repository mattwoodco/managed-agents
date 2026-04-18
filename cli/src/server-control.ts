/**
 * Helpers to manage the local Bun proxy server as a background process.
 *
 * - PID lives at ~/.clapp-proxy.pid so subsequent CLI invocations
 *   (across shells) can stop/status/log the same process.
 * - stdout/stderr of the child are appended to ~/.clapp-proxy.log so
 *   `clapp logs` has something to tail.
 * - serverDir defaults walk adjacent to the CLI install so `clapp`
 *   works from any cwd once linked globally.
 */

import { openSync, existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PROXY_LOG, PROXY_PID } from "./paths";

export function pidFilePath(): string {
	return PROXY_PID;
}

export function logFilePath(): string {
	return PROXY_LOG;
}

/**
 * Guess where `server/server.ts` lives. Priority:
 *   1. explicit argument
 *   2. ../server relative to the CLI source file (works for bun link and
 *      for `bun run src/index.ts` inside the repo)
 *   3. ../server relative to cwd (works for `cd cli && bun run ...`)
 */
export function resolveServerDir(explicit?: string): string {
	if (explicit) return resolve(explicit);

	const fromCli = resolve(
		fileURLToPath(import.meta.url),
		"..",
		"..",
		"..",
		"server",
	);
	if (existsSync(resolve(fromCli, "server.ts"))) return fromCli;

	const fromCwd = resolve(process.cwd(), "../server");
	if (existsSync(resolve(fromCwd, "server.ts"))) return fromCwd;

	return fromCli;
}

export function readPid(): number | null {
	if (!existsSync(PROXY_PID)) return null;
	const raw = readFileSync(PROXY_PID, "utf8").trim();
	const pid = Number(raw);
	return Number.isFinite(pid) && pid > 0 ? pid : null;
}

export function isRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

export async function waitForHealthy(
	baseUrl: string,
	timeoutMs = 10_000,
): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`${baseUrl}/health`);
			if (res.ok) return true;
		} catch {
			// not up yet
		}
		await new Promise((r) => setTimeout(r, 250));
	}
	return false;
}

export async function isReachable(baseUrl: string): Promise<boolean> {
	try {
		const res = await fetch(`${baseUrl}/health`);
		return res.ok;
	} catch {
		return false;
	}
}

/**
 * Spawn the proxy server detached so it survives the CLI exiting.
 * Resolves once /health responds OK or the timeout elapses.
 */
export async function startProxy(opts: {
	serverDir: string;
	envFile: string;
	port: number;
	baseUrl: string;
}): Promise<{ pid: number; logFile: string; reused: boolean }> {
	const existing = readPid();
	if (existing && isRunning(existing) && (await isReachable(opts.baseUrl))) {
		return { pid: existing, logFile: PROXY_LOG, reused: true };
	}

	const entry = resolve(opts.serverDir, "server.ts");
	if (!existsSync(entry)) {
		throw new Error(`server entry not found: ${entry}`);
	}

	const logFd = openSync(PROXY_LOG, "a");
	const child = spawn("bun", [`--env-file=${opts.envFile}`, "run", entry], {
		cwd: opts.serverDir,
		env: { ...process.env, PORT: String(opts.port) },
		stdio: ["ignore", logFd, logFd],
		detached: true,
	});
	child.unref();

	if (!child.pid) throw new Error("failed to spawn server");
	writeFileSync(PROXY_PID, String(child.pid));

	const healthy = await waitForHealthy(opts.baseUrl);
	if (!healthy) {
		throw new Error(
			`server started (pid ${child.pid}) but did not become healthy at ${opts.baseUrl}. See ${PROXY_LOG}.`,
		);
	}
	return { pid: child.pid, logFile: PROXY_LOG, reused: false };
}

export function stopProxy(): { stopped: boolean; pid: number | null } {
	const pid = readPid();
	if (!pid) return { stopped: false, pid: null };
	try {
		process.kill(pid, "SIGTERM");
	} catch {
		// already dead
	}
	try {
		unlinkSync(PROXY_PID);
	} catch {
		// ignore
	}
	return { stopped: true, pid };
}
