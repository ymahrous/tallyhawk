import { getCurrentAdmin, json, route } from "@/server/http";
import { serializeAccount } from "@/server/serializers";

/** The signed-in admin's own account. */
export const GET = route(async (request) => json(serializeAccount(await getCurrentAdmin(request))));
