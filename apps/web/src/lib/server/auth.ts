import "server-only";
import type { Database } from "@escrow/shared/database";
import { getServerEnv } from "./env";
import { ApiError } from "./http";
import { getPrivy, toIdentity } from "./privy";
import { getSupabaseAdmin } from "./supabase";

export type AppUser = Database["public"]["Tables"]["users"]["Row"];

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

/** Verifica el access token de Privy (firma JWT local, sin llamada de red) y devuelve el DID. */
async function verifyPrivyDid(request: Request): Promise<string | null> {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    const claims = await getPrivy().utils().auth().verifyAccessToken(token);
    return claims.user_id;
  } catch {
    throw new ApiError(401, "invalid_token", "Tu sesión expiró. Vuelve a ingresar.");
  }
}

/**
 * Sincroniza el usuario desde la API de Privy (fuente confiable de email verificado y wallets vinculadas).
 * Nunca se toman email ni wallet desde el cuerpo de la solicitud.
 */
export async function syncUserFromPrivy(did: string, options: { displayName?: string } = {}): Promise<AppUser> {
  const identity = toIdentity(await getPrivy().users()._get(did));
  const supabase = getSupabaseAdmin();

  const { data: existing, error: readError } = await supabase
    .from("users")
    .select("*")
    .eq("privy_did", did)
    .maybeSingle();
  if (readError) throw new ApiError(500, "database_error", "No pudimos cargar tu perfil.");

  const values = {
    privy_did: did,
    email: identity.email,
    wallet_address: identity.walletAddress,
    display_name: options.displayName ?? existing?.display_name ?? identity.displayName,
  };

  const result = existing
    ? await supabase.from("users").update(values).eq("id", existing.id).select("*").single()
    : await supabase.from("users").insert(values).select("*").single();

  if (result.error) {
    if (result.error.code === "23505") {
      throw new ApiError(409, "identity_conflict", "Ese email o wallet ya está asociado a otra cuenta.");
    }
    console.error("[auth] sync user:", result.error.message);
    throw new ApiError(500, "database_error", "No pudimos guardar tu perfil.");
  }
  return result.data;
}

/** Usuario autenticado o null si la solicitud no trae token. */
export async function getRequestUser(request: Request): Promise<AppUser | null> {
  const did = await verifyPrivyDid(request);
  if (!did) return null;
  const { data, error } = await getSupabaseAdmin().from("users").select("*").eq("privy_did", did).maybeSingle();
  if (error) throw new ApiError(500, "database_error", "No pudimos cargar tu perfil.");
  // Un perfil sin wallet se vuelve a leer de Privy: al crear la cuenta, la wallet embebida puede tardar un instante en
  // aparecer en su API y la primera sincronización la pierde. Solo afecta a perfiles incompletos.
  if (!data || !data.wallet_address) return syncUserFromPrivy(did);
  return data;
}

export async function requireUser(request: Request): Promise<AppUser> {
  const user = await getRequestUser(request);
  if (!user) throw new ApiError(401, "unauthorized", "Ingresa para continuar.");
  return user;
}

export async function requireDid(request: Request): Promise<string> {
  const did = await verifyPrivyDid(request);
  if (!did) throw new ApiError(401, "unauthorized", "Ingresa para continuar.");
  return did;
}

export function isArbitrationAdmin(user: AppUser): boolean {
  return !!user.email && getServerEnv().ARBITRATION_ADMIN_EMAILS.includes(user.email);
}

export function toMeResponse(user: AppUser) {
  return {
    user: {
      id: user.id,
      email: user.email,
      walletAddress: user.wallet_address,
      displayName: user.display_name,
      isArbitrationAdmin: isArbitrationAdmin(user),
    },
  };
}
