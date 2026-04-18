/**
 * `clapp init` — scaffold .clapp/config.json in the current directory.
 * Interactive when possible; accepts flags for CI.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { style, text, isCancel } from "@stacksjs/clapp";
import type { ClappConfig } from "../config";

export type InitOptions = {
	agent?: string;
	model?: string;
	system?: string;
	force?: boolean;
};

const DEFAULT_MODEL = "claude-opus-4-6";

export async function runInit(opts: InitOptions): Promise<void> {
	const dir = join(process.cwd(), ".clapp");
	const cfgPath = join(dir, "config.json");

	if (existsSync(cfgPath) && !opts.force) {
		console.error(
			style.yellow(`config already exists: ${cfgPath}`),
		);
		console.error(style.dim("re-run with --force to overwrite."));
		return;
	}

	const agentName = opts.agent ?? (await promptText("Agent profile name:", "default"));
	if (agentName === null) return;

	const model = opts.model ?? (await promptText("Model:", DEFAULT_MODEL));
	if (model === null) return;

	const system =
		opts.system ??
		(await promptText(
			"System prompt:",
			"You are a concise, helpful assistant.",
		));
	if (system === null) return;

	const config: ClappConfig = {
		agent: agentName,
		agents: {
			[agentName]: {
				name: `clapp-${agentName}`,
				model,
				system,
			},
		},
	};

	mkdirSync(dir, { recursive: true });
	writeFileSync(cfgPath, JSON.stringify(config, null, 2) + "\n");
	console.log(style.green(`wrote ${cfgPath}`));
	console.log(
		style.dim(
			`this agent will be minted on first use; edit ${cfgPath} any time.`,
		),
	);
}

async function promptText(
	message: string,
	defaultValue: string,
): Promise<string | null> {
	const answer = (await text({
		message,
		defaultValue,
		placeholder: defaultValue,
	})) as unknown;
	if (isCancelLike(answer)) return null;
	const str = typeof answer === "string" ? answer.trim() : "";
	return str || defaultValue;
}

function isCancelLike(v: unknown): boolean {
	return typeof isCancel === "function" && isCancel(v);
}
