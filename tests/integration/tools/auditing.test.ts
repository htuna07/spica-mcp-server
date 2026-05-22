import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAuditingTools } from "../../../src/tools/auditing.js";

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

  registerAuditingTools(mockServer, mockClient as never);
  return { handlers, mockClient };
}

describe("registerAuditingTools", () => {
  let handlers: Record<string, Handler>;
  let mockClient: ReturnType<typeof setup>["mockClient"];

  beforeEach(() => {
    ({ handlers, mockClient } = setup());
  });

  it("registers the list_activities tool", () => {
    expect(handlers).toHaveProperty("list_activities");
  });

  describe("list_activities", () => {
    it("calls GET /activity with no params when none provided", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_activities"]({});
      expect(mockClient.get).toHaveBeenCalledWith(
        "/activity",
        expect.any(Object),
      );
    });

    it("forwards identifier filter to the API", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_activities"]({ identifier: "user123" });
      expect(mockClient.get).toHaveBeenCalledWith(
        "/activity",
        expect.objectContaining({ identifier: "user123" }),
      );
    });

    it("forwards action array filter to the API", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_activities"]({ action: [1, 2] });
      expect(mockClient.get).toHaveBeenCalledWith(
        "/activity",
        expect.objectContaining({ action: [1, 2] }),
      );
    });

    it("forwards date range filters (begin/end)", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_activities"]({
        begin: "2024-01-01T00:00:00Z",
        end: "2024-12-31T23:59:59Z",
      });
      expect(mockClient.get).toHaveBeenCalledWith(
        "/activity",
        expect.objectContaining({
          begin: "2024-01-01T00:00:00Z",
          end: "2024-12-31T23:59:59Z",
        }),
      );
    });

    it("forwards pagination (skip/limit) to the API", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_activities"]({ skip: 10, limit: 25 });
      expect(mockClient.get).toHaveBeenCalledWith(
        "/activity",
        expect.objectContaining({ skip: 10, limit: 25 }),
      );
    });

    it("returns activities in structuredContent", async () => {
      const activities = [{ _id: "a1", action: 1 }];
      mockClient.get.mockResolvedValue(activities);
      const result = (await handlers["list_activities"]({})) as {
        structuredContent: { activities: unknown };
      };
      expect(result.structuredContent.activities).toEqual(activities);
    });
  });
});
