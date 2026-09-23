// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bxgfykzjqggwqjgzwbpj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4Z2Z5a3pqcWdnd3FqZ3p3YnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5ODAwMDEsImV4cCI6MjEwMjU1NjAwMX0.0gWbOpFdTsIFElraRofFp7g4yfXwNvPvHZSEexYDsoI';

// ✅ CONFIGURACIÓN: Sesión NO persistente (expira al cerrar la pestaña/navegador)
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