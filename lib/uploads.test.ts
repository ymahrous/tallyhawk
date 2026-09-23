import { describe, it, expect } from "vitest";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, validateUploadFile } from "./uploads";

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
