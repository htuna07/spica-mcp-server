import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpicaClient } from "../client";
import type { StorageObject } from "../types";
import {
  StorageObjectOutputSchema,
  StorageObjectListOutputSchema,
} from "../schemas/outputs";

// ── Shared storage object field schema ────────────────────────────────────────────
const StorageObjectInputBase = z.object({
  name: z.string().describe("File name"),
  content: z.object({
    type: z.string().describe("MIME type, e.g. text/plain, image/png"),
    data: z.string().describe("Base64-encoded content data"),
  }),
});

export function registerStorageTools(
  server: McpServer,
  client: SpicaClient,
): void {
  // ── list_storage_objects ──────────────────────────────────────────────
  server.registerTool(
    "list_storage_objects",
    {
      title: "List Storage Objects",
      description:
        "Returns storage objects with optional filtering, pagination, and sorting.",
      annotations: { readOnlyHint: true },
      outputSchema: StorageObjectListOutputSchema,
      inputSchema: z.object({
        filter: z.string().optional().describe("JSON filter object"),
        paginate: z
          .boolean()
          .optional()
          .describe("When true, includes pagination metadata"),
        limit: z.number().int().optional().describe("Max objects to return"),
        skip: z.number().int().optional().describe("Objects to skip"),
        sort: z.string().optional().describe("JSON sort object"),
      }),
    },
    async ({ filter, paginate, limit, skip, sort }) => {
      const data = await client.get("/storage", {
        filter,
        paginate,
        limit,
        skip,
        sort,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { objects: data },
      };
    },
  );

  // ── insert_storage_object ─────────────────────────────────────────────
  server.registerTool(
    "insert_storage_object",
    {
      title: "Insert Storage Object",
      description:
        "Creates a new storage object. Content data must be base64-encoded.",
      inputSchema: z
        .object({
          _id: z
            .string()
            .optional()
            .describe("Optional custom ID. If omitted, MongoDB generates one."),
        })
        .merge(StorageObjectInputBase),
    },
    async ({ _id, name, content }) => {
      const obj: Record<string, unknown> = { name, content };
      if (_id !== undefined) obj._id = _id;
      const arr = (await client.post("/storage", [obj])) as StorageObject[];
      const result: StorageObject = Array.isArray(arr) ? arr[0] : arr;
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  // ── update_storage_object ─────────────────────────────────────────────
  server.registerTool(
    "update_storage_object",
    {
      title: "Update Storage Object",
      description:
        "Replaces an existing storage object. _id is required. Content data must be base64-encoded.",
      inputSchema: z
        .object({ _id: z.string().describe("Storage object ID. Required.") })
        .merge(StorageObjectInputBase),
    },
    async ({ _id, name, content }) => {
      const result = (await client.put(`/storage/${_id}`, {
        name,
        content,
      })) as StorageObject;
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  // ── rename_storage_object ─────────────────────────────────────────────
  server.registerTool(
    "rename_storage_object",
    {
      title: "Rename Storage Object",
      description: "Renames a storage object by updating its metadata.",
      inputSchema: z.object({
        id: z.string().describe("Storage object ID"),
        name: z.string().describe("New file name"),
      }),
    },
    async ({ id, name }) => {
      const result = await client.patch(`/storage/${id}`, { name });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result as Record<string, unknown>,
      };
    },
  );
}
