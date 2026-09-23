export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const ACCEPTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

/** Client-side pre-flight check mirroring the backend's upload rules. Returns an error message, or null when valid. */
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
