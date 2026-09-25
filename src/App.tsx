// src/App.tsx
import { useState, useEffect } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './lib/msal';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CargoRegistration from './components/CargoRegistration';
import TrackingModule from './components/TrackingModule';
import DocumentsModule from './components/DocumentsModule';
import FleetModule from './components/FleetModule';
import ProvidersModule from './components/ProvidersModule';
import DriversModule from './components/DriversModule';
import ClientsModule from './components/ClientsModule';
import CalculationsModule from './components/CalculationsModule';
import Login from './components/Login';
import EmailModule from './components/EmailModule';
import FacturacionModule from './components/FacturacionModule';

// Vistas activas (sin 'orders')
export type ActiveView = 
  | 'dashboard' 
  | 'cargo' 
  | 'tracking' 
  | 'documents' 
  | 'fleet' 
  | 'providers'
  | 'drivers'
  | 'clients'
  | 'calculations'
  | 'email'
  | 'facturacion';

interface UserPermissions {
  can_view_dashboard: boolean;
  can_view_cargo: boolean;
  can_view_tracking: boolean;
  can_view_documents: boolean;
  can_view_fleet: boolean;
  can_view_drivers: boolean;
  can_view_providers: boolean;
  can_view_clients: boolean;
  can_view_calculations: boolean;
  can_view_email: boolean;
  can_view_facturacion: boolean;
}

const defaultPermissions: UserPermissions = {
  can_view_dashboard: false,
  can_view_cargo: false,
  can_view_tracking: false,
  can_view_documents: false,
  can_view_fleet: false,
  can_view_drivers: false,
  can_view_providers: false,
  can_view_clients: false,
  can_view_calculations: false,
  can_view_email: false,
  can_view_facturacion: false,
};

const activeViewStorageKey = 'vtm-active-view';
const activeViews: ActiveView[] = [
  'dashboard', 'cargo', 'tracking', 'documents',
  'fleet', 'providers', 'drivers', 'clients', 'calculations', 'email',
  'facturacion',
];

const getStoredActiveView = (): ActiveView | null => {
  const storedView = sessionStorage.getItem(activeViewStorageKey);
  return storedView && activeViews.includes(storedView as ActiveView)
    ? storedView as ActiveView
    : null;
};

const hasPermissionForView = (view: ActiveView, permissions: UserPermissions): boolean => {
  const permissionByView: Record<ActiveView, keyof UserPermissions> = {
    dashboard: 'can_view_dashboard',
    cargo: 'can_view_cargo',
    tracking: 'can_view_tracking',
    documents: 'can_view_documents',
    fleet: 'can_view_fleet',
    providers: 'can_view_providers',
    drivers: 'can_view_drivers',
    clients: 'can_view_clients',
    calculations: 'can_view_calculations',
    email: 'can_view_email',
    facturacion: 'can_view_facturacion',
  };
  return permissions[permissionByView[view]];
};

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AppContent />
    </MsalProvider>
  );
}

function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(defaultPermissions);
  const [userRole, setUserRole] = useState<string>('user');
  const [activeView, setActiveView] = useState<ActiveView>(() => getStoredActiveView() || 'dashboard');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    sessionStorage.setItem(activeViewStorageKey, activeView);
  }, [activeView]);

  const checkAuthorization = async (email: string): Promise<{ authorized: boolean; role: string; permissions: UserPermissions }> => {
    try {
      console.log('🔍 Verificando autorización para:', email);
      
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

      const { data: permissionsData, error: permError } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', userData.role)
        .maybeSingle();

      if (permError || !permissionsData) {
        console.log('⚠️ No se encontraron permisos para el rol:', userData.role);
        if (userData.role === 'admin') {
          return { 
            authorized: true, 
            role: userData.role, 
            permissions: {
              can_view_dashboard: true,
              can_view_cargo: true,
              can_view_tracking: true,
              can_view_documents: true,
              can_view_fleet: true,
              can_view_drivers: true,
              can_view_providers: true,
              can_view_clients: true,
              can_view_calculations: true,
              can_view_email: true,
              can_view_facturacion: true,
            }
          };
        }
        return { authorized: true, role: userData.role, permissions: defaultPermissions };
      }

      console.log('📊 Permisos obtenidos:', permissionsData);

      const permissions: UserPermissions = {
        can_view_dashboard: permissionsData.can_view_dashboard || false,
        can_view_cargo: permissionsData.can_view_cargo || false,
        can_view_tracking: permissionsData.can_view_tracking || false,
        can_view_documents: permissionsData.can_view_documents || false,
        can_view_fleet: permissionsData.can_view_fleet || false,
        can_view_drivers: permissionsData.can_view_drivers || false,
        can_view_providers: permissionsData.can_view_providers || false,
        can_view_clients: permissionsData.can_view_clients || false,
        can_view_calculations: permissionsData.can_view_calculations || false,
        can_view_email: permissionsData.can_view_email || false,
        can_view_facturacion: permissionsData.can_view_facturacion || false,
      };

      console.log('✅ Permisos finales:', permissions);
      return { authorized: true, role: userData.role, permissions };
    } catch (err) {
      console.error('❌ Error en verificación:', err);
      return { authorized: false, role: 'none', permissions: defaultPermissions };
    }
  };

  const getFirstAvailableView = (permissions: UserPermissions): ActiveView => {
    if (permissions.can_view_dashboard) return 'dashboard';
    if (permissions.can_view_cargo) return 'cargo';
    if (permissions.can_view_documents) return 'documents';
    if (permissions.can_view_tracking) return 'tracking';
    if (permissions.can_view_fleet) return 'fleet';
    if (permissions.can_view_drivers) return 'drivers';
    if (permissions.can_view_providers) return 'providers';
    if (permissions.can_view_clients) return 'clients';
    if (permissions.can_view_calculations) return 'calculations';
    if (permissions.can_view_email) return 'email';
    if (permissions.can_view_facturacion) return 'facturacion';
    return 'dashboard';
  };

  const canAccessView = (view: ActiveView): boolean => {
    switch (view) {
      case 'dashboard': return userPermissions.can_view_dashboard;
      case 'cargo': return userPermissions.can_view_cargo;
      case 'tracking': return userPermissions.can_view_tracking;
      case 'documents': return userPermissions.can_view_documents;
      case 'fleet': return userPermissions.can_view_fleet;
      case 'drivers': return userPermissions.can_view_drivers;
      case 'providers': return userPermissions.can_view_providers;
      case 'clients': return userPermissions.can_view_clients;
      case 'calculations': return userPermissions.can_view_calculations;
      case 'email': return userPermissions.can_view_email;
      case 'facturacion': return userPermissions.can_view_facturacion; 
      default: return false;
    }
  };

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
            const storedView = getStoredActiveView();
            const initialView = storedView && hasPermissionForView(storedView, result.permissions)
              ? storedView
              : getFirstAvailableView(result.permissions);
            console.log('📌 Vista inicial:', initialView);
            setActiveView(initialView);
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
    cargo: <CargoRegistration />,
    tracking: <TrackingModule />,
    documents: <DocumentsModule />,
    fleet: <FleetModule />,
    providers: <ProvidersModule />,
    drivers: <DriversModule />,
    clients: <ClientsModule />,
    calculations: <CalculationsModule />,
    email: <EmailModule />,
    facturacion: <FacturacionModule />,
  };

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