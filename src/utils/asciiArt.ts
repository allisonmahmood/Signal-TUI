import { asciifyImage } from "ink-asciify-image";
import { existsSync } from "node:fs";

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
      return undefined;
    }

    const lines = await asciifyImage(imagePath, { width, height });
    return lines.join("\n");
  } catch (error) {
    // Image conversion failed - return undefined
    return undefined;
  }
}
