/**
 * Called from every user-facing command (ask/chat/health/logs/sessions)
 * to guarantee the proxy is running before we try to talk to it.
 *
 * Behaviour:
 *   - if the URL is reachable, return immediately
 *   - if the user pointed at a non-localhost URL (e.g. remote proxy),
 *     do NOT try to auto-spawn — fail with a helpful message
 *   - otherwise spawn the local proxy, wait for /health
 */

import { style } from "@stacksjs/clapp";
import { resolveEnvFile } from "./env";
import {
	isReachable,
	resolveServerDir,
	startProxy,
} from "./server-control";

export async function ensureProxy(url: string): Promise<void> {
	if (await isReachable(url)) return;

	const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url);
	if (!isLocal) {
		throw new Error(
			`proxy at ${url} is unreachable. ` +
				`Not auto-starting because the URL is non-local.`,
		);
	}

	const port = Number(new URL(url).port || 8787);
	const serverDir = resolveServerDir();
	const envFile = resolveEnvFile(serverDir);
	if (!envFile) {
		throw new Error(
			"no .env.local or .env found. Create one with ANTHROPIC_API_KEY or run `clapp doctor`.",
		);
	}

	process.stderr.write(style.dim(`starting proxy at ${url} ...\n`));
	await startProxy({ serverDir, envFile, port, baseUrl: url });
}
