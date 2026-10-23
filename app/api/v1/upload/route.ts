import { runInBackground } from "@/server/background";
import { getDb } from "@/server/db";
import { documents } from "@/server/db/schema";
import { ApiError, getCurrentUser, json, route } from "@/server/http";
import { processDocument } from "@/server/pipeline";
import { uploadToStorage } from "@/server/storage";
import { documentsProcessedThisMonth, FREE_TIER_LIMIT, incrementUsage } from "@/server/usage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, validateUploadFile } from "@/lib/uploads";

// AI extraction runs after the response (see server/background.ts) and typically takes 10–30s.
export const maxDuration = 60;

export const POST = route(async (request) => {
  const user = await getCurrentUser(request);

  if (user.plan === "free" && (await documentsProcessedThisMonth(user.id)) >= FREE_TIER_LIMIT) {
    throw new ApiError(403, {
      error: "limit_exceeded",
      message: "Free tier limit reached. Upgrade to Pro for unlimited uploads.",
      limit: FREE_TIER_LIMIT,
    });
  }

  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    // fall through to the 422 below
  }
  if (!(file instanceof File)) {
    throw new ApiError(422, [{ loc: ["body", "file"], msg: "Field required", type: "missing" }]);
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, `File too large. Maximum size is ${MAX_UPLOAD_MB}MB.`);
  // The same extension/MIME rules the upload forms check before sending (lib/uploads.ts).
  const invalid = validateUploadFile(file);
  if (invalid) throw new ApiError(400, invalid);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const publicUrl = await uploadToStorage(bytes, file.name);

  const [doc] = await getDb()
    .insert(documents)
    .values({ filename: file.name, s3Url: publicUrl, status: "PENDING", ownerId: user.id })
    .returning();

  await incrementUsage(user.id);
  runInBackground("process_document", () => processDocument(doc.id));

  return json({ message: "Document received!", document_id: doc.id, status: doc.status });
});
