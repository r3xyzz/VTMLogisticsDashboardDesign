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

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  // ✅ Función para verificar autorización (con logs)
  const checkAuthorization = async (email: string): Promise<boolean> => {
    try {
      console.log('🔍 Verificando autorización para:', email);
      
      const { data, error } = await supabase
        .from('authorized_users')
        .select('email, is_active')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('❌ Error checking authorization:', error);
        return false;
      }

      console.log('📊 Resultado de verificación:', data);
      
      if (!data) {
        setAuthError('❌ Usuario no autorizado. Contacta al administrador.');
        return false;
      }

      return true;
    } catch (err) {
      console.error('❌ Error en verificación:', err);
      return false;
    }
  };

  useEffect(() => {
    // 1. Obtener sesión inicial
    const initializeAuth = async () => {
      try {
        console.log('🔄 Inicializando autenticación...');
        
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error al obtener sesión:', error);
          setLoading(false);
          return;
        }
        
        console.log('📋 Sesión inicial:', initialSession?.user?.email || 'No hay sesión');
        
        if (initialSession?.user?.email) {
          const authorized = await checkAuthorization(initialSession.user.email);
          setIsAuthorized(authorized);
          console.log('✅ Usuario autorizado:', authorized);
        }
        
        setSession(initialSession);
      } catch (error) {
        console.error('❌ Error en initializeAuth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // 2. Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      console.log('🔄 Cambio en autenticación:', _event, newSession?.user?.email || 'No hay sesión');
      
      setSession(newSession);
      
      if (newSession?.user?.email) {
        const authorized = await checkAuthorization(newSession.user.email);
        setIsAuthorized(authorized);
        console.log('✅ Usuario autorizado después de cambio:', authorized);
      } else {
        setIsAuthorized(false);
        setAuthError(null);
      }
    });

    // 3. Limpiar suscripción al desmontar
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Si está cargando, mostrar pantalla de carga
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

  // Si no hay sesión o no está autorizado, mostrar Login
  if (!session || !isAuthorized) {
    return <Login />;
  }

  // Si hay sesión y está autorizado, mostrar la aplicación
  const view: Record<ActiveView, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={setActiveView} />,
    orders: <OrdersModule onNavigate={setActiveView} />,
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
        onNavigate={setActiveView}
      />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        {view[activeView]}
      </main>
    </div>
  );
}