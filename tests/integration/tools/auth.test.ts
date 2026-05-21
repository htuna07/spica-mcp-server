import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAuthTools } from "../../../src/tools/auth.js";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

function setup() {
  const handlers: Record<string, Handler> = {};
  const mockServer = {
    registerTool: vi.fn(
      (name: string, _config: unknown, handler: Handler) => {
        handlers[name] = handler;
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

  registerAuthTools(mockServer, mockClient as never);
  return { handlers, mockClient };
}

describe("registerAuthTools", () => {
  let handlers: Record<string, Handler>;
  let mockClient: ReturnType<typeof setup>["mockClient"];

  beforeEach(() => {
    ({ handlers, mockClient } = setup());
  });

  it("registers the expected tool names", () => {
    expect(Object.keys(handlers)).toEqual(
      expect.arrayContaining([
        "list_apikeys",
        "insert_apikey",
        "update_apikey",
        "list_identities",
        "insert_identity",
        "update_identity",
        "list_policies",
        "insert_policy",
        "update_policy",
        "list_users",
      ]),
    );
  });

  describe("list_apikeys", () => {
    it("calls GET /passport/apikey", async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await handlers["list_apikeys"]({});
      expect(mockClient.get).toHaveBeenCalledWith("/passport/apikey");
    });

    it("returns apikeys in structuredContent", async () => {
      const keys = [{ _id: "k1", name: "My Key" }];
      mockClient.get.mockResolvedValue({ data: keys });
      const result = (await handlers["list_apikeys"]({})) as {
        structuredContent: { apikeys: unknown };
      };
      expect(result.structuredContent.apikeys).toEqual(keys);
    });
  });

  describe("insert_apikey", () => {
    it("calls POST /passport/apikey with name and active fields", async () => {
      mockClient.post.mockResolvedValue({ _id: "k1", name: "CI Key" });
      mockClient.get.mockResolvedValue({ _id: "k1", name: "CI Key" });
      await handlers["insert_apikey"]({ name: "CI Key", active: true });
      expect(mockClient.post).toHaveBeenCalledWith(
        "/passport/apikey",
        expect.objectContaining({ name: "CI Key", active: true }),
      );
    });

    it("attaches policies via PUT after creation", async () => {
      mockClient.post.mockResolvedValue({ _id: "k1", name: "Key" });
      mockClient.get.mockResolvedValue({ _id: "k1", name: "Key" });
      await handlers["insert_apikey"]({
        name: "Key",
        active: true,
        policies: ["p1", "p2"],
      });
      expect(mockClient.put).toHaveBeenCalledWith(
        "/passport/apikey/k1/policy/p1",
      );
      expect(mockClient.put).toHaveBeenCalledWith(
        "/passport/apikey/k1/policy/p2",
      );
    });
  });

  describe("list_policies", () => {
    it("calls GET /passport/policy", async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await handlers["list_policies"]({});
      expect(mockClient.get).toHaveBeenCalledWith(
        "/passport/policy",
        expect.any(Object),
      );
    });
  });

  describe("list_identities", () => {
    it("calls GET /passport/identity", async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await handlers["list_identities"]({});
      expect(mockClient.get).toHaveBeenCalledWith(
        "/passport/identity",
        expect.any(Object),
      );
    });
  });

  describe("list_users", () => {
    it("calls GET /passport/user", async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await handlers["list_users"]({});
      expect(mockClient.get).toHaveBeenCalledWith(
        "/passport/user",
        expect.any(Object),
      );
    });
  });
});
