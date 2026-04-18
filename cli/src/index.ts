#!/usr/bin/env bun
/**
 * clapp CLI for the local Managed Agents proxy server.
 *
 * Commands:
 *   ask "<text>"            one-shot prompt, streams to stdout
 *   chat                    interactive REPL loop
 *   run <file>              run a prompt from a text/markdown file
 *   health                  pretty-prints the proxy /health
 *   sessions                list recent sessions
 *   logs [--follow]         tail the proxy log
 *   init                    scaffold .clapp/config.json
 *   config {get,set,list,path}
 *   doctor                  environment sanity check
 *   server:{start,stop,status}
 *
 * Every user-facing command auto-starts the local proxy if it's not
 * already running, unless --url points to a remote host.
 *
 * Global options:
 *   -u, --url <url>         proxy base URL (default from config / env)
 *       --raw               print raw SSE events instead of prettified text
 *       --agent <name>      agent profile to use (default "default")
 */

import { resolve } from "node:path";
import { cli, style } from "@stacksjs/clapp";
import { health, startRun, streamSession, type RunOptions } from "./api";
import { renderEvent, type RenderMode } from "./render";
import {
	isRunning,
	logFilePath,
	pidFilePath,
	readPid,
	resolveServerDir,
	startProxy,
	stopProxy,
} from "./server-control";
import { ensureProxy } from "./ensure-proxy";
import { loadConfig, resolveAgentConfig, DEFAULT_CONFIG } from "./config";
import { loadEnvFromNearby, resolveEnvFile } from "./env";
import { runInit, type InitOptions } from "./commands/init";
import { runLogs, type LogsOptions } from "./commands/logs";
import { runSessions } from "./commands/sessions";
import {
	runConfigGet,
	runConfigList,
	runConfigPath,
	runConfigSet,
} from "./commands/config";
import { runDoctor } from "./commands/doctor";
import { parsePromptFile } from "./commands/run-file";

loadEnvFromNearby();

const CFG = loadConfig();
const DEFAULT_URL = (CFG.url as string) || DEFAULT_CONFIG.url;
const DEFAULT_AGENT = (CFG.agent as string) || DEFAULT_CONFIG.agent;

const app = cli("clapp");

app.option("-u, --url <url>", "Proxy base URL", { default: DEFAULT_URL });
app.option("--raw", "Print raw SSE events instead of prettified text");
app.option("--agent <name>", "Agent profile to use", { default: DEFAULT_AGENT });

type GlobalOpts = { url: string; raw?: boolean; agent?: string };

function getMode(opts: GlobalOpts): RenderMode {
	return opts.raw ? "raw" : "pretty";
}

function runOptionsFor(opts: GlobalOpts): RunOptions {
	const agent = opts.agent ?? DEFAULT_AGENT;
	const config = resolveAgentConfig(CFG, agent);
	const runOpts: RunOptions = { agent };
	if (Object.keys(config).length) runOpts.config = config;
	return runOpts;
}

async function streamAnswer(
	text: string,
	opts: GlobalOpts,
): Promise<void> {
	await ensureProxy(opts.url);
	const sessionId = await startRun(opts.url, text, runOptionsFor(opts));
	process.stdout.write(style.dim(`session ${sessionId}\n`));
	const mode = getMode(opts);
	for await (const evt of streamSession(opts.url, sessionId)) {
		renderEvent(evt, mode);
	}
}

function fail(err: unknown): never {
	console.error(
		style.red(`error: ${err instanceof Error ? err.message : String(err)}`),
	);
	process.exit(1);
}

app
	.command("ask <text>", "Send a one-shot prompt and stream the response")
	.action(async (text: string, opts: GlobalOpts) => {
		try {
			await streamAnswer(text, opts);
		} catch (err) {
			fail(err);
		}
	});

app
	.command("chat", "Start an interactive chat loop")
	.action(async (opts: GlobalOpts) => {
		const { text, isCancel } = await import("@stacksjs/clapp");
		try {
			await ensureProxy(opts.url);
		} catch (err) {
			fail(err);
		}
		console.log(style.bold("clapp chat — Ctrl+C or empty line to exit"));
		console.log(style.dim(`proxy: ${opts.url}  agent: ${opts.agent ?? DEFAULT_AGENT}\n`));

		while (true) {
			const input = (await text({
				message: "you",
				placeholder: "type a prompt",
			})) as unknown;

			if (typeof isCancel === "function" && isCancel(input)) break;
			const prompt = typeof input === "string" ? input.trim() : "";
			if (!prompt) break;

			try {
				await streamAnswer(prompt, opts);
				process.stdout.write("\n");
			} catch (err) {
				console.error(
					style.red(`error: ${err instanceof Error ? err.message : err}`),
				);
			}
		}
		console.log(style.dim("bye."));
	});

app
	.command("run <file>", "Run a prompt loaded from a text or markdown file")
	.action(async (file: string, opts: GlobalOpts) => {
		try {
			const { text, options: fileOpts } = parsePromptFile(file);
			if (!text) throw new Error(`${file}: prompt body is empty`);
			const merged: GlobalOpts = {
				...opts,
				agent: fileOpts.agent ?? opts.agent,
			};
			const runOpts = runOptionsFor(merged);
			if (fileOpts.config) {
				runOpts.config = { ...(runOpts.config ?? {}), ...fileOpts.config };
			}
			await ensureProxy(merged.url);
			const sessionId = await startRun(merged.url, text, runOpts);
			process.stdout.write(style.dim(`session ${sessionId}\n`));
			const mode = getMode(merged);
			for await (const evt of streamSession(merged.url, sessionId)) {
				renderEvent(evt, mode);
			}
		} catch (err) {
			fail(err);
		}
	});

app
	.command("health", "Check proxy server health")
	.action(async (opts: GlobalOpts) => {
		try {
			await ensureProxy(opts.url);
			const payload = await health(opts.url);
			console.log(JSON.stringify(payload, null, 2));
		} catch (err) {
			fail(err);
		}
	});

app
	.command("sessions", "List recent sessions (in-memory on the proxy)")
	.action(async (opts: GlobalOpts) => {
		try {
			await ensureProxy(opts.url);
			await runSessions(opts.url);
		} catch (err) {
			fail(err);
		}
	});

app
	.command("logs", "Tail the proxy log file")
	.option("-f, --follow", "Follow the log as new lines are written")
	.option("-n, --lines <n>", "How many historical lines to show", { default: 50 })
	.option("--raw", "Print raw log lines without JSON parsing")
	.action(async (opts: LogsOptions) => {
		try {
			await runLogs(opts);
		} catch (err) {
			fail(err);
		}
	});

app
	.command("init", "Scaffold .clapp/config.json in the current directory")
	.option("--agent <name>", "Agent profile name")
	.option("--model <model>", "Model id")
	.option("--system <prompt>", "System prompt")
	.option("--force", "Overwrite an existing .clapp/config.json")
	.action(async (opts: InitOptions) => {
		try {
			await runInit(opts);
		} catch (err) {
			fail(err);
		}
	});

app
	.command("doctor", "Run environment / setup health checks")
	.action(async (opts: GlobalOpts) => {
		try {
			await runDoctor(opts.url);
		} catch (err) {
			fail(err);
		}
	});

app.command("config:list", "List the user config (~/.clapprc.json)").action(() => {
	runConfigList();
});

app.command("config:path", "Print path to the user config file").action(() => {
	runConfigPath();
});

app
	.command("config:get <key>", "Read a dotted key from the user config")
	.action((key: string) => {
		runConfigGet(key);
	});

app
	.command("config:set <key> <value>", "Write a dotted key into the user config")
	.action((key: string, value: string) => {
		runConfigSet(key, value);
	});

app
	.command("server:start", "Start the proxy server in the background")
	.option("-p, --port <port>", "Port to bind", { default: 8787 })
	.option("--server-dir <path>", "Path to the server/ folder")
	.option("--env-file <path>", "Path to the env file")
	.action(
		async (opts: { port: number; serverDir?: string; envFile?: string }) => {
			try {
				const serverDir = resolveServerDir(opts.serverDir);
				const envFile =
					(opts.envFile && resolve(opts.envFile)) ||
					resolveEnvFile(serverDir) ||
					"";
				if (!envFile) {
					throw new Error(
						"no env file found; pass --env-file or run `clapp doctor`.",
					);
				}
				const baseUrl = `http://localhost:${opts.port}`;
				const { pid, logFile, reused } = await startProxy({
					serverDir,
					envFile,
					port: Number(opts.port),
					baseUrl,
				});
				console.log(
					reused
						? style.dim(`already running: pid ${pid}`)
						: style.green(`proxy running: pid ${pid}`),
				);
				console.log(style.dim(`url:  ${baseUrl}`));
				console.log(style.dim(`env:  ${envFile}`));
				console.log(style.dim(`log:  ${logFile}`));
				console.log(style.dim(`pid:  ${pidFilePath()}`));
			} catch (err) {
				fail(err);
			}
		},
	);

app.command("server:stop", "Stop the background proxy server").action(() => {
	const { stopped, pid } = stopProxy();
	if (!stopped) {
		console.log(style.dim("no proxy pid recorded; nothing to stop."));
		return;
	}
	console.log(style.green(`stopped pid ${pid}`));
});

app.command("server:status", "Show background proxy status").action(() => {
	const pid = readPid();
	if (!pid) {
		console.log(style.dim("no proxy recorded."));
		return;
	}
	const alive = isRunning(pid);
	console.log(
		alive
			? style.green(`running: pid ${pid}`)
			: style.yellow(`stale pid ${pid} (process gone)`),
	);
	console.log(style.dim(`log: ${logFilePath()}`));
});

app.help();
app.version("0.2.0");
app.parse();
