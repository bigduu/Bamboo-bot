import { FileOperationsService } from "./FileOperationsService";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeSanitize from "rehype-sanitize";

export type MessageExportFormat = "markdown" | "pdf";

const toMutableFilters = (
  filters: ReadonlyArray<{ name: string; extensions: ReadonlyArray<string> }>,
): { name: string; extensions: string[] }[] =>
  filters.map((f) => ({ name: f.name, extensions: [...f.extensions] }));

const sanitizeFilenamePart = (value: string): string => {
  // Keep filenames portable across OSes.
  const trimmed = value.trim().slice(0, 64);
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return safe || "message";
};

export class MessageExportService {
  static async exportMessageText(args: {
    format: MessageExportFormat;
    content: string;
    chatId?: string | null;
    messageId?: string | null;
    filenamePrefix?: string;
  }): Promise<{ success: boolean; filename?: string; error?: string }> {
    const {
      format,
      content,
      chatId = null,
      messageId = null,
      filenamePrefix,
    } = args;

    const prefix =
      filenamePrefix ||
      [
        "chat-message",
        chatId ? sanitizeFilenamePart(chatId.slice(0, 8)) : null,
        messageId ? sanitizeFilenamePart(messageId.slice(0, 8)) : null,
      ]
        .filter(Boolean)
        .join("-");

    const defaultPath =
      format === "markdown"
        ? FileOperationsService.generateTimestampedFilename(prefix, "md")
        : FileOperationsService.generateTimestampedFilename(prefix, "pdf");

    if (format === "markdown") {
      const result = await FileOperationsService.saveTextFile(
        content,
        toMutableFilters(FileOperationsService.FILTERS.MARKDOWN),
        defaultPath,
      );
      return result.success
        ? { success: true, filename: result.filename }
        : { success: false, error: result.error };
    }

    // pdf
    try {
      const pdfBytes = await this.generatePdfFromText(content);
      const result = await FileOperationsService.saveBinaryFile(
        pdfBytes,
        toMutableFilters(FileOperationsService.FILTERS.PDF),
        defaultPath,
      );
      return result.success
        ? { success: true, filename: result.filename }
        : { success: false, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to export PDF",
      };
    }
  }

  private static async generatePdfFromText(content: string): Promise<Uint8Array> {
    // PDF export should reflect the rendered Markdown, not the raw source.
    // We render Markdown into a temporary DOM node and let html2pdf (html2canvas + jsPDF)
    // capture it into the PDF. This keeps the feature isolated (no global state updates)
    // and only runs on demand.
    if (typeof document === "undefined") {
      throw new Error("PDF export is unavailable in this environment");
    }

    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const { createRoot } = await import("react-dom/client");
    const { flushSync } = await import("react-dom");

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.zIndex = "2147483647";
    overlay.style.background = "rgba(0,0,0,0.15)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.fontFamily =
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    overlay.style.fontSize = "14px";
    overlay.style.color = "#111";

    const overlayCard = document.createElement("div");
    overlayCard.style.background = "#fff";
    overlayCard.style.border = "1px solid rgba(0,0,0,0.12)";
    overlayCard.style.borderRadius = "10px";
    overlayCard.style.padding = "12px 14px";
    overlayCard.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
    overlayCard.textContent = "Exporting PDF...";
    overlay.appendChild(overlayCard);

    const container = document.createElement("div");
    container.style.position = "fixed";
    // NOTE: html2canvas can produce empty renders when the element is far offscreen.
    // Keep it at (0,0) but behind the app so users don't notice it.
    container.style.left = "0";
    container.style.top = "0";
    container.style.zIndex = "2147483646";
    container.style.pointerEvents = "none";
    // A4 width in px at 96dpi: 8.27in * 96 = ~794px
    container.style.width = "794px";
    container.style.background = "#fff";
    container.style.color = "#111";
    container.style.padding = "24px";
    container.style.boxSizing = "border-box";
    container.style.fontFamily =
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    container.style.fontSize = "14px";
    container.style.lineHeight = "1.35";

    const style = document.createElement("style");
    style.textContent = `
      .md-export h1 { font-size: 24px; margin: 0 0 16px; }
      .md-export h2 { font-size: 18px; margin: 18px 0 12px; }
      .md-export h3 { font-size: 16px; margin: 14px 0 10px; }
      .md-export p { margin: 0 0 10px; }
      .md-export ul, .md-export ol { margin: 0 0 10px 20px; padding: 0; }
      .md-export li { margin: 0 0 6px; }
      .md-export pre { background: #f6f6f6; padding: 12px; border-radius: 8px; overflow: hidden; }
      .md-export code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      .md-export blockquote { border-left: 4px solid #ddd; margin: 0 0 10px; padding: 0 0 0 12px; color: #444; }
      .md-export table { border-collapse: collapse; width: 100%; margin: 0 0 10px; }
      .md-export th, .md-export td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
    `;
    container.appendChild(style);

    const rootHost = document.createElement("div");
    rootHost.className = "md-export";
    container.appendChild(rootHost);

    // Attach both elements so layout/paint happens reliably in WebView engines.
    document.body.appendChild(container);
    document.body.appendChild(overlay);

    const root = createRoot(rootHost);
    flushSync(() => {
      root.render(
        React.createElement(
          ReactMarkdown as unknown as React.ComponentType<any>,
          {
            remarkPlugins: [remarkGfm, remarkBreaks],
            rehypePlugins: [rehypeSanitize],
          },
          content || "",
        ),
      );
    });

    try {
      // Ensure layout + fonts settle before capture.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      // Some environments support FontFaceSet; wait best-effort.
      await (document as any).fonts?.ready?.catch?.(() => undefined);

      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: true,
      });

      // Basic guard: if we somehow got a 0x0 canvas, abort.
      if (!canvas.width || !canvas.height) {
        throw new Error("PDF render failed (empty canvas)");
      }

      // Render canvas into A4 pages (pt units).
      const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageWidthPt = doc.internal.pageSize.getWidth();
      const pageHeightPt = doc.internal.pageSize.getHeight();
      const marginPt = 24;
      const contentWidthPt = pageWidthPt - marginPt * 2;
      const contentHeightPt = pageHeightPt - marginPt * 2;

      const pxPerPt = canvas.width / contentWidthPt;
      const sliceHeightPx = Math.max(1, Math.floor(contentHeightPt * pxPerPt));

      let offsetY = 0;
      let pageIndex = 0;
      while (offsetY < canvas.height) {
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(sliceHeightPx, canvas.height - offsetY);

        const ctx = sliceCanvas.getContext("2d");
        if (!ctx) throw new Error("PDF render failed (no canvas context)");

        // White background to avoid transparency issues.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          offsetY,
          canvas.width,
          sliceCanvas.height,
          0,
          0,
          canvas.width,
          sliceCanvas.height,
        );

        const imgData = sliceCanvas.toDataURL("image/jpeg", 0.92);
        const sliceHeightPt = sliceCanvas.height / pxPerPt;

        if (pageIndex > 0) doc.addPage();
        doc.addImage(
          imgData,
          "JPEG",
          marginPt,
          marginPt,
          contentWidthPt,
          sliceHeightPt,
        );

        offsetY += sliceCanvas.height;
        pageIndex += 1;
      }

      const buffer = doc.output("arraybuffer") as ArrayBuffer;
      return new Uint8Array(buffer);
    } finally {
      root.unmount();
      overlay.remove();
      container.remove();
    }
  }
}
