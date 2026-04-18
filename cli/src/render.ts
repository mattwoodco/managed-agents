/**
 * Consistent stream-event rendering for the CLI.
 * Keeps presentation concerns out of the command handlers.
 */

import { style } from "@stacksjs/clapp";
import { extractText, type SseEvent } from "./api";

export type RenderMode = "pretty" | "raw";

export function renderEvent(evt: SseEvent, mode: RenderMode): void {
  if (mode === "raw") {
    process.stdout.write(`event: ${evt.event}\ndata: ${evt.data}\n\n`);
    return;
  }

  const type = evt.type ?? evt.event;

  if (type === "agent.message") {
    const text = extractText(evt);
    if (text) {
      process.stdout.write(text);
      return;
    }
  }

  if (type === "session.status_idle") {
    process.stdout.write("\n");
    process.stdout.write(style.dim("[done]\n"));
    return;
  }

  // echo the user's own message back silently; model_request spans
  // and other metadata are noise unless --raw is requested.
  if (
    type === "user.message" ||
    type === "session.status_running" ||
    type?.startsWith("span.")
  ) {
    return;
  }

  if (type?.startsWith("tool")) {
    process.stdout.write(style.dim(`\n[${type}]\n`));
    return;
  }

  if (type) {
    process.stdout.write(style.dim(`\n[${type}]\n`));
  }
}
