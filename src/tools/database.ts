import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpicaClient } from "../client";
import { BucketPropertySchema } from "../schemas/bucket";
import {
  BucketListOutputSchema,
  BucketDocumentListOutputSchema,
  ExportBucketDataOutputSchema,
  ImportBucketDataOutputSchema,
} from "../schemas/outputs";

// ── CSV helpers ───────────────────────────────────────────────────────────────

function csvEscape(val: unknown): string {
  const s =
    val === null || val === undefined
      ? ""
      : typeof val === "object"
        ? JSON.stringify(val)
        : String(val);
  if (
    s.includes(",") ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r")
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

function parseCsvValue(v: string): unknown {
  if (v === "" || v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  const n = Number(v);
  if (v.trim() !== "" && !isNaN(n)) return n;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  fields.push(cur);
  return fields;
}

function fromCsv(content: string): Record<string, unknown>[] {
  // Stream-parse character by character to correctly handle RFC4180 quoted
  // fields that may contain embedded newlines.
  const records: string[][] = [];
  let cur = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];
    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        if (ch === "\r") i++;
        row.push(cur);
        cur = "";
        if (row.some((f) => f !== "")) records.push(row);
        row = [];
      } else {
        cur += ch;
      }
    }
  }
  // Flush last field/row
  row.push(cur);
  if (row.some((f) => f !== "")) records.push(row);

  if (records.length < 2) return [];
  const headers = records[0];
  return records.slice(1).map((values) => {
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = parseCsvValue(values[j] ?? "");
    }
    return obj;
  });
}

// ── Shared bucket field schema ───────────────────────────────────────────────
const BucketInputBase = z.object({
  title: z
    .string()
    .min(4)
    .max(100)
    .describe("Display title of the bucket"),
  icon: z
    .string()
    .optional()
    .describe("Material icon identifier. Default: 'view_stream'"),
  description: z
    .string()
    .min(5)
    .max(250)
    .describe("Description of the bucket"),
  primary: z.string().describe("Primary field key used as display column"),
  history: z
    .boolean()
    .optional()
    .describe("Enable document history tracking. Default: false"),
  category: z
    .string()
    .optional()
    .describe("Category name for grouping buckets"),
  properties: z
    .record(BucketPropertySchema)
    .describe(
      "Field definitions keyed by field name. Property names must be lowercase with underscores/digits only (pattern: ^(?!(_id)$)([a-z_0-9]*)+$). At least one property is required.",
    ),
  order: z.number().optional().describe("Display order of the bucket"),
  required: z
    .array(z.string())
    .optional()
    .describe("Array of required field names"),
  acl: z.object({
    read: z
      .string()
      .describe(
        "ACL expression for read access. Runs for only users. Example: 'document.owner==auth._id' (users can only read their own data). Default: 'true==true'",
      ),
    write: z
      .string()
      .describe(
        "ACL expression for write access. Runs for only users. Example: 'document.owner==auth._id' (users can only write their own data). Default: 'true==true'",
      ),
  }),
  documentSettings: z
    .object({
      countLimit: z
        .number()
        .min(1)
        .optional()
        .describe("Maximum number of documents this bucket can hold"),
      limitExceedBehaviour: z
        .enum(["prevent", "remove"])
        .optional()
        .describe(
          "'prevent': reject new inserts when limit is reached. 'remove': delete oldest documents to stay within limit",
        ),
    })
    .optional()
    .describe("Document count limits and overflow behaviour"),
  indexes: z
    .array(
      z.object({
        definition: z
          .record(z.union([z.number().int(), z.string()]))
          .describe(
            "Field paths and index direction (1 for ascending, -1 for descending, or 'text' for text index)",
          ),
        options: z
          .record(z.any())
          .optional()
          .describe(
            "Additional MongoDB index options (e.g. unique, sparse, expireAfterSeconds for TTL)",
          ),
      }),
    )
    .optional()
    .describe("Custom database indexes"),
});

export function registerDatabaseTools(
  server: McpServer,
  client: SpicaClient,
): void {
  // ── list_buckets ──────────────────────────────────────────────────────
  server.registerTool(
    "list_buckets",
    {
      title: "List Buckets",
      description: "Returns all bucket schemas from the Spica server.",
      annotations: { readOnlyHint: true },
      outputSchema: BucketListOutputSchema,
    },
    async () => {
      const data = await client.get("/bucket");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { buckets: data },
      };
    },
  );

  // ── insert_bucket ─────────────────────────────────────────────────────
  server.registerTool(
    "insert_bucket",
    {
      title: "Insert Bucket",
      description:
        "Creates a new bucket schema.\n\n" +
        "The 'properties' field defines the bucket's data model. Each property has a 'type' which can be:\n" +
        "- Standard types: string, number, boolean, object, array\n" +
        "- Spica types: relation (link to another bucket), storage (file reference), richtext, textarea, color, " +
        "date, location (GeoJSON Point), multiselect, json, hash, encrypted\n\n" +
        "For 'relation' type: bucketId and relationType (onetoone/onetomany) are required.\n" +
        "For 'object' type: use nested 'properties' to define sub-fields.\n" +
        "For 'array'/'multiselect' type: use 'items' to define the element schema.",
      inputSchema: z
        .object({
          _id: z
            .string()
            .optional()
            .describe("Optional custom ID. If omitted, MongoDB generates one."),
        })
        .merge(BucketInputBase),
    },
    async ({ _id, ...rest }) => {
      const bucket = await client.post(
        "/bucket",
        _id !== undefined ? { _id, ...rest } : rest,
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(bucket, null, 2) },
        ],
        structuredContent: bucket as Record<string, unknown>,
      };
    },
  );

  // ── update_bucket ─────────────────────────────────────────────────────
  server.registerTool(
    "update_bucket",
    {
      title: "Update Bucket",
      description:
        "Replaces an existing bucket schema. _id is required.\n\n" +
        "The 'properties' field defines the bucket's data model. Each property has a 'type' which can be:\n" +
        "- Standard types: string, number, boolean, object, array\n" +
        "- Spica types: relation (link to another bucket), storage (file reference), richtext, textarea, color, " +
        "date, location (GeoJSON Point), multiselect, json, hash, encrypted\n\n" +
        "For 'relation' type: bucketId and relationType (onetoone/onetomany) are required.\n" +
        "For 'object' type: use nested 'properties' to define sub-fields.\n" +
        "For 'array'/'multiselect' type: use 'items' to define the element schema.",
      inputSchema: z
        .object({ _id: z.string().describe("Bucket ID. Required.") })
        .merge(BucketInputBase),
    },
    async ({ _id, ...body }) => {
      const bucket = await client.put(`/bucket/${_id}`, body);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(bucket, null, 2) },
        ],
        structuredContent: bucket as Record<string, unknown>,
      };
    },
  );

  // ── list_bucket_data ──────────────────────────────────────────────────
  server.registerTool(
    "list_bucket_data",
    {
      title: "List Bucket Data",
      description:
        "Returns documents from a bucket with optional filtering, pagination, sorting, and relation resolution.",
      annotations: { readOnlyHint: true },
      outputSchema: BucketDocumentListOutputSchema,
      inputSchema: z.object({
        bucketId: z.string().describe("Bucket ID"),
        filter: z
          .string()
          .optional()
          .describe("Filter expression or JSON object to filter documents"),
        paginate: z
          .boolean()
          .optional()
          .describe("When true, includes meta.total in response"),
        limit: z.number().int().optional().describe("Max documents to return"),
        skip: z.number().int().optional().describe("Documents to skip"),
        sort: z
          .string()
          .optional()
          .describe('JSON sort, e.g. {"created_at":-1}'),
        relation: z
          .union([z.boolean(), z.array(z.string())])
          .optional()
          .describe(
            "true to resolve all relations, or array of relation field paths",
          ),
        language: z
          .string()
          .optional()
          .describe(
            "Accept-Language for translated documents, e.g. en_US, tr_TR",
          ),
      }),
    },
    async ({
      bucketId,
      filter,
      paginate,
      limit,
      skip,
      sort,
      relation,
      language,
    }) => {
      const query: Record<string, unknown> = {
        filter,
        paginate,
        limit,
        skip,
        sort,
      };
      if (relation !== undefined) query["relation"] = relation;

      const headers: Record<string, string> = {};
      if (language) headers["accept-language"] = language;

      const data = await client.get(`/bucket/${bucketId}/data`, query, headers);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { documents: data },
      };
    },
  );

  // ── save_bucket_data ──────────────────────────────────────────────────
  server.registerTool(
    "save_bucket_data",
    {
      title: "Save Bucket Data",
      description:
        "Creates or updates a document in a bucket (upsert). When the document contains _id it is replaced, otherwise inserted. " +
        "The document body must conform to the bucket's schema definition.",
      inputSchema: z.object({
        bucketId: z.string().describe("Bucket ID"),
        document: z
          .record(z.any())
          .describe(
            "Document object. Include _id to update an existing document, omit to create.",
          ),
      }),
    },
    async ({ bucketId, document }) => {
      let result: unknown;
      const docId = document["_id"];
      if (typeof docId === "string" && docId) {
        const { _id, ...body } = document;
        void _id; // consumed for URL, not sent as body
        result = await client.put(`/bucket/${bucketId}/data/${docId}`, body);
      } else {
        result = await client.post(`/bucket/${bucketId}/data`, document);
      }
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result as Record<string, unknown>,
      };
    },
  );

  // ── export_bucket_data ────────────────────────────────────────────────
  server.registerTool(
    "export_bucket_data",
    {
      title: "Export Bucket Data",
      description:
        "Fetches documents from a bucket and writes them to a local JSON or CSV file. " +
        "Supports filter, limit, skip, sort. " +
        "Efficient way for large dataset exports.",
      annotations: { readOnlyHint: false },
      outputSchema: ExportBucketDataOutputSchema,
      inputSchema: z.object({
        bucketId: z.string().describe("Bucket ID to export data from"),
        format: z
          .enum(["json", "csv"])
          .default("json")
          .describe("Output file format. Default: json"),
        directory: z
          .string()
          .optional()
          .describe(
            "Directory path to write the file. Defaults to the current working directory.",
          ),
        fileName: z
          .string()
          .optional()
          .describe(
            "File name without extension. Defaults to '{bucketId}_{timestamp}'.",
          ),
        filter: z
          .string()
          .optional()
          .describe("Filter expression or JSON object to filter documents"),
        limit: z.number().int().optional().describe("Max documents to return"),
        skip: z.number().int().optional().describe("Documents to skip"),
        sort: z
          .string()
          .optional()
          .describe('JSON sort object, e.g. {"created_at":-1}'),
        language: z
          .string()
          .optional()
          .describe("Accept-Language for translated documents, e.g. en_US"),
      }),
    },
    async ({
      bucketId,
      format,
      directory,
      fileName,
      filter,
      limit,
      skip,
      sort,
      language,
    }) => {
      const query: Record<string, unknown> = {
        filter,
        limit,
        skip,
        sort,
      };

      const headers: Record<string, string> = {};
      if (language) headers["accept-language"] = language;

      const rows = await client.get(`/bucket/${bucketId}/data`, query, headers) as Record<string, unknown>[]

      // Strip any directory components from fileName to prevent path traversal.
      // Resolve dir to an absolute path so the returned filePath is always absolute.
      const safeName = path.basename(
        fileName ??
        `${bucketId}_${new Date().toISOString().replace(/[:.]/g, "-")}`,
      );
      const dir = path.resolve(directory ?? process.cwd());
      const filePath = path.join(dir, `${safeName}.${format}`);

      let fileContent: string;
      if (format === "csv") {
        fileContent = toCsv(rows);
      } else {
        fileContent = JSON.stringify(rows, null, 2);
      }

      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, fileContent, "utf-8");

      const summary = {
        filePath: path.resolve(filePath),
        format,
        totalDocuments: rows.length,
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(summary, null, 2) },
        ],
        structuredContent: summary,
      };
    },
  );

  // ── import_bucket_data ────────────────────────────────────────────────
  server.registerTool(
    "import_bucket_data",
    {
      title: "Import Bucket Data",
      description:
        "Reads a local JSON or CSV file and inserts its documents into a bucket in parallel batches. " +
        "Use concurrency to control how many inserts run at once (default 50). " +
        "Efficient way for large dataset imports.",
      outputSchema: ImportBucketDataOutputSchema,
      inputSchema: z.object({
        bucketId: z.string().describe("Bucket ID to import data into"),
        filePath: z
          .string()
          .describe(
            "Absolute or relative path to the JSON or CSV file to import",
          ),
        concurrency: z
          .number()
          .int()
          .min(1)
          .max(500)
          .default(50)
          .optional()
          .describe(
            "Number of documents to insert in parallel per batch. Default: 50. Lower this if you encounter network errors.",
          ),
      }),
    },
    async ({ bucketId, filePath: inputFilePath, concurrency = 50 }) => {
      const resolvedPath = path.resolve(inputFilePath);
      const ext = path.extname(resolvedPath).toLowerCase();

      const content = fs.readFileSync(resolvedPath, "utf-8");

      if (ext !== ".json" && ext !== ".csv") {
        throw new Error(
          `Unsupported file extension "${ext}". Only .json and .csv are accepted.`,
        );
      }

      let rows: Record<string, unknown>[];
      if (ext === ".csv") {
        rows = fromCsv(content);
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          throw new Error("Failed to parse JSON file: invalid JSON syntax.");
        }
        rows = Array.isArray(parsed)
          ? (parsed as Record<string, unknown>[])
          : [parsed as Record<string, unknown>];
      }

      type InsertResult =
        | { id: string; status: "success"; insertedId: string }
        | { id: string; status: "failure"; error: string };

      const details: InsertResult[] = [];

      // Process rows in batches of `concurrency` to avoid overwhelming the server
      for (let i = 0; i < rows.length; i += concurrency) {
        const batch = rows.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(
          batch.map((doc, batchIndex) => {
            const globalIndex = i + batchIndex;
            const rowId =
              typeof doc["_id"] === "string" && doc["_id"]
                ? (doc["_id"] as string)
                : `row:${globalIndex}`;

            return client
              .post(`/bucket/${bucketId}/data`, doc)
              .then((inserted) => {
                const insertedId =
                  typeof (inserted as Record<string, unknown>)["_id"] ===
                  "string"
                    ? ((inserted as Record<string, unknown>)["_id"] as string)
                    : JSON.stringify(inserted);
                return {
                  id: rowId,
                  status: "success" as const,
                  insertedId,
                };
              })
              .catch((err: unknown) => {
                return {
                  id: rowId,
                  status: "failure" as const,
                  error: err instanceof Error ? err.message : String(err),
                };
              });
          }),
        );

        for (const r of batchResults) {
          details.push(
            r.status === "fulfilled"
              ? r.value
              : {
                  id: "unknown",
                  status: "failure" as const,
                  error: String((r as PromiseRejectedResult).reason),
                },
          );
        }
      }

      const successCount = details.filter((d) => d.status === "success").length;
      const failureCount = details.filter((d) => d.status === "failure").length;

      const summary = {
        totalProcessed: rows.length,
        successCount,
        failureCount,
        results: details,
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(summary, null, 2) },
        ],
        structuredContent: summary,
      };
    },
  );
}
