// src/components/facturacion/BookingsView.tsx
import { Shipment, Doc, getShipmentDocStatus } from "./data"
import { Icon, DocStatusPill, ActionButton, SectionTitle } from "./ui"

export function BookingsView({ 
  query, setQuery, shipments, documents,
}: { 
  query: string
  setQuery: (v: string) => void
  shipments: Shipment[]
  documents: Doc[]
}) {
  const q = query.trim().toLowerCase()

  const matchedShipments = shipments.filter((s) =>
    s.booking.toLowerCase() === q ||
    s.bl.toLowerCase() === q ||
    s.container.toLowerCase() === q
  )

  const matchedDocuments = documents.filter(d => {
    if (!d.fileUrl) return false
    return matchedShipments.some(s => 
      d.linkedId === s.id ||
      (d.bl && d.bl === s.bl) ||
      (d.booking && d.booking === s.booking) ||
      (d.container && d.container === s.container)
    )
  })

  const docsByShipment = matchedShipments.map(s => {
    const docs = matchedDocuments.filter(d => 
      d.linkedId === s.id ||
      (d.bl && d.bl === s.bl) ||
      (d.booking && d.booking === s.booking) ||
      (d.container && d.container === s.container)
    )
    return { shipment: s, documents: docs, docStatus: getShipmentDocStatus(s, documents) }
  })

  const hasResults = matchedShipments.length > 0

  return (
    <div className="p-5">
      <SectionTitle title="Consulta de reservas" description="Busca un SAI BOOK, BL o contenedor para desplegar sus documentos." />
      <div className="mt-5 flex max-w-xl gap-2">
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 font-mono text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200" 
            placeholder="Ej. SB-10482 · BL-CL-84801 · COSU-9104420" 
          />
        </div>
        <ActionButton>Consultar</ActionButton>
      </div>

      {hasResults ? (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-800 p-4 text-white">
            <span className="flex size-10 items-center justify-center rounded-lg bg-white/10">
              <Icon name="booking" className="size-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm font-bold">{query}</p>
              <p className="mt-1 text-[11px] text-slate-300">
                {matchedShipments.length} embarque{matchedShipments.length !== 1 ? "s" : ""} · {matchedDocuments.length} documento{matchedDocuments.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {docsByShipment.map(({ shipment, documents: sDocs, docStatus }) => (
            <div key={shipment.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon name="box" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-bold text-slate-800">{shipment.container}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    BL {shipment.bl} · DUS {shipment.dus} · {shipment.booking}
                  </p>
                </div>
                <DocStatusPill status={docStatus.status} />
              </div>

              {sDocs.length === 0 ? (
                <div className="p-6 text-center">
                  <Icon name="file" className="mx-auto size-7 text-slate-300" />
                  <p className="mt-2 text-[11px] text-slate-400">
                    Sin documentos subidos para este embarque.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                      <span className={`flex size-9 items-center justify-center rounded-lg flex-shrink-0 ${
                        doc.linkedType === "invoice" 
                          ? "bg-emerald-50 text-emerald-600" 
                          : "bg-red-50 text-red-600"
                      }`}>
                        <Icon name={doc.linkedType === "invoice" ? "finance" : "file"} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-800">{doc.name}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {doc.linkedType === "invoice" ? "Factura física" : "Doc. embarque"}
                          {" · "}{doc.size} · {doc.uploaded}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ring-inset flex-shrink-0 ${
                        doc.linkedType === "invoice"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-red-50 text-red-700 ring-red-200"
                      }`}>
                        {doc.linkedType === "invoice" ? "Factura" : "Embarque"}
                      </span>
                      {doc.fileUrl && (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800 flex-shrink-0"
                          title="Ver documento"
                        >
                          <Icon name="eye" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-500">
          No hay vínculos para "{query}". Prueba con un booking, BL o contenedor existente.
        </div>
      )}
    </div>
  )
}
