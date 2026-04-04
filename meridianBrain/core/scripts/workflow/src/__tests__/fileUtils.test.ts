import { describe, it, expect, afterEach } from "vitest";
import { readContentFile, adoFieldToContextKey } from "../lib/fileUtils.js";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TMP = tmpdir();

function tmpFile(name: string): string {
  return join(TMP, `fileUtils-test-${name}`);
}

afterEach(() => {
  // Clean up temp files created during tests
  for (const f of ["bom.txt", "emoji.txt", "plain.txt"]) {
    try {
      unlinkSync(tmpFile(f));
    } catch {
      /* ignore */
    }
  }
});

describe("readContentFile", () => {
  it("should throw a user-friendly error for missing files", () => {
    expect(() => readContentFile("/nonexistent/path.html", "--description-file")).toThrow(
      /File not found.*--description-file.*nonexistent/,
    );
  });

  it("should throw without option name for missing files", () => {
    expect(() => readContentFile("/nonexistent/path.html")).toThrow(/File not found.*nonexistent/);
  });

  it("should strip UTF-8 BOM from file content", () => {
    const path = tmpFile("bom.txt");
    writeFileSync(path, "\uFEFF<h1>Hello</h1>", "utf-8");

    const content = readContentFile(path);
    expect(content).toBe("<h1>Hello</h1>");
    expect(content.charCodeAt(0)).not.toBe(0xfeff);
  });

  it("should preserve emoji content in files", () => {
    const path = tmpFile("emoji.txt");
    const emojiContent = "🐛 Bug: 👨‍💻 Developer found 🇺🇸 locale issue with 👍🏽";
    writeFileSync(path, emojiContent, "utf-8");

    const content = readContentFile(path);
    expect(content).toBe(emojiContent);
  });

  it("should handle BOM + emoji content together", () => {
    const path = tmpFile("emoji.txt");
    const emojiContent = "🚀 Deployment notes with ⚙️ settings";
    writeFileSync(path, `\uFEFF${emojiContent}`, "utf-8");

    const content = readContentFile(path);
    expect(content).toBe(emojiContent);
  });

  it("should return plain content unchanged", () => {
    const path = tmpFile("plain.txt");
    writeFileSync(path, "Just plain text", "utf-8");

    const content = readContentFile(path);
    expect(content).toBe("Just plain text");
  });
});

describe("adoFieldToContextKey", () => {
  it("should map known ADO fields to context keys", () => {
    expect(adoFieldToContextKey("System.Description")).toBe("description");
    expect(adoFieldToContextKey("Microsoft.VSTS.Common.AcceptanceCriteria")).toBe(
      "acceptance_criteria",
    );
    expect(adoFieldToContextKey("Custom.Blockers")).toBe("blockers");
    expect(adoFieldToContextKey("Custom.Progress")).toBe("progress");
    expect(adoFieldToContextKey("Custom.PlannedWork")).toBe("planned_work");
  });

  it("should fall back to lower-cased dot-to-underscore for unknown fields", () => {
    expect(adoFieldToContextKey("Custom.SomeNewField")).toBe("custom_somenewfield");
    expect(adoFieldToContextKey("System.AreaPath")).toBe("system_areapath");
  });
});
