/**
 * Walk up from cwd looking for .env.local / .env, merging values into
 * process.env without clobbering what the user already set. We avoid
 * dotenv because Bun's runtime already supports --env-file for the
 * proxy; this helper exists purely for the CLI process itself when
 * commands (like `doctor`) need to *read* ANTHROPIC_API_KEY.
 */

import { existsSync, readFileSync } from "node:fs";
import { findUp } from "./paths";

const ENV_FILES = [".env.local", ".env"];

export function loadEnvFromNearby(startDir = process.cwd()): string | null {
	for (const name of ENV_FILES) {
		const found = findUp(startDir, name);
		if (!found) continue;
		applyEnvFile(found);
		return found;
	}
	return null;
}

function applyEnvFile(path: string): void {
	if (!existsSync(path)) return;
	const raw = readFileSync(path, "utf8");
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (!(key in process.env)) {
			process.env[key] = value;
		}
	}
}

/**
 * Resolve the env file the proxy should use. Prefer .env.local next to
 * the server/ dir, then walk up from cwd.
 */
export function resolveEnvFile(
	serverDir: string,
	startDir = process.cwd(),
): string | null {
	const candidates = [
		`${serverDir}/.env.local`,
		`${serverDir}/../.env.local`,
		`${serverDir}/.env`,
		`${serverDir}/../.env`,
	];
	for (const c of candidates) {
		if (existsSync(c)) return c;
	}
	for (const name of ENV_FILES) {
		const f = findUp(startDir, name);
		if (f) return f;
	}
	return null;
}
