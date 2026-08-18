import { useState } from 'react'

/* ─── Config ─────────────────────────────────────────────────────────────────── */

const ROUTES = [
  { label: 'Valparaíso → Santiago',  dist: 120, toll: 4200, litres: 28 },
  { label: 'Santiago → San Antonio', dist: 100, toll: 2800, litres: 22 },
  { label: 'Valparaíso → San Antonio',dist: 65, toll: 1800, litres: 16 },
  { label: 'San Antonio → Santiago', dist: 100, toll: 2800, litres: 22 },
  { label: 'Santiago → Valparaíso',  dist: 120, toll: 4200, litres: 28 },
]

const TRUCKS = [
  { label: 'Camión 3/4 — 3.5 t',  cap: 3500,  fuelRate: 10, rate: 45000 },
  { label: 'Camión Mediano — 7 t', cap: 7000,  fuelRate: 14, rate: 72000 },
  { label: 'Camión Semi — 15 t',   cap: 15000, fuelRate: 20, rate: 120000 },
  { label: 'Camión Full — 28 t',   cap: 28000, fuelRate: 28, rate: 190000 },
]

const PKGS = ['Cajas', 'Cajón', 'Pallets', 'Bultos', 'Carga General', 'Carga Refrigerada', 'Maquinaria', 'Contenedor 20"', 'Contenedor 40"']
const CITIES = ['Valparaíso', 'Santiago', 'San Antonio', 'Viña del Mar', 'Quilpué', 'Pudahuel', 'Lo Espejo', 'Rancagua']

const DIESEL_CLP = 1090 // CLP per litre

const clp = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function Lbl({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return (
    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
      {children}{req && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] text-slate-800 bg-white placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-colors'

function Card({ title, icon, children, accent }: { title: string; icon: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
      <div
        className="flex items-center gap-2.5 px-5 py-3"
        style={{ borderBottom: '1px solid #f1f5f9', background: accent ? 'linear-gradient(90deg,#060d1a,#102040)' : '#f8fafc' }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{ background: accent ? 'rgba(37,88,160,0.3)' : '#e2e8f0' }}
        >
          <svg className="w-3.5 h-3.5" style={{ color: accent ? '#93c5fd' : '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={icon} />
          </svg>
        </div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent ? 'white' : '#374151' }}>
          {title}
        </h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function CostLine({ label, value, note, bold, highlight }: { label: string; value: string; note?: string; bold?: boolean; highlight?: 'green' | 'orange' | 'blue' }) {
  const bgMap = { green: '#f0fdf4', orange: '#fff7ed', blue: '#eff6ff' }
  const cMap  = { green: '#15803d', orange: '#c2410c', blue: '#1e4278' }
  return (
    <div
      className="flex items-start justify-between py-2"
      style={highlight ? { background: bgMap[highlight], borderRadius: 8, padding: '8px 12px', margin: '0 -12px' } : {}}
    >
      <div>
        <span className={`text-[12px] ${bold ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>{label}</span>
        {note && <div className="text-[10px] text-slate-400">{note}</div>}
      </div>
      <span
        className={`font-mono text-[12px] font-bold ml-4 flex-shrink-0`}
        style={{ color: highlight ? cMap[highlight] : bold ? '#0f172a' : '#374151' }}
      >
        {value}
      </span>
    </div>
  )
}

/* ─── Main ─────────────────────────────────────────────────────────────────── */

export default function CargoRegistration() {
  const [f, setF] = useState({
    client: '', contact: '', origin: '', destination: '',
    routeIdx: 0, truckIdx: 0,
    pkg: 'Cajas', qty: '', kg: '',
    l: '', a: '', h: '',
    mode: 'propia' as 'propia' | 'sub',
    subCost: '', notes: '', priority: 'normal' as 'normal' | 'urgente',
    saved: false,
  })

  const set = <K extends keyof typeof f>(k: K, v: typeof f[K]) => setF(p => ({ ...p, [k]: v }))

  const route = ROUTES[f.routeIdx]
  const truck = TRUCKS[f.truckIdx]

  const vol = f.l && f.a && f.h
    ? parseFloat(f.l) * parseFloat(f.a) * parseFloat(f.h) / 1_000_000
    : 0
  const qty = parseInt(f.qty) || 1
  const kg = parseFloat(f.kg) || 0
  const overweight = kg > truck.cap

  const litres    = route.litres * truck.fuelRate
  const dieselCst = litres * DIESEL_CLP
  const tollCst   = route.toll
  const laborCst  = 18000
  const opCost    = dieselCst + tollCst + laborCst
  const revenue   = truck.rate
  const grossMargin = revenue - opCost

  const subBase  = parseFloat(f.subCost) || 0
  const margin20 = subBase * 0.2
  const subTotal = subBase + margin20

  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    set('saved', true)
    setTimeout(() => set('saved', false), 4000)
  }

  return (
    <div className="min-h-full">
      {/* Top bar */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6 h-14"
        style={{ background: 'rgba(248,250,252,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e2e8f0' }}
      >
        <div>
          <h1 className="text-[15px] font-bold text-slate-900 leading-none">Registro de Carga · Cotizador</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Nueva Orden de Transporte — complete los datos del servicio</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">OT-2451</span>
          <button
            type="button"
            onClick={() => set('priority', f.priority === 'urgente' ? 'normal' : 'urgente')}
            className="text-[11px] font-bold px-3 py-1 rounded-lg border transition-all"
            style={f.priority === 'urgente'
              ? { background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5' }
              : { background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}
          >
            {f.priority === 'urgente' ? '🔴 Urgente' : '🟢 Normal'}
          </button>
        </div>
      </header>

      {f.saved && (
        <div className="mx-5 mt-4 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
          <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[12px] font-semibold text-green-700">OT-2451 registrada y cotización enviada al cliente.</span>
        </div>
      )}

      <form onSubmit={handle}>
        <div className="p-5 max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

            {/* ── Left (2/3) ── */}
            <div className="xl:col-span-2 space-y-4">

              {/* 1. Cliente */}
              <Card title="Datos del Cliente" icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <Lbl req>Empresa / Cliente</Lbl>
                    <input className={inp} placeholder="Ej: Walmart Chile S.A." value={f.client} onChange={e => set('client', e.target.value)} required />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Lbl>Contacto / Email</Lbl>
                    <input className={inp} placeholder="nombre@empresa.cl" value={f.contact} onChange={e => set('contact', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Lbl>Notas u observaciones</Lbl>
                    <textarea className={inp + ' resize-none'} rows={2} placeholder="Instrucciones de acceso, horarios de recepción, contacto en destino..." value={f.notes} onChange={e => set('notes', e.target.value)} />
                  </div>
                </div>
              </Card>

              {/* 2. Ruta */}
              <Card title="Origen · Destino · Ruta" icon="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <Lbl req>Origen</Lbl>
                    <select className={inp} value={f.origin} onChange={e => set('origin', e.target.value)} required>
                      <option value="">Seleccionar ciudad...</option>
                      {CITIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl req>Destino</Lbl>
                    <select className={inp} value={f.destination} onChange={e => set('destination', e.target.value)} required>
                      <option value="">Seleccionar ciudad...</option>
                      {CITIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Lbl>Ruta estimada</Lbl>
                    <select className={inp} value={f.routeIdx} onChange={e => set('routeIdx', +e.target.value)}>
                      {ROUTES.map((r, i) => <option key={i} value={i}>{r.label} — {r.dist} km</option>)}
                    </select>
                  </div>
                </div>

                {/* Route stats strip */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Distancia', value: `${route.dist} km` },
                    { label: `Diésel est. (${truck.label.split('—')[0].trim()})`, value: `${litres} L` },
                    { label: 'Peajes aprox.', value: clp(route.toll) },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{s.label}</div>
                      <div className="font-mono text-[13px] font-bold text-slate-800">{s.value}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 3. Carga */}
              <Card title="Detalle de Carga" icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Lbl req>Tipo de bulto</Lbl>
                    <select className={inp} value={f.pkg} onChange={e => set('pkg', e.target.value)}>
                      {PKGS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl req>Cantidad (unidades)</Lbl>
                    <input type="number" min="1" className={inp} placeholder="0" value={f.qty} onChange={e => set('qty', e.target.value)} required />
                  </div>
                  <div>
                    <Lbl req>Peso total (kg)</Lbl>
                    <div className="relative">
                      <input type="number" min="1" className={inp + (overweight && f.kg ? ' border-red-300 focus:border-red-400 focus:ring-red-300/30' : '')} placeholder="0" value={f.kg} onChange={e => set('kg', e.target.value)} required />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">kg</span>
                    </div>
                    {overweight && f.kg && (
                      <p className="text-[10px] text-red-600 mt-1 font-semibold">⚠ Excede capacidad del camión seleccionado ({truck.cap.toLocaleString()} kg)</p>
                    )}
                  </div>
                  <div>
                    <Lbl>Dimensiones por bulto (cm)</Lbl>
                    <div className="flex items-center gap-1.5">
                      <input type="number" className={inp + ' text-center'} placeholder="L" value={f.l} onChange={e => set('l', e.target.value)} />
                      <span className="text-slate-300 text-sm font-bold flex-shrink-0">×</span>
                      <input type="number" className={inp + ' text-center'} placeholder="A" value={f.a} onChange={e => set('a', e.target.value)} />
                      <span className="text-slate-300 text-sm font-bold flex-shrink-0">×</span>
                      <input type="number" className={inp + ' text-center'} placeholder="H" value={f.h} onChange={e => set('h', e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Volume badge */}
                {vol > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                      <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      <div>
                        <div className="text-[9px] font-bold text-blue-600 uppercase tracking-wide">Vol. por bulto</div>
                        <div className="font-mono text-[13px] font-bold text-blue-800">{vol.toFixed(3)} m³</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5">
                      <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 20h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <div className="text-[9px] font-bold text-indigo-600 uppercase tracking-wide">Vol. total ({qty} uds.)</div>
                        <div className="font-mono text-[13px] font-bold text-indigo-800">{(vol * qty).toFixed(3)} m³</div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* 4. Asignación */}
              <Card title="Modo de Asignación" icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4">
                {/* Toggle */}
                <div className="flex gap-3 mb-4">
                  {(['propia', 'sub'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set('mode', m)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold border-2 transition-all"
                      style={f.mode === m
                        ? { background: '#eff6ff', color: '#163358', borderColor: '#3b82f6' }
                        : { background: 'white', color: '#94a3b8', borderColor: '#e2e8f0' }}
                    >
                      <span>{m === 'propia' ? '🚛' : '🤝'}</span>
                      {m === 'propia' ? 'Flota Propia VTM' : 'Subcontratación (3°)'}
                    </button>
                  ))}
                </div>

                {f.mode === 'propia' ? (
                  <div>
                    <Lbl>Tipo de camión</Lbl>
                    <select className={inp} value={f.truckIdx} onChange={e => set('truckIdx', +e.target.value)}>
                      {TRUCKS.map((t, i) => (
                        <option key={i} value={i}>{t.label} — Tarifa {clp(t.rate)}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      Capacidad: <span className="font-mono font-semibold text-slate-600">{truck.cap.toLocaleString()} kg</span>
                      {f.kg && !overweight && (
                        <span className="ml-2 text-green-600 font-semibold">✓ Dentro del límite</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <div>
                    <Lbl req>Costo del proveedor (CLP, neto)</Lbl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[12px] font-mono">$</span>
                      <input
                        type="number"
                        className={inp + ' pl-7'}
                        placeholder="0"
                        value={f.subCost}
                        onChange={e => set('subCost', e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      Margen VTM del <span className="font-semibold text-blue-600">20%</span> aplicado automáticamente.
                    </p>
                  </div>
                )}
              </Card>
            </div>

            {/* ── Right (1/3): Cost panel ── */}
            <div className="space-y-4">
              <div className="sticky top-16 space-y-4">
                {/* Cost summary */}
                <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                  {/* Dark header */}
                  <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg,#060d1a,#102040)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-[13px] font-bold text-white">Resumen de Costos</h3>
                      <span className="text-[10px] font-mono text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded">OT-2451</span>
                    </div>
                    <p className="text-[10px] text-blue-300/70">Estimación operativa · Modo: {f.mode === 'propia' ? 'Flota Propia' : 'Subcontrato'}</p>
                  </div>

                  <div className="px-5 py-4 space-y-0 divide-y divide-slate-50">
                    {f.mode === 'propia' ? (
                      <>
                        <CostLine label="Consumo diésel" value={clp(dieselCst)} note={`${litres} L × $${DIESEL_CLP}/L`} />
                        <CostLine label="Peajes" value={clp(tollCst)} note={route.label.split(' → ')[0]} />
                        <CostLine label="Mano de obra / viático" value={clp(laborCst)} />
                        <CostLine label="Costo operativo total" value={clp(opCost)} bold />
                        <div className="pt-3 pb-1">
                          <CostLine label="Tarifa al cliente" value={clp(revenue)} note={truck.label} />
                        </div>
                        <div className="pt-2">
                          <CostLine
                            label={grossMargin >= 0 ? 'Margen bruto estimado' : 'Déficit estimado'}
                            value={clp(Math.abs(grossMargin))}
                            note={`${revenue > 0 ? Math.abs(Math.round((grossMargin / revenue) * 100)) : 0}% del total`}
                            bold
                            highlight={grossMargin >= 0 ? 'green' : 'orange'}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <CostLine label="Costo proveedor (base)" value={subBase > 0 ? clp(subBase) : '—'} />
                        <CostLine label="Margen VTM (20%)" value={margin20 > 0 ? clp(margin20) : '—'} />
                        <div className="pt-2">
                          <CostLine label="Total cotización" value={subTotal > 0 ? clp(subTotal) : '—'} bold />
                        </div>
                        {margin20 > 0 && (
                          <div className="pt-2">
                            <CostLine label="Ganancia VTM" value={clp(margin20)} bold highlight="blue" />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Info strip */}
                  <div className="mx-5 mb-4 grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Ruta</div>
                      <div className="text-[10px] font-semibold text-slate-700 mt-0.5">{route.label}</div>
                    </div>
                    {f.mode === 'propia' && (
                      <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Camión</div>
                        <div className="text-[10px] font-semibold text-slate-700 mt-0.5">{truck.label.split('—')[0].trim()}</div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="px-5 pb-5 space-y-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                      style={{ background: 'linear-gradient(135deg,#163358,#2558a0)' }}
                    >
                      Registrar OT y Cotizar
                    </button>
                    <button
                      type="button"
                      className="w-full py-2 rounded-xl text-[12px] font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                    >
                      Guardar borrador
                    </button>
                    <button
                      type="button"
                      className="w-full py-2 rounded-xl text-[12px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      ✉ Enviar cotización al cliente
                    </button>
                  </div>
                </div>

                {/* Pre-dispatch checklist */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Checklist pre-despacho</h4>
                  {[
                    { label: 'Chofer asignado', done: false },
                    { label: 'Camión disponible', done: false },
                    { label: 'Guía de despacho', done: false },
                    { label: 'Documentos de carga', done: false },
                    { label: 'GPS activo en unidad', done: true },
                    { label: 'Seguro de carga vigente', done: true },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2.5 py-1.5" style={{ borderBottom: '1px solid #f8fafc' }}>
                      <div
                        className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all"
                        style={item.done ? { background: '#16a34a', borderColor: '#16a34a' } : { borderColor: '#d1d5db' }}
                      >
                        {item.done && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[12px] text-slate-600">{item.label}</span>
                      <span className="ml-auto text-[10px] font-bold" style={{ color: item.done ? '#16a34a' : '#94a3b8' }}>
                        {item.done ? 'OK' : 'Pdte.'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
