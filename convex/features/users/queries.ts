import { query } from "../../_generated/server";
import { requireEditor } from "../../authz";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    await requireEditor(ctx);
    const users = await ctx.db.query("members").collect();
    return users.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("members")
      .withIndex("by_active", (q) => q.eq("is_active", true))
      .order("desc")
      .collect()
      .then((members) => members.map(({ _id, name, is_active }) => ({ _id, name, is_active })));
  },
});
