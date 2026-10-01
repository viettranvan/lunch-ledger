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
import type * as features_debts_helpers from "../features/debts/helpers.js";
import type * as features_debts_internal from "../features/debts/internal.js";
import type * as features_debts_queries from "../features/debts/queries.js";
import type * as features_invoices_helpers from "../features/invoices/helpers.js";
import type * as features_invoices_mutations from "../features/invoices/mutations.js";
import type * as features_invoices_queries from "../features/invoices/queries.js";
import type * as features_orders_allocation from "../features/orders/allocation.js";
import type * as features_orders_helpers from "../features/orders/helpers.js";
import type * as features_orders_mutations from "../features/orders/mutations.js";
import type * as features_orders_queries from "../features/orders/queries.js";
import type * as features_teams_internal from "../features/teams/internal.js";
import type * as features_teams_mutations from "../features/teams/mutations.js";
import type * as features_teams_queries from "../features/teams/queries.js";
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
  "features/debts/helpers": typeof features_debts_helpers;
  "features/debts/internal": typeof features_debts_internal;
  "features/debts/queries": typeof features_debts_queries;
  "features/invoices/helpers": typeof features_invoices_helpers;
  "features/invoices/mutations": typeof features_invoices_mutations;
  "features/invoices/queries": typeof features_invoices_queries;
  "features/orders/allocation": typeof features_orders_allocation;
  "features/orders/helpers": typeof features_orders_helpers;
  "features/orders/mutations": typeof features_orders_mutations;
  "features/orders/queries": typeof features_orders_queries;
  "features/teams/internal": typeof features_teams_internal;
  "features/teams/mutations": typeof features_teams_mutations;
  "features/teams/queries": typeof features_teams_queries;
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
