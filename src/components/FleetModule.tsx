const fleet = [
  {
    driver: 'Carlos Vega',
    plate: 'BFLK-92',
    type: 'Camión Semi 15t',
    docs: { license: true, background: true, cv: true, permit: true, tech: true, cargo: true, vehicle: true, gps: true },
  },
  {
    driver: 'Pedro Rojas',
    plate: 'CGMN-14',
    type: 'Camión Mediano 7t',
    docs: { license: true, background: true, cv: false, permit: true, tech: true, cargo: false, vehicle: true, gps: true },
  },
  {
    driver: 'Marcelo Fuentes',
    plate: 'DHPR-67',
    type: 'Camión 3/4',
    docs: { license: true, background: false, cv: true, permit: false, tech: true, cargo: true, vehicle: true, gps: true },
  },
]

const DOC_LABELS: Record<string, string> = {
  license: 'Licencia conducir',
  background: 'Cert. antecedentes',
  cv: 'Hoja de vida',
  permit: 'Permiso circulación',
  tech: 'Revisión técnica',
  cargo: 'Seguro de carga',
  vehicle: 'Seguro vehículo',
  gps: 'GPS activo',
}

export default function FleetModule() {
  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Flota y Cumplimiento</h1>
        <p className="text-sm text-slate-500 mt-0.5">Estándar minero — Checklists de habilitación de vehículos y conductores</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {fleet.map(unit => {
          const total = Object.keys(unit.docs).length
          const ok = Object.values(unit.docs).filter(Boolean).length
          const pct = Math.round((ok / total) * 100)
          const color = pct === 100 ? '#16a34a' : pct >= 75 ? '#ea580c' : '#dc2626'

          return (
            <div key={unit.plate} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100" style={{ background: '#050f1c' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white text-sm font-bold">{unit.driver}</div>
                    <div className="font-mono text-blue-300 text-xs">{unit.plate} · {unit.type}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold" style={{ color }}>{pct}%</div>
                    <div className="text-[10px] text-slate-400">{ok}/{total} docs</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
              <div className="p-4 space-y-2">
                {Object.entries(unit.docs).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">{DOC_LABELS[key]}</span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded"
                      style={val ? { background: '#f0fdf4', color: '#16a34a' } : { background: '#fef2f2', color: '#dc2626' }}
                    >
                      {val ? '✓ OK' : '✗ Falta'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
