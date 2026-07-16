import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDevelopmentTools } from "../../../src/tools/development.js";
import {
  buildTriggerSchemas,
  type FunctionInformation,
} from "../../../src/schemas/triggers.js";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

const baseInfo: FunctionInformation = {
  enqueuers: [],
  runtimes: [
    {
      name: "node",
      title: "Node.js",
      description: "Node runtime",
      language: "javascript",
    },
  ],
  timeout: 30,
};
const triggerInfo = buildTriggerSchemas(baseInfo);

function setup() {
  const handlers: Record<string, Handler> = {};
  const mockServer = {
    registerTool: vi.fn(
      (name: string, _config: unknown, handler: Handler) => {
        handlers[name] = handler;
        return { update: vi.fn() }; // RegisteredTool minimal shape
      },
    ),
  } as unknown as McpServer;

  const mockClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };

  registerDevelopmentTools(mockServer, mockClient as never, triggerInfo);
  return { handlers, mockClient };
}

describe("registerDevelopmentTools", () => {
  let handlers: Record<string, Handler>;
  let mockClient: ReturnType<typeof setup>["mockClient"];

  beforeEach(() => {
    ({ handlers, mockClient } = setup());
  });

  it("registers the expected tool names", () => {
    expect(Object.keys(handlers)).toEqual(
      expect.arrayContaining([
        "list_functions",
        "get_function_index",
        "get_function_dependencies",
        "insert_function",
        "update_function",
        "save_function_index",
        "save_function_dependencies",
        "list_env_vars",
        "insert_env_var",
        "update_env_var",
        "list_secrets",
        "insert_secret",
        "update_secret",
      ]),
    );
  });

  describe("list_functions", () => {
    it("calls GET /function", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_functions"]({});
      expect(mockClient.get).toHaveBeenCalledWith("/function");
    });

    it("returns functions in structuredContent", async () => {
      const fns = [{ _id: "fn1", name: "myFn" }];
      mockClient.get.mockResolvedValue(fns);
      const result = (await handlers["list_functions"]({})) as {
        structuredContent: { functions: unknown };
      };
      expect(result.structuredContent.functions).toEqual(fns);
    });
  });

  describe("get_function_index", () => {
    it("calls GET /function/{id}/index", async () => {
      mockClient.get.mockResolvedValue({ index: "export default {}" });
      await handlers["get_function_index"]({ functionId: "fn1" });
      expect(mockClient.get).toHaveBeenCalledWith("/function/fn1/index");
    });
  });

  describe("get_function_dependencies", () => {
    it("calls GET /function/{id}/dependencies", async () => {
      mockClient.get.mockResolvedValue({ lodash: "^4.17.21" });
      await handlers["get_function_dependencies"]({ functionId: "fn1" });
      expect(mockClient.get).toHaveBeenCalledWith(
        "/function/fn1/dependencies",
      );
    });
  });

  describe("insert_function", () => {
    it("calls POST /function with the function body", async () => {
      const fn = { _id: "fn1", name: "greeting" };
      mockClient.post.mockResolvedValue(fn);
      mockClient.get.mockResolvedValue(fn);
      await handlers["insert_function"]({
        name: "greeting",
        triggers: {},
        timeout: 30,
        language: "javascript",
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        "/function",
        expect.objectContaining({ name: "greeting", timeout: 30 }),
      );
    });

    it("fetches the created function after POST", async () => {
      const fn = { _id: "fn1", name: "greeting" };
      mockClient.post.mockResolvedValue(fn);
      mockClient.get.mockResolvedValue(fn);
      await handlers["insert_function"]({
        name: "greeting",
        triggers: {},
        timeout: 30,
        language: "javascript",
      });
      expect(mockClient.get).toHaveBeenCalledWith("/function/fn1");
    });

    it("omits triggers from the body for a helper function", async () => {
      const fn = { _id: "fn1", name: "helper" };
      mockClient.post.mockResolvedValue(fn);
      mockClient.get.mockResolvedValue(fn);
      await handlers["insert_function"]({
        name: "helper",
        timeout: 30,
        language: "javascript",
      });
      const body = mockClient.post.mock.calls[0][1];
      expect(body).not.toHaveProperty("triggers");
    });
  });

  describe("list_env_vars", () => {
    it("calls GET /env-var", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_env_vars"]({});
      expect(mockClient.get).toHaveBeenCalledWith("/env-var");
    });
  });

  describe("insert_env_var", () => {
    it("calls POST /env-var with key and value", async () => {
      mockClient.post.mockResolvedValue({ _id: "ev1", key: "NODE_ENV", value: "production" });
      await handlers["insert_env_var"]({ key: "NODE_ENV", value: "production" });
      expect(mockClient.post).toHaveBeenCalledWith(
        "/env-var",
        expect.objectContaining({ key: "NODE_ENV", value: "production" }),
      );
    });
  });

  describe("update_env_var", () => {
    it("calls PUT /env-var/{id} with updated key/value", async () => {
      mockClient.put.mockResolvedValue({ _id: "ev1", key: "NODE_ENV", value: "staging" });
      await handlers["update_env_var"]({
        _id: "ev1",
        key: "NODE_ENV",
        value: "staging",
      });
      expect(mockClient.put).toHaveBeenCalledWith(
        "/env-var/ev1",
        expect.objectContaining({ key: "NODE_ENV", value: "staging" }),
      );
    });
  });

  describe("list_secrets", () => {
    it("calls GET /secret", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_secrets"]({});
      expect(mockClient.get).toHaveBeenCalledWith("/secret");
    });
  });

  describe("update_secret", () => {
    it("calls PUT /secret/{id} with updated key and value", async () => {
      mockClient.put.mockResolvedValue({ _id: "s1", key: "DB_PASS", value: "newpass" });
      await handlers["update_secret"]({ _id: "s1", key: "DB_PASS", value: "newpass" });
      expect(mockClient.put).toHaveBeenCalledWith(
        "/secret/s1",
        expect.objectContaining({ key: "DB_PASS", value: "newpass" }),
      );
    });
  });

  describe("update_function", () => {
    it("calls PUT /function/{id} with function body", async () => {
      const fn = { _id: "fn1", name: "updated", env_vars: [], secrets: [] };
      mockClient.put.mockResolvedValue(fn);
      mockClient.get.mockResolvedValue(fn);
      await handlers["update_function"]({
        _id: "fn1",
        name: "updated",
        triggers: {},
        timeout: 30,
        language: "javascript",
      });
      expect(mockClient.put).toHaveBeenCalledWith(
        "/function/fn1",
        expect.objectContaining({ name: "updated", timeout: 30 }),
      );
    });

    it("fetches the function after PUT", async () => {
      const fn = { _id: "fn1", name: "updated", env_vars: [], secrets: [] };
      mockClient.put.mockResolvedValue(fn);
      mockClient.get.mockResolvedValue(fn);
      await handlers["update_function"]({
        _id: "fn1",
        name: "updated",
        triggers: {},
        timeout: 30,
        language: "javascript",
      });
      expect(mockClient.get).toHaveBeenCalledWith("/function/fn1");
    });
  });

  describe("save_function_index", () => {
    it("calls POST /function/{id}/index with the source code", async () => {
      mockClient.post.mockResolvedValue(undefined);
      await handlers["save_function_index"]({
        functionId: "fn1",
        index: "export default function() {}",
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        "/function/fn1/index",
        expect.objectContaining({ index: "export default function() {}" }),
      );
    });
  });

  describe("save_function_dependencies", () => {
    it("calls POST /function/{id}/dependencies with package name array", async () => {
      mockClient.post.mockResolvedValue(undefined);
      await handlers["save_function_dependencies"]({
        functionId: "fn1",
        packages: ["lodash", "axios@1.6.0"],
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        "/function/fn1/dependencies",
        expect.objectContaining({ name: ["lodash", "axios@1.6.0"] }),
      );
    });
  });
});
