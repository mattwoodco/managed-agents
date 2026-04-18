/**
 * Single place for every filesystem path the CLI owns.
 * Tests and future callers import from here rather than hard-coding.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const HOME = homedir();

/** CLI-level global config. */
export const USER_CONFIG = join(HOME, ".clapprc.json");

/** Background proxy pid/log (owned by server-control). */
export const PROXY_PID = join(HOME, ".clapp-proxy.pid");
export const PROXY_LOG = join(HOME, ".clapp-proxy.log");

/** Project-local state, created by `clapp init`. */
export const PROJECT_DIR_NAME = ".clapp";
export const PROJECT_CONFIG_NAME = "config.json";

/** Walk up from startDir looking for the first match. */
export function findUp(
	startDir: string,
	filename: string,
	stopAt = "/",
): string | null {
	let dir = resolve(startDir);
	while (true) {
		const candidate = join(dir, filename);
		if (existsSync(candidate)) return candidate;
		if (dir === stopAt) return null;
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

/** Walk up looking for a directory (not file). */
export function findUpDir(
	startDir: string,
	name: string,
	stopAt = "/",
): string | null {
	let dir = resolve(startDir);
	while (true) {
		const candidate = join(dir, name);
		if (existsSync(candidate)) return candidate;
		if (dir === stopAt) return null;
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

export function projectConfigPath(startDir = process.cwd()): string | null {
	const dir = findUpDir(startDir, PROJECT_DIR_NAME);
	if (!dir) return null;
	const candidate = join(dir, PROJECT_CONFIG_NAME);
	return existsSync(candidate) ? candidate : null;
}
