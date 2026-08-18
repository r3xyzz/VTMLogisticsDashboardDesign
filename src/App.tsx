import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import CargoRegistration from './components/CargoRegistration'
import OrdersModule from './components/OrdersModule'
import TrackingModule from './components/TrackingModule'
import DocumentsModule from './components/DocumentsModule'
import FleetModule from './components/FleetModule'

export type ActiveView = 'dashboard' | 'orders' | 'cargo' | 'tracking' | 'documents' | 'fleet'

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')
  const [collapsed, setCollapsed] = useState(false)

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
        {view[activeView]}
      </main>
    </div>
  )
}
