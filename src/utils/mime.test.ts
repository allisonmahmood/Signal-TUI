import { describe, expect, test } from "bun:test";
import { getMimeType, isImage, isAudio, isVideo } from "./mime.ts";

describe("getMimeType", () => {
  // Image formats
  test("returns correct MIME type for .jpg", () => {
    expect(getMimeType("photo.jpg")).toBe("image/jpeg");
  });

  test("returns correct MIME type for .jpeg", () => {
    expect(getMimeType("photo.jpeg")).toBe("image/jpeg");
  });

  test("returns correct MIME type for .png", () => {
    expect(getMimeType("image.png")).toBe("image/png");
  });

  test("returns correct MIME type for .gif", () => {
    expect(getMimeType("animation.gif")).toBe("image/gif");
  });

  test("returns correct MIME type for .webp", () => {
    expect(getMimeType("photo.webp")).toBe("image/webp");
  });

  test("returns correct MIME type for .bmp", () => {
    expect(getMimeType("image.bmp")).toBe("image/bmp");
  });

  test("returns correct MIME type for .svg", () => {
    expect(getMimeType("icon.svg")).toBe("image/svg+xml");
  });

  test("returns correct MIME type for .ico", () => {
    expect(getMimeType("favicon.ico")).toBe("image/x-icon");
  });

  test("returns correct MIME type for .heic", () => {
    expect(getMimeType("photo.heic")).toBe("image/heic");
  });

  test("returns correct MIME type for .heif", () => {
    expect(getMimeType("photo.heif")).toBe("image/heif");
  });

  // Audio formats
  test("returns correct MIME type for .mp3", () => {
    expect(getMimeType("song.mp3")).toBe("audio/mpeg");
  });

  test("returns correct MIME type for .aac", () => {
    expect(getMimeType("audio.aac")).toBe("audio/aac");
  });

  test("returns correct MIME type for .m4a", () => {
    expect(getMimeType("voice.m4a")).toBe("audio/mp4");
  });

  test("returns correct MIME type for .ogg", () => {
    expect(getMimeType("audio.ogg")).toBe("audio/ogg");
  });

  test("returns correct MIME type for .wav", () => {
    expect(getMimeType("sound.wav")).toBe("audio/wav");
  });

  test("returns correct MIME type for .flac", () => {
    expect(getMimeType("music.flac")).toBe("audio/flac");
  });

  test("returns correct MIME type for .opus", () => {
    expect(getMimeType("voice.opus")).toBe("audio/opus");
  });

  // Video formats
  test("returns correct MIME type for .mp4", () => {
    expect(getMimeType("video.mp4")).toBe("video/mp4");
  });

  test("returns correct MIME type for .webm", () => {
    expect(getMimeType("video.webm")).toBe("video/webm");
  });

  test("returns correct MIME type for .mov", () => {
    expect(getMimeType("video.mov")).toBe("video/quicktime");
  });

  test("returns correct MIME type for .avi", () => {
    expect(getMimeType("video.avi")).toBe("video/x-msvideo");
  });

  test("returns correct MIME type for .mkv", () => {
    expect(getMimeType("video.mkv")).toBe("video/x-matroska");
  });

  // Document formats
  test("returns correct MIME type for .pdf", () => {
    expect(getMimeType("document.pdf")).toBe("application/pdf");
  });

  test("returns correct MIME type for .doc", () => {
    expect(getMimeType("document.doc")).toBe("application/msword");
  });

  test("returns correct MIME type for .docx", () => {
    expect(getMimeType("document.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  test("returns correct MIME type for .xls", () => {
    expect(getMimeType("spreadsheet.xls")).toBe("application/vnd.ms-excel");
  });

  test("returns correct MIME type for .xlsx", () => {
    expect(getMimeType("spreadsheet.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  test("returns correct MIME type for .ppt", () => {
    expect(getMimeType("presentation.ppt")).toBe("application/vnd.ms-powerpoint");
  });

  test("returns correct MIME type for .pptx", () => {
    expect(getMimeType("presentation.pptx")).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
  });

  // Text formats
  test("returns correct MIME type for .txt", () => {
    expect(getMimeType("readme.txt")).toBe("text/plain");
  });

  test("returns correct MIME type for .csv", () => {
    expect(getMimeType("data.csv")).toBe("text/csv");
  });

  test("returns correct MIME type for .json", () => {
    expect(getMimeType("config.json")).toBe("application/json");
  });

  test("returns correct MIME type for .xml", () => {
    expect(getMimeType("data.xml")).toBe("application/xml");
  });

  test("returns correct MIME type for .html", () => {
    expect(getMimeType("page.html")).toBe("text/html");
  });

  test("returns correct MIME type for .md", () => {
    expect(getMimeType("readme.md")).toBe("text/markdown");
  });

  // Archive formats
  test("returns correct MIME type for .zip", () => {
    expect(getMimeType("archive.zip")).toBe("application/zip");
  });

  test("returns correct MIME type for .gz", () => {
    expect(getMimeType("file.gz")).toBe("application/gzip");
  });

  test("returns correct MIME type for .tar", () => {
    expect(getMimeType("archive.tar")).toBe("application/x-tar");
  });

  test("returns correct MIME type for .rar", () => {
    expect(getMimeType("archive.rar")).toBe("application/vnd.rar");
  });

  test("returns correct MIME type for .7z", () => {
    expect(getMimeType("archive.7z")).toBe("application/x-7z-compressed");
  });

  // Edge cases
  test("returns application/octet-stream for unknown extension", () => {
    expect(getMimeType("file.xyz")).toBe("application/octet-stream");
  });

  test("returns application/octet-stream for no extension", () => {
    expect(getMimeType("filename")).toBe("application/octet-stream");
  });

  test("handles uppercase extensions (case insensitive)", () => {
    expect(getMimeType("PHOTO.JPG")).toBe("image/jpeg");
  });

  test("handles mixed case extensions", () => {
    expect(getMimeType("photo.Png")).toBe("image/png");
  });

  test("handles full paths", () => {
    expect(getMimeType("/path/to/file/photo.jpg")).toBe("image/jpeg");
  });

  test("handles paths with multiple dots", () => {
    expect(getMimeType("file.backup.2024.png")).toBe("image/png");
  });
});

describe("isImage", () => {
  test("returns true for image files", () => {
    expect(isImage("photo.jpg")).toBe(true);
    expect(isImage("image.png")).toBe(true);
    expect(isImage("animation.gif")).toBe(true);
    expect(isImage("photo.webp")).toBe(true);
    expect(isImage("icon.svg")).toBe(true);
  });

  test("returns false for non-image files", () => {
    expect(isImage("song.mp3")).toBe(false);
    expect(isImage("video.mp4")).toBe(false);
    expect(isImage("document.pdf")).toBe(false);
    expect(isImage("archive.zip")).toBe(false);
    expect(isImage("file.txt")).toBe(false);
  });

  test("returns false for unknown extensions", () => {
    expect(isImage("file.xyz")).toBe(false);
  });
});

describe("isAudio", () => {
  test("returns true for audio files", () => {
    expect(isAudio("song.mp3")).toBe(true);
    expect(isAudio("audio.aac")).toBe(true);
    expect(isAudio("voice.m4a")).toBe(true);
    expect(isAudio("sound.wav")).toBe(true);
    expect(isAudio("music.flac")).toBe(true);
    expect(isAudio("voice.opus")).toBe(true);
  });

  test("returns false for non-audio files", () => {
    expect(isAudio("photo.jpg")).toBe(false);
    expect(isAudio("video.mp4")).toBe(false);
    expect(isAudio("document.pdf")).toBe(false);
    expect(isAudio("archive.zip")).toBe(false);
  });

  test("returns false for unknown extensions", () => {
    expect(isAudio("file.xyz")).toBe(false);
  });
});

describe("isVideo", () => {
  test("returns true for video files", () => {
    expect(isVideo("movie.mp4")).toBe(true);
    expect(isVideo("clip.webm")).toBe(true);
    expect(isVideo("recording.mov")).toBe(true);
    expect(isVideo("video.avi")).toBe(true);
    expect(isVideo("film.mkv")).toBe(true);
  });

  test("returns false for non-video files", () => {
    expect(isVideo("photo.jpg")).toBe(false);
    expect(isVideo("song.mp3")).toBe(false);
    expect(isVideo("document.pdf")).toBe(false);
    expect(isVideo("archive.zip")).toBe(false);
  });

  test("returns false for unknown extensions", () => {
    expect(isVideo("file.xyz")).toBe(false);
  });
});
