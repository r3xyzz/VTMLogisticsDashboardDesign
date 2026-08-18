import type { ActiveView } from '../App'

interface Props {
  collapsed: boolean
  onToggle: () => void
  activeView: ActiveView
  onNavigate: (v: ActiveView) => void
}

interface NavItem {
  id: ActiveView
  label: string
  badge?: number
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'orders',    label: 'Pedidos / Correo',    badge: 2 },
  { id: 'cargo',     label: 'Nueva OT / Cotizar' },
  { id: 'tracking',  label: 'Monitoreo · Tracking' },
  { id: 'documents', label: 'POD · Documentos' },
  { id: 'fleet',     label: 'Flota · Proveedores' },
]

function NavIcon({ id }: { id: ActiveView }) {
  const d: Record<ActiveView, string | string[]> = {
    dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    orders:    'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    cargo:     'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    tracking:  ['M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z', 'M15 11a3 3 0 11-6 0 3 3 0 016 0z'],
    documents: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    fleet:     'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
  }
  const paths = Array.isArray(d[id]) ? d[id] as string[] : [d[id] as string]
  return (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {paths.map((p, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={p} />
      ))}
    </svg>
  )
}

export default function Sidebar({ collapsed, onToggle, activeView, onNavigate }: Props) {
  return (
    <aside
      className="flex flex-col h-full flex-shrink-0 transition-[width] duration-200 ease-out overflow-hidden"
      style={{
        width: collapsed ? 64 : 232,
        background: 'linear-gradient(180deg, #060d1a 0%, #102040 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Wordmark */}
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

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <div className="px-4 pt-1 pb-2">
            <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'rgba(148,163,184,0.45)' }}>Módulos</span>
          </div>
        )}

        {navItems.map(item => {
          const active = activeView === item.id
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
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {!collapsed && (
          <div className="flex items-center gap-3 px-4 py-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#1e4278,#2558a0)' }}
            >
              JO
            </div>
            <div className="min-w-0">
              <div className="text-white text-[13px] font-semibold truncate">Juan Ortega</div>
              <div className="text-blue-400/50 text-[10px] truncate">Jefe de Operaciones</div>
            </div>
            <button className="ml-auto text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        )}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center h-9 transition-colors hover:bg-white/5"
          style={{ color: 'rgba(100,116,139,0.6)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={collapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'} />
          </svg>
        </button>
      </div>
    </aside>
  )
}
