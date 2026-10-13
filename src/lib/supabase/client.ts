import { createBrowserClient } from "@supabase/ssr";
import { ENV_MISSING_MESSAGE, supabaseEnv } from "./env";

export function createClient() {
  const env = supabaseEnv();
  if (!env) throw new Error(ENV_MISSING_MESSAGE);
  return createBrowserClient(
    env.url,
    env.key,
  );
}
