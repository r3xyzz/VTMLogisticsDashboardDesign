// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';


// Estas credenciales las encuentras en Supabase > Settings > API
// La URL es: https://bxgfykzjqggwqjgzwbpj.supabase.co
const supabaseUrl = 'https://bxgfykzjqggwqjgzwbpj.supabase.co';
// ⚠️ USA LA ANON KEY (NO LA SERVICE ROLE KEY)
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4Z2Z5a3pqcWdnd3FqZ3p3YnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5ODAwMDEsImV4cCI6MjEwMjU1NjAwMX0.0gWbOpFdTsIFElraRofFp7g4yfXwNvPvHZSEexYDsoI';


export const supabase = createClient(supabaseUrl, supabaseAnonKey);