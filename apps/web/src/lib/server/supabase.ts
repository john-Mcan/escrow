import "server-only";
import type { Database } from "@escrow/shared/database";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "./env";

let client: SupabaseClient<Database> | undefined;

/**
 * Cliente con la secret key (ignora RLS). Solo para Route Handlers: toda escritura pasa por aquí después de
 * verificar el token de Privy o la transacción on-chain.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!client) {
    const env = getServerEnv();
    client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
