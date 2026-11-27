// src/components/facturacion/DocumentsView.tsx
import { Doc } from "./data"
import { Icon, SectionTitle } from "./ui"

export function DocumentsView({ documents, onDelete }: { documents: Doc[]; onDelete: (doc: Doc) => void }) {
  const validDocs = documents.filter(d => d.fileUrl)
  
  const grouped = validDocs.reduce((acc, doc) => {
    let key: string
    if (doc.linkedType === "invoice") {
      key = `Factura · ${doc.bl || doc.booking || "Sin relación"}`
    } else if (doc.linkedType === "shipment" && doc.bl) {
      key = `Embarque · ${doc.bl}`
    } else {
      key = doc.relation || "Sin relación"
    }
    if (!acc[key]) acc[key] = []
    acc[key].push(doc)
    return acc
  }, {} as Record<string, Doc[]>)

  const totalGroups = Object.keys(grouped).length

  return (
    <div className="p-5">
      <SectionTitle 
        title="Repositorio documental" 
        description={`${validDocs.length} documento${validDocs.length !== 1 ? "s" : ""} en ${totalGroups} relación${totalGroups !== 1 ? "es" : ""}`}
      />
      
      {validDocs.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-8">Sin documentos en el repositorio.</p>
      )}
      
      <div className="mt-5 space-y-6">
        {Object.entries(grouped).map(([relation, docs]) => (
          <div key={relation}>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="link" className="size-3.5 text-slate-400" />
              <p className="font-mono text-[11px] font-bold text-slate-600">{relation}</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                {docs.length}
              </span>
            </div>
            <div className="grid gap-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-4 rounded-xl border border-slate-200 p-3 hover:border-slate-300 hover:bg-slate-50">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-red-600 flex-shrink-0">
                    <Icon name="file" className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{d.name}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {d.size} · {d.uploaded}
                      {d.booking && ` · ${d.booking}`}
                      {d.container && ` · ${d.container}`}
                    </p>
                  </div>
                  {d.fileUrl && (
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                      title="Ver documento"
                    >
                      <Icon name="eye" />
                    </a>
                  )}
                  <button
                    onClick={() => onDelete(d)}
                    className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Eliminar"
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
