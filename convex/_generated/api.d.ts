/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as features_befood_receipt from "../features/befood/receipt.js";
import type * as features_befood_receipts from "../features/befood/receipts.js";
import type * as features_debts_helpers from "../features/debts/helpers.js";
import type * as features_debts_internal from "../features/debts/internal.js";
import type * as features_debts_queries from "../features/debts/queries.js";
import type * as features_drafts_agent from "../features/drafts/agent.js";
import type * as features_drafts_draft from "../features/drafts/draft.js";
import type * as features_drafts_review from "../features/drafts/review.js";
import type * as features_grab_actions from "../features/grab/actions.js";
import type * as features_grab_gmail from "../features/grab/gmail.js";
import type * as features_grab_internal from "../features/grab/internal.js";
import type * as features_grab_parse from "../features/grab/parse.js";
import type * as features_grab_queries from "../features/grab/queries.js";
import type * as features_grab_week from "../features/grab/week.js";
import type * as features_invoices_helpers from "../features/invoices/helpers.js";
import type * as features_invoices_mutations from "../features/invoices/mutations.js";
import type * as features_invoices_queries from "../features/invoices/queries.js";
import type * as features_orders_allocation from "../features/orders/allocation.js";
import type * as features_orders_helpers from "../features/orders/helpers.js";
import type * as features_orders_mutations from "../features/orders/mutations.js";
import type * as features_orders_queries from "../features/orders/queries.js";
import type * as features_teams_history from "../features/teams/history.js";
import type * as features_teams_internal from "../features/teams/internal.js";
import type * as features_teams_mutations from "../features/teams/mutations.js";
import type * as features_teams_queries from "../features/teams/queries.js";
import type * as features_teams_threadSnapshot from "../features/teams/threadSnapshot.js";
import type * as features_users_mutations from "../features/users/mutations.js";
import type * as features_users_queries from "../features/users/queries.js";
import type * as http from "../http.js";
import type * as integrations_teams_actions from "../integrations/teams/actions.js";
import type * as migrations from "../migrations.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authz: typeof authz;
  "features/befood/receipt": typeof features_befood_receipt;
  "features/befood/receipts": typeof features_befood_receipts;
  "features/debts/helpers": typeof features_debts_helpers;
  "features/debts/internal": typeof features_debts_internal;
  "features/debts/queries": typeof features_debts_queries;
  "features/drafts/agent": typeof features_drafts_agent;
  "features/drafts/draft": typeof features_drafts_draft;
  "features/drafts/review": typeof features_drafts_review;
  "features/grab/actions": typeof features_grab_actions;
  "features/grab/gmail": typeof features_grab_gmail;
  "features/grab/internal": typeof features_grab_internal;
  "features/grab/parse": typeof features_grab_parse;
  "features/grab/queries": typeof features_grab_queries;
  "features/grab/week": typeof features_grab_week;
  "features/invoices/helpers": typeof features_invoices_helpers;
  "features/invoices/mutations": typeof features_invoices_mutations;
  "features/invoices/queries": typeof features_invoices_queries;
  "features/orders/allocation": typeof features_orders_allocation;
  "features/orders/helpers": typeof features_orders_helpers;
  "features/orders/mutations": typeof features_orders_mutations;
  "features/orders/queries": typeof features_orders_queries;
  "features/teams/history": typeof features_teams_history;
  "features/teams/internal": typeof features_teams_internal;
  "features/teams/mutations": typeof features_teams_mutations;
  "features/teams/queries": typeof features_teams_queries;
  "features/teams/threadSnapshot": typeof features_teams_threadSnapshot;
  "features/users/mutations": typeof features_users_mutations;
  "features/users/queries": typeof features_users_queries;
  http: typeof http;
  "integrations/teams/actions": typeof integrations_teams_actions;
  migrations: typeof migrations;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
