/**
 * `clapp run <file>` — load a prompt from a file and stream the response.
 *
 * Supports plain text, or markdown with an optional YAML-ish frontmatter
 * block at the top for overrides:
 *
 *   ---
 *   agent: research
 *   model: claude-opus-4-6
 *   ---
 *   Prompt body goes here, can span many lines.
 *
 * Unknown frontmatter keys pass through as `config` on the run payload.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RunOptions } from "../api";

export type ParsedPrompt = {
	text: string;
	options: RunOptions;
};

export function parsePromptFile(path: string): ParsedPrompt {
	const raw = readFileSync(resolve(path), "utf8");
	return parsePromptContent(raw);
}

export function parsePromptContent(raw: string): ParsedPrompt {
	const frontmatter = extractFrontmatter(raw);
	if (!frontmatter) return { text: raw.trim(), options: {} };

	const options: RunOptions = {};
	const config: NonNullable<RunOptions["config"]> = {};
	for (const [k, v] of Object.entries(frontmatter.data)) {
		if (k === "agent") options.agent = String(v);
		else if (k === "model") config.model = String(v);
		else if (k === "system") config.system = String(v);
		else if (k === "name") config.name = String(v);
	}
	if (Object.keys(config).length) options.config = config;
	return { text: frontmatter.body.trim(), options };
}

function extractFrontmatter(
	raw: string,
): { data: Record<string, string>; body: string } | null {
	if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) return null;
	const rest = raw.slice(4);
	const end = rest.indexOf("\n---");
	if (end === -1) return null;
	const headerBlock = rest.slice(0, end);
	const body = rest.slice(end + 4).replace(/^\r?\n/, "");
	const data: Record<string, string> = {};
	for (const line of headerBlock.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const colon = trimmed.indexOf(":");
		if (colon === -1) continue;
		const key = trimmed.slice(0, colon).trim();
		let value = trimmed.slice(colon + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (key) data[key] = value;
	}
	return { data, body };
}
