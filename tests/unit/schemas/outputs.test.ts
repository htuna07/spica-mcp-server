import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  FunctionOutputSchema,
  FunctionListOutputSchema,
} from "../../../src/schemas/outputs.js";

describe("FunctionOutputSchema", () => {
  const base = {
    _id: "000000000000000000000000",
    name: "fn",
    timeout: 30,
    language: "javascript",
  };

  it("parses a function with triggers", () => {
    const result = z.object(FunctionOutputSchema).safeParse({
      ...base,
      triggers: { default: { type: "http", options: { path: "/x" } } },
    });
    expect(result.success).toBe(true);
  });

  it("parses a helper function with no triggers field", () => {
    const result = z.object(FunctionOutputSchema).safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts a list containing a triggerless function", () => {
    const result = z.object(FunctionListOutputSchema).safeParse({
      functions: [base],
    });
    expect(result.success).toBe(true);
  });
});
