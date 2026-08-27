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
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  // ✅ Función para verificar autorización con logs
  const checkAuthorization = async (email: string): Promise<boolean> => {
    try {
      console.log('🔍 ====== INICIO VERIFICACIÓN ======');
      console.log('📧 Email a verificar:', email);
      
      const { data, error } = await supabase
        .from('authorized_users')
        .select('email, is_active, role')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('❌ Error en consulta SQL:', error);
        setDebugInfo({ error, email, step: 'sql_query_error' });
        return false;
      }

      console.log('📊 Resultado de la consulta:', data);
      
      if (!data) {
        console.warn('⚠️ Email NO encontrado en authorized_users');
        setDebugInfo({ email, result: 'not_found', step: 'authorization_check' });
        return false;
      }

      console.log('✅ Email ENCONTRADO y autorizado:', data);
      setDebugInfo({ email, data, result: 'authorized', step: 'authorization_check' });
      return true;
    } catch (err) {
      console.error('❌ Error en verificación:', err);
      setDebugInfo({ error: err, step: 'authorization_catch' });
      return false;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('🔄 ====== INICIALIZANDO AUTENTICACIÓN ======');
        
        // Obtener la sesión actual
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error al obtener sesión:', error);
          setDebugInfo({ error, step: 'get_session_error' });
          setLoading(false);
          return;
        }
        
        console.log('📋 Sesión obtenida:', initialSession ? 'SI hay sesión' : 'NO hay sesión');
        console.log('👤 Email de la sesión:', initialSession?.user?.email || 'No hay email');
        
        if (initialSession?.user?.email) {
          const authorized = await checkAuthorization(initialSession.user.email);
          setIsAuthorized(authorized);
          console.log('✅ Autorización final:', authorized);
        } else {
          console.log('ℹ️ No hay sesión activa, mostrando login');
        }
        
        setSession(initialSession);
      } catch (error) {
        console.error('❌ Error en initializeAuth:', error);
        setDebugInfo({ error, step: 'initialize_auth_catch' });
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('🔄 ====== CAMBIO EN AUTENTICACIÓN ======');
      console.log('📌 Evento:', event);
      console.log('👤 Nuevo email:', newSession?.user?.email || 'No hay email');
      
      setSession(newSession);
      
      if (newSession?.user?.email) {
        const authorized = await checkAuthorization(newSession.user.email);
        setIsAuthorized(authorized);
        console.log('✅ Autorización después del cambio:', authorized);
      } else {
        setIsAuthorized(false);
        setAuthError(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // 👇 Panel de depuración (visible en la consola)
  console.log('🐛 ====== ESTADO ACTUAL ======');
  console.log('🔐 Sesión:', session ? `Sesión activa: ${session.user.email}` : 'No hay sesión');
  console.log('✅ Autorizado:', isAuthorized);
  console.log('📝 Debug Info:', debugInfo);

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
