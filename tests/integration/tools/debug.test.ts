import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDebugTools } from "../../../src/tools/debug.js";

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

  registerDebugTools(mockServer, mockClient as never);
  return { handlers, mockClient };
}

describe("registerDebugTools", () => {
  let handlers: Record<string, Handler>;
  let mockClient: ReturnType<typeof setup>["mockClient"];

  beforeEach(() => {
    ({ handlers, mockClient } = setup());
  });

  it("registers the expected tool names", () => {
    expect(Object.keys(handlers)).toEqual(
      expect.arrayContaining([
        "list_bucket_data_profile",
        "list_user_profile",
        "list_function_logs",
      ]),
    );
  });

  describe("list_bucket_data_profile", () => {
    it("calls GET /bucket/{id}/data/profile", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_bucket_data_profile"]({ bucketId: "b1" });
      expect(mockClient.get).toHaveBeenCalledWith(
        "/bucket/b1/data/profile",
        expect.any(Object),
      );
    });

    it("forwards filter, limit, skip, sort params", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_bucket_data_profile"]({
        bucketId: "b1",
        filter: '{"status":"active"}',
        limit: 10,
        skip: 5,
        sort: '{"createdAt":-1}',
      });
      expect(mockClient.get).toHaveBeenCalledWith(
        "/bucket/b1/data/profile",
        expect.objectContaining({
          filter: '{"status":"active"}',
          limit: 10,
          skip: 5,
          sort: '{"createdAt":-1}',
        }),
      );
    });

    it("returns entries in structuredContent", async () => {
      const entries = [{ _id: "e1", count: 5 }];
      mockClient.get.mockResolvedValue(entries);
      const result = (await handlers["list_bucket_data_profile"]({
        bucketId: "b1",
      })) as { structuredContent: { entries: unknown } };
      expect(result.structuredContent.entries).toEqual(entries);
    });
  });

  describe("list_user_profile", () => {
    it("calls GET /passport/user/profile", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_user_profile"]({});
      expect(mockClient.get).toHaveBeenCalledWith(
        "/passport/user/profile",
        expect.any(Object),
      );
    });
  });

  describe("list_function_logs", () => {
    it("calls GET /function-logs", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_function_logs"]({});
      expect(mockClient.get).toHaveBeenCalledWith(
        "/function-logs",
        expect.any(Object),
      );
    });

    it("forwards functions array param", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_function_logs"]({
        functions: ["fn1", "fn2"],
      });
      expect(mockClient.get).toHaveBeenCalledWith(
        "/function-logs",
        expect.objectContaining({ functions: ["fn1", "fn2"] }),
      );
    });

    it("returns logs in structuredContent", async () => {
      const logs = [{ _id: "l1", channel: "stderr", content: "error msg" }];
      mockClient.get.mockResolvedValue(logs);
      const result = (await handlers["list_function_logs"]({})) as {
        structuredContent: { logs: unknown };
      };
      expect(result.structuredContent.logs).toEqual(logs);
    });
  });
});
