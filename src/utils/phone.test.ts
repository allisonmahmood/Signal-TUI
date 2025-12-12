import { describe, expect, test } from "bun:test";
import { normalizeNumber } from "./phone";

describe("normalizeNumber", () => {
  test("removes hyphens and spaces", () => {
    expect(normalizeNumber("555-123-4567")).toBe("5551234567");
    expect(normalizeNumber("(555) 123 4567")).toBe("5551234567");
  });

  test("preserves leading +", () => {
    expect(normalizeNumber("+1-555-123-4567")).toBe("+15551234567");
    expect(normalizeNumber("+44 7700 900077")).toBe("+447700900077");
  });

  test("handles empty input", () => {
    expect(normalizeNumber("")).toBe("");
    expect(normalizeNumber(null)).toBe("");
    expect(normalizeNumber(undefined)).toBe("");
  });

  test("removes only non-digit chars (except leading +)", () => {
    expect(normalizeNumber("+1 (555) call-me")).toBe("+1555");
  });
});
