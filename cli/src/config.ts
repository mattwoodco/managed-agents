/**
 * Layered config resolution for the CLI.
 *
 * Precedence (highest wins):
 *   1. explicit CLI flags (handled at the call site)
 *   2. project config   (.clapp/config.json walked up from cwd)
 *   3. user config      (~/.clapprc.json)
 *   4. hard-coded defaults
 *
 * We keep the shape deliberately small — extra keys are allowed and
 * passed through verbatim so server upgrades don't force a CLI change.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { projectConfigPath, USER_CONFIG } from "./paths";

export type AgentConfig = {
	name?: string;
	model?: string;
	system?: string;
	tools?: unknown[];
};

export type ClappConfig = {
	url?: string;
	agent?: string;
	agents?: Record<string, AgentConfig>;
} & Record<string, unknown>;

export const DEFAULT_CONFIG: Required<Pick<ClappConfig, "url" | "agent">> = {
	url: "http://localhost:8787",
	agent: "default",
};

function safeReadJson(path: string): ClappConfig | null {
	try {
		if (!existsSync(path)) return null;
		const raw = readFileSync(path, "utf8");
		const parsed = JSON.parse(raw);
		return typeof parsed === "object" && parsed ? (parsed as ClappConfig) : null;
	} catch {
		return null;
	}
}

function mergeConfigs(...layers: (ClappConfig | null)[]): ClappConfig {
	const merged: ClappConfig = {};
	for (const layer of layers) {
		if (!layer) continue;
		for (const [k, v] of Object.entries(layer)) {
			if (v === undefined) continue;
			if (k === "agents" && typeof v === "object" && v !== null) {
				merged.agents = { ...(merged.agents ?? {}), ...(v as Record<string, AgentConfig>) };
				continue;
			}
			merged[k] = v;
		}
	}
	return merged;
}

export function loadConfig(startDir = process.cwd()): ClappConfig {
	const user = safeReadJson(USER_CONFIG);
	const projectPath = projectConfigPath(startDir);
	const project = projectPath ? safeReadJson(projectPath) : null;
	return mergeConfigs({ ...DEFAULT_CONFIG }, user, project);
}

export function loadUserConfig(): ClappConfig {
	return safeReadJson(USER_CONFIG) ?? {};
}

export function saveUserConfig(cfg: ClappConfig): void {
	mkdirSync(dirname(USER_CONFIG), { recursive: true });
	writeFileSync(USER_CONFIG, JSON.stringify(cfg, null, 2) + "\n");
}

export function loadProjectConfig(startDir = process.cwd()): ClappConfig | null {
	const path = projectConfigPath(startDir);
	return path ? safeReadJson(path) : null;
}

export function resolveAgentConfig(
	cfg: ClappConfig,
	name: string,
): AgentConfig {
	return cfg.agents?.[name] ?? {};
}
