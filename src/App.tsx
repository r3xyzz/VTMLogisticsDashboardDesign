// src/App.tsx
import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './lib/msal';
import { supabase } from './lib/supabase';
import { fetchAccess, allowedView, isView, type Access, type ActiveView } from './lib/permissions';
import type { Session } from '@supabase/supabase-js';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import ErrorBoundary from './components/ui/ErrorBoundary';

// Cada módulo se descarga recién cuando se abre (la primera carga de la página es mucho más liviana)
const Dashboard = lazy(() => import('./components/Dashboard'));
const CargoRegistration = lazy(() => import('./components/CargoRegistration'));
const TrackingModule = lazy(() => import('./components/TrackingModule'));
const DocumentsModule = lazy(() => import('./components/DocumentsModule'));
const FleetModule = lazy(() => import('./components/FleetModule'));
const ProvidersModule = lazy(() => import('./components/ProvidersModule'));
const DriversModule = lazy(() => import('./components/DriversModule'));
const ClientsModule = lazy(() => import('./components/ClientsModule'));
const CalculationsModule = lazy(() => import('./components/CalculationsModule'));
const EmailModule = lazy(() => import('./components/EmailModule'));
const FacturacionModule = lazy(() => import('./components/FacturacionModule'));
const CamionerosModule = lazy(() => import('./components/Camioneros'));
const CoordinationBoard = lazy(() => import('./components/TablaCoordinacion'));
const ImportExportModule = lazy(() => import('./components/ImportExportModule'));
const PatioModule = lazy(() => import('./components/Patio'));

export type { ActiveView };

const activeViewStorageKey = 'vtm-active-view';

const getStoredActiveView = (): ActiveView | null => {
  const storedView = sessionStorage.getItem(activeViewStorageKey);
  return isView(storedView) ? storedView : null;
};

const Spinner = ({ label }: { label: string }) => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="text-center">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      <p className="mt-4 text-slate-500">{label}</p>
    </div>
  </div>
);

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
  // Rol y vistas permitidas: los calcula Supabase (lib/permissions.ts)
  const [access, setAccess] = useState<Access | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>(() => getStoredActiveView() || 'dashboard');
  const [collapsed, setCollapsed] = useState(false);
  // Menú lateral: fijo en pantallas grandes (lg, 1024px+); panel deslizable en celular y tablet
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => { setIsDesktop(query.matches); if (query.matches) setMobileMenuOpen(false); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    sessionStorage.setItem(activeViewStorageKey, activeView);
  }, [activeView]);

  // memoizar handleNavigate para que no cambie de identidad en cada render (solo si cambian los permisos)
  const handleNavigate = useCallback((view: ActiveView) => {
    if (access) setActiveView(allowedView(access, view));
  }, [access]);

  useEffect(() => {
    const loadAccess = async (currentSession: Session | null): Promise<Access | null> => {
      if (!currentSession) {
        setAccess(null);
        setAccessError(null);
        return null;
      }
      try {
        const result = await fetchAccess();
        setAccess(result);
        setAccessError(null);
        return result;
      } catch (error: any) {
        console.error('No se pudieron leer los permisos del usuario:', error);
        setAccess(null);
        setAccessError(error?.code === 'PGRST202'
          ? 'Falta ejecutar en Supabase la migración supabase/migrations/20261127_view_permissions.sql.'
          : 'No se pudieron leer tus permisos. Recarga la página o intenta más tarde.');
        return null;
      }
    };

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        const result = await loadAccess(initialSession);
        if (result) setActiveView(allowedView(result, getStoredActiveView()));
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
      await loadAccess(newSession);
    });

    return () => subscription?.unsubscribe();
  }, []);

  // ✅ FIX: memoizar el objeto `view` para que React NO desmonte/monte los módulos
  // en cada re-render de AppContent. Solo se recrea si cambia handleNavigate
  // (es decir, si cambian los permisos).
  const view = useMemo<Record<ActiveView, React.ReactNode>>(() => ({
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
    coordination: <CoordinationBoard />,
    camioneros: <CamionerosModule />,
    importexport: <ImportExportModule />,
    patio: <PatioModule />,
  }), [handleNavigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Spinner label="Cargando..." />
      </div>
    );
  }

  if (!session || !access || access.views.length === 0) {
    const notice = !session ? undefined
      : accessError ?? (access
        ? 'Tu usuario no tiene vistas asignadas. Pide acceso al administrador.'
        : `La cuenta ${session.user.email ?? ''} no está autorizada para entrar.`);
    return <Login notice={notice} />;
  }

  const currentView = allowedView(access, activeView);

  return (
    // 100dvh: en iOS/Android descuenta la barra del navegador (h-screen dejaba contenido tapado)
    <div className="flex h-[100dvh] overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {mobileMenuOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[1px] lg:hidden" onClick={() => setMobileMenuOpen(false)} />}
      <Sidebar
        collapsed={isDesktop && collapsed}
        onToggle={() => setCollapsed(c => !c)}
        activeView={currentView}
        onNavigate={handleNavigate}
        allowedViews={access.views}
        userRole={access.role}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior solo en celular / tablet */}
        <div className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-white/10 px-3 lg:hidden" style={{ background: '#060d1a', paddingTop: 'env(safe-area-inset-top)' }}>
          <button onClick={() => setMobileMenuOpen(true)} className="flex size-9 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10" aria-label="Abrir menú">
            <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <img src={`${import.meta.env.BASE_URL}logo_empresa_VTM.png`} alt="VTM Logistics" className="h-5 w-auto" />
          <span className="truncate text-sm font-semibold text-white">VTM Logistics</span>
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50">
          <ErrorBoundary key={currentView} name={currentView}>
            <Suspense fallback={<Spinner label="Cargando módulo..." />}>
              {view[currentView]}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}