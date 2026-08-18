const docs = [
  { id: 'OT-2440', client: 'Lider Express', route: 'Santiago → Valparaíso', date: '18 Ago 2026', pod: true, guide: true, invoiced: true },
  { id: 'OT-2438', client: 'Walmart Chile', route: 'Valparaíso → Santiago', date: '17 Ago 2026', pod: true, guide: false, invoiced: false },
  { id: 'OT-2435', client: 'DHL Chile', route: 'San Antonio → Santiago', date: '15 Ago 2026', pod: false, guide: true, invoiced: false },
  { id: 'OT-2430', client: 'Cosco Shipping', route: 'Valparaíso → San Antonio', date: '12 Ago 2026', pod: false, guide: false, invoiced: false },
]

const Semaphore = ({ ok }: { ok: boolean }) => (
  <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: ok ? '#16a34a' : '#ea580c' }}>
    <span className="w-2 h-2 rounded-full" style={{ background: ok ? '#16a34a' : '#ea580c' }} />
    {ok ? 'OK' : 'Pendiente'}
  </span>
)

export default function DocumentsModule() {
  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">POD / Documentos y Cierre</h1>
        <p className="text-sm text-slate-500 mt-0.5">Pruebas de entrega, guías de despacho y estado de liquidación</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['OT', 'Cliente', 'Ruta', 'Fecha', 'POD Firmado', 'Guía Despacho', 'Facturado', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {docs.map(doc => (
              <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">{doc.id}</td>
                <td className="px-4 py-3 text-xs font-medium text-slate-700">{doc.client}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{doc.route}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{doc.date}</td>
                <td className="px-4 py-3"><Semaphore ok={doc.pod} /></td>
                <td className="px-4 py-3"><Semaphore ok={doc.guide} /></td>
                <td className="px-4 py-3"><Semaphore ok={doc.invoiced} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="text-[10px] font-semibold text-blue-600 hover:text-blue-800">Subir POD</button>
                    <button className="text-[10px] text-slate-400 hover:text-slate-600">Ver docs</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
