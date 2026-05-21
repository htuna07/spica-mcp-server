import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpicaClient } from "../client";
import type { ApiKey, Identity, PolicyBase } from "../types";
import {
  ApiKeyOutputSchema,
  ApiKeyListOutputSchema,
  IdentityOutputSchema,
  IdentityListOutputSchema,
  PolicyOutputSchema,
  PolicyListOutputSchema,
  UserListOutputSchema,
} from "../schemas/outputs";

// ── Resource primitive validators ─────────────────────────────────────────────
// Plain resource id: no forward-slash, no asterisk, no whitespace
const PlainId = z.string().regex(/^[^/*\s]+$/);
// Two-segment wildcard exclude item: "*/plain-id"
const StarSlashId = z.string().regex(/^\*\/[^/*\s]+$/);

// Single-segment resource:
//   { include: ["*"],      exclude: plainId[]   }  — wildcard include, explicit excludes
//   { include: plainId+,   exclude: []          }  — explicit include, no excludes
const SingleSegmentResource = z.union([
  z.object({ include: z.tuple([z.literal("*")]), exclude: z.array(PlainId)          }),
  z.object({ include: z.array(PlainId).min(1),   exclude: z.array(z.string()).max(0) }),
]);

// Glob resource (storage:browse): single glob path (must end with *), any non-empty strings for exclude
const GlobSegmentResource = z.object({
  include: z.array(z.string().regex(/\*$/)).max(1),
  exclude: z.array(z.string().min(1)),
});

// Two-segment resource:
//   { include: ["*/*"],    exclude: starSlashId[] }  — wildcard include, explicit excludes
//   { include: starSlashId+, exclude: []          }  — explicit include, no excludes
const TwoSegmentResource = z.union([
  z.object({ include: z.tuple([z.literal("*/*")]), exclude: z.array(StarSlashId)      }),
  z.object({ include: z.array(StarSlashId).min(1), exclude: z.array(z.string()).max(0) }),
]);

function noRes<A extends string, M extends string>(action: A, module: M) {
  return z.object({ action: z.literal(action), module: z.literal(module) }).strict();
}
function singleRes<A extends string, M extends string>(action: A, module: M) {
  return z.object({ action: z.literal(action), module: z.literal(module), resource: SingleSegmentResource });
}
function twoRes<A extends string, M extends string>(action: A, module: M) {
  return z.object({ action: z.literal(action), module: z.literal(module), resource: TwoSegmentResource });
}
function globRes<A extends string, M extends string>(action: A, module: M) {
  return z.object({ action: z.literal(action), module: z.literal(module), resource: GlobSegmentResource });
}

const PolicyStatementSchema = z.discriminatedUnion("action", [
  // ── NO_RESOURCE: resource field must not be present ───────────────────────
  noRes("activity:index",             "activity"),
  noRes("activity:delete",            "activity"),
  noRes("asset:index",                "asset"),
  noRes("asset:show",                 "asset"),
  noRes("asset:download",             "asset"),
  noRes("asset:install",              "asset"),
  noRes("asset:delete",               "asset"),
  noRes("asset:export",               "asset"),
  noRes("bucket:create",              "bucket"),
  noRes("dashboard:create",           "dashboard"),
  noRes("env-var:create",             "env-var"),
  noRes("function:create",            "function"),
  noRes("function:logs:delete",       "function:logs"),
  noRes("function:logs:index",        "function:logs"),
  noRes("passport:apikey:create",     "passport:apikey"),
  noRes("passport:identity:create",   "passport:identity"),
  noRes("passport:identity:profile",  "passport:identity"),
  noRes("passport:policy:create",     "passport:policy"),
  noRes("passport:strategy:insert",   "passport:strategy"),
  noRes("passport:user:create",       "passport:user"),
  noRes("passport:user:profile",      "passport:user"),
  noRes("secret:create",              "secret"),
  noRes("storage:create",             "storage"),
  noRes("versioncontrol:update",      "versioncontrol"),
  noRes("versioncontrol:show",        "versioncontrol"),
  noRes("webhook:create",             "webhook"),
  noRes("webhook:logs:delete",        "webhook:logs"),
  noRes("webhook:logs:index",         "webhook:logs"),
  // ── SINGLE_SEGMENT: resource is a single-segment id or wildcard ───────────
  singleRes("bucket:stream",                 "bucket"),
  singleRes("bucket:index",                  "bucket"),
  singleRes("bucket:show",                   "bucket"),
  singleRes("bucket:update",                 "bucket"),
  singleRes("bucket:delete",                 "bucket"),
  singleRes("bucket:data:stream",            "bucket:data"),
  singleRes("bucket:data:index",             "bucket:data"),
  singleRes("bucket:data:show",              "bucket:data"),
  singleRes("bucket:data:create",            "bucket:data"),
  singleRes("bucket:data:update",            "bucket:data"),
  singleRes("bucket:data:delete",            "bucket:data"),
  singleRes("bucket:data:profile",           "bucket:data"),
  singleRes("config:index",                  "config"),
  singleRes("config:show",                   "config"),
  singleRes("config:update",                 "config"),
  singleRes("dashboard:index",               "dashboard"),
  singleRes("dashboard:show",                "dashboard"),
  singleRes("dashboard:stream",              "dashboard"),
  singleRes("dashboard:update",              "dashboard"),
  singleRes("dashboard:delete",              "dashboard"),
  singleRes("env-var:index",                 "env-var"),
  singleRes("env-var:show",                  "env-var"),
  singleRes("env-var:stream",                "env-var"),
  singleRes("env-var:update",                "env-var"),
  singleRes("env-var:delete",                "env-var"),
  singleRes("function:index",                "function"),
  singleRes("function:show",                 "function"),
  singleRes("function:stream",               "function"),
  singleRes("function:update",               "function"),
  singleRes("function:delete",               "function"),
  singleRes("passport:apikey:index",         "passport:apikey"),
  singleRes("passport:apikey:show",          "passport:apikey"),
  singleRes("passport:apikey:stream",        "passport:apikey"),
  singleRes("passport:apikey:update",        "passport:apikey"),
  singleRes("passport:apikey:delete",        "passport:apikey"),
  singleRes("passport:identity:index",       "passport:identity"),
  singleRes("passport:identity:show",        "passport:identity"),
  singleRes("passport:identity:stream",      "passport:identity"),
  singleRes("passport:identity:update",      "passport:identity"),
  singleRes("passport:identity:delete",      "passport:identity"),
  singleRes("passport:policy:index",         "passport:policy"),
  singleRes("passport:policy:show",          "passport:policy"),
  singleRes("passport:policy:stream",        "passport:policy"),
  singleRes("passport:policy:update",        "passport:policy"),
  singleRes("passport:policy:delete",        "passport:policy"),
  singleRes("passport:refresh-token:index",  "passport:refresh-token"),
  singleRes("passport:refresh-token:show",   "passport:refresh-token"),
  singleRes("passport:refresh-token:stream", "passport:refresh-token"),
  singleRes("passport:refresh-token:update", "passport:refresh-token"),
  singleRes("passport:refresh-token:delete", "passport:refresh-token"),
  singleRes("passport:strategy:index",       "passport:strategy"),
  singleRes("passport:strategy:show",        "passport:strategy"),
  singleRes("passport:strategy:update",      "passport:strategy"),
  singleRes("passport:strategy:delete",      "passport:strategy"),
  singleRes("passport:user:index",           "passport:user"),
  singleRes("passport:user:show",            "passport:user"),
  singleRes("passport:user:stream",          "passport:user"),
  singleRes("passport:user:update",          "passport:user"),
  singleRes("passport:user:delete",          "passport:user"),
  singleRes("preference:show",               "preference"),
  singleRes("preference:update",             "preference"),
  singleRes("secret:index",                  "secret"),
  singleRes("secret:show",                   "secret"),
  singleRes("secret:stream",                 "secret"),
  singleRes("secret:update",                 "secret"),
  singleRes("secret:delete",                 "secret"),
  singleRes("status:index",                  "status"),
  singleRes("status:show",                   "status"),
  singleRes("storage:index",                 "storage"),
  singleRes("storage:show",                  "storage"),
  singleRes("storage:update",                "storage"),
  singleRes("storage:delete",                "storage"),
  globRes("storage:browse", "storage"),
  singleRes("webhook:index",  "webhook"),
  singleRes("webhook:show",   "webhook"),
  singleRes("webhook:update", "webhook"),
  singleRes("webhook:delete", "webhook"),
  // ── TWO_SEGMENT: resource is a two-segment "*/id" path or wildcard ────────
  twoRes("function:env-var:inject",          "function:env-var"),
  twoRes("function:env-var:eject",           "function:env-var"),
  twoRes("function:invoke",                  "function:invoke"),
  twoRes("function:secret:inject",           "function:secret"),
  twoRes("function:secret:eject",            "function:secret"),
  twoRes("passport:apikey:policy:add",       "passport:apikey:policy"),
  twoRes("passport:apikey:policy:remove",    "passport:apikey:policy"),
  twoRes("passport:identity:policy:add",     "passport:identity:policy"),
  twoRes("passport:identity:policy:remove",  "passport:identity:policy"),
  twoRes("passport:user:policy:add",         "passport:user:policy"),
  twoRes("passport:user:policy:remove",      "passport:user:policy"),
]);

// ── Shared input base schemas ─────────────────────────────────────────────────
const ApiKeyInputBase = z.object({
  name: z.string().describe("Name of the API key"),
  description: z.string().optional().describe("Description"),
  active: z.boolean().describe("Whether the key is active"),
  policies: z
    .array(z.string())
    .optional()
    .describe("Policy IDs to associate with the API key."),
});

const PolicyInputBase = z.object({
  name: z.string().describe("Policy name"),
  description: z.string().optional().describe("Policy description"),
  statement: z
    .array(PolicyStatementSchema)
    .describe("Array of policy statements"),
});

export function registerAuthTools(
  server: McpServer,
  client: SpicaClient,
): void {
  // ── list_apikeys ──────────────────────────────────────────────────────
  server.registerTool(
    "list_apikeys",
    {
      title: "List API Keys",
      description:
        "Returns all API keys from the Spica server. No pagination or filtering.",
      annotations: { readOnlyHint: true },
      outputSchema: ApiKeyListOutputSchema,
    },
    async () => {
      const { data } = (await client.get("/passport/apikey")) as {
        data: ApiKey[];
      };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { apikeys: data },
      };
    },
  );

  // ── insert_apikey ─────────────────────────────────────────────────────
  server.registerTool(
    "insert_apikey",
    {
      title: "Insert API Key",
      description:
        "Creates a new API key. Use insert_policy to create a policy before associating it.",
      inputSchema: z
        .object({
          _id: z
            .string()
            .optional()
            .describe("Optional custom ID. If omitted, MongoDB generates one."),
        })
        .merge(ApiKeyInputBase),
    },
    async ({ _id, name, description, active, policies }) => {
      const body: {
        name: string;
        active: boolean;
        description?: string;
        _id?: string;
      } = { name, active };
      if (description !== undefined) body.description = description;
      if (_id !== undefined) body._id = _id;

      let apikey = (await client.post("/passport/apikey", body)) as ApiKey;
      const apikeyId = apikey._id;

      if (policies !== undefined) {
        for (const pid of policies) {
          await client.put(`/passport/apikey/${apikeyId}/policy/${pid}`);
        }
        apikey = (await client.get(`/passport/apikey/${apikeyId}`)) as ApiKey;
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(apikey, null, 2) },
        ],
        structuredContent: apikey as unknown as Record<string, unknown>,
      };
    },
  );

  // ── update_apikey ─────────────────────────────────────────────────────
  server.registerTool(
    "update_apikey",
    {
      title: "Update API Key",
      description:
        "Updates an existing API key. _id is required. Use insert_policy to create or update a policy before associating it.",
      inputSchema: z
        .object({ _id: z.string().describe("API key ID. Required.") })
        .merge(ApiKeyInputBase),
    },
    async ({ _id, name, description, active, policies }) => {
      const body: { name: string; active: boolean; description?: string } = {
        name,
        active,
      };
      if (description !== undefined) body.description = description;

      let apikey = (await client.put(`/passport/apikey/${_id}`, body)) as ApiKey;
      const apikeyId = _id;

      if (policies !== undefined) {
        const currentPolicies = apikey.policies ?? [];

        for (const pid of policies) {
          if (!currentPolicies.includes(pid)) {
            await client.put(`/passport/apikey/${apikeyId}/policy/${pid}`);
          }
        }
        for (const pid of currentPolicies) {
          if (!policies.includes(pid)) {
            await client.delete(`/passport/apikey/${apikeyId}/policy/${pid}`);
          }
        }

        apikey = (await client.get(`/passport/apikey/${apikeyId}`)) as ApiKey;
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(apikey, null, 2) },
        ],
        structuredContent: apikey as unknown as Record<string, unknown>,
      };
    },
  );

  // ── list_identities ───────────────────────────────────────────────────
  server.registerTool(
    "list_identities",
    {
      title: "List Identities",
      description: "Returns identities with optional filtering and pagination.",
      annotations: { readOnlyHint: true },
      outputSchema: IdentityListOutputSchema,
      inputSchema: z.object({
        filter: z.string().optional().describe("JSON filter object"),
        limit: z.number().int().optional().describe("Max documents to return"),
        skip: z.number().int().optional().describe("Documents to skip"),
        sort: z
          .string()
          .optional()
          .describe('JSON sort object, e.g. {"identifier":1}'),
      }),
    },
    async ({ filter, limit, skip, sort }) => {
      const data = await client.get("/passport/identity", {
        filter,
        limit,
        skip,
        sort,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { identities: data },
      };
    },
  );

  // ── insert_identity ───────────────────────────────────────────────────
  server.registerTool(
    "insert_identity",
    {
      title: "Insert Identity",
      description:
        "Creates a new identity. Use insert_policy to create a policy before associating it.",
      inputSchema: z.object({
        _id: z
          .string()
          .optional()
          .describe("Optional custom ID. If omitted, MongoDB generates one."),
        identifier: z.string().describe("Unique identifier for the identity"),
        password: z.string().describe("Password. Required on create."),
        policies: z
          .array(z.string())
          .optional()
          .describe("Policy IDs to associate with the identity."),
      }),
    },
    async ({ _id, identifier, password, policies }) => {
      const identityBody: Record<string, unknown> = { identifier, password };
      if (_id !== undefined) identityBody._id = _id;
      let identity = (await client.post(
        "/passport/identity",
        identityBody,
      )) as Identity;
      const identityId = identity._id;

      if (policies !== undefined) {
        for (const pid of policies) {
          await client.put(`/passport/identity/${identityId}/policy/${pid}`);
        }
        identity = (await client.get(
          `/passport/identity/${identityId}`,
        )) as Identity;
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(identity, null, 2) },
        ],
        structuredContent: identity as unknown as Record<string, unknown>,
      };
    },
  );

  // ── update_identity ───────────────────────────────────────────────────
  server.registerTool(
    "update_identity",
    {
      title: "Update Identity",
      description:
        "Updates an existing identity. _id is required. Use insert_policy to create or update a policy before associating it.",
      inputSchema: z.object({
        _id: z.string().describe("Identity ID. Required."),
        identifier: z
          .string()
          .optional()
          .describe("Unique identifier for the identity"),
        password: z
          .string()
          .optional()
          .describe("Password. Optional on update."),
        policies: z
          .array(z.string())
          .optional()
          .describe(
            "Policy IDs to associate with the identity.",
          ),
      }),
    },
    async ({ _id, identifier, password, policies }) => {
      const body: { identifier?: string; password?: string } = {};
      if (identifier !== undefined) body.identifier = identifier;
      if (password !== undefined) body.password = password;

      let identity = (await client.put(
        `/passport/identity/${_id}`,
        body,
      )) as Identity;
      const identityId = _id;

      if (policies !== undefined) {
        const currentPolicies = identity.policies ?? [];

        for (const pid of policies) {
          if (!currentPolicies.includes(pid)) {
            await client.put(`/passport/identity/${identityId}/policy/${pid}`);
          }
        }
        for (const pid of currentPolicies) {
          if (!policies.includes(pid)) {
            await client.delete(
              `/passport/identity/${identityId}/policy/${pid}`,
            );
          }
        }

        identity = (await client.get(
          `/passport/identity/${identityId}`,
        )) as Identity;
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(identity, null, 2) },
        ],
        structuredContent: identity as unknown as Record<string, unknown>,
      };
    },
  );

  // ── list_policies ─────────────────────────────────────────────────────
  server.registerTool(
    "list_policies",
    {
      title: "List Policies",
      description:
        "Returns access policies with optional filtering and pagination.",
      annotations: { readOnlyHint: true },
      outputSchema: PolicyListOutputSchema,
      inputSchema: z.object({
        filter: z.string().optional().describe("JSON filter object"),
        limit: z.number().int().optional().describe("Max documents to return"),
        skip: z.number().int().optional().describe("Documents to skip"),
        sort: z
          .string()
          .optional()
          .describe('JSON sort object, e.g. {"name":1}'),
      }),
    },
    async ({ filter, limit, skip, sort }) => {
      const { data } = (await client.get("/passport/policy", {
        filter,
        limit,
        skip,
        sort,
      })) as { data: PolicyBase[] };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { policies: data },
      };
    },
  );

  // ── insert_policy ──────────────────────────────────────────────────────
  server.registerTool(
    "insert_policy",
    {
      title: "Insert Policy",
      description: "Creates a new access policy.",
      inputSchema: z
        .object({
          _id: z
            .string()
            .optional()
            .describe("Optional custom ID. If omitted, MongoDB generates one."),
        })
        .merge(PolicyInputBase),
    },
    async ({ _id, name, description, statement }) => {
      const body: PolicyBase & { _id?: string } = { name, statement };
      if (description !== undefined) body.description = description;
      if (_id !== undefined) body._id = _id;

      const policy = (await client.post("/passport/policy", body)) as PolicyBase;

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(policy, null, 2) },
        ],
        structuredContent: policy as unknown as Record<string, unknown>,
      };
    },
  );

  // ── update_policy ──────────────────────────────────────────────────────
  server.registerTool(
    "update_policy",
    {
      title: "Update Policy",
      description: "Replaces an existing access policy. _id is required.",
      inputSchema: z
        .object({ _id: z.string().describe("Policy ID. Required.") })
        .merge(PolicyInputBase),
    },
    async ({ _id, name, description, statement }) => {
      const body: PolicyBase = { name, statement };
      if (description !== undefined) body.description = description;

      const policy = (await client.put(
        `/passport/policy/${_id}`,
        body,
      )) as PolicyBase;

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(policy, null, 2) },
        ],
        structuredContent: policy as unknown as Record<string, unknown>,
      };
    },
  );

  // ── list_users ────────────────────────────────────────────────────────
  server.registerTool(
    "list_users",
    {
      title: "List Users",
      description:
        "Returns users with optional pagination, sorting, and filtering.",
      annotations: { readOnlyHint: true },
      outputSchema: UserListOutputSchema,
      inputSchema: z.object({
        filter: z.string().optional().describe("JSON filter object"),
        limit: z.number().int().optional().describe("Max documents to return"),
        skip: z.number().int().optional().describe("Documents to skip"),
        sort: z
          .string()
          .optional()
          .describe('JSON sort object, e.g. {"username":1}'),
        paginate: z
          .boolean()
          .optional()
          .describe("When true, response includes pagination metadata"),
      }),
    },
    async ({ filter, limit, skip, sort, paginate }) => {
      const data = await client.get("/passport/user", {
        filter,
        limit,
        skip,
        sort,
        paginate,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { users: data },
      };
    },
  );
}
