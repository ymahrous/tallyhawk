import { revokeSessions } from "@/server/accounts";
import { getDb } from "@/server/db";
import { getCurrentAccount, noContent, route } from "@/server/http";

/** Signs the account out everywhere, including this session. */
export const POST = route(async (request) => {
  const account = await getCurrentAccount(request);
  await revokeSessions(getDb(), account.id);
  return noContent();
});
