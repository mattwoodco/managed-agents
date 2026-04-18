/**
 * `clapp logs` — print the proxy log file, optionally tailing.
 * Also parses structured JSON log lines and pretty-prints them.
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import { watch } from "node:fs";
import { style } from "@stacksjs/clapp";
import { logFilePath } from "../server-control";

export type LogsOptions = {
	follow?: boolean;
	raw?: boolean;
	lines?: number;
};

const LEVEL_COLOR: Record<string, (s: string) => string> = {
	fatal: (s) => style.red(style.bold(s)),
	error: (s) => style.red(s),
	warn: (s) => style.yellow(s),
	info: (s) => style.green(s),
	debug: (s) => style.dim(s),
};

function format(line: string, raw: boolean): string {
	if (raw) return line;
	const trimmed = line.trim();
	if (!trimmed) return "";
	try {
		const parsed = JSON.parse(trimmed) as Record<string, unknown>;
		const level = String(parsed.level ?? "info");
		const ts = String(parsed.ts ?? "");
		const msg = String(parsed.msg ?? "");
		const rest = { ...parsed };
		delete rest.level;
		delete rest.ts;
		delete rest.msg;
		const tail = Object.keys(rest).length ? " " + style.dim(JSON.stringify(rest)) : "";
		const colorer = LEVEL_COLOR[level] ?? ((s) => s);
		return `${style.dim(ts)} ${colorer(level.padEnd(5))} ${msg}${tail}`;
	} catch {
		return line;
	}
}

export async function runLogs(opts: LogsOptions): Promise<void> {
	const path = logFilePath();
	if (!existsSync(path)) {
		console.error(style.yellow(`no log file at ${path}`));
		console.error(style.dim("start the proxy first with 'clapp server:start' or any command that uses it."));
		return;
	}

	const tailLines = opts.lines ?? 50;
	const initial = await readTail(path, tailLines);
	for (const line of initial) {
		const out = format(line, !!opts.raw);
		if (out) console.log(out);
	}

	if (!opts.follow) return;

	let offset = statSync(path).size;
	console.error(style.dim("-- following; Ctrl+C to exit --"));
	const watcher = watch(path, { persistent: true }, async () => {
		try {
			const size = statSync(path).size;
			if (size < offset) offset = 0;
			if (size === offset) return;
			await new Promise<void>((resolve, reject) => {
				const stream = createReadStream(path, { start: offset, end: size });
				let buf = "";
				stream.on("data", (chunk) => {
					buf += chunk.toString("utf8");
				});
				stream.on("end", () => {
					offset = size;
					for (const line of buf.split("\n")) {
						if (!line.trim()) continue;
						const out = format(line, !!opts.raw);
						if (out) console.log(out);
					}
					resolve();
				});
				stream.on("error", reject);
			});
		} catch {
			// transient; ignore
		}
	});

	await new Promise<void>((resolve) => {
		process.on("SIGINT", () => {
			watcher.close();
			resolve();
		});
	});
}

async function readTail(path: string, n: number): Promise<string[]> {
	const size = statSync(path).size;
	const chunkSize = Math.min(size, 64 * 1024);
	const start = Math.max(0, size - chunkSize);
	return await new Promise<string[]>((resolve, reject) => {
		const stream = createReadStream(path, { start, end: size });
		let buf = "";
		stream.on("data", (chunk) => {
			buf += chunk.toString("utf8");
		});
		stream.on("end", () => {
			const lines = buf.split("\n").filter((l) => l.trim());
			resolve(lines.slice(-n));
		});
		stream.on("error", reject);
	});
}
