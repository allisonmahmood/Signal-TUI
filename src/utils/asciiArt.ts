import { asciifyImage } from "ink-asciify-image";
import { existsSync } from "node:fs";

const DEBUG = process.env.DEBUG === "true";

/**
 * Generate ASCII art from an image file
 * @param imagePath - Path to the image file
 * @param width - Width in characters (default: 40)
 * @param height - Height in rows (default: 20)
 * @returns ASCII art as a single string with newlines, or undefined if failed
 */
export async function generateAsciiArt(
  imagePath: string,
  width: number = 40,
  height: number = 20
): Promise<string | undefined> {
  try {
    if (!existsSync(imagePath)) {
      if (DEBUG) {
        console.error(`[asciiArt] File not found: ${imagePath}`);
      }
      return undefined;
    }

    const lines = await asciifyImage(imagePath, { width, height });
    return lines.join("\n");
  } catch (error) {
    if (DEBUG) {
      console.error(`[asciiArt] Failed to convert image: ${imagePath}`, error);
    }
    return undefined;
  }
}
