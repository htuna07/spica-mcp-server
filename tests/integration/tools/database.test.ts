import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDatabaseTools } from "../../../src/tools/database.js";

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

  registerDatabaseTools(mockServer, mockClient as never);
  return { handlers, mockClient };
}

describe("registerDatabaseTools", () => {
  let handlers: Record<string, Handler>;
  let mockClient: ReturnType<typeof setup>["mockClient"];

  beforeEach(() => {
    ({ handlers, mockClient } = setup());
  });

  it("registers the expected tool names", () => {
    expect(Object.keys(handlers)).toEqual(
      expect.arrayContaining([
        "list_buckets",
        "insert_bucket",
        "update_bucket",
        "list_bucket_data",
        "save_bucket_data",
        "export_bucket_data",
        "import_bucket_data",
      ]),
    );
  });

  describe("list_buckets", () => {
    it("calls GET /bucket", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_buckets"]({});
      expect(mockClient.get).toHaveBeenCalledWith("/bucket");
    });

    it("returns the bucket list in structuredContent", async () => {
      const buckets = [{ _id: "b1", title: "Users" }];
      mockClient.get.mockResolvedValue(buckets);
      const result = (await handlers["list_buckets"]({})) as {
        structuredContent: { buckets: unknown };
      };
      expect(result.structuredContent.buckets).toEqual(buckets);
    });
  });

  describe("list_bucket_data", () => {
    it("calls GET /bucket/{id}/data", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_bucket_data"]({ bucketId: "b1" });
      expect(mockClient.get).toHaveBeenCalledWith(
        "/bucket/b1/data",
        expect.any(Object),
        expect.any(Object),
      );
    });

    it("forwards filter and pagination params", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_bucket_data"]({
        bucketId: "b1",
        filter: '{"active":true}',
        limit: 20,
        skip: 0,
      });
      expect(mockClient.get).toHaveBeenCalledWith(
        "/bucket/b1/data",
        expect.objectContaining({
          filter: '{"active":true}',
          limit: 20,
          skip: 0,
        }),
        expect.any(Object),
      );
    });

    it("sets accept-language header when language param is provided", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_bucket_data"]({ bucketId: "b1", language: "tr_TR" });
      expect(mockClient.get).toHaveBeenCalledWith(
        "/bucket/b1/data",
        expect.any(Object),
        expect.objectContaining({ "accept-language": "tr_TR" }),
      );
    });
  });

  describe("save_bucket_data (upsert logic)", () => {
    it("calls POST when the document has no _id (insert)", async () => {
      mockClient.post.mockResolvedValue({ _id: "new1", name: "Doc" });
      await handlers["save_bucket_data"]({
        bucketId: "b1",
        document: { name: "Doc" },
      });
      expect(mockClient.post).toHaveBeenCalledWith("/bucket/b1/data", {
        name: "Doc",
      });
      expect(mockClient.put).not.toHaveBeenCalled();
    });

    it("calls PUT to the correct sub-path when document has _id (update)", async () => {
      mockClient.put.mockResolvedValue({ _id: "doc1", name: "Updated" });
      await handlers["save_bucket_data"]({
        bucketId: "b1",
        document: { _id: "doc1", name: "Updated" },
      });
      expect(mockClient.put).toHaveBeenCalledWith(
        "/bucket/b1/data/doc1",
        expect.any(Object),
      );
      expect(mockClient.post).not.toHaveBeenCalled();
    });

    it("strips _id from the PUT request body", async () => {
      mockClient.put.mockResolvedValue({ _id: "doc1", name: "Updated" });
      await handlers["save_bucket_data"]({
        bucketId: "b1",
        document: { _id: "doc1", name: "Updated" },
      });
      const [, body] = mockClient.put.mock.calls[0] as [string, unknown];
      expect(body).not.toHaveProperty("_id");
    });
  });

  describe("insert_bucket", () => {
    it("calls POST /bucket with the bucket body", async () => {
      mockClient.post.mockResolvedValue({ _id: "b2" });
      await handlers["insert_bucket"]({
        title: "Products",
        description: "Product catalog",
        primary: "name",
        properties: { name: { type: "string" } },
        acl: { read: "true==true", write: "true==true" },
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        "/bucket",
        expect.objectContaining({ title: "Products" }),
      );
    });
  });

  describe("update_bucket", () => {
    it("calls PUT /bucket/{id} with the bucket body", async () => {
      mockClient.put.mockResolvedValue({ _id: "b1" });
      await handlers["update_bucket"]({
        _id: "b1",
        title: "Renamed",
        description: "Updated desc",
        primary: "name",
        properties: { name: { type: "string" } },
        acl: { read: "true==true", write: "true==true" },
      });
      expect(mockClient.put).toHaveBeenCalledWith(
        "/bucket/b1",
        expect.objectContaining({ title: "Renamed" }),
      );
    });
  });
});
