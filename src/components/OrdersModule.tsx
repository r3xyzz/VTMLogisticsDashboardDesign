import type { ActiveView } from '../App'

interface Props {
  onNavigate: (v: ActiveView) => void
}

const emails = [
  {
    id: 1,
    from: 'operaciones@walmartchile.cl',
    company: 'Walmart Chile S.A.',
    subject: 'Solicitud de transporte Valparaíso → Santiago — 3 pallets',
    preview: 'Estimados, necesitamos coordinar el retiro de 3 pallets desde bodega Valparaíso el día 20 de agosto...',
    time: '09:14',
    read: false,
    urgent: true,
  },
  {
    id: 2,
    from: 'logistica@cosco.com',
    company: 'Cosco Shipping Chile',
    subject: 'Requerimiento de transporte contenedor San Antonio',
    preview: 'Buenos días, tenemos un contenedor de 20" listo para retiro en puerto San Antonio desde el lunes...',
    time: '08:42',
    read: false,
    urgent: false,
  },
  {
    id: 3,
    from: 'compras@acme.cl',
    company: 'ACME Importaciones',
    subject: 'Cotización transporte maquinaria industrial',
    preview: 'Hola VTM, necesitamos cotizar transporte de maquinaria pesada desde Santiago hacia Valparaíso...',
    time: '07:58',
    read: true,
    urgent: false,
  },
  {
    id: 4,
    from: 'supply@dhl.com',
    company: 'DHL Chile',
    subject: 'Solicitud urgente — entrega San Antonio hoy',
    preview: 'Requiero confirmación de disponibilidad para carga urgente hoy 18/08, origen Santiago, destino...',
    time: 'Ayer',
    read: true,
    urgent: true,
  },
]

export default function OrdersModule({ onNavigate }: Props) {
  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pedidos / Buzón de Correo</h1>
          <p className="text-sm text-slate-500 mt-0.5">Solicitudes entrantes de clientes — Convierta en Orden de Transporte</p>
        </div>
        <button
          onClick={() => onNavigate('cargo')}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white"
          style={{ background: '#1e4278' }}
        >
          + Nueva OT Manual
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {emails.map((email) => (
          <div key={email.id} className={`flex gap-4 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer ${!email.read ? 'bg-blue-50/30' : ''}`}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#163058' }}>
              {email.company[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`text-sm ${!email.read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{email.company}</span>
                  {email.urgent && <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">URGENTE</span>}
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{email.time}</span>
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5">{email.subject}</div>
              <div className="text-xs text-slate-400 mt-0.5 truncate">{email.preview}</div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onNavigate('cargo')}
                  className="text-[11px] font-semibold px-3 py-1 rounded border text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  Convertir en OT →
                </button>
                <button className="text-[11px] font-semibold px-3 py-1 rounded border text-slate-600 border-slate-200 hover:bg-slate-100 transition-colors">
                  Generar cotización
                </button>
                <button className="text-[11px] text-slate-400 px-2 py-1 hover:text-slate-600 transition-colors">
                  Ver correo completo
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
