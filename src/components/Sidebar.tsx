// src/components/Sidebar.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ActiveView } from '../App';
import type { Session } from '@supabase/supabase-js';

interface UserPermissions {
  can_view_dashboard: boolean;
  can_view_orders: boolean;
  can_view_cargo: boolean;
  can_view_tracking: boolean;
  can_view_documents: boolean;
  can_view_fleet: boolean;
  can_view_drivers: boolean;
  can_view_providers: boolean;
}

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  activeView: ActiveView;
  onNavigate: (v: ActiveView) => void;
  permissions: UserPermissions;
  userRole: string;
}

interface NavItem {
  id: ActiveView;
  label: string;
  badge?: number;
  requiredPermission: keyof UserPermissions;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', requiredPermission: 'can_view_dashboard' },
  { id: 'orders', label: 'Pedidos / Correo', badge: 2, requiredPermission: 'can_view_orders' },
  { id: 'cargo', label: 'Nueva OT / Cotizar', requiredPermission: 'can_view_cargo' },
  { id: 'tracking', label: 'Monitoreo · Tracking', requiredPermission: 'can_view_tracking' },
  { id: 'documents', label: 'POD · Documentos', requiredPermission: 'can_view_documents' },
  { id: 'fleet', label: 'Flota · Vehículos', requiredPermission: 'can_view_fleet' },
  { id: 'drivers', label: 'Conductores', requiredPermission: 'can_view_drivers' },
  { id: 'providers', label: 'Proveedores', badge: 3, requiredPermission: 'can_view_providers' },
];

function NavIcon({ id }: { id: ActiveView }) {
  const d: Record<ActiveView, string | string[]> = {
    dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    orders: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    cargo: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    tracking: ['M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z', 'M15 11a3 3 0 11-6 0 3 3 0 016 0z'],
    documents: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    fleet: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
    providers: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    drivers: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  };
  const paths = Array.isArray(d[id]) ? (d[id] as string[]) : [d[id] as string];
  return (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {paths.map((p, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={p} />
      ))}
    </svg>
  );
}

export default function Sidebar({ 
  collapsed, 
  onToggle, 
  activeView, 
  onNavigate, 
  permissions,
  userRole 
}: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const getUserInitials = () => {
    if (!session?.user?.email) return 'U';
    return session.user.email[0].toUpperCase();
  };

  const getUserName = () => {
    if (session?.user?.user_metadata?.full_name) {
      return session.user.user_metadata.full_name;
    }
    if (session?.user?.email) {
      return session.user.email.split('@')[0];
    }
    return 'Usuario';
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  // ✅ Filtrar items según permisos
  const visibleNavItems = navItems.filter(item => {
    const hasPermission = permissions[item.requiredPermission] === true;
    console.log(`🔍 ${item.label}: ${hasPermission ? '✅ visible' : '❌ oculto'}`);
    return hasPermission;
  });

  return (
    <aside
      className="flex flex-col h-full flex-shrink-0 transition-[width] duration-200 ease-out overflow-hidden"
      style={{
        width: collapsed ? 64 : 232,
        background: 'linear-gradient(180deg, #060d1a 0%, #102040 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="flex items-center gap-3 px-4 h-14 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #2558a0, #3a72c2)' }}
        >
          <svg className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-white font-bold text-[15px] tracking-tight leading-none whitespace-nowrap">VTM Logistics</div>
            <div className="text-blue-400/60 text-[10px] tracking-widest uppercase mt-0.5 whitespace-nowrap">TMS · Control Center</div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <div className="px-4 pt-1 pb-2">
            <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'rgba(148,163,184,0.45)' }}>
              Módulos
            </span>
          </div>
        )}

        {visibleNavItems.length === 0 ? (
          <div className="px-4 py-2 text-xs text-slate-400">
            No tienes módulos disponibles
          </div>
        ) : (
          visibleNavItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className="relative w-full flex items-center gap-3 px-4 h-10 text-left group transition-colors duration-100"
                style={{
                  background: active ? 'rgba(37,88,160,0.3)' : 'transparent',
                  color: active ? '#93c5fd' : 'rgba(148,163,184,0.7)',
                }}
              >
                {active && (
                  <span
                    className="absolute left-0 inset-y-1.5 w-[3px] rounded-r-full"
                    style={{ background: '#60a5fa' }}
                  />
                )}
                <span style={{ color: active ? '#60a5fa' : 'rgba(100,116,139,0.9)' }}>
                  <NavIcon id={item.id} />
                </span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-[13px] font-medium truncate whitespace-nowrap">{item.label}</span>
                    {item.badge && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: '#dc2626', color: 'white' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {collapsed && item.badge && (
                  <span
                    className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                    style={{ background: '#dc2626' }}
                  />
                )}
              </button>
            );
          })
        )}
      </nav>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {!collapsed && (
          <div className="flex items-center gap-3 px-4 py-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#1e4278,#2558a0)' }}
            >
              {loading ? '...' : getUserInitials()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-[13px] font-semibold truncate">
                {loading ? 'Cargando...' : getUserName()}
              </div>
              <div className="text-blue-400/50 text-[10px] truncate flex items-center gap-1">
                <span>{session?.user?.email || 'Usuario'}</span>
                <span className="text-[8px] bg-blue-900/50 px-1.5 py-0.5 rounded-full text-blue-300">
                  {userRole === 'admin' ? 'Admin' : 'Usuario'}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-red-400 hover:text-red-300 transition-colors flex-shrink-0 px-2 py-1 rounded border border-red-500/30 hover:border-red-400/50"
              title="Cerrar sesión"
            >
              Cerrar sesión
            </button>
          </div>
        )}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center h-9 transition-colors hover:bg-white/5"
          style={{ color: 'rgba(100,116,139,0.6)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={collapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'}
            />
          </svg>
        </button>
      </div>
    </aside>
  );
}