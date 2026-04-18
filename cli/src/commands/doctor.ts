/**
 * `clapp doctor` — environment / setup sanity check.
 * Each check is isolated so one failure never masks another.
 */

import { existsSync } from "node:fs";
import { style } from "@stacksjs/clapp";
import { loadEnvFromNearby } from "../env";
import { isReachable, resolveServerDir } from "../server-control";
import { loadConfig } from "../config";
import { resolve } from "node:path";

type CheckResult = { name: string; ok: boolean; detail?: string };

async function checkBun(): Promise<CheckResult> {
	const version = typeof Bun !== "undefined" ? Bun.version : null;
	return version
		? { name: "bun runtime", ok: true, detail: version }
		: { name: "bun runtime", ok: false, detail: "not detected (install: https://bun.sh)" };
}

function checkApiKey(): CheckResult {
	const envFile = loadEnvFromNearby();
	const key = process.env.ANTHROPIC_API_KEY;
	if (!key) {
		return {
			name: "ANTHROPIC_API_KEY",
			ok: false,
			detail: envFile
				? `found env file ${envFile} but no ANTHROPIC_API_KEY in it`
				: "no .env.local or .env found in cwd or parents",
		};
	}
	const masked = key.length > 12 ? `${key.slice(0, 10)}…${key.slice(-4)}` : "(short)";
	return {
		name: "ANTHROPIC_API_KEY",
		ok: true,
		detail: envFile ? `${masked} (from ${envFile})` : masked,
	};
}

function checkServer(): CheckResult {
	const dir = resolveServerDir();
	const entry = resolve(dir, "server.ts");
	return existsSync(entry)
		? { name: "server source", ok: true, detail: entry }
		: { name: "server source", ok: false, detail: `missing ${entry}` };
}

async function checkProxy(url: string): Promise<CheckResult> {
	const up = await isReachable(url);
	return up
		? { name: "proxy reachable", ok: true, detail: url }
		: { name: "proxy reachable", ok: false, detail: `${url} (auto-started by commands as needed)` };
}

async function checkAnthropic(): Promise<CheckResult> {
	const key = process.env.ANTHROPIC_API_KEY;
	if (!key) return { name: "api.anthropic.com auth", ok: false, detail: "no key" };
	try {
		const res = await fetch("https://api.anthropic.com/v1/models", {
			headers: {
				"x-api-key": key,
				"anthropic-version": "2023-06-01",
			},
		});
		if (res.ok) return { name: "api.anthropic.com auth", ok: true, detail: `${res.status}` };
		if (res.status === 401) return { name: "api.anthropic.com auth", ok: false, detail: "401 — invalid key" };
		return { name: "api.anthropic.com auth", ok: false, detail: `status ${res.status}` };
	} catch (err) {
		return { name: "api.anthropic.com auth", ok: false, detail: String(err) };
	}
}

function render(results: CheckResult[]): number {
	let failures = 0;
	for (const r of results) {
		const mark = r.ok ? style.green("✓") : style.red("✗");
		const detail = r.detail ? style.dim(` — ${r.detail}`) : "";
		console.log(`${mark} ${r.name}${detail}`);
		if (!r.ok) failures++;
	}
	return failures;
}

export async function runDoctor(url: string): Promise<void> {
	loadEnvFromNearby();
	const cfg = loadConfig();
	const effectiveUrl = url || (cfg.url as string) || "http://localhost:8787";

	const checks = await Promise.all([
		checkBun(),
		Promise.resolve(checkApiKey()),
		Promise.resolve(checkServer()),
		checkProxy(effectiveUrl),
		checkAnthropic(),
	]);

	console.log(style.bold("\nclapp doctor"));
	console.log(style.dim(`proxy url: ${effectiveUrl}\n`));
	const failures = render(checks);
	console.log();
	if (failures === 0) {
		console.log(style.green("all checks passed."));
		return;
	}
	console.log(style.yellow(`${failures} issue${failures === 1 ? "" : "s"} found.`));
	process.exit(1);
}
