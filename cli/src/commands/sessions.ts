/**
 * `clapp sessions` — list recent sessions from the proxy's in-memory log.
 */

import { style } from "@stacksjs/clapp";
import { listSessions } from "../api";

export async function runSessions(url: string): Promise<void> {
	const sessions = await listSessions(url);
	if (!sessions.length) {
		console.log(style.dim("no sessions yet."));
		return;
	}
	for (const s of sessions) {
		const when = style.dim(s.createdAt);
		const agent = style.cyan(s.agent.padEnd(10));
		const id = s.id;
		const preview = style.dim(s.firstMessage.replace(/\s+/g, " ").slice(0, 60));
		console.log(`${when}  ${agent}  ${id}  ${preview}`);
	}
}
