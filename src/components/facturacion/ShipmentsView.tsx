// src/components/facturacion/ShipmentsView.tsx
import { useMemo, useRef, useState } from "react"
import { Shipment, Doc, getShipmentDocuments, getInvoiceDocumentsForShipment, getShipmentDocStatus } from "./data"
import { Icon, DocStatusPill, ActionButton, SectionTitle, Detail } from "./ui"

export function ShipmentsView({ 
  shipments, documents, onSelect,
}: { 
  shipments: Shipment[]
  documents: Doc[]
  onSelect: (s: Shipment) => void
}) {
  const [shipmentSearch, setShipmentSearch] = useState("")

  const filteredShipments = useMemo(() => {
    const q = shipmentSearch.trim().toLowerCase()
    if (!q) return shipments
    return shipments.filter((s) =>
      [s.bl, s.dus, s.container, s.booking, s.port, s.period].join(" ").toLowerCase().includes(q)
    )
  }, [shipments, shipmentSearch])

  const duplicates = shipments.filter((s, i, arr) => arr.findIndex(x => x.container === s.container) !== i)

  return (
    <div className="p-5">
      <SectionTitle title="BL, DUS y contenedores" description="Control histórico con validación de duplicidad entre periodos." />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Icon name="search" className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={shipmentSearch}
            onChange={(e) => setShipmentSearch(e.target.value)}
            placeholder="Buscar por BL, DUS, contenedor o reserva..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
        {shipmentSearch && (
          <button onClick={() => setShipmentSearch("")} className="text-xs font-semibold text-slate-500 hover:text-slate-800 self-start sm:self-center">
            Limpiar búsqueda
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-400 self-start sm:self-center">
          {filteredShipments.length} de {shipments.length} embarques
        </span>
      </div>

      {duplicates.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex gap-3">
            <Icon name="alert" className="mt-0.5 size-5 text-amber-600" />
            <div>
              <p className="text-xs font-bold text-amber-800">{duplicates.length} coincidencias históricas detectadas</p>
              <p className="mt-1 text-[11px] text-amber-700">Algunos contenedores aparecen más de una vez.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[850px] text-left">
          <thead className="bg-slate-50">
            <tr>
              {["BL", "DUS", "Contenedor", "Reserva / Puerto", "Periodo", "Estado", "Acción"].map((h) => (
                <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredShipments.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-xs text-slate-400">
                  {shipmentSearch ? `No se encontraron embarques que coincidan con "${shipmentSearch}".` : "No hay embarques registrados."}
                </td>
              </tr>
            )}
            {filteredShipments.map((s) => {
              const docStatus = getShipmentDocStatus(s, documents)
              return (
                <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(s)}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{s.bl}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.dus}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{s.container}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-slate-700">{s.booking}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{s.port}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{s.period}</td>
                  <td className="px-4 py-3">
                    <DocStatusPill status={docStatus.status} />
                  </td>
                  <td className="px-4 py-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onSelect(s); }}
                      className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800" 
                      aria-label={`Ver ${s.container}`}
                    >
                      <Icon name="eye" />
                    </button>
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

export function ShipmentPanel({ 
  shipment, documents, uploading, onClose,
  onUploadForInvoice, onUploadForShipment, onDeleteDocument,
}: { 
  shipment: Shipment
  documents: Doc[]
  uploading: boolean
  onClose: () => void
  onUploadForInvoice: (file: File) => Promise<void>
  onUploadForShipment: (file: File) => Promise<void>
  onDeleteDocument: (doc: Doc) => void
}) {
  const invoiceDocs = getInvoiceDocumentsForShipment(shipment, documents)
  const shipmentDocs = getShipmentDocuments(shipment, documents)
  const docStatus = getShipmentDocStatus(shipment, documents)

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/30 backdrop-blur-sm" onClick={onClose}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Embarque / Contenedor</p>
              <h2 className="mt-1 font-mono text-xl font-bold text-slate-900">{shipment.container}</h2>
              <p className="mt-1 text-xs text-slate-500">BL {shipment.bl}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
              <span className="text-lg">×</span>
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <DocStatusPill status={docStatus.status} />
            <span className="text-[10px] text-slate-400">
              {docStatus.hasInvoice ? "✓" : "✗"} Factura · {docStatus.hasShipmentDoc ? "✓" : "✗"} DUS/BL
            </span>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Datos del embarque</p>
            <div className="grid grid-cols-2 gap-4">
              <Detail label="BL" value={shipment.bl} mono />
              <Detail label="DUS" value={shipment.dus || '—'} mono />
              <Detail label="Contenedor" value={shipment.container} mono />
              <Detail label="Reserva" value={shipment.booking || '—'} mono />
              <Detail label="Puerto" value={shipment.port || '—'} />
              <Detail label="Periodo" value={shipment.period || '—'} />
            </div>
          </div>

          {/* Facturas */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Facturas ({invoiceDocs.length})
              </p>
              {invoiceDocs.length > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <Icon name="check" className="size-2.5" />
                  Subida
                </span>
              )}
            </div>
            <InvoiceDropZone
              label="Arrastra o click para subir factura física"
              sublabel="Se vincula a este BL y contenedor"
              documents={invoiceDocs}
              uploading={uploading}
              onUpload={onUploadForInvoice}
              onDelete={onDeleteDocument}
            />
          </div>

          {/* Documentos del embarque */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Documentos del embarque ({shipmentDocs.length})
              </p>
              {shipmentDocs.length > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <Icon name="check" className="size-2.5" />
                  Subido
                </span>
              )}
            </div>
            <DocumentDropZone
              documents={shipmentDocs}
              onUpload={onUploadForShipment}
              onDelete={onDeleteDocument}
              uploading={uploading}
            />
          </div>

          <div className="flex gap-2 border-t border-slate-100 pt-5">
            <ActionButton variant="secondary" onClick={onClose}>Cerrar</ActionButton>
          </div>
        </div>
      </aside>
    </div>
  )
}

export function InvoiceDropZone({
  label, sublabel, documents, uploading, onUpload, onDelete,
}: {
  label: string
  sublabel?: string
  documents: Doc[]
  uploading: boolean
  onUpload: (file: File) => Promise<void>
  onDelete: (doc: Doc) => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      await onUpload(file)
    }
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition ${
          uploading
            ? "border-blue-300 bg-blue-50 cursor-wait"
            : isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <Icon name="refresh" className="size-4 text-blue-500 animate-spin" />
            <span className="text-[10px] font-semibold text-blue-700">Subiendo...</span>
          </div>
        ) : (
          <>
            <Icon name="finance" className={`mx-auto size-6 ${isDragging ? "text-blue-500" : "text-slate-400"}`} />
            <p className={`mt-1.5 text-[11px] font-semibold ${isDragging ? "text-blue-700" : "text-slate-700"}`}>
              {isDragging ? "Suelta el archivo aquí" : label}
            </p>
            {sublabel && (
              <p className="mt-0.5 text-[9px] text-slate-400">{sublabel}</p>
            )}
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ""
        }}
      />

      {documents.length > 0 && (
        <div className="rounded-xl border border-slate-200">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 border-b border-slate-100 p-3 last:border-0">
              <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 flex-shrink-0">
                <Icon name="finance" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-800">{doc.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {doc.size} · {doc.uploaded}
                </p>
              </div>
              <button
                onClick={() => onDelete(doc)}
                className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                title="Eliminar"
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DocumentDropZone({
  documents, onUpload, onDelete, uploading,
}: {
  documents: Doc[]
  onUpload: (file: File) => Promise<void>
  onDelete: (doc: Doc) => void
  uploading: boolean
}) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      await onUpload(file)
    }
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition ${
          uploading
            ? "border-blue-300 bg-blue-50 cursor-wait"
            : isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        {uploading ? (
          <>
            <Icon name="refresh" className="mx-auto size-7 text-blue-500 animate-spin" />
            <p className="mt-2 text-xs font-semibold text-blue-700">Subiendo...</p>
          </>
        ) : (
          <>
            <Icon name="document" className={`mx-auto size-7 ${isDragging ? "text-blue-500" : "text-slate-400"}`} />
            <p className={`mt-2 text-xs font-semibold ${isDragging ? "text-blue-700" : "text-slate-700"}`}>
              {isDragging ? "Suelta el archivo aquí" : "Arrastra DUS/BL o click para subir"}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              Documento propio del embarque (DUS, BL)
            </p>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ""
        }}
      />

      {documents.length > 0 && (
        <div className="rounded-xl border border-slate-200">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 border-b border-slate-100 p-3 last:border-0">
              <span className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-red-600 flex-shrink-0">
                <Icon name="file" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-800">{doc.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {doc.size} · {doc.uploaded}
                </p>
              </div>
              <button
                onClick={() => onDelete(doc)}
                className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                title="Eliminar"
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
