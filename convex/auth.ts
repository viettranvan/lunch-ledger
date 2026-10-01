import { Password } from "@convex-dev/auth/providers/Password";
import type { ConvexCredentialsUserConfig } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { isEditor, requireEditor } from "./authz";
import type { DataModel } from "./_generated/dataModel";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env;

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

const passwordProvider = Password<DataModel>({
  profile: (params) => {
    const email = normalizeEmail(params.email);
    if (!email) throw new ConvexError("Nhập email hợp lệ.");

    if (params.flow === "signUp") {
      const editorEmail = normalizeEmail(env?.EDITOR_EMAIL);
      const bootstrapCode = env?.EDITOR_BOOTSTRAP_CODE;
      if (
        !editorEmail ||
        email !== editorEmail ||
        !bootstrapCode ||
        params.bootstrapCode !== bootstrapCode
      ) {
        throw new ConvexError("Mã khởi tạo hoặc email editor không hợp lệ.");
      }
    }

    return { email, name: email };
  },
});

const passwordOptions = (
  passwordProvider as unknown as { options: ConvexCredentialsUserConfig<DataModel> }
).options;

const gatedPasswordProvider = {
  ...passwordProvider,
  options: {
    ...passwordOptions,
    authorize: async (
      params: Parameters<typeof passwordOptions.authorize>[0],
      ctx: Parameters<typeof passwordOptions.authorize>[1],
    ) => {
      const result = await passwordOptions.authorize(params, ctx);
      if (params.flow === "signUp" && result) {
        await ctx.runMutation(internal.auth.consumeBootstrap, {
          email: normalizeEmail(params.email),
          code: typeof params.bootstrapCode === "string" ? params.bootstrapCode : "",
        });
      }
      return result;
    },
  },
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [gatedPasswordProvider],
});

export const consumeBootstrap = internalMutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const editorEmail = normalizeEmail(env?.EDITOR_EMAIL);
    const bootstrapCode = env?.EDITOR_BOOTSTRAP_CODE;
    const claimed = await ctx.db.query("auth_bootstrap").first();

    if (
      !editorEmail ||
      !bootstrapCode ||
      args.email !== editorEmail ||
      args.code !== bootstrapCode ||
      claimed
    ) {
      throw new ConvexError("Không thể tạo tài khoản editor. Hãy kiểm tra thông tin bootstrap.");
    }

    await ctx.db.insert("auth_bootstrap", { claimed_at: Date.now() });
  },
});

export const isEditorQuery = query({
  args: {},
  handler: async (ctx) => isEditor(ctx),
});

export const getAccessStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    return {
      isEditor: await isEditor(ctx),
      email: user?.email ?? null,
    };
  },
});

export const isBootstrapAvailable = query({
  args: {},
  handler: async (ctx) => {
    const claimed = await ctx.db.query("auth_bootstrap").first();
    return Boolean(
      !claimed &&
        env?.EDITOR_EMAIL &&
        env?.EDITOR_BOOTSTRAP_CODE,
    );
  },
});

export const getEditorSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireEditor(ctx);
    return { email: env?.EDITOR_EMAIL ?? null };
  },
});
