// src/App.tsx
import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import CargoRegistration from './components/CargoRegistration'
import OrdersModule from './components/OrdersModule'
import TrackingModule from './components/TrackingModule'
import DocumentsModule from './components/DocumentsModule'
import FleetModule from './components/FleetModule'
import ProvidersModule from './components/ProvidersModule'  
import DriversModule from './components/DriversModule'

export type ActiveView = 
    | 'dashboard' 
    | 'orders' 
    | 'cargo' 
    | 'tracking' 
    | 'documents' 
    | 'fleet' 
    | 'providers'   
    | 'drivers'

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')
  const [collapsed, setCollapsed] = useState(false)

  const view: Record<ActiveView, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={setActiveView} />, // Add the Dashboard component here
    orders:    <OrdersModule onNavigate={setActiveView} />, // Add the OrdersModule component here
    cargo:     <CargoRegistration />, // Add the CargoRegistration component here
    tracking:  <TrackingModule />, // Add the TrackingModule component here
    documents: <DocumentsModule />, // Add the DocumentsModule component here
    fleet:     <FleetModule />, // Add the FleetModule component here
    providers: <ProvidersModule />, // Add the ProvidersModule component here
    drivers:   <DriversModule />, // Add the DriversModule component here
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
