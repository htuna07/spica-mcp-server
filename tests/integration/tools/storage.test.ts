import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerStorageTools } from "../../../src/tools/storage.js";

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

  registerStorageTools(mockServer, mockClient as never);
  return { handlers, mockClient };
}

describe("registerStorageTools", () => {
  let handlers: Record<string, Handler>;
  let mockClient: ReturnType<typeof setup>["mockClient"];

  beforeEach(() => {
    ({ handlers, mockClient } = setup());
  });

  it("registers the expected tool names", () => {
    expect(Object.keys(handlers)).toEqual(
      expect.arrayContaining([
        "list_storage_objects",
        "insert_storage_object",
        "update_storage_object",
        "rename_storage_object",
      ]),
    );
  });

  describe("list_storage_objects", () => {
    it("calls GET /storage with provided params", async () => {
      mockClient.get.mockResolvedValue([]);
      await handlers["list_storage_objects"]({ limit: 10, skip: 0 });
      expect(mockClient.get).toHaveBeenCalledWith(
        "/storage",
        expect.objectContaining({ limit: 10, skip: 0 }),
      );
    });

    it("returns objects in structuredContent", async () => {
      const objects = [{ _id: "s1", name: "file.txt" }];
      mockClient.get.mockResolvedValue(objects);
      const result = (await handlers["list_storage_objects"]({})) as {
        structuredContent: { objects: unknown };
      };
      expect(result.structuredContent.objects).toEqual(objects);
    });
  });

  describe("insert_storage_object", () => {
    it("calls POST /storage with the object wrapped in an array", async () => {
      const stored = [{ _id: "s1", name: "logo.png" }];
      mockClient.post.mockResolvedValue(stored);
      await handlers["insert_storage_object"]({
        name: "logo.png",
        content: { type: "image/png", data: "base64data==" },
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        "/storage",
        expect.arrayContaining([
          expect.objectContaining({ name: "logo.png" }),
        ]),
      );
    });

    it("includes custom _id when provided", async () => {
      const stored = [{ _id: "custom-id", name: "logo.png" }];
      mockClient.post.mockResolvedValue(stored);
      await handlers["insert_storage_object"]({
        _id: "custom-id",
        name: "logo.png",
        content: { type: "image/png", data: "data==" },
      });
      const [, body] = mockClient.post.mock.calls[0] as [string, unknown[]];
      expect(body[0]).toHaveProperty("_id", "custom-id");
    });

    it("returns the first element of the created array", async () => {
      const stored = [{ _id: "s1", name: "logo.png" }];
      mockClient.post.mockResolvedValue(stored);
      const result = (await handlers["insert_storage_object"]({
        name: "logo.png",
        content: { type: "image/png", data: "data==" },
      })) as { structuredContent: unknown };
      expect(result.structuredContent).toMatchObject({ _id: "s1" });
    });
  });

  describe("update_storage_object", () => {
    it("calls PUT /storage/{id} with name and content", async () => {
      mockClient.put.mockResolvedValue({ _id: "s1", name: "new.png" });
      await handlers["update_storage_object"]({
        _id: "s1",
        name: "new.png",
        content: { type: "image/png", data: "newdata==" },
      });
      expect(mockClient.put).toHaveBeenCalledWith(
        "/storage/s1",
        expect.objectContaining({ name: "new.png" }),
      );
    });
  });

  describe("rename_storage_object", () => {
    it("calls PATCH /storage/{id} with the new name", async () => {
      mockClient.patch.mockResolvedValue({ _id: "s1", name: "renamed.png" });
      await handlers["rename_storage_object"]({ id: "s1", name: "renamed.png" });
      expect(mockClient.patch).toHaveBeenCalledWith("/storage/s1", {
        name: "renamed.png",
      });
    });
  });
});
