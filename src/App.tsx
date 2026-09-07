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

  // ✅ Función para verificar autorización
  const checkAuthorization = async (email: string): Promise<{ authorized: boolean; role: string; permissions: UserPermissions }> => {
    try {
      console.log('🔍 Verificando autorización para:', email);
      
      // 1. Verificar si el usuario está en authorized_users
      const { data: userData, error: userError } = await supabase
        .from('authorized_users')
        .select('email, role, is_active')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

      if (userError || !userData) {
        console.log('❌ Usuario no encontrado en authorized_users');
        return { authorized: false, role: 'none', permissions: defaultPermissions };
      }

      console.log('✅ Usuario encontrado:', userData);

      // 2. Obtener permisos según el rol
      const { data: permissionsData, error: permError } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', userData.role)
        .maybeSingle();

      if (permError || !permissionsData) {
        console.log('⚠️ No se encontraron permisos para el rol:', userData.role);
        // Si es admin, dar todos los permisos
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

      console.log('📊 Permisos obtenidos:', permissionsData);

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

      console.log('✅ Permisos finales:', permissions);
      return { authorized: true, role: userData.role, permissions };
    } catch (err) {
      console.error('❌ Error en verificación:', err);
      return { authorized: false, role: 'none', permissions: defaultPermissions };
    }
  };

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

  // ✅ Handler de navegación con verificación
  const handleNavigate = (view: ActiveView) => {
    console.log('🔍 Navegando a:', view);
    if (canAccessView(view)) {
      console.log('✅ Acceso permitido');
      setActiveView(view);
    } else {
      console.log('⛔ Acceso denegado a:', view);
      const firstAvailable = getFirstAvailableView(userPermissions);
      console.log('📌 Redirigiendo a:', firstAvailable);
      setActiveView(firstAvailable);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('🔄 Inicializando autenticación...');
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession?.user?.email) {
          console.log('👤 Usuario:', initialSession.user.email);
          const result = await checkAuthorization(initialSession.user.email);
          setIsAuthorized(result.authorized);
          setUserRole(result.role);
          setUserPermissions(result.permissions);
          
          if (result.authorized) {
            const firstAvailableView = getFirstAvailableView(result.permissions);
            console.log('📌 Primera vista disponible:', firstAvailableView);
            setActiveView(firstAvailableView);
          }
        }
        setSession(initialSession);
      } catch (error) {
        console.error('❌ Error inicializando autenticación:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('🔄 Cambio en autenticación:', event);
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

  // ✅ Solo renderizar la vista activa si es accesible
  const currentView = canAccessView(activeView) ? activeView : getFirstAvailableView(userPermissions);

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        activeView={currentView}
        onNavigate={handleNavigate}
        permissions={userPermissions}
        userRole={userRole}
      />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        {view[currentView]}
      </main>
    </div>
  );
}