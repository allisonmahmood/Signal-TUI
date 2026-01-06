import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { generateAsciiArt } from "./asciiArt.ts";

// Use a test image from node_modules
const TEST_IMAGE_PATH = join(
  process.cwd(),
  "node_modules/exif-parser/test/test.jpg"
);

describe("generateAsciiArt", () => {
  test("generates ASCII art from valid image file", async () => {
    const result = await generateAsciiArt(TEST_IMAGE_PATH);

    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
    // Should contain newlines (multiple rows)
    expect(result).toContain("\n");
  });

  test("returns undefined for non-existent file", async () => {
    const result = await generateAsciiArt("/nonexistent/path/image.jpg");

    expect(result).toBeUndefined();
  });

  test("returns undefined for invalid path", async () => {
    const result = await generateAsciiArt("");

    expect(result).toBeUndefined();
  });

  test("respects custom width parameter", async () => {
    const narrow = await generateAsciiArt(TEST_IMAGE_PATH, 20, 10);
    const wide = await generateAsciiArt(TEST_IMAGE_PATH, 60, 10);

    expect(narrow).toBeDefined();
    expect(wide).toBeDefined();

    // Wider image should have longer lines on average
    const narrowLines = narrow!.split("\n");
    const wideLines = wide!.split("\n");

    // The wide version should have longer max line length
    const maxNarrowLength = Math.max(...narrowLines.map(l => l.length));
    const maxWideLength = Math.max(...wideLines.map(l => l.length));

    expect(maxWideLength).toBeGreaterThan(maxNarrowLength);
  });

  test("respects custom height parameter", async () => {
    const short = await generateAsciiArt(TEST_IMAGE_PATH, 40, 10);
    const tall = await generateAsciiArt(TEST_IMAGE_PATH, 40, 30);

    expect(short).toBeDefined();
    expect(tall).toBeDefined();

    // Taller image should have more lines
    const shortLineCount = short!.split("\n").length;
    const tallLineCount = tall!.split("\n").length;

    expect(tallLineCount).toBeGreaterThan(shortLineCount);
  });

  test("uses default dimensions (40x20) when not specified", async () => {
    const result = await generateAsciiArt(TEST_IMAGE_PATH);

    expect(result).toBeDefined();

    // Default height is 20, so should have around 20 lines
    const lineCount = result!.split("\n").length;
    // Allow some tolerance for aspect ratio adjustments
    expect(lineCount).toBeGreaterThan(10);
    expect(lineCount).toBeLessThanOrEqual(25);
  });

  test("handles non-image file gracefully", async () => {
    // Try to convert a text file (package.json)
    const result = await generateAsciiArt(join(process.cwd(), "package.json"));

    // Should return undefined or empty on error
    expect(result === undefined || result === "").toBe(true);
  });
});
