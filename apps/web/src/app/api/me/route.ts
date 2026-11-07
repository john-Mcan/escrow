import { profileSchema } from "@escrow/shared";
import type { MeResponse } from "@/lib/api-types";
import { requireDid, requireUser, syncUserFromPrivy, toMeResponse } from "@/lib/server/auth";
import { json, withErrorHandling } from "@/lib/server/http";

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireUser(request);
  return json<MeResponse>(toMeResponse(user));
});

/** Sincroniza el perfil desde Privy (email verificado y wallet). Se llama tras el login y al cambiar de wallet. */
export const POST = withErrorHandling(async (request: Request) => {
  const did = await requireDid(request);
  const body: unknown = await request.json().catch(() => ({}));
  const profile = profileSchema.safeParse(body);
  const user = await syncUserFromPrivy(did, { displayName: profile.success ? profile.data.displayName : undefined });
  return json<MeResponse>(toMeResponse(user));
});
