export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const ACCEPTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

/** Upload rules, checked by the upload forms before sending and again by POST /upload. Returns an error message, or null when valid. */
export function validateUploadFile(file: Pick<File, "name" | "type" | "size">): string | null {
  const fileName = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
    return `Unsupported file extension. Please upload ${ACCEPTED_EXTENSIONS.join(", ")}.`;
  }

  // Some platforms report an empty MIME type; the extension check above still applies.
  if (file.type && !ACCEPTED_MIME_TYPES.includes(file.type)) {
    return `Unsupported file type: ${file.type}. Accepted: PDF, JPG, PNG.`;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${MAX_UPLOAD_MB}MB.`;
  }

  return null;
}

export type SniffedType = "pdf" | "jpeg" | "png";

const EXTENSION_TYPES: Record<string, SniffedType> = { ".pdf": "pdf", ".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png" };
export const SNIFFED_MIME_TYPES: Record<SniffedType, string> = { pdf: "application/pdf", jpeg: "image/jpeg", png: "image/png" };
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** What a file really is, judged by its first bytes rather than its name or declared type. */
export function sniffFileType(bytes: Uint8Array): SniffedType | null {
  if (PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  // Readers accept the PDF header anywhere in the first 1024 bytes.
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i + PDF_HEADER.length <= head.length; i++) {
    if (PDF_HEADER.every((b, j) => head[i + j] === b)) return "pdf";
  }
  return null;
}

/** The type a file name's extension promises, or null for an unsupported one. */
export function extensionType(fileName: string): SniffedType | null {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? null : (EXTENSION_TYPES[fileName.slice(dot).toLowerCase()] ?? null);
}

/** A display-safe file name: no directories, control characters or unbounded length. */
export function safeFileName(fileName: string, fallbackType: SniffedType): string {
  const base = (fileName.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (!base || base === "." || base === "..") return `document.${fallbackType === "jpeg" ? "jpg" : fallbackType}`;
  if (base.length <= 255) return base;
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 ? base.slice(dot) : "";
  return base.slice(0, 255 - ext.length) + ext;
}
