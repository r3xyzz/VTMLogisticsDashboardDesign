// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// ✅ CONFIGURACIÓN: Sesión persistente (queda guardada en localStorage y sigue activa al cerrar y volver a abrir el navegador, hasta cerrar sesión)
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,     // ✅ Persiste la sesión en localStorage
      autoRefreshToken: true,   // ✅ Refresca el token automáticamente
      detectSessionInUrl: true, // ✅ Detecta el retorno de redirects
      storage: window.localStorage, // ✅ Usa localStorage
    },
  }
);