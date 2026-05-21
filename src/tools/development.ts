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
): { saveFunctionTool: RegisteredTool } {
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

  // ── save_env_var ──────────────────────────────────────────────────────
  server.registerTool(
    "save_env_var",
    {
      title: "Save Environment Variable",
      description:
        "Creates or updates an environment variable. When _id is provided the variable is updated, otherwise created.",
      outputSchema: EnvVarOutputSchema,
      inputSchema: z.object({
        _id: z
          .string()
          .optional()
          .describe("Env var ID. Omit to create a new variable."),
        key: z.string().describe("Variable key"),
        value: z.string().describe("Variable value"),
      }),
    },
    async ({ _id, key, value }) => {
      let result: { _id: string; key: string; value: string };
      if (_id) {
        result = (await client.put(`/env-var/${_id}`, {
          key,
          value,
        })) as typeof result;
      } else {
        result = (await client.post("/env-var", {
          key,
          value,
        })) as typeof result;
      }
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

  // ── save_secret ───────────────────────────────────────────────────────
  server.registerTool(
    "save_secret",
    {
      title: "Save Secret",
      description:
        "Creates or updates a secret. When _id is provided the secret is updated, otherwise created.",
      outputSchema: SecretOutputSchema,
      inputSchema: z.object({
        _id: z
          .string()
          .optional()
          .describe("Secret ID. Omit to create a new secret."),
        key: z.string().describe("Secret key"),
        value: z.string().describe("Secret value"),
      }),
    },
    async ({ _id, key, value }) => {
      let result: { _id: string; key: string; value: string };
      if (_id) {
        result = (await client.put(`/secret/${_id}`, {
          key,
          value,
        })) as typeof result;
      } else {
        result = (await client.post("/secret", {
          key,
          value,
        })) as typeof result;
      }
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  // ── save_function ─────────────────────────────────────────────────────
  const saveFunctionTool = server.registerTool(
    "save_function",
    {
      title: "Save Function",
      description:
        "Creates or updates a serverless function (upsert). When _id is provided the function is replaced, otherwise created.\n\n" +
        "Environment variable and secret management:\n" +
        "- env_vars: omit to leave existing env var attachments unchanged; pass an empty array to detach all; otherwise IDs not present in the array are detached from the function.\n" +
        "- secrets: omit to leave existing secret attachments unchanged; pass an empty array to detach all; otherwise IDs not present in the array are detached from the function.\n" +
        "Use save_env_var / save_secret to create or update env vars and secrets before attaching them.",
      inputSchema: z.object({
        _id: z.string().optional().describe("Function ID. Omit to create."),
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
          .describe(
            "Env var IDs to attach. Omit to leave unchanged; pass an empty array to detach all; otherwise IDs not in this array are detached.",
          ),
        secrets: z
          .array(z.string())
          .optional()
          .describe(
            "Secret IDs to attach. Omit to leave unchanged; pass an empty array to detach all; otherwise IDs not in this array are detached.",
          ),
      }),
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

      let fn: SpicaFunction;
      let fnId: string;

      if (_id) {
        fn = (await client.put(`/function/${_id}`, fnBody)) as SpicaFunction;
        fnId = _id;
      } else {
        fn = (await client.post("/function", fnBody)) as SpicaFunction;
        fnId = fn._id;
      }

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

  return { saveFunctionTool };
}
