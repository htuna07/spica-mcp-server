import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpicaClient, SpicaApiError } from "../../src/client.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(
  status: number,
  body: unknown,
  ok = status >= 200 && status < 300,
) {
  const text =
    body === null || body === undefined
      ? ""
      : typeof body === "string"
        ? body
        : JSON.stringify(body);
  return { ok, status, text: vi.fn().mockResolvedValue(text) };
}

describe("SpicaClient", () => {
  let client: SpicaClient;

  beforeEach(() => {
    client = new SpicaClient("https://api.example.com/", "test-key");
    mockFetch.mockReset();
  });

  describe("URL normalization", () => {
    it("strips a single trailing slash from the base URL", async () => {
      mockFetch.mockResolvedValue(makeResponse(200, []));
      await client.get("/bucket");
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.example.com/bucket");
    });

    it("strips multiple trailing slashes from the base URL", async () => {
      const c = new SpicaClient("https://api.example.com///", "key");
      mockFetch.mockResolvedValue(makeResponse(200, []));
      await c.get("/path");
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.example.com/path");
    });
  });

  describe("Authorization header", () => {
    it('sets "Authorization: APIKEY {key}" on every request', async () => {
      mockFetch.mockResolvedValue(makeResponse(200, {}));
      await client.get("/passport/apikey");
      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(
        (opts.headers as Record<string, string>)["Authorization"],
      ).toBe("APIKEY test-key");
    });

    it("uses Content-Type: application/json", async () => {
      mockFetch.mockResolvedValue(makeResponse(200, {}));
      await client.post("/bucket", {});
      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(
        (opts.headers as Record<string, string>)["Content-Type"],
      ).toBe("application/json");
    });
  });

  describe("get()", () => {
    it("sends a GET request and returns parsed JSON", async () => {
      mockFetch.mockResolvedValue(makeResponse(200, [{ _id: "b1" }]));
      const result = await client.get("/bucket");
      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(opts.method).toBe("GET");
      expect(result).toEqual([{ _id: "b1" }]);
    });

    it("appends flat query parameters as a query string", async () => {
      mockFetch.mockResolvedValue(makeResponse(200, []));
      await client.get("/bucket", { limit: 10, skip: 5 });
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("limit=10");
      expect(url).toContain("skip=5");
    });

    it("appends array query params as repeated keys", async () => {
      mockFetch.mockResolvedValue(makeResponse(200, []));
      await client.get("/function-logs", { functionIds: ["fn1", "fn2"] });
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("functionIds=fn1");
      expect(url).toContain("functionIds=fn2");
    });

    it("omits null and undefined query params from the URL", async () => {
      mockFetch.mockResolvedValue(makeResponse(200, []));
      await client.get("/bucket", {
        filter: undefined,
        limit: null as unknown as number,
      });
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.example.com/bucket");
    });

    it("does not include a body in GET requests", async () => {
      mockFetch.mockResolvedValue(makeResponse(200, []));
      await client.get("/bucket");
      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(opts.body).toBeUndefined();
    });
  });

  describe("post()", () => {
    it("sends a POST request with a JSON-serialized body", async () => {
      mockFetch.mockResolvedValue(makeResponse(201, { _id: "abc" }));
      await client.post("/bucket", { title: "test", description: "desc" });
      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(opts.method).toBe("POST");
      expect(opts.body).toBe(
        JSON.stringify({ title: "test", description: "desc" }),
      );
    });
  });

  describe("put()", () => {
    it("sends a PUT request with a JSON body", async () => {
      mockFetch.mockResolvedValue(makeResponse(200, { _id: "abc" }));
      await client.put("/bucket/abc", { title: "updated" });
      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(opts.method).toBe("PUT");
      expect(opts.body).toBe(JSON.stringify({ title: "updated" }));
    });
  });

  describe("patch()", () => {
    it("sends a PATCH request", async () => {
      mockFetch.mockResolvedValue(makeResponse(200, { _id: "abc" }));
      await client.patch("/storage/abc", { name: "new-name" });
      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(opts.method).toBe("PATCH");
    });
  });

  describe("delete()", () => {
    it("sends a DELETE request", async () => {
      mockFetch.mockResolvedValue(makeResponse(204, null));
      await client.delete("/bucket/abc");
      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(opts.method).toBe("DELETE");
    });

    it("passes query params on DELETE", async () => {
      mockFetch.mockResolvedValue(makeResponse(204, null));
      await client.delete("/bucket/abc", { query: { cascade: "true" } });
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("cascade=true");
    });
  });

  describe("204 No Content", () => {
    it("returns null for a 204 response", async () => {
      mockFetch.mockResolvedValue(makeResponse(204, null));
      const result = await client.delete("/bucket/abc");
      expect(result).toBeNull();
    });
  });

  describe("SpicaApiError", () => {
    it("throws SpicaApiError on 400 with a 'message' field", async () => {
      mockFetch.mockResolvedValue(
        makeResponse(400, { message: "Bad request" }, false),
      );
      await expect(client.get("/bucket")).rejects.toThrow(SpicaApiError);
      await expect(client.get("/bucket")).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("Bad request"),
      });
    });

    it("throws SpicaApiError on 404", async () => {
      mockFetch.mockResolvedValue(
        makeResponse(404, { message: "Not found" }, false),
      );
      await expect(client.get("/bucket/missing")).rejects.toMatchObject({
        status: 404,
      });
    });

    it("throws SpicaApiError on 500 with an 'error' field", async () => {
      mockFetch.mockResolvedValue(
        makeResponse(500, { error: "Internal Server Error" }, false),
      );
      await expect(client.post("/bucket", {})).rejects.toMatchObject({
        status: 500,
      });
    });

    it("sets the error name to 'SpicaApiError'", async () => {
      mockFetch.mockResolvedValue(
        makeResponse(401, { message: "Unauthorized" }, false),
      );
      await expect(client.get("/passport/apikey")).rejects.toMatchObject({
        name: "SpicaApiError",
      });
    });

    it("attaches the raw response body to the error", async () => {
      const body = { message: "Validation failed", details: ["required"] };
      mockFetch.mockResolvedValue(makeResponse(422, body, false));
      await expect(client.post("/bucket", {})).rejects.toMatchObject({ body });
    });

    it("handles non-JSON error responses gracefully", async () => {
      mockFetch.mockResolvedValue(makeResponse(503, "Service Unavailable", false));
      await expect(client.get("/bucket")).rejects.toThrow(SpicaApiError);
    });
  });
});
