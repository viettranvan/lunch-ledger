import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { readThreadSnapshot } from "./features/teams/threadSnapshot";

const http = httpRouter();
auth.addHttpRoutes(http);

function authorized(header: string | null, secret: string) {
  const expected = `Bearer ${secret}`;
  if (!header || header.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  }
  return mismatch === 0;
}

http.route({
  path: "/integrations/teams/history",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const secret = env?.TEAMS_HISTORY_WEBHOOK_SECRET?.trim();
    const channelId = env?.TEAMS_HISTORY_CHANNEL_ID?.trim();
    if (!secret || !channelId) return new Response("Teams import is unconfigured.", { status: 503 });
    if (!authorized(request.headers.get("Authorization"), secret)) {
      return new Response("Unauthorized.", { status: 401 });
    }

    let thread;
    try {
      const body = await request.text();
      if (body.length > 300_000) return new Response("Payload too large.", { status: 413 });
      thread = readThreadSnapshot(JSON.parse(body));
    } catch (error) {
      // Parser errors contain field descriptions only, never message content.
      const reason = error instanceof Error && !(error instanceof SyntaxError)
        ? error.message
        : "Invalid JSON.";
      return new Response(`Invalid Teams thread snapshot. ${reason}`, { status: 400 });
    }
    if (thread.channelId !== channelId) return new Response("Unexpected Teams channel.", { status: 403 });

    return Response.json(await ctx.runMutation(internal.features.teams.history.saveThread, { thread }));
  }),
});

export default http;
