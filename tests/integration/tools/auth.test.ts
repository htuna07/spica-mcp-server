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

  describe("update_apikey", () => {
    it("calls PUT /passport/apikey/{id} with name and active", async () => {
      mockClient.put.mockResolvedValue({ _id: "k1", name: "Updated Key", active: false });
      await handlers["update_apikey"]({ _id: "k1", name: "Updated Key", active: false });
      expect(mockClient.put).toHaveBeenCalledWith(
        "/passport/apikey/k1",
        expect.objectContaining({ name: "Updated Key", active: false }),
      );
    });

    it("attaches new policies and removes dropped ones", async () => {
      // existing key has policy p1; we pass p2 → should add p2 and remove p1
      mockClient.put
        .mockResolvedValueOnce({ _id: "k1", name: "Key", active: true, policies: ["p1"] })
        .mockResolvedValue(undefined);
      mockClient.get.mockResolvedValue({ _id: "k1", name: "Key", active: true, policies: ["p2"] });
      await handlers["update_apikey"]({ _id: "k1", name: "Key", active: true, policies: ["p2"] });
      expect(mockClient.put).toHaveBeenCalledWith("/passport/apikey/k1/policy/p2");
      expect(mockClient.delete).toHaveBeenCalledWith("/passport/apikey/k1/policy/p1");
    });
  });

  describe("insert_identity", () => {
    it("calls POST /passport/identity with identifier and password", async () => {
      const identity = { _id: "id1", identifier: "alice" };
      mockClient.post.mockResolvedValue(identity);
      await handlers["insert_identity"]({ identifier: "alice", password: "secret" });
      expect(mockClient.post).toHaveBeenCalledWith(
        "/passport/identity",
        expect.objectContaining({ identifier: "alice", password: "secret" }),
      );
    });

    it("attaches policies via PUT after creation", async () => {
      const identity = { _id: "id1", identifier: "alice" };
      mockClient.post.mockResolvedValue(identity);
      mockClient.get.mockResolvedValue({ ...identity, policies: ["p1"] });
      await handlers["insert_identity"]({ identifier: "alice", password: "secret", policies: ["p1"] });
      expect(mockClient.put).toHaveBeenCalledWith("/passport/identity/id1/policy/p1");
    });
  });

  describe("update_identity", () => {
    it("calls PUT /passport/identity/{id} with updated fields", async () => {
      const identity = { _id: "id1", identifier: "alice-updated", policies: [] };
      mockClient.put.mockResolvedValue(identity);
      await handlers["update_identity"]({ _id: "id1", identifier: "alice-updated" });
      expect(mockClient.put).toHaveBeenCalledWith(
        "/passport/identity/id1",
        expect.objectContaining({ identifier: "alice-updated" }),
      );
    });

    it("adds new policies and removes dropped ones on update", async () => {
      // existing identity has p1; we want p2
      mockClient.put
        .mockResolvedValueOnce({ _id: "id1", identifier: "alice", policies: ["p1"] })
        .mockResolvedValue(undefined);
      mockClient.get.mockResolvedValue({ _id: "id1", identifier: "alice", policies: ["p2"] });
      await handlers["update_identity"]({ _id: "id1", policies: ["p2"] });
      expect(mockClient.put).toHaveBeenCalledWith("/passport/identity/id1/policy/p2");
      expect(mockClient.delete).toHaveBeenCalledWith("/passport/identity/id1/policy/p1");
    });
  });

  describe("insert_policy", () => {
    it("calls POST /passport/policy with name and statement", async () => {
      mockClient.post.mockResolvedValue({ _id: "pol1", name: "ReadAll" });
      await handlers["insert_policy"]({ name: "ReadAll", statement: [] });
      expect(mockClient.post).toHaveBeenCalledWith(
        "/passport/policy",
        expect.objectContaining({ name: "ReadAll" }),
      );
    });
  });

  describe("update_policy", () => {
    it("calls PUT /passport/policy/{id} with updated body", async () => {
      mockClient.put.mockResolvedValue({ _id: "pol1", name: "ReadAll-v2" });
      await handlers["update_policy"]({ _id: "pol1", name: "ReadAll-v2", statement: [] });
      expect(mockClient.put).toHaveBeenCalledWith(
        "/passport/policy/pol1",
        expect.objectContaining({ name: "ReadAll-v2" }),
      );
    });
  });
});
