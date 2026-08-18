// src/App.tsx
import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import CargoRegistration from './components/CargoRegistration'
import OrdersModule from './components/OrdersModule'
import TrackingModule from './components/TrackingModule'
import DocumentsModule from './components/DocumentsModule'
import FleetModule from './components/FleetModule'
import { TestConnection } from './components/TestConnection' // 👈 Importa el componente de prueba

export type ActiveView = 'dashboard' | 'orders' | 'cargo' | 'tracking' | 'documents' | 'fleet'

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [showTest, setShowTest] = useState(true) // 👈 Estado para mostrar/ocultar la prueba

  const view: Record<ActiveView, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={setActiveView} />,
    orders:    <OrdersModule onNavigate={setActiveView} />,
    cargo:     <CargoRegistration />,
    tracking:  <TrackingModule />,
    documents: <DocumentsModule />,
    fleet:     <FleetModule />,
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        activeView={activeView}
        onNavigate={setActiveView}
      />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        {/* 👇 Componente de prueba - se muestra al inicio */}
        {showTest && (
          <div style={{ padding: '20px' }}>
            <button 
              onClick={() => setShowTest(false)}
              style={{
                background: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '20px'
              }}
            >
              ✕ Ocultar prueba
            </button>
            <TestConnection />
            <hr style={{ margin: '30px 0', border: '1px solid #e5e7eb' }} />
            <h2 style={{ marginBottom: '10px' }}>📊 Dashboard Principal</h2>
          </div>
        )}
        
        {/* El resto de tu app */}
        {view[activeView]}
      </main>
    </div>
  )
}