import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  buildTriggerSchemas,
  type FunctionInformation,
} from "../../../src/schemas/triggers.js";

const emptyInfo: FunctionInformation = {
  enqueuers: [],
  runtimes: [
    {
      name: "node",
      title: "Node.js",
      description: "Node runtime",
      language: "javascript",
    },
  ],
  timeout: 10,
};

const httpInfo: FunctionInformation = {
  enqueuers: [
    {
      description: {
        name: "http",
        title: "HTTP",
        description: "HTTP trigger",
      },
      options: {
        type: "object",
        required: ["method"],
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE"],
            title: "HTTP Method",
          },
          path: { type: "string", title: "Path" },
        },
      },
    },
  ],
  runtimes: [
    {
      name: "node",
      title: "Node.js",
      description: "Node runtime",
      language: "javascript",
    },
  ],
  timeout: 120,
};

const multiEnqueuerInfo: FunctionInformation = {
  enqueuers: [
    ...httpInfo.enqueuers,
    {
      description: {
        name: "scheduler",
        title: "Scheduler",
        description: "Cron trigger",
      },
      options: {
        type: "object",
        required: ["timezone"],
        properties: {
          timezone: { type: "string", title: "Timezone" },
          frequency: { type: "string", title: "Frequency" },
        },
      },
    },
  ],
  runtimes: httpInfo.runtimes,
  timeout: 60,
};

describe("buildTriggerSchemas", () => {
  describe("return shape", () => {
    it("returns schema, runtimes, timeout, and fingerprint", () => {
      const result = buildTriggerSchemas(emptyInfo);
      expect(result.schema).toBeDefined();
      expect(result.runtimes).toHaveLength(1);
      expect(result.timeout).toBe(10);
      expect(result.fingerprint).toBeDefined();
    });

    it("exposes runtimes from the input info", () => {
      const result = buildTriggerSchemas(httpInfo);
      expect(result.runtimes[0].name).toBe("node");
    });
  });

  describe("empty enqueuers — fallback schema", () => {
    it("produces a valid Zod schema for empty enqueuers", () => {
      const { schema } = buildTriggerSchemas(emptyInfo);
      const parsed = (schema as z.ZodObject<z.ZodRawShape>).safeParse({
        type: "http",
        options: { method: "GET" },
      });
      expect(parsed.success).toBe(true);
    });
  });

  describe("HTTP trigger schema", () => {
    it("builds a schema that accepts a valid http trigger object", () => {
      const { schema } = buildTriggerSchemas(httpInfo);
      const parsed = (schema as z.ZodObject<z.ZodRawShape>).safeParse({
        type: "http",
        options: { method: "GET", path: "/hello" },
      });
      expect(parsed.success).toBe(true);
    });

    it("reflects the correct timeout from the info", () => {
      expect(buildTriggerSchemas(httpInfo).timeout).toBe(120);
    });
  });

  describe("multiple enqueuers", () => {
    it("produces a schema for multiple trigger types", () => {
      const { schema } = buildTriggerSchemas(multiEnqueuerInfo);
      expect(schema).toBeDefined();
    });
  });

  describe("fingerprint", () => {
    it("is deterministic: same input produces the same fingerprint", () => {
      const r1 = buildTriggerSchemas(httpInfo);
      const r2 = buildTriggerSchemas(httpInfo);
      expect(r1.fingerprint).toBe(r2.fingerprint);
    });

    it("differs when enqueuers differ", () => {
      const r1 = buildTriggerSchemas(emptyInfo);
      const r2 = buildTriggerSchemas(httpInfo);
      expect(r1.fingerprint).not.toBe(r2.fingerprint);
    });

    it("is a 64-character SHA256 hex string", () => {
      const { fingerprint } = buildTriggerSchemas(httpInfo);
      expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
