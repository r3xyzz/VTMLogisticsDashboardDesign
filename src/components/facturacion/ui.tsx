// src/components/facturacion/ui.tsx
import { ShipmentDocStatus } from "./data"

/* ─── Iconos ─────────────────────────────────────────────────────────────────── */

export type IconName =
  | "alert" | "arrow" | "booking" | "box" | "check" | "chevron" | "clock"
  | "document" | "download" | "eye" | "file" | "finance" | "link" | "more"
  | "plus" | "refresh" | "search" | "trash" | "upload"

export const iconPaths: Record<IconName, string[]> = {
  alert: ["M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.052 3.38c.866-1.5 3.03-1.5 3.896 0l7.355 12.746z", "M12 16.5h.008v.008H12V16.5z"],
  arrow: ["M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"],
  booking: ["M6.75 3v2.25M17.25 3v2.25M3.75 9.75h16.5", "M5.25 4.5h13.5a1.5 1.5 0 0 1 1.5 1.5v13.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5z"],
  box: ["M21 8.25 12 13.5 3 8.25M12 21V13.5", "M19.5 6.75 12 2.25 4.5 6.75v10.5L12 21l7.5-3.75V6.75z"],
  check: ["m4.5 12.75 6 6 9-13.5"],
  chevron: ["m9 18 6-6-6-6"],
  clock: ["M12 6v6h4.5", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
  document: ["M15.75 2.25H6A2.25 2.25 0 0 0 3.75 4.5v15A2.25 2.25 0 0 0 6 21h12a2.25 2.25 0 0 0 2.25-2.25V6.75L15.75 2.25z", "M15.75 2.25v4.5h4.5M8.25 12h7.5m-7.5 3h7.5"],
  download: ["M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5", "M4.5 18.75h15"],
  eye: ["M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6S2.25 12 2.25 12z", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"],
  file: ["M14.25 2.25H6.75A2.25 2.25 0 0 0 4.5 4.5v15a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V7.5l-5.25-5.25z", "M14.25 2.25V7.5h5.25"],
  finance: ["M12 6v12m3-9.75c0-1.243-1.343-2.25-3-2.25S9 7.007 9 8.25s1.343 2.25 3 2.25 3 1.007 3 2.25S13.657 15 12 15s-3-1.007-3-2.25", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
  link: ["M10.5 13.5a3 3 0 0 0 4.243 0l3-3a3 3 0 0 0-4.243-4.243l-1.5 1.5", "M13.5 10.5a3 3 0 0 0-4.243 0l-3 3a3 3 0 0 0 4.243 4.243l1.5-1.5"],
  more: ["M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z"],
  plus: ["M12 4.5v15m7.5-7.5h-15"],
  refresh: ["M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"],
  search: ["m21 21-4.35-4.35", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z"],
  trash: ["M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"],
  upload: ["M12 16.5v-12m0 0-4.5 4.5M12 4.5l4.5 4.5", "M4.5 15.75v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3"],
}

export function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      {iconPaths[name].map((path, index) => (
        <path key={index} d={path} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

export function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    Pendiente: "bg-amber-50 text-amber-700 ring-amber-200",
    Pagada: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Pagado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Procesado: "bg-blue-50 text-blue-700 ring-blue-200",
    "Con detalle": "bg-violet-50 text-violet-700 ring-violet-200",
    Vencida: "bg-red-50 text-red-700 ring-red-200",
    Final: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Inicial: "bg-slate-100 text-slate-600 ring-slate-200",
    "Timbrado y firmado": "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Respaldo: "bg-blue-50 text-blue-700 ring-blue-200",
    Emitido: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Borrador: "bg-slate-100 text-slate-500 ring-slate-200",
    Anulado: "bg-slate-900 text-white ring-slate-700",
    "En espera de SII": "bg-yellow-50 text-yellow-700 ring-yellow-200",
    "Rechazado por SII": "bg-red-100 text-red-800 ring-red-300",
    "En espera de reemisión": "bg-orange-50 text-orange-700 ring-orange-200",
    "Sin respuesta SII": "bg-orange-100 text-orange-800 ring-orange-300",
    "Reintentar emisión": "bg-orange-200 text-orange-900 ring-orange-400",
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tones[status] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{status}</span>
}

export function DocStatusPill({ status }: { status: ShipmentDocStatus }) {
  const config: Record<ShipmentDocStatus, { label: string; classes: string; icon: IconName }> = {
    sin_subir: {
      label: "Sin subir",
      classes: "bg-red-50 text-red-700 ring-red-200",
      icon: "alert",
    },
    incompleto: {
      label: "Incompleto",
      classes: "bg-amber-50 text-amber-700 ring-amber-200",
      icon: "clock",
    },
    subido: {
      label: "Subido",
      classes: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      icon: "check",
    },
  }
  const c = config[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${c.classes}`}>
      <Icon name={c.icon} className="size-3" />
      {c.label}
    </span>
  )
}

export function ActionButton({
  children, onClick, variant = "primary", type = "button", disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary" | "ghost"
  type?: "button" | "submit"
  disabled?: boolean
}) {
  const styles = {
    primary: "bg-slate-800 text-white shadow-sm hover:bg-slate-700",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
  }
  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {children}
    </button>
  )
}

export function SectionTitle({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  )
}

/* ─── Sub-componentes ────────────────────────────────────────────────────────── */

export function Metric({ label, value, detail, tone, icon, reverse }: { label: string; value: string; detail: string; tone: "blue" | "orange" | "green" | "red"; icon: IconName; reverse?: boolean }) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
        </div>
        <span className={`flex size-9 items-center justify-center rounded-lg ${toneClasses[tone]} ${reverse ? "rotate-180" : ""}`}><Icon name={icon} /></span>
      </div>
    </div>
  )
}

export function DaysPill({ days }: { days: number | null }) {
  if (days === null) return <span className="text-[10px] text-slate-400">—</span>

  let label = ""
  let classes = ""

  if (days < 0) {
    label = `${Math.abs(days)} día${Math.abs(days) !== 1 ? "s" : ""} vencida`
    classes = "bg-red-100 text-red-800 ring-red-200"
  } else if (days === 0) {
    label = "Vence hoy"
    classes = "bg-orange-100 text-orange-800 ring-orange-200"
  } else if (days <= 7) {
    label = `${days} día${days !== 1 ? "s" : ""}`
    classes = "bg-amber-100 text-amber-800 ring-amber-200"
  } else {
    label = `${days} días`
    classes = "bg-emerald-100 text-emerald-800 ring-emerald-200"
  }

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${classes}`}>
      {label}
    </span>
  )
}

export function LinkedBlock({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-800"><Icon name={icon} className="size-4 text-slate-600" />{title}</div><div className="divide-y divide-slate-100">{children}</div></div>
}

export function LinkedRow({ primary, secondary }: { primary: string; secondary: string }) {
  return <div className="py-2.5"><p className="font-mono text-xs font-semibold text-slate-700">{primary}</p><p className="mt-1 text-[10px] text-slate-400">{secondary}</p></div>
}

export function Detail({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-sm ${strong ? "font-bold text-slate-800" : "font-semibold text-slate-700"} ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  )
}

// ─── PESTAÑA CONCILIACIÓN Y CONCEPTOS ──────────────────────────────────────────
