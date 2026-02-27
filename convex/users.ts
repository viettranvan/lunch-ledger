import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Lấy danh sách tất cả người dùng
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

// Thêm người dùng mới
export const create = mutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
    });
  },
});

// Cập nhật thông tin người dùng
export const update = mutation({
  args: { id: v.id("users"), name: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const { id, name, email } = args;
    await ctx.db.patch(id, { name, email });
  },
});

// Xóa người dùng
export const remove = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
