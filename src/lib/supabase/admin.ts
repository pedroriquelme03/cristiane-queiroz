// src/lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";

// Cliente com service_role (apenas no servidor)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);