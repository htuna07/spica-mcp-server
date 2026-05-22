import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { SpicaClient } from "../../src/client.js";
import { registerAuthTools } from "../../src/tools/auth.js";
import { registerDatabaseTools } from "../../src/tools/database.js";
import { registerDevelopmentTools } from "../../src/tools/development.js";
import { registerDebugTools } from "../../src/tools/debug.js";
import { registerAuditingTools } from "../../src/tools/auditing.js";
import { registerStorageTools } from "../../src/tools/storage.js";
import {
  buildTriggerSchemas,
  type FunctionInformation,
} from "../../src/schemas/triggers.js";

const SPICA_URL = process.env.SPICA_URL;
const SPICA_APIKEY = process.env.SPICA_APIKEY;

const shouldRun = Boolean(SPICA_URL && SPICA_APIKEY);

// Ordered list of API paths to DELETE in afterAll (reversed for dependency order)
const toDelete: string[] = [];

describe.skipIf(!shouldRun)("Spica E2E lifecycle (MCP tool calls)", () => {
  let mcpClient: Client;
  let spicaClient: SpicaClient;

  // Shared IDs populated during the run
  let bucketId: string;
  let docId: string;
  let storageId: string;
  let policyId: string;
  let apikeyId: string;
  let envVarId: string;
  let secretId: string;
  let functionId: string;

  // Call a tool by name, parse JSON from content[0].text, throw on isError
  async function call(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const result = await mcpClient.callTool({ name, arguments: args });
    if (result.isError) {
      const msg =
        (result.content as Array<{ type: string; text: string }>)[0]?.text ??
        "Tool call failed";
      throw new Error(`Tool "${name}" failed: ${msg}`);
    }
    const first = (result.content as Array<{ type: string; text: string }>)[0];
    try {
      return JSON.parse(first.text);
    } catch {
      return first.text;
    }
  }

  beforeAll(async () => {
    spicaClient = new SpicaClient(SPICA_URL!, SPICA_APIKEY!);

    const functionInfo = (await spicaClient.get(
      "/function/information",
    )) as FunctionInformation;
    const triggerInfo = buildTriggerSchemas(functionInfo);

    const server = new McpServer({ name: "e2e-test-server", version: "1.0.0" });
    registerAuthTools(server, spicaClient);
    registerDatabaseTools(server, spicaClient);
    registerDevelopmentTools(server, spicaClient, triggerInfo);
    registerDebugTools(server, spicaClient);
    registerAuditingTools(server, spicaClient);
    registerStorageTools(server, spicaClient);

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    mcpClient = new Client({ name: "e2e-test-client", version: "1.0.0" });
    await mcpClient.connect(clientTransport);
  }, 15000);

  // ── Connection ────────────────────────────────────────────────────────

  it("lists available MCP tools", async () => {
    const { tools } = await mcpClient.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("list_buckets");
    expect(names).toContain("insert_function");
    expect(names).toContain("list_activities");
  });

  // ── Bucket ────────────────────────────────────────────────────────────

  it("list_buckets returns an array", async () => {
    const result = await call("list_buckets");
    expect(Array.isArray(result)).toBe(true);
  });

  it("insert_bucket creates a bucket", async () => {
    const result = (await call("insert_bucket", {
      title: "E2E Test Bucket",
      description: "Created by E2E tool call tests — safe to delete",
      primary: "name",
      acl: { read: "true==true", write: "true==true" },
      properties: {
        name: { type: "string", title: "Name" },
        value: { type: "number", title: "Value" },
      },
    })) as { _id: string };
    expect(result._id).toBeDefined();
    bucketId = result._id;
    toDelete.push(`/bucket/${bucketId}`);
  });

  it("update_bucket replaces the bucket schema", async () => {
    const result = (await call("update_bucket", {
      _id: bucketId,
      title: "E2E Test Bucket (updated)",
      description: "Updated by E2E tool call tests",
      primary: "name",
      acl: { read: "true==true", write: "true==true" },
      properties: {
        name: { type: "string", title: "Name" },
        value: { type: "number", title: "Value" },
      },
    })) as { title: string };
    expect(result.title).toBe("E2E Test Bucket (updated)");
  });

  it("list_bucket_data returns empty array for new bucket", async () => {
    const result = (await call("list_bucket_data", { bucketId })) as unknown[];
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("save_bucket_data inserts a document", async () => {
    const result = (await call("save_bucket_data", {
      bucketId,
      document: { name: "e2e-doc", value: 42 },
    })) as { _id: string };
    expect(result._id).toBeDefined();
    docId = result._id;
  });

  it("list_bucket_data returns the inserted document", async () => {
    const result = (await call("list_bucket_data", { bucketId })) as Array<{
      name: string;
      value: number;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe("e2e-doc");
    expect(result[0].value).toBe(42);
  });

  it("save_bucket_data updates an existing document via _id", async () => {
    const result = (await call("save_bucket_data", {
      bucketId,
      document: { _id: docId, name: "e2e-doc-updated", value: 99 },
    })) as { name: string };
    expect(result.name).toBe("e2e-doc-updated");
  });

  // ── Storage ───────────────────────────────────────────────────────────

  it("list_storage_objects returns a result", async () => {
    const result = await call("list_storage_objects");
    expect(result).toBeDefined();
  });

  it("insert_storage_object creates a file", async () => {
    const data = Buffer.from("hello e2e tool").toString("base64");
    const result = (await call("insert_storage_object", {
      name: "e2e-file.txt",
      content: { type: "text/plain", data },
    })) as { _id: string };
    expect(result._id).toBeDefined();
    storageId = result._id;
    toDelete.push(`/storage/${storageId}`);
  });

  it("update_storage_object replaces file content", async () => {
    const data = Buffer.from("hello e2e tool v2").toString("base64");
    const result = (await call("update_storage_object", {
      _id: storageId,
      name: "e2e-file.txt",
      content: { type: "text/plain", data },
    })) as { _id: string };
    expect(result._id).toBe(storageId);
  });

  it("rename_storage_object changes the file name", async () => {
    const result = await call("rename_storage_object", {
      id: storageId,
      name: "e2e-renamed.txt",
    });
    expect(result).toBeDefined();
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  it("list_policies returns policies", async () => {
    const result = await call("list_policies");
    expect(result).toBeDefined();
  });

  it("insert_policy creates a policy", async () => {
    const result = (await call("insert_policy", {
      name: "e2e-policy",
      description: "E2E tool test — safe to delete",
      statement: [
        {
          action: "bucket:index",
          module: "bucket",
          resource: { include: ["*"], exclude: [] },
        },
      ],
    })) as { _id: string };
    expect(result._id).toBeDefined();
    policyId = result._id;
    toDelete.push(`/passport/policy/${policyId}`);
  });

  it("list_apikeys returns an array", async () => {
    const result = (await call("list_apikeys")) as unknown[];
    expect(Array.isArray(result)).toBe(true);
  });

  it("insert_apikey creates an apikey", async () => {
    const result = (await call("insert_apikey", {
      name: "e2e-apikey",
      description: "E2E tool test — safe to delete",
      active: true,
    })) as { _id: string };
    expect(result._id).toBeDefined();
    apikeyId = result._id;
    toDelete.push(`/passport/apikey/${apikeyId}`);
  });

  it("update_apikey modifies the apikey", async () => {
    const result = (await call("update_apikey", {
      _id: apikeyId,
      name: "e2e-apikey",
      description: "Updated by E2E",
      active: false,
    })) as { active: boolean };
    expect(result.active).toBe(false);
  });

  it("list_identities returns identities", async () => {
    const result = await call("list_identities");
    expect(result).toBeDefined();
  });

  it("list_users returns users", async () => {
    const result = await call("list_users");
    expect(result).toBeDefined();
  });

  // ── Development ───────────────────────────────────────────────────────

  it("list_env_vars returns an array", async () => {
    const result = (await call("list_env_vars")) as unknown[];
    expect(Array.isArray(result)).toBe(true);
  });

  it("insert_env_var creates an env var", async () => {
    const result = (await call("insert_env_var", {
      key: "E2E_TOOL_VAR",
      value: "hello",
    })) as { _id: string };
    expect(result._id).toBeDefined();
    envVarId = result._id;
    toDelete.push(`/env-var/${envVarId}`);
  });

  it("update_env_var updates the env var", async () => {
    const result = (await call("update_env_var", {
      _id: envVarId,
      key: "E2E_TOOL_VAR",
      value: "updated",
    })) as { value: string };
    expect(result.value).toBe("updated");
  });

  it("list_secrets returns an array", async () => {
    const result = (await call("list_secrets")) as unknown[];
    expect(Array.isArray(result)).toBe(true);
  });

  it("insert_secret creates a secret", async () => {
    const result = (await call("insert_secret", {
      key: "E2E_TOOL_SECRET",
      value: "s3cret",
    })) as { _id: string };
    expect(result._id).toBeDefined();
    secretId = result._id;
    toDelete.push(`/secret/${secretId}`);
  });

  it("update_secret updates the secret", async () => {
    const result = (await call("update_secret", {
      _id: secretId,
      key: "E2E_TOOL_SECRET",
      value: "s3cret-v2",
    })) as { key: string };
    expect(result.key).toBe("E2E_TOOL_SECRET");
  });

  it("list_functions returns an array", async () => {
    const result = (await call("list_functions")) as unknown[];
    expect(Array.isArray(result)).toBe(true);
  });

  it("insert_function creates a function", async () => {
    const result = (await call("insert_function", {
      name: "e2e-tool-function",
      description: "E2E tool test — safe to delete",
      language: "javascript",
      timeout: 10,
      triggers: {
        default: {
          type: "http",
          active: true,
          options: {
            method: "Get",
            path: "/e2e-tool-test",
            preflight: true,
            authenticate: [],
            authorize: false,
          },
        },
      },
    })) as { _id: string };
    expect(result._id).toBeDefined();
    functionId = result._id;
    toDelete.push(`/function/${functionId}`);
  });

  it("save_function_index saves source code", async () => {
    const result = await call("save_function_index", {
      functionId,
      index:
        "export default async function(req, res) { res.send('e2e ok'); }",
    });
    expect(typeof result).toBe("string");
  });

  it("get_function_index retrieves the saved index", async () => {
    const result = await call("get_function_index", { functionId });
    expect(result).toBeDefined();
  });

  it("get_function_dependencies returns dependencies", async () => {
    const result = await call("get_function_dependencies", { functionId });
    expect(result).toBeDefined();
  });

  // ── Auditing ──────────────────────────────────────────────────────────

  it("list_activities returns activity log", async () => {
    const result = await call("list_activities", { limit: 5 });
    expect(result).toBeDefined();
  });

  // ── Debug ─────────────────────────────────────────────────────────────

  it("list_user_profile returns user profile data", async () => {
    const result = await call("list_user_profile", { limit: 1 });
    expect(result).toBeDefined();
  });

  it("list_function_logs returns function logs", async () => {
    const result = await call("list_function_logs", { limit: 5 });
    expect(result).toBeDefined();
  });

  // ── Cleanup ───────────────────────────────────────────────────────────

  afterAll(async () => {
    // Delete in reverse creation order to respect dependencies
    for (const path of [...toDelete].reverse()) {
      try {
        await spicaClient.delete(path);
      } catch {
        // Best-effort — test must not fail if a resource was already removed
      }
    }
  });
});
