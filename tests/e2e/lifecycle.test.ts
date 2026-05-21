import { describe, it, expect, afterAll } from "vitest";
import { SpicaClient } from "../../src/client.js";

const SPICA_URL = process.env.SPICA_URL;
const SPICA_APIKEY = process.env.SPICA_APIKEY;

const shouldRun = Boolean(SPICA_URL && SPICA_APIKEY);

// Track resources created during the test so we can clean them up
const createdIds: { type: "bucket" | "storage"; id: string }[] = [];

describe.skipIf(!shouldRun)("Spica E2E lifecycle", () => {
  // Shared across tests in this suite
  let client: SpicaClient;
  let testBucketId: string;
  let testDocumentId: string;
  let testStorageId: string;

  // Runs before the suite if we're executing
  it("initializes the SpicaClient from env vars", () => {
    client = new SpicaClient(SPICA_URL!, SPICA_APIKEY!);
    expect(client).toBeDefined();
  });

  // ── Bucket operations ─────────────────────────────────────────────────

  it("lists existing buckets without error", async () => {
    const buckets = await client.get("/bucket");
    expect(Array.isArray(buckets)).toBe(true);
  });

  it("creates a test bucket", async () => {
    const result = (await client.post("/bucket", {
      title: "E2E Test Bucket",
      description: "Created by automated E2E tests — safe to delete",
      primary: "name",
      acl: { read: "true==true", write: "true==true" },
      properties: {
        name: {
          type: "string",
          title: "Name",
        },
        value: {
          type: "number",
          title: "Value",
        },
      },
    })) as { _id: string };

    expect(result._id).toBeDefined();
    testBucketId = result._id;
    createdIds.push({ type: "bucket", id: testBucketId });
  });

  it("lists bucket data (expect empty array for new bucket)", async () => {
    const data = await client.get(`/bucket/${testBucketId}/data`);
    // May be an array or paginated object; either way count should be 0
    const items = Array.isArray(data) ? data : (data as { data: unknown[] }).data;
    expect(items).toHaveLength(0);
  });

  it("inserts a document into the test bucket", async () => {
    const doc = (await client.post(`/bucket/${testBucketId}/data`, {
      name: "e2e-doc",
      value: 42,
    })) as { _id: string };

    expect(doc._id).toBeDefined();
    testDocumentId = doc._id;
  });

  it("retrieves the inserted document by ID", async () => {
    const doc = (await client.get(
      `/bucket/${testBucketId}/data/${testDocumentId}`,
    )) as { _id: string; name: string; value: number };

    expect(doc.name).toBe("e2e-doc");
    expect(doc.value).toBe(42);
  });

  it("updates the document via PUT", async () => {
    const updated = (await client.put(
      `/bucket/${testBucketId}/data/${testDocumentId}`,
      { name: "e2e-doc-updated", value: 99 },
    )) as { name: string };

    expect(updated.name).toBe("e2e-doc-updated");
  });

  // ── Storage operations ────────────────────────────────────────────────

  it("lists existing storage objects without error", async () => {
    const result = await client.get("/storage");
    expect(result).toBeDefined();
  });

  it("creates a test storage object", async () => {
    const textContent = Buffer.from("hello e2e").toString("base64");
    const result = (await client.post("/storage", [
      {
        name: "e2e-test-file.txt",
        content: { type: "text/plain", data: textContent },
      },
    ])) as { _id: string }[];

    const stored = Array.isArray(result) ? result[0] : result;
    expect(stored._id).toBeDefined();
    testStorageId = stored._id;
    createdIds.push({ type: "storage", id: testStorageId });
  });

  it("renames the storage object via PATCH", async () => {
    const result = await client.patch(`/storage/${testStorageId}`, {
      name: "e2e-renamed.txt",
    });
    expect(result).toBeDefined();
  });

  // ── Cleanup ───────────────────────────────────────────────────────────

  afterAll(async () => {
    if (!client) return;
    for (const { type, id } of createdIds) {
      try {
        if (type === "bucket") {
          await client.delete(`/bucket/${id}`);
        } else if (type === "storage") {
          await client.delete(`/storage/${id}`);
        }
      } catch {
        // Best-effort cleanup — test should not fail if deletion fails
      }
    }
  });
});
