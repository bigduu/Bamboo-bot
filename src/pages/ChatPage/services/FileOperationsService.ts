/**
 * Unified File Operations Service
 * Centralizes all Tauri file operations to eliminate duplicate imports and patterns
 */

export interface FileFilter {
  name: string;
  extensions: ReadonlyArray<string>;
}

export interface SaveFileOptions {
  content: Uint8Array | string;
  filters: ReadonlyArray<FileFilter>;
  defaultPath: string;
}

export interface SaveFileResult {
  filename: string;
  success: boolean;
  error?: string;
}

export class FileOperationsService {
  /**
   * Save file with unified error handling
   */
  static async saveFile(options: SaveFileOptions): Promise<SaveFileResult> {
    try {
      const { content, filters, defaultPath } = options;

      // Dynamic imports to avoid bundling if not needed
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile, writeTextFile } = await import(
        "@tauri-apps/plugin-fs"
      );

      // Show save dialog
      const filePath = await save({
        // Convert readonly arrays into the mutable shape expected by the Tauri dialog types.
        filters: filters.map((f) => ({ name: f.name, extensions: [...f.extensions] })),
        defaultPath,
      });

      if (!filePath) {
        throw new Error("User cancelled save operation");
      }

      // Write file based on content type
      if (typeof content === "string") {
        await writeTextFile(filePath, content);
      } else {
        await writeFile(filePath, content);
      }

      // Extract filename from path
      const filename = filePath.split(/[/\\]/).pop() || defaultPath;

      return {
        filename,
        success: true,
      };
    } catch (error) {
      return {
        filename: "",
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Save text file (convenience method)
   */
  static async saveTextFile(
    content: string,
    filters: ReadonlyArray<FileFilter>,
    defaultPath: string,
  ): Promise<SaveFileResult> {
    return this.saveFile({ content, filters, defaultPath });
  }

  /**
   * Save binary file (convenience method)
   */
  static async saveBinaryFile(
    content: Uint8Array,
    filters: ReadonlyArray<FileFilter>,
    defaultPath: string,
  ): Promise<SaveFileResult> {
    return this.saveFile({ content, filters, defaultPath });
  }

  /**
   * Common file filters
   */
  static readonly FILTERS = {
    MARKDOWN: [{ name: "Markdown", extensions: ["md"] }],
    PDF: [{ name: "PDF", extensions: ["pdf"] }],
    TEXT: [{ name: "Text", extensions: ["txt"] }],
    JSON: [{ name: "JSON", extensions: ["json"] }],
    ALL: [{ name: "All Files", extensions: ["*"] }],
  } as const;

  /**
   * Generate timestamped filename
   */
  static generateTimestampedFilename(
    prefix: string,
    extension: string,
  ): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    return `${prefix}-${timestamp}.${extension}`;
  }
}
