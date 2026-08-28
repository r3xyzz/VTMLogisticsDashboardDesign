// src/App.tsx
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CargoRegistration from './components/CargoRegistration';
import OrdersModule from './components/OrdersModule';
import TrackingModule from './components/TrackingModule';
import DocumentsModule from './components/DocumentsModule';
import FleetModule from './components/FleetModule';
import ProvidersModule from './components/ProvidersModule';
import DriversModule from './components/DriversModule';
import Login from './components/Login';

export type ActiveView = 
  | 'dashboard' 
  | 'orders' 
  | 'cargo' 
  | 'tracking' 
  | 'documents' 
  | 'fleet' 
  | 'providers'
  | 'drivers';

// ✅ Interfaz para permisos
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

// ✅ Permisos por defecto (sin acceso)
const defaultPermissions: UserPermissions = {
  can_view_dashboard: false,
  can_view_orders: false,
  can_view_cargo: false,
  can_view_tracking: false,
  can_view_documents: false,
  can_view_fleet: false,
  can_view_drivers: false,
  can_view_providers: false,
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(defaultPermissions);
  const [userRole, setUserRole] = useState<string>('user');
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  const checkAuthorization = async (email: string): Promise<{ authorized: boolean; role: string; permissions: UserPermissions }> => {
    try {
      // 1. Verificar si el usuario está en authorized_users
      const { data: userData, error: userError } = await supabase
        .from('authorized_users')
        .select('email, role, is_active')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

      if (userError || !userData) {
        return { authorized: false, role: 'none', permissions: defaultPermissions };
      }

      // 2. Obtener permisos según el rol
      const { data: permissionsData, error: permError } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', userData.role)
        .maybeSingle();

      if (permError || !permissionsData) {
        // Si no hay permisos configurados, usar valores por defecto según el rol
        if (userData.role === 'admin') {
          return { 
            authorized: true, 
            role: userData.role, 
            permissions: {
              can_view_dashboard: true,
              can_view_orders: true,
              can_view_cargo: true,
              can_view_tracking: true,
              can_view_documents: true,
              can_view_fleet: true,
              can_view_drivers: true,
              can_view_providers: true,
            }
          };
        }
        return { authorized: true, role: userData.role, permissions: defaultPermissions };
      }

      // 3. Construir objeto de permisos
      const permissions: UserPermissions = {
        can_view_dashboard: permissionsData.can_view_dashboard || false,
        can_view_orders: permissionsData.can_view_orders || false,
        can_view_cargo: permissionsData.can_view_cargo || false,
        can_view_tracking: permissionsData.can_view_tracking || false,
        can_view_documents: permissionsData.can_view_documents || false,
        can_view_fleet: permissionsData.can_view_fleet || false,
        can_view_drivers: permissionsData.can_view_drivers || false,
        can_view_providers: permissionsData.can_view_providers || false,
      };

      return { authorized: true, role: userData.role, permissions };
    } catch (err) {
      console.error('Error en verificación:', err);
      return { authorized: false, role: 'none', permissions: defaultPermissions };
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession?.user?.email) {
          const result = await checkAuthorization(initialSession.user.email);
          setIsAuthorized(result.authorized);
          setUserRole(result.role);
          setUserPermissions(result.permissions);
          
          // ✅ Redirigir a la primera vista permitida
          if (result.authorized) {
            const firstAvailableView = getFirstAvailableView(result.permissions);
            setActiveView(firstAvailableView);
          }
        }
        setSession(initialSession);
      } catch (error) {
        console.error('Error inicializando autenticación:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      
      if (newSession?.user?.email) {
        const result = await checkAuthorization(newSession.user.email);
        setIsAuthorized(result.authorized);
        setUserRole(result.role);
        setUserPermissions(result.permissions);
        
        if (result.authorized) {
          const firstAvailableView = getFirstAvailableView(result.permissions);
          setActiveView(firstAvailableView);
        }
      } else {
        setIsAuthorized(false);
        setUserPermissions(defaultPermissions);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  // ✅ Función para obtener la primera vista disponible
  const getFirstAvailableView = (permissions: UserPermissions): ActiveView => {
    if (permissions.can_view_dashboard) return 'dashboard';
    if (permissions.can_view_orders) return 'orders';
    if (permissions.can_view_cargo) return 'cargo';
    if (permissions.can_view_documents) return 'documents';
    if (permissions.can_view_tracking) return 'tracking';
    if (permissions.can_view_fleet) return 'fleet';
    if (permissions.can_view_drivers) return 'drivers';
    if (permissions.can_view_providers) return 'providers';
    return 'dashboard'; // fallback
  };

  // ✅ Verificar si una vista es accesible
  const canAccessView = (view: ActiveView): boolean => {
    switch (view) {
      case 'dashboard': return userPermissions.can_view_dashboard;
      case 'orders': return userPermissions.can_view_orders;
      case 'cargo': return userPermissions.can_view_cargo;
      case 'tracking': return userPermissions.can_view_tracking;
      case 'documents': return userPermissions.can_view_documents;
      case 'fleet': return userPermissions.can_view_fleet;
      case 'drivers': return userPermissions.can_view_drivers;
      case 'providers': return userPermissions.can_view_providers;
      default: return false;
    }
  };

  // ✅ Handler de navegación con verificación de permisos
  const handleNavigate = (view: ActiveView) => {
    if (canAccessView(view)) {
      setActiveView(view);
    } else {
      // Si no tiene permisos, redirigir a la primera vista disponible
      const firstAvailable = getFirstAvailableView(userPermissions);
      setActiveView(firstAvailable);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session || !isAuthorized) {
    return <Login />;
  }

  const view: Record<ActiveView, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={handleNavigate} />,
    orders: <OrdersModule onNavigate={handleNavigate} />,
    cargo: <CargoRegistration />,
    tracking: <TrackingModule />,
    documents: <DocumentsModule />,
    fleet: <FleetModule />,
    providers: <ProvidersModule />,
    drivers: <DriversModule />,
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        activeView={activeView}
        onNavigate={handleNavigate}
        permissions={userPermissions}
        userRole={userRole}
      />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        {view[activeView]}
      </main>
    </div>
  );
}
