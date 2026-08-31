// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bxgfykzjqggwqjgzwbpj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4Z2Z5a3pqcWdnd3FqZ3p3YnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5ODAwMDEsImV4cCI6MjEwMjU1NjAwMX0.0gWbOpFdTsIFElraRofFp7g4yfXwNvPvHZSEexYDsoI';

// ✅ CONFIGURACIÓN: Sesión NO persistente (expira al cerrar la pestaña/navegador)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false, // 🔥 CLAVE: No guardar sesión en localStorage
        autoRefreshToken: true, // Mantener token renovado mientras la pestaña esté abierta
        detectSessionInUrl: true,
    }
});