import { randomUUID } from "node:crypto";
import { runInBackground } from "@/server/background";
import { getDb } from "@/server/db";
import { documents } from "@/server/db/schema";
import { ApiError, getCurrentUser, json, route } from "@/server/http";
import { processDocument } from "@/server/pipeline";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { uploadToStorage } from "@/server/storage";
import { documentsProcessedThisMonth, FREE_TIER_LIMIT, incrementUsage } from "@/server/usage";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  SNIFFED_MIME_TYPES,
  extensionType,
  safeFileName,
  sniffFileType,
  validateUploadFile,
} from "@/lib/uploads";

// AI extraction runs after the response (see server/background.ts) and typically takes 10–30s.
export const maxDuration = 60;

/** Multipart framing around the file; anything bigger than file + this is refused before parsing. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export const POST = route(async (request) => {
  const user = await getCurrentUser(request);
  const tooLarge = () => new ApiError(413, `File too large. Maximum size is ${MAX_UPLOAD_MB}MB.`);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) throw tooLarge();

  if (user.plan === "free" && (await documentsProcessedThisMonth(user.id)) >= FREE_TIER_LIMIT) {
    throw new ApiError(403, {
      error: "limit_exceeded",
      message: "Free tier limit reached. Upgrade to Pro for unlimited uploads.",
      limit: FREE_TIER_LIMIT,
    });
  }
  await rateLimit("upload", user.id, LIMITS.uploadPerUser);

  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    // fall through to the 422 below
  }
  if (!(file instanceof File)) {
    throw new ApiError(422, [{ loc: ["body", "file"], msg: "Field required", type: "missing" }]);
  }
  if (file.size > MAX_UPLOAD_BYTES) throw tooLarge();
  // The same extension/MIME rules the upload forms check before sending (lib/uploads.ts).
  const invalid = validateUploadFile(file);
  if (invalid) throw new ApiError(400, invalid);

  // The name and declared type are the client's word; the bytes are the truth. A script or HTML
  // page renamed to receipt.png is refused here instead of being stored and served.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffFileType(bytes);
  if (!type || type !== extensionType(file.name)) {
    throw new ApiError(400, "The file's contents don't match its extension. Please upload a real PDF, JPG or PNG.");
  }

  // Each upload gets its own unguessable key under the owner's folder, so uploads never overwrite
  // or expose one another, whatever they're called.
  const storagePath = `${user.id}/${randomUUID()}.${type === "jpeg" ? "jpg" : type}`;
  const publicUrl = await uploadToStorage(bytes, storagePath, SNIFFED_MIME_TYPES[type]);

  const [doc] = await getDb()
    .insert(documents)
    .values({ filename: safeFileName(file.name, type), s3Url: publicUrl, storagePath, status: "PENDING", ownerId: user.id })
    .returning();

  await incrementUsage(user.id);
  runInBackground("process_document", () => processDocument(doc.id));

  return json({ message: "Document received!", document_id: doc.id, status: doc.status });
});
