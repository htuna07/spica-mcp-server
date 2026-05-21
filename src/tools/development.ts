import { z } from "zod";
import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpicaClient } from "../client";
import type { SpicaFunction, Trigger } from "../types";
import type { TriggerSchemaResult } from "../schemas/triggers";
import { index } from "../examples/function";
import {
  FunctionOutputSchema,
  FunctionListOutputSchema,
  FunctionIndexOutputSchema,
  FunctionDependenciesOutputSchema,
  EnvVarOutputSchema,
  EnvVarListOutputSchema,
  SecretOutputSchema,
  SecretListOutputSchema,
  SuccessMessageOutputSchema,
} from "../schemas/outputs";

export function registerDevelopmentTools(
  server: McpServer,
  client: SpicaClient,
  triggerInfo: TriggerSchemaResult,
): { updateFunctionTool: RegisteredTool } {
  // ── Shared input base schemas ─────────────────────────────────────────
  const EnvVarInputBase = z.object({
    key: z.string().describe("Variable key"),
    value: z.string().describe("Variable value"),
  });

  const SecretInputBase = z.object({
    key: z.string().describe("Secret key"),
    value: z.string().describe("Secret value"),
  });

  const FunctionInputBase = z.object({
    name: z.string().describe("Function name"),
    description: z.string().optional().describe("Description"),
    triggers: z
      .record(triggerInfo.schema as z.ZodType)
      .describe("Triggers keyed by handler name in function index"),
    timeout: z
      .number()
      .int()
      .describe(
        `Execution timeout in seconds. Default: ${triggerInfo.timeout}`,
      ),
    language: z
      .enum(["javascript", "typescript"])
      .describe("Programming language"),
    env_vars: z
      .array(z.string())
      .optional()
      .describe("Env var IDs to associate with the function."),
    secrets: z
      .array(z.string())
      .optional()
      .describe("Secret IDs to associate with the function."),
  });

  // ── list_functions ────────────────────────────────────────────────────
  server.registerTool(
    "list_functions",
    {
      title: "List Functions",
      description: "Returns all serverless function objects.",
      annotations: { readOnlyHint: true },
      outputSchema: FunctionListOutputSchema,
    },
    async () => {
      const data = await client.get("/function");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { functions: data },
      };
    },
  );

  // ── get_function_index ────────────────────────────────────────────────
  server.registerTool(
    "get_function_index",
    {
      title: "Get Function Index",
      description: "Returns the source code (index) of a specific function.",
      annotations: { readOnlyHint: true },
      outputSchema: FunctionIndexOutputSchema,
      inputSchema: z.object({
        functionId: z.string().describe("Function ID"),
      }),
    },
    async ({ functionId }) => {
      const data = await client.get(`/function/${functionId}/index`);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: data as Record<string, unknown>,
      };
    },
  );

  // ── get_function_dependencies ─────────────────────────────────────────
  server.registerTool(
    "get_function_dependencies",
    {
      title: "Get Function Dependencies",
      description:
        "Returns the installed dependencies and their versions for a specific function.",
      annotations: { readOnlyHint: true },
      outputSchema: FunctionDependenciesOutputSchema,
      inputSchema: z.object({
        functionId: z.string().describe("Function ID"),
      }),
    },
    async ({ functionId }) => {
      const data = await client.get(`/function/${functionId}/dependencies`);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: data as Record<string, unknown>,
      };
    },
  );

  // ── list_env_vars ─────────────────────────────────────────────────────
  server.registerTool(
    "list_env_vars",
    {
      title: "List Environment Variables",
      description: "Returns all environment variable objects.",
      annotations: { readOnlyHint: true },
      outputSchema: EnvVarListOutputSchema,
    },
    async () => {
      const data = await client.get("/env-var");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { env_vars: data },
      };
    },
  );

  // ── insert_env_var ─────────────────────────────────────────────────────
  server.registerTool(
    "insert_env_var",
    {
      title: "Insert Environment Variable",
      description: "Creates a new environment variable.",
      outputSchema: EnvVarOutputSchema,
      inputSchema: z
        .object({
          _id: z
            .string()
            .optional()
            .describe("Optional custom ID. If omitted, MongoDB generates one."),
        })
        .merge(EnvVarInputBase),
    },
    async ({ _id, key, value }) => {
      const body: Record<string, unknown> = { key, value };
      if (_id !== undefined) body._id = _id;
      const result = (await client.post("/env-var", body)) as {
        _id: string;
        key: string;
        value: string;
      };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  // ── update_env_var ─────────────────────────────────────────────────────
  server.registerTool(
    "update_env_var",
    {
      title: "Update Environment Variable",
      description: "Updates an existing environment variable. _id is required.",
      outputSchema: EnvVarOutputSchema,
      inputSchema: z
        .object({ _id: z.string().describe("Env var ID. Required.") })
        .merge(EnvVarInputBase),
    },
    async ({ _id, key, value }) => {
      const result = (await client.put(`/env-var/${_id}`, {
        key,
        value,
      })) as { _id: string; key: string; value: string };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  // ── list_secrets ──────────────────────────────────────────────────────
  server.registerTool(
    "list_secrets",
    {
      title: "List Secrets",
      description: "Returns all secret objects.",
      annotations: { readOnlyHint: true },
      outputSchema: SecretListOutputSchema,
    },
    async () => {
      const data = await client.get("/secret");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { secrets: data },
      };
    },
  );

  // ── insert_secret ──────────────────────────────────────────────────────
  server.registerTool(
    "insert_secret",
    {
      title: "Insert Secret",
      description: "Creates a new secret.",
      outputSchema: SecretOutputSchema,
      inputSchema: z
        .object({
          _id: z
            .string()
            .optional()
            .describe("Optional custom ID. If omitted, MongoDB generates one."),
        })
        .merge(SecretInputBase),
    },
    async ({ _id, key, value }) => {
      const body: Record<string, unknown> = { key, value };
      if (_id !== undefined) body._id = _id;
      const result = (await client.post("/secret", body)) as {
        _id: string;
        key: string;
        value: string;
      };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  // ── update_secret ──────────────────────────────────────────────────────
  server.registerTool(
    "update_secret",
    {
      title: "Update Secret",
      description: "Updates an existing secret. _id is required.",
      outputSchema: SecretOutputSchema,
      inputSchema: z
        .object({ _id: z.string().describe("Secret ID. Required.") })
        .merge(SecretInputBase),
    },
    async ({ _id, key, value }) => {
      const result = (await client.put(`/secret/${_id}`, {
        key,
        value,
      })) as { _id: string; key: string; value: string };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  // ── insert_function ───────────────────────────────────────────────────
  server.registerTool(
    "insert_function",
    {
      title: "Insert Function",
      description:
        "Creates a new serverless function.\n\n" +
        "Environment variable and secret management:\n" +
        "- env_vars: omit to attach none; pass an array of IDs to attach them to the new function.\n" +
        "- secrets: omit to attach none; pass an array of IDs to attach them to the new function.\n" +
        "Use insert_env_var / insert_secret to create env vars and secrets before attaching them.",
      inputSchema: z
        .object({
          _id: z
            .string()
            .optional()
            .describe("Optional custom ID. If omitted, MongoDB generates one."),
        })
        .merge(FunctionInputBase),
    },
    async ({ _id, name, description, triggers, timeout, language, env_vars, secrets }) => {
      const fnBody: {
        _id?: string;
        name: string;
        triggers: Record<string, Trigger>;
        timeout: number;
        language: string;
        description?: string;
      } = { name, triggers, timeout, language };
      if (description !== undefined) fnBody.description = description;
      if (_id !== undefined) fnBody._id = _id;

      let fn = (await client.post("/function", fnBody)) as SpicaFunction;
      const fnId = fn._id;

      if (env_vars !== undefined) {
        for (const eid of env_vars) {
          await client.put(`/function/${fnId}/env-var/${eid}`);
        }
      }

      if (secrets !== undefined) {
        for (const sid of secrets) {
          await client.put(`/function/${fnId}/secret/${sid}`);
        }
      }

      fn = (await client.get(`/function/${fnId}`)) as SpicaFunction;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(fn, null, 2) }],
        structuredContent: fn as unknown as Record<string, unknown>,
      };
    },
  );

  // ── update_function ───────────────────────────────────────────────────
  const updateFunctionTool = server.registerTool(
    "update_function",
    {
      title: "Update Function",
      description:
        "Replaces an existing serverless function. _id is required.\n\n" +
        "Environment variable and secret management:\n" +
        "- env_vars: omit to leave existing env var attachments unchanged; pass an empty array to detach all; otherwise IDs not present in the array are detached from the function.\n" +
        "- secrets: omit to leave existing secret attachments unchanged; pass an empty array to detach all; otherwise IDs not present in the array are detached from the function.\n" +
        "Use insert_env_var / insert_secret to create or update env vars and secrets before attaching them.",
      inputSchema: z
        .object({ _id: z.string().describe("Function ID. Required.") })
        .merge(FunctionInputBase),
    },
    async ({
      _id,
      name,
      description,
      triggers,
      timeout,
      language,
      env_vars,
      secrets,
    }) => {
      const fnBody: {
        name: string;
        triggers: Record<string, Trigger>;
        timeout: number;
        language: string;
        description?: string;
      } = { name, triggers, timeout, language };
      if (description !== undefined) fnBody.description = description;

      let fn = (await client.put(`/function/${_id}`, fnBody)) as SpicaFunction;
      const fnId = _id;

      if (env_vars !== undefined) {
        const currentEnvIds = (fn.env_vars ?? []).map((e) =>
          typeof e === "string" ? e : e._id,
        );

        for (const eid of env_vars) {
          if (!currentEnvIds.includes(eid)) {
            await client.put(`/function/${fnId}/env-var/${eid}`);
          }
        }
        for (const eid of currentEnvIds) {
          if (!env_vars.includes(eid)) {
            await client.delete(`/function/${fnId}/env-var/${eid}`);
          }
        }
      }

      if (secrets !== undefined) {
        const currentSecretIds = (fn.secrets ?? []).map((s) =>
          typeof s === "string" ? s : s._id,
        );

        for (const sid of secrets) {
          if (!currentSecretIds.includes(sid)) {
            await client.put(`/function/${fnId}/secret/${sid}`);
          }
        }
        for (const sid of currentSecretIds) {
          if (!secrets.includes(sid)) {
            await client.delete(`/function/${fnId}/secret/${sid}`);
          }
        }
      }

      fn = (await client.get(`/function/${fnId}`)) as SpicaFunction;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(fn, null, 2) }],
        structuredContent: fn as unknown as Record<string, unknown>,
      };
    },
  );

  // ── save_function_index ───────────────────────────────────────────────
  server.registerTool(
    "save_function_index",
    {
      title: "Save Function Index",
      description:
        "Replaces and compiles the source code (index) of a function. " +
        "Returns 204 on success or a compilation diagnostics error on failure.",
      outputSchema: SuccessMessageOutputSchema,
      inputSchema: z.object({
        functionId: z.string().describe("Function ID"),
        index: z
          .string()
          .describe(
            `Source code of the function, example: ${JSON.stringify(index, null, 2)}`,
          ),
      }),
    },
    async ({ functionId, index }) => {
      await client.post(`/function/${functionId}/index`, { index });
      return {
        content: [
          {
            type: "text" as const,
            text: "Function index updated and compiled successfully.",
          },
        ],
        structuredContent: {
          message: "Function index updated and compiled successfully.",
        },
      };
    },
  );

  // ── save_function_dependencies ────────────────────────────────────────
  server.registerTool(
    "save_function_dependencies",
    {
      title: "Save Function Dependencies",
      description:
        "Installs one or more npm packages as dependencies for a function.",
      outputSchema: SuccessMessageOutputSchema,
      inputSchema: z.object({
        functionId: z.string().describe("Function ID"),
        packages: z
          .array(z.string())
          .describe("Package names to install, e.g. ['lodash', 'axios@1.6.0']"),
      }),
    },
    async ({ functionId, packages }) => {
      await client.post(`/function/${functionId}/dependencies`, {
        name: packages,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully installed packages: ${packages.join(", ")}`,
          },
        ],
        structuredContent: {
          message: `Successfully installed packages: ${packages.join(", ")}`,
        },
      };
    },
  );

  return { updateFunctionTool };
}
