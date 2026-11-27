---
name: lunch-draft
description: Draft a day's Lunch Ledger invoices by mapping Teams lunch orders onto that day's beFood/Grab receipt items. Use when asked to draft, map or allocate lunch orders for a date or a week.
---

# Lunch draft

Lunch Ledger holds the data; you do the judgement; the result goes back as a **pending draft** that the editor reviews and approves on `/drafts`. You never create invoices yourself, and money is computed by Lunch Ledger, never by you.

Run every command from the repo root. Dates are `YYYY-MM-DD` in Vietnam time. For a week, repeat the steps for each day Mon–Fri that has receipts.

## 1. Read the day

```sh
npx convex run features/drafts/agent:input '{"date":"2026-11-17"}'
```

Returns `members` (id, name, teams_email), `threads` (Teams post + replies), `receipts` (id, restaurant, `items[]` with `item_index`, `quantity`, `name`, `amount`) and `existing_draft_status`. Add `--prod` only when the user asks for production.

Stop and tell the user when `existing_draft_status` is `"approved"` (already invoiced) or `receipts` is empty (sync beFood/Grab first). Note any thread with `may_have_more_replies: true`: replies may be missing.

## 2. Map orders to portions

Build one **line** per person per receipt item: `{ message_id, member_id, receipt_id, item_index, quantity, confidence, note? }`.

- **Author → member**: match the Teams display name's first word to `members[].name`, case-insensitive ("Rio Van" → Rio, "malco Nguyen (Vinova)" → Malco). The post author ordered too when the post text itself names a dish.
- **Order text → item**: compare without diacritics or case; "pho tai" = "Phở Tái". Members abbreviate: "nạm chả" ≈ "Nạm + Chả Heo + Bò Viên", "tái chả bò ziên" ≈ "Tái + Chả Heo + Bò Viên". Notes in parentheses ("nước trong", "rau trụng") are preparation, not items.
- **Counting**: "+1", "+ 1", "+" and a bare dish all mean one portion; "x2" / "+2" mean two; "cho Kane" / "đặt giùm Lani" assigns to that member; a later "hủy" / "thôi" from the same author cancels their earlier order.
- **Ledger rule**: across all lines, each item's assigned quantity equals its `quantity` exactly. Identical dish names split across rows (e.g. "Bún Bò Nạm" ×3 and ×1) are separate `item_index`es; fill each one. With two receipts from the same restaurant, any assignment that fills every row is acceptable.
- **Confidence**: `"high"` when name and dish match plainly; `"low"` for any guess, with a `note` saying why (≤300 chars).
- **Orderer's portion**: the post author places the group order and usually skips writing their own dish. When exactly one portion of the day is left over, assign it to the post author (`confidence: "high"`, note "Phần duy nhất còn thừa: <name> đặt nhưng không ghi trên Teams."). With two or more leftovers, leave them all unassigned.
- **Unmatched**: chatter ("sao dị anh Tí"), orders you cannot tie to a member or item, and leftover portions go to `unmatched: [{ message_id?, author, text, reason }]`. Leave a portion unassigned rather than invent an owner; the editor fills it on `/drafts`.

Done when every order reply is either a line or an unmatched entry, and every receipt item is fully assigned or its gap is explained in `unmatched`.

## 3. Submit

Write the payload `{ "date", "lines", "unmatched" }` to a scratch JSON file, then:

```sh
npx convex run features/drafts/agent:submit "$(cat /path/to/draft.json)"
```

Submitting again replaces the pending draft. On a validation error (unknown receipt, item over-assigned, inactive member), fix the named line and resubmit until it returns `saved_lines`.

## 4. Report

Tell the user, in their language: per receipt, who got which item; every low-confidence line and unmatched message; any unassigned portion; and that the draft is waiting for approval at `/drafts?date=<date>`.
