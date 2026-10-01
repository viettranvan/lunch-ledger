import { v } from "convex/values";
import { internalMutation, mutation } from "../../_generated/server";
import { requireEditor } from "../../authz";
import { allocateProportionally } from "../orders/allocation";
import { getSortTime, syncInvoiceStatus } from "./helpers";

export const create = mutation({
  args: {
    store_name: v.string(),
    paid_amount: v.number(),
    invoice_type: v.optional(
      v.union(v.literal("receivable"), v.literal("payable")),
    ),
    date: v.string(),
    orders: v.array(
      v.object({
        member_id: v.id("members"),
        item_price: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx);
    const storeName = args.store_name.trim();
    if (!storeName) throw new Error("Vui lòng nhập tên quán hoặc nội dung hóa đơn.");
    if (!Number.isSafeInteger(args.paid_amount) || args.paid_amount <= 0) {
      throw new Error("Tổng hóa đơn phải lớn hơn 0 và được tính bằng đồng.");
    }
    if (args.orders.length === 0) {
      throw new Error("Hóa đơn cần có ít nhất một thành viên và phần ăn.");
    }

    const invoiceType = args.invoice_type ?? "receivable";
    if (invoiceType === "payable" && args.orders.length !== 1) {
      throw new Error("Hóa đơn phải trả cần chọn đúng một người bạn nợ.");
    }

    const userIds = new Set<string>();
    for (const order of args.orders) {
      if (userIds.has(order.member_id)) {
        throw new Error("Một thành viên không thể được thêm nhiều lần vào cùng hóa đơn.");
      }
      userIds.add(order.member_id);

      if (!Number.isFinite(order.item_price) || order.item_price <= 0) {
        throw new Error("Giá món của từng thành viên phải lớn hơn 0.");
      }

      const user = await ctx.db.get(order.member_id);
      if (!user || !user.is_active) {
        throw new Error("Danh sách có thành viên không còn hoạt động. Hãy tải lại trang.");
      }
    }

    const allocations =
      invoiceType === "payable"
        ? [{ amount: args.paid_amount, percentage: 100 }]
        : allocateProportionally(
            args.paid_amount,
            args.orders.map((order) => order.item_price),
          );
    const now = Date.now();
    const invoiceId = await ctx.db.insert("invoices", {
      store_name: storeName,
      paid_amount: args.paid_amount,
      invoice_type: invoiceType,
      updated_at: now,
      date: args.date,
      sort_time: getSortTime(args.date, now),
      total_orderers: args.orders.length,
      paid_orderers: 0,
      status: "unpaid",
    });

    for (const [index, order] of args.orders.entries()) {
      await ctx.db.insert("orderers", {
        member_id: order.member_id,
        invoice_id: invoiceId,
        actual_price: allocations[index].amount,
        item_price: order.item_price,
        is_paid: false,
        percentage: allocations[index].percentage,
        updated_at: now,
      });
    }

    return invoiceId;
  },
});

export const updateWithOrders = mutation({
  args: {
    id: v.id("invoices"),
    store_name: v.string(),
    paid_amount: v.number(),
    date: v.string(),
    orders: v.array(
      v.object({
        member_id: v.id("members"),
        item_price: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx);
    const invoice = await ctx.db.get(args.id);
    if (!invoice) throw new Error("Không tìm thấy hóa đơn.");

    const existingOrders = await ctx.db
      .query("orderers")
      .withIndex("by_invoice", (q) => q.eq("invoice_id", args.id))
      .collect();
    if (
      invoice.status === "completed" ||
      invoice.status === "partial" ||
      existingOrders.some((order) => order.is_paid)
    ) {
      throw new Error("Hóa đơn đã hoàn tất hoặc đã ghi nhận thanh toán nên không thể chỉnh sửa.");
    }

    const storeName = args.store_name.trim();
    if (!storeName) throw new Error("Vui lòng nhập tên quán hoặc nội dung hóa đơn.");
    if (!Number.isSafeInteger(args.paid_amount) || args.paid_amount <= 0) {
      throw new Error("Tổng hóa đơn phải lớn hơn 0 và được tính bằng đồng.");
    }
    if (args.orders.length === 0) {
      throw new Error("Hóa đơn cần có ít nhất một thành viên và phần ăn.");
    }

    const invoiceType = invoice.invoice_type ?? "receivable";
    if (invoiceType === "payable" && args.orders.length !== 1) {
      throw new Error("Hóa đơn phải trả cần chọn đúng một người bạn nợ.");
    }

    const existingMemberIds = new Set(existingOrders.map((order) => order.member_id));
    const requestedUserIds = new Set<string>();
    for (const order of args.orders) {
      if (requestedUserIds.has(order.member_id)) {
        throw new Error("Một thành viên không thể được thêm nhiều lần vào cùng hóa đơn.");
      }
      requestedUserIds.add(order.member_id);

      if (!Number.isFinite(order.item_price) || order.item_price <= 0) {
        throw new Error("Giá món của từng thành viên phải lớn hơn 0.");
      }

      const user = await ctx.db.get(order.member_id);
      if (!user || (!user.is_active && !existingMemberIds.has(order.member_id))) {
        throw new Error("Danh sách có thành viên không còn hoạt động. Hãy tải lại trang.");
      }
    }

    const allocations =
      invoiceType === "payable"
        ? [{ amount: args.paid_amount, percentage: 100 }]
        : allocateProportionally(
            args.paid_amount,
            args.orders.map((order) => order.item_price),
          );
    const now = Date.now();
    await ctx.db.patch(args.id, {
      store_name: storeName,
      paid_amount: args.paid_amount,
      date: args.date,
      sort_time: getSortTime(args.date, invoice._creationTime),
      updated_at: now,
    });

    const remainingOrders = new Map(
      existingOrders.map((order) => [order.member_id, order]),
    );
    for (const [index, order] of args.orders.entries()) {
      const current = remainingOrders.get(order.member_id);
      const allocation = allocations[index];
      const values = {
        item_price: order.item_price,
        actual_price: allocation.amount,
        percentage: allocation.percentage,
        updated_at: now,
      };

      if (current) {
        await ctx.db.patch(current._id, values);
        remainingOrders.delete(order.member_id);
      } else {
        await ctx.db.insert("orderers", {
          member_id: order.member_id,
          invoice_id: args.id,
          ...values,
          is_paid: false,
        });
      }
    }
    for (const removedOrder of remainingOrders.values()) {
      await ctx.db.delete(removedOrder._id);
    }

    await syncInvoiceStatus(ctx, args.id);
  },
});

export const deleteInvoice = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    await requireEditor(ctx);
    const invoice = await ctx.db.get(args.id);
    if (!invoice) return;

    const orders = await ctx.db
      .query("orderers")
      .withIndex("by_invoice", (q) => q.eq("invoice_id", args.id))
      .collect();

    const hasRecordedPayments = orders.some((order) => order.is_paid);
    if (
      invoice.status === "completed" ||
      invoice.status === "partial" ||
      hasRecordedPayments
    ) {
      throw new Error("Không thể xóa hóa đơn đã hoàn tất hoặc đã ghi nhận thanh toán.");
    }

    for (const order of orders) {
      await ctx.db.delete(order._id);
    }

    return await ctx.db.delete(args.id);
  },
});

export const backfillStatus = internalMutation({
  args: {},
  handler: async (ctx) => {
    const invoices = await ctx.db.query("invoices").collect();
    for (const invoice of invoices) {
      await syncInvoiceStatus(ctx, invoice._id);
    }
    return { updated: invoices.length };
  },
});
