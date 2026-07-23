import { describe, it, expect } from "vitest";
import { parseCsv, sanitizeCsvCell, writeCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a simple comma-delimited table", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("returns no rows for an empty string", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("strips a leading UTF-8 BOM", () => {
    const withBom = `${String.fromCharCode(0xfeff)}a,b\n1,2`;
    expect(parseCsv(withBom)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles quoted fields containing commas, newlines, and escaped quotes", () => {
    const input = 'name,note\n"Rivera, Jordan","Said ""hello""\nnext line"';
    expect(parseCsv(input)).toEqual([
      ["name", "note"],
      ["Rivera, Jordan", 'Said "hello"\nnext line'],
    ]);
  });

  it("handles CRLF line endings without producing blank rows", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("sanitizeCsvCell", () => {
  it("prefixes formula-triggering characters with a single quote", () => {
    expect(sanitizeCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(sanitizeCsvCell("+1")).toBe("'+1");
    expect(sanitizeCsvCell("-1")).toBe("'-1");
    expect(sanitizeCsvCell("@mention")).toBe("'@mention");
  });

  it("leaves ordinary text untouched", () => {
    expect(sanitizeCsvCell("Jordan Rivera")).toBe("Jordan Rivera");
  });

  it("quotes and escapes cells containing commas or quotes", () => {
    expect(sanitizeCsvCell('Rivera, "Jordan"')).toBe('"Rivera, ""Jordan"""');
  });
});

describe("writeCsv", () => {
  it("round-trips through parseCsv for ordinary data", () => {
    const csv = writeCsv(["First name", "Last name"], [["Jordan", "Rivera"]]);
    expect(parseCsv(csv)).toEqual([
      ["First name", "Last name"],
      ["Jordan", "Rivera"],
    ]);
  });

  it("neutralizes a formula-injection attempt in a generated report", () => {
    const csv = writeCsv(["Note"], [["=cmd|' /C calc'!A0"]]);
    expect(csv).toContain("'=cmd");
  });
});
