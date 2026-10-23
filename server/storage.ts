import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

function bucket() {
  const url = process.env.SUPABASE_URL;
  // A service-role key is preferred server-side; the anon key works if the bucket's policies allow it.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const name = process.env.SUPABASE_BUCKET_NAME;
  if (!url || !key || !name) throw new Error("Supabase storage is not configured (SUPABASE_URL, key, SUPABASE_BUCKET_NAME)");
  client ??= createClient(url, key, { auth: { persistSession: false } });
  return client.storage.from(name);
}

/** Uploads (upserting) and returns the object's public URL. */
export async function uploadToStorage(bytes: Uint8Array, path: string): Promise<string> {
  const store = bucket();
  const { error } = await store.upload(path, bytes, { contentType: "application/octet-stream", upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return store.getPublicUrl(path).data.publicUrl;
}

export async function deleteFromStorage(path: string): Promise<void> {
  const { error } = await bucket().remove([path]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
