import { describe, it, expect } from "vitest";
import {
  csvEscape,
  toCsv,
  fromCsv,
} from "../../../src/tools/database.js";

describe("csvEscape()", () => {
  it("returns a plain string unchanged", () => {
    expect(csvEscape("hello")).toBe("hello");
  });

  it("wraps strings containing commas in double quotes", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
  });

  it("wraps strings containing newlines in double quotes", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("wraps strings containing carriage returns in double quotes", () => {
    expect(csvEscape("a\rb")).toBe('"a\rb"');
  });

  it("doubles embedded double-quote characters and wraps", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it("converts null to empty string", () => {
    expect(csvEscape(null)).toBe("");
  });

  it("converts undefined to empty string", () => {
    expect(csvEscape(undefined)).toBe("");
  });

  it("serializes plain objects to JSON", () => {
    expect(csvEscape({ key: "value" })).toContain("key");
  });

  it("serializes numbers to their string representation", () => {
    expect(csvEscape(42)).toBe("42");
  });

  it("serializes booleans to their string representation", () => {
    expect(csvEscape(true)).toBe("true");
    expect(csvEscape(false)).toBe("false");
  });
});

describe("toCsv()", () => {
  it("returns empty string for an empty array", () => {
    expect(toCsv([])).toBe("");
  });

  it("produces a header row from the first object's keys", () => {
    const lines = toCsv([{ name: "Alice", age: 30 }]).split("\n");
    expect(lines[0]).toBe("name,age");
  });

  it("produces a data row for a flat object", () => {
    const lines = toCsv([{ name: "Alice", age: 30 }]).split("\n");
    expect(lines[1]).toBe("Alice,30");
  });

  it("serializes nested objects as JSON cells", () => {
    const lines = toCsv([{ data: { nested: true } }]).split("\n");
    expect(lines[1]).toContain("nested");
  });

  it("escapes values containing commas", () => {
    expect(toCsv([{ name: "Smith, John" }])).toContain('"Smith, John"');
  });

  it("produces one header row and N data rows for N objects", () => {
    const lines = toCsv([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ]).split("\n");
    expect(lines).toHaveLength(3);
  });

  it("uses the keys from the first row as the column set", () => {
    const csv = toCsv([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
    expect(csv.split("\n")[0]).toBe("x,y");
  });
});

describe("fromCsv()", () => {
  it("returns an empty array when content has only a header row", () => {
    expect(fromCsv("name,age")).toEqual([]);
  });

  it("parses a simple CSV with header and one data row", () => {
    expect(fromCsv("name,age\nAlice,30")).toEqual([{ name: "Alice", age: 30 }]);
  });

  it("handles quoted fields containing commas", () => {
    expect(fromCsv('name\n"Smith, John"')).toEqual([{ name: "Smith, John" }]);
  });

  it("handles doubled double-quotes inside quoted fields", () => {
    expect(fromCsv('quote\n"say ""hi"""')).toEqual([{ quote: 'say "hi"' }]);
  });

  it('converts the string "null" to null', () => {
    expect(fromCsv("value\nnull")).toEqual([{ value: null }]);
  });

  it('converts "true" and "false" strings to booleans', () => {
    expect(fromCsv("flag\ntrue\nfalse")).toEqual([
      { flag: true },
      { flag: false },
    ]);
  });

  it("parses numeric strings as numbers", () => {
    expect(fromCsv("count\n42")).toEqual([{ count: 42 }]);
  });

  it("parses decimal numeric strings as floating-point numbers", () => {
    expect(fromCsv("score\n99.5")).toEqual([{ score: 99.5 }]);
  });

  it("returns an empty array for empty input", () => {
    expect(fromCsv("")).toEqual([]);
  });
});

describe("CSV round-trip (toCsv → fromCsv)", () => {
  it("preserves primitive data across a full round-trip", () => {
    const original = [
      { id: 1, name: "Alice", active: true, score: 99.5 },
      { id: 2, name: "Bob", active: false, score: 42 },
    ];
    expect(fromCsv(toCsv(original))).toEqual(original);
  });

  it("preserves nested objects across a full round-trip", () => {
    const original = [{ data: { nested: true, count: 3 } }];
    expect(fromCsv(toCsv(original))).toEqual(original);
  });

  it("preserves values with commas in their strings across a round-trip", () => {
    const original = [{ addr: "1st Ave, NY" }];
    expect(fromCsv(toCsv(original))).toEqual(original);
  });
});
