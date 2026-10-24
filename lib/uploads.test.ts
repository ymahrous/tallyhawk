import { describe, it, expect } from "vitest";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, validateUploadFile, sniffFileType, extensionType, safeFileName } from "./uploads";

const file = (name: string, type: string, size = 1024) => ({ name, type, size });

describe("validateUploadFile", () => {
  it.each([
    ["receipt.pdf", "application/pdf"],
    ["photo.JPG", "image/jpeg"],
    ["scan.jpeg", "image/jpeg"],
    ["scan.png", "image/png"],
  ])("accepts %s", (name, type) => {
    expect(validateUploadFile(file(name, type))).toBeNull();
  });

  it("rejects unsupported extensions before looking at the MIME type", () => {
    expect(validateUploadFile(file("invoice.docx", "application/pdf"))).toMatch(
      /^Unsupported file extension/
    );
  });

  it("rejects a mismatched MIME type", () => {
    expect(validateUploadFile(file("fake.pdf", "text/html"))).toBe(
      "Unsupported file type: text/html. Accepted: PDF, JPG, PNG."
    );
  });

  it("allows an empty MIME type (some platforms omit it)", () => {
    expect(validateUploadFile(file("receipt.pdf", ""))).toBeNull();
  });

  it("enforces the size limit", () => {
    expect(validateUploadFile(file("big.pdf", "application/pdf", MAX_UPLOAD_BYTES))).toBeNull();
    expect(validateUploadFile(file("big.pdf", "application/pdf", MAX_UPLOAD_BYTES + 1))).toBe(
      `File too large (10.00MB). Maximum size is ${MAX_UPLOAD_MB}MB.`
    );
  });
});

describe("content sniffing", () => {
  const bytes = (...values: number[]) => new Uint8Array(values);
  const text = (value: string) => new TextEncoder().encode(value);

  it("recognises PDF, JPEG and PNG by their magic bytes", () => {
    expect(sniffFileType(text("%PDF-1.7\n..."))).toBe("pdf");
    expect(sniffFileType(new Uint8Array([0xef, 0xbb, 0xbf, ...text("\n%PDF-1.4")]))).toBe("pdf"); // header after a BOM
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("jpeg");
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("png");
  });

  it("refuses everything else, including HTML and SVG dressed up as images", () => {
    expect(sniffFileType(text("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffFileType(text("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffFileType(new Uint8Array())).toBeNull();
    expect(sniffFileType(new Uint8Array(2000).fill(0x20))).toBeNull();
  });

  it("maps extensions to the type they promise", () => {
    expect(extensionType("a.PDF")).toBe("pdf");
    expect(extensionType("a.jpeg")).toBe("jpeg");
    expect(extensionType("a.jpg")).toBe("jpeg");
    expect(extensionType("a.png")).toBe("png");
    expect(extensionType("a.png.exe")).toBeNull();
    expect(extensionType("noext")).toBeNull();
  });
});

describe("safeFileName", () => {
  it("drops directories and control characters", () => {
    expect(safeFileName("../../etc/receipt.pdf", "pdf")).toBe("receipt.pdf");
    expect(safeFileName("C:\\Users\\ada\\scan.png", "png")).toBe("scan.png");
    expect(safeFileName("in\u0000voice\n.pdf", "pdf")).toBe("invoice.pdf");
  });

  it("falls back to a generic name and caps the length, keeping the extension", () => {
    expect(safeFileName("../", "jpeg")).toBe("document.jpg");
    expect(safeFileName("..", "pdf")).toBe("document.pdf");
    const long = safeFileName(`${"x".repeat(400)}.pdf`, "pdf");
    expect(long).toHaveLength(255);
    expect(long.endsWith(".pdf")).toBe(true);
  });
});
