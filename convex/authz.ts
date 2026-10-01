import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type AuthContext = QueryCtx | MutationCtx;

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env;

function editorEmail() {
  return env?.EDITOR_EMAIL?.trim().toLowerCase();
}

export async function isEditor(ctx: AuthContext) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;

  const user = await ctx.db.get(userId);
  const configuredEmail = editorEmail();

  return Boolean(
    user?.email &&
      configuredEmail &&
      user.email.trim().toLowerCase() === configuredEmail,
  );
}

export async function requireEditor(ctx: AuthContext) {
  if (!(await isEditor(ctx))) {
    throw new ConvexError("Bạn cần đăng nhập bằng tài khoản editor.");
  }
}
