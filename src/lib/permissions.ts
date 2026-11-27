// src/lib/permissions.ts
// Vistas de la app y permisos del usuario.
// Los permisos los calcula Supabase (función my_access, migración 20261127_view_permissions.sql)
// y la base los vuelve a exigir en cada tabla: ocultar una vista acá es solo visual.
import { supabase } from './supabase';

// Orden = prioridad de la vista inicial cuando el usuario no tiene una guardada
export const VIEWS = [
  'dashboard', 'cargo', 'documents', 'tracking', 'fleet', 'drivers', 'providers', 'clients',
  'calculations', 'email', 'facturacion', 'coordination', 'camioneros', 'importexport', 'patio',
] as const;

// Cada vista se habilita con la columna can_view_<vista> de role_permissions
export type ActiveView = (typeof VIEWS)[number];

export interface Access {
  role: string; // admin | driver | ...
  views: ActiveView[]; // vistas permitidas, en el orden de VIEWS
}

export const isView = (value: unknown): value is ActiveView => VIEWS.includes(value as ActiveView);

/** Rol y vistas del usuario conectado. null = no está activo en authorized_users. */
export async function fetchAccess(): Promise<Access | null> {
  const { data, error } = await supabase.rpc('my_access');
  if (error) throw error;
  if (!data) return null;
  const permissions = (data.permissions ?? {}) as Record<string, boolean>;
  return {
    role: data.role ?? 'user',
    views: VIEWS.filter((view) => permissions[`can_view_${view}`] === true),
  };
}

/** Vista a mostrar: la pedida si tiene permiso; si no, la primera permitida. */
export const allowedView = (access: Access, view: ActiveView | null): ActiveView =>
  view && access.views.includes(view) ? view : access.views[0] ?? 'dashboard';
