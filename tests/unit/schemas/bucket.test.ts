import { describe, it, expect } from "vitest";
import { BucketPropertySchema } from "../../../src/schemas/bucket.js";

describe("BucketPropertySchema", () => {
  it("parses a string type", () => {
    expect(
      BucketPropertySchema.safeParse({ type: "string", title: "Name" }).success,
    ).toBe(true);
  });

  it("parses a number type with min/max constraints", () => {
    expect(
      BucketPropertySchema.safeParse({
        type: "number",
        minimum: 0,
        maximum: 100,
      }).success,
    ).toBe(true);
  });

  it("parses a boolean type", () => {
    expect(
      BucketPropertySchema.safeParse({ type: "boolean" }).success,
    ).toBe(true);
  });

  it("parses all extended Spica-specific types", () => {
    const spicaTypes = [
      "storage",
      "richtext",
      "date",
      "textarea",
      "color",
      "multiselect",
      "location",
      "json",
      "hash",
      "encrypted",
    ];
    for (const type of spicaTypes) {
      expect(
        BucketPropertySchema.safeParse({ type }).success,
        `expected type '${type}' to be valid`,
      ).toBe(true);
    }
  });

  it("parses an array type with an items sub-schema", () => {
    expect(
      BucketPropertySchema.safeParse({
        type: "array",
        items: { type: "string" },
      }).success,
    ).toBe(true);
  });

  it("parses an object type with nested properties (recursive)", () => {
    expect(
      BucketPropertySchema.safeParse({
        type: "object",
        properties: {
          street: { type: "string" },
          number: { type: "number" },
        },
      }).success,
    ).toBe(true);
  });

  it("parses deeply nested object schemas", () => {
    expect(
      BucketPropertySchema.safeParse({
        type: "object",
        properties: {
          address: {
            type: "object",
            properties: {
              city: { type: "string" },
            },
          },
        },
      }).success,
    ).toBe(true);
  });

  it("parses a relation type with bucketId and relationType", () => {
    expect(
      BucketPropertySchema.safeParse({
        type: "relation",
        bucketId: "bucket123",
        relationType: "onetoone",
      }).success,
    ).toBe(true);
  });

  it("parses a relation with onetomany cardinality", () => {
    expect(
      BucketPropertySchema.safeParse({
        type: "relation",
        bucketId: "bucket456",
        relationType: "onetomany",
        dependent: true,
      }).success,
    ).toBe(true);
  });

  it("parses optional fields: title, description, default", () => {
    expect(
      BucketPropertySchema.safeParse({
        type: "string",
        title: "Display name",
        description: "The full name",
        default: "Alice",
      }).success,
    ).toBe(true);
  });

  it("parses a string type with an enum constraint", () => {
    expect(
      BucketPropertySchema.safeParse({
        type: "string",
        enum: ["active", "inactive", "pending"],
      }).success,
    ).toBe(true);
  });

  it("rejects unknown type strings", () => {
    expect(
      BucketPropertySchema.safeParse({ type: "unknown_xyz" }).success,
    ).toBe(false);
  });

  it("rejects missing type field", () => {
    expect(
      BucketPropertySchema.safeParse({ title: "no type" }).success,
    ).toBe(false);
  });
});
