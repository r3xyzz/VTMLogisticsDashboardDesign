import { useState } from 'react'

const loads = [
  { id: 'OT-2445', client: 'Walmart Chile', driver: 'Carlos Vega', plate: 'BFLK-92', route: 'Valparaíso → Santiago', milestone: 'En tránsito km 78', status: 'en-ruta', extra: null },
  { id: 'OT-2446', client: 'Puerto Central S.A.', driver: 'Pedro Rojas', plate: 'CGMN-14', route: 'Santiago → San Antonio', milestone: 'Cargando en origen', status: 'cargando', extra: { desc: 'Estadía 30 min extra', amount: 15000, resp: 'cliente' } },
  { id: 'OT-2447', client: 'Cosco Shipping', driver: 'Marcelo Fuentes', plate: 'DHPR-67', route: 'Valparaíso → San Antonio', milestone: 'Desvío detectado', status: 'retrasado', extra: { desc: 'Peaje alternativo', amount: 3200, resp: 'vtm' } },
  { id: 'OT-2440', client: 'Lider Express', driver: 'Andrés Morales', plate: 'EJQS-33', route: 'Santiago → Valparaíso', milestone: 'Entrega confirmada 11:32', status: 'entregado', extra: null },
  { id: 'OT-2448', client: 'DHL Chile', driver: 'Roberto Silva', plate: 'FKRT-81', route: 'San Antonio → Santiago', milestone: 'Esperando orden de carga', status: 'en-espera', extra: null },
]

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  'en-ruta': { label: 'En Ruta', color: '#16a34a', bg: '#dcfce7' },
  'cargando': { label: 'Cargando', color: '#2558a0', bg: '#dbeafe' },
  'retrasado': { label: 'Retrasado', color: '#ea580c', bg: '#fed7aa' },
  'entregado': { label: 'Entregado', color: '#374151', bg: '#e5e7eb' },
  'en-espera': { label: 'En Espera', color: '#6b7280', bg: '#f3f4f6' },
}

export default function TrackingModule() {
  const [filter, setFilter] = useState('todos')
  const [trackingId, setTrackingId] = useState<string | null>(null)

  const filtered = filter === 'todos' ? loads : loads.filter(l => l.status === filter)

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Monitoreo de Viajes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cargas activas en tránsito y seguimiento de incidencias</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-4">
        {['todos', 'en-ruta', 'retrasado', 'cargando', 'en-espera', 'entregado'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded text-xs font-semibold border transition-colors capitalize"
            style={filter === f ? { background: '#1e4278', color: 'white', borderColor: '#1e4278' } : { background: 'white', color: '#64748b', borderColor: '#e2e8f0' }}
          >
            {f === 'todos' ? 'Todos' : statusConfig[f]?.label}
          </button>
        ))}
      </div>

      {trackingId && (
        <div className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <div>
            <span className="text-xs font-semibold text-green-700">Link de seguimiento generado para {trackingId}:</span>
            <span className="ml-2 text-xs font-mono text-green-600">https://track.vtm.cl/{trackingId.toLowerCase()}</span>
          </div>
          <button onClick={() => setTrackingId(null)} className="ml-auto text-green-500 hover:text-green-700">×</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['ID Carga', 'Cliente', 'Chofer / Unidad', 'Origen → Destino', 'Hito Actual', 'Estado', 'Incidencia', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(load => {
              const st = statusConfig[load.status]
              return (
                <tr key={load.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">{load.id}</td>
                  <td className="px-4 py-3 text-xs text-slate-700 font-medium">{load.client}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold text-slate-800">{load.driver}</div>
                    <div className="text-[10px] font-mono text-slate-400">{load.plate}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{load.route}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{load.milestone}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {load.extra ? (
                      <div>
                        <div className="text-[10px] text-slate-700 font-medium">{load.extra.desc}</div>
                        <div className="text-[10px] font-mono text-orange-600">+${load.extra.amount.toLocaleString()} CLP</div>
                        <div
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block"
                          style={load.extra.resp === 'cliente' ? { background: '#fef3c7', color: '#92400e' } : { background: '#ede9fe', color: '#5b21b6' }}
                        >
                          {load.extra.resp === 'cliente' ? 'Cargo cliente' : 'Asumido VTM'}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setTrackingId(load.id)}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap"
                      >
                        🔗 Link tracking
                      </button>
                      <button className="text-[10px] text-slate-400 hover:text-slate-600 text-left">
                        + Registrar costo
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
