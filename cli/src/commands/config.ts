/**
 * `clapp config {get,set,list,path}` — manage ~/.clapprc.json.
 * Supports dotted keys for nested access (`agents.default.model`).
 */

import { style } from "@stacksjs/clapp";
import { loadUserConfig, saveUserConfig } from "../config";
import { USER_CONFIG } from "../paths";

export function runConfigList(): void {
	const cfg = loadUserConfig();
	if (!Object.keys(cfg).length) {
		console.log(style.dim(`(empty) ${USER_CONFIG}`));
		return;
	}
	console.log(style.dim(USER_CONFIG));
	console.log(JSON.stringify(cfg, null, 2));
}

export function runConfigGet(key: string): void {
	const cfg = loadUserConfig();
	const value = getPath(cfg, key);
	if (value === undefined) {
		console.error(style.yellow(`not set: ${key}`));
		process.exit(1);
	}
	console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

export function runConfigSet(key: string, value: string): void {
	const cfg = loadUserConfig();
	const parsed = tryJson(value);
	setPath(cfg, key, parsed);
	saveUserConfig(cfg);
	console.log(style.green(`set ${key}`));
}

export function runConfigPath(): void {
	console.log(USER_CONFIG);
}

function tryJson(v: string): unknown {
	try {
		return JSON.parse(v);
	} catch {
		return v;
	}
}

function getPath(obj: Record<string, unknown>, key: string): unknown {
	const parts = key.split(".");
	let cur: unknown = obj;
	for (const part of parts) {
		if (cur === null || typeof cur !== "object") return undefined;
		cur = (cur as Record<string, unknown>)[part];
	}
	return cur;
}

function setPath(
	obj: Record<string, unknown>,
	key: string,
	value: unknown,
): void {
	const parts = key.split(".");
	let cur = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const k = parts[i]!;
		const next = cur[k];
		if (next === null || typeof next !== "object") {
			cur[k] = {};
		}
		cur = cur[k] as Record<string, unknown>;
	}
	cur[parts[parts.length - 1]!] = value;
}
