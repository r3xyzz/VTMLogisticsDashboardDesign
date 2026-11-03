// src/lib/demoData.ts

// ── 1. TIPOS (exportados para usarlos en el módulo) ──────────────────────────
export type OperationType = "impo" | "expo"
export type OperationStatus = "Standby" | "Vacío" | "Full / Cargado" | "En tránsito" | "Entregado"
export type Section = "operations" | "inbox" | "providers"
export type IconName = "alert" | "anchor" | "arrow" | "calendar" | "check" | "chevron" | "clock" | "container" | "document" | "mail" | "money" | "search" | "ship" | "truck" | "user"

export type Operation = {
  id: string
  type: OperationType
  client: string
  owner: string
  reference: string
  container: string
  size: string
  eta: string
  port: string
  origin: string
  destination: string
  driver: string
  plate: string
  status: OperationStatus
  seal: string
  weight: string
  deadline: string
  countdown: number
  booking?: string
  shippingLine?: string
  bookingStatus?: "Vigente" | "Roleado / Aplazado"
  depot?: string
  depotCity?: string
  containerClass?: "Clase A" | "Clase M"
  assistants?: number
  gateOut?: string
  loadingAt?: string
  stackingAt?: string
  truckType?: string
  truckCapacityKg?: number
  weightKg?: number
  noStock?: boolean
  earlyGateOut?: boolean
  stackingCollision?: boolean
  roleHistory?: string[]
  freeDays?: number
  provider?: string
  documents: string[]
  currentStep: number
  steps: string[]
}

// ── 2. DATOS DE OPERACIONES (Hardcodeados de ejemplo) ────────────────────────
export const operationsSeed: Operation[] = [
  { 
    id: "1", type: "impo", client: "Kuehne+Nagel", owner: "Bosch Chile", reference: "BL-MSCU882104", 
    container: "MSCU-882104-7", size: "1 × 40' HC", eta: "26 ago · 06:00", port: "San Antonio", 
    origin: "Puerto Central", destination: "CD Lo Boza, Pudahuel", driver: "Carlos Ramírez", 
    plate: "JTRK-82", status: "Standby", seal: "MSC-908821", weight: "18.420 kg", 
    deadline: "ETA en 3 días", countdown: 3, freeDays: 5, 
    documents: ["BL_MSCU882104.pdf", "Guía despacho.pdf"], 
    currentStep: 0, steps: ["Arribo nave", "Retiro puerto", "Entrega cliente", "Devolución vacío"] 
  },
  { 
    id: "2", type: "expo", client: "Kronos Logistics", owner: "Makita", reference: "EXP-CL-240831", 
    container: "MRKU-441280-1", size: "1 × 40' STD", eta: "31 ago · 22:00", port: "Valparaíso", 
    origin: "Depósito San Bernardo", destination: "TPS Valparaíso", driver: "Miguel Soto", 
    plate: "KLPR-19", status: "Vacío", seal: "Pendiente carga", weight: "12.800 kg est.", 
    deadline: "Stacking abre en 2 días", countdown: 2, booking: "MAEU-2988401", 
    shippingLine: "Maersk", bookingStatus: "Vigente", depot: "Contopsa", depotCity: "Santiago", 
    containerClass: "Clase A", assistants: 1, gateOut: "04 nov · 06:30", loadingAt: "04 nov · 09:00", 
    stackingAt: "05 nov · 08:00", truckType: "Tracto + semirremolque", truckCapacityKg: 28000, 
    weightKg: 12800, earlyGateOut: false, stackingCollision: false, noStock: false, roleHistory: [], 
    freeDays: 5, documents: ["Booking_MAEU.pdf", "Correo programación.eml"], 
    currentStep: 1, steps: ["Folio / Booking", "Retiro vacío", "Carga cliente", "Sello naviera", "Ingreso puerto"] 
  },
  { 
    id: "3", type: "impo", client: "DSV Air & Sea", owner: "Komatsu", reference: "BL-HLCU771908", 
    container: "HLCU-771908-3", size: "1 × 20' OT", eta: "Hoy · 14:30", port: "Valparaíso", 
    origin: "ZEAL", destination: "Quilicura, Santiago", driver: "Alejandro Pérez", 
    plate: "PLRW-44", status: "En tránsito", seal: "HLC-77201", weight: "21.600 kg", 
    deadline: "Entrega hoy · 18:00", countdown: 0, provider: "Transportes Andinos", freeDays: 4, 
    documents: ["BL_HLCU.pdf", "DIN_771908.pdf"], 
    currentStep: 2, steps: ["Arribo nave", "Retiro puerto", "Entrega cliente", "Devolución vacío"] 
  },
  { 
    id: "4", type: "expo", client: "Eculine Chile", owner: "3M Chile", reference: "BOOK-045887", 
    container: "TCLU-610244-9", size: "2 × 40' HC", eta: "02 sep · 08:00", port: "San Antonio", 
    origin: "Sitrans San Bernardo", destination: "Puerto Central", driver: "Por asignar", 
    plate: "—", status: "Standby", seal: "—", weight: "24.200 kg est.", 
    deadline: "Cierre documental en 6 días", countdown: 6, booking: "MSCU-045887", 
    shippingLine: "MSC", bookingStatus: "Roleado / Aplazado", depot: "Sitrans", depotCity: "San Bernardo", 
    containerClass: "Clase A", assistants: 2, gateOut: "05 nov · 07:00", loadingAt: "05 nov · 10:30", 
    stackingAt: "07 nov · 00:01", truckType: "Tracto + rampla 40'", truckCapacityKg: 23000, 
    weightKg: 24200, earlyGateOut: false, stackingCollision: true, noStock: true, 
    roleHistory: ["Roleo 28 oct: nave aplazada 48 h", "Booking anterior MSCU-038210"], freeDays: 6, 
    documents: ["Booking_MSCU.pdf", "Packing list.xlsx", "Correo roleo.eml"], 
    currentStep: 0, steps: ["Folio / Booking", "Retiro vacío", "Carga cliente", "Sello naviera", "Ingreso puerto"] 
  },
  { 
    id: "5", type: "impo", client: "Kuehne+Nagel", owner: "Siemens", reference: "BL-ONEY334015", 
    container: "ONEY-334015-2", size: "1 × 40' RF", eta: "29 ago · 11:00", port: "San Antonio", 
    origin: "DP World", destination: "Lampa, Santiago", driver: "Rodrigo Muñoz", 
    plate: "HRPK-63", status: "Full / Cargado", seal: "ONE-33219", weight: "16.980 kg", 
    deadline: "ETA en 6 días", countdown: 6, freeDays: 5, documents: ["BL_ONEY.pdf"], 
    currentStep: 1, steps: ["Arribo nave", "Retiro puerto", "Entrega cliente", "Devolución vacío"] 
  },
  { 
    id: "6", type: "expo", client: "Expeditors", owner: "Nestlé", reference: "EXP-2908-NES", 
    container: "CMAU-221098-4", size: "1 × 20' STD", eta: "28 ago · 19:00", port: "Valparaíso", 
    origin: "Curauma", destination: "TPS Valparaíso", driver: "Pedro Rojas", 
    plate: "CGMN-14", status: "Full / Cargado", seal: "CMA-81002", weight: "9.640 kg", 
    deadline: "Stacking cierra mañana", countdown: 1, booking: "CMA-882190", 
    shippingLine: "CMA CGM", bookingStatus: "Vigente", depot: "Agunsa", depotCity: "Valparaíso", 
    containerClass: "Clase M", assistants: 0, gateOut: "06 nov · 16:00", loadingAt: "07 nov · 08:00", 
    stackingAt: "07 nov · 18:00", truckType: "Camión portacontenedor 20'", truckCapacityKg: 18000, 
    weightKg: 9640, earlyGateOut: true, stackingCollision: false, noStock: false, roleHistory: [], 
    freeDays: 5, documents: ["Booking_CMA.pdf", "Guía_8831.pdf"], 
    currentStep: 3, steps: ["Folio / Booking", "Retiro vacío", "Carga cliente", "Sello naviera", "Ingreso puerto"] 
  },
]

// ── 3. DATOS DE CORREOS (Para la vista "Correo procesado") ───────────────────
export const emailsSeed = [
  { id: 1, from: "operations.cl@kuehne-nagel.com", company: "Kuehne+Nagel", subject: "Prealerta importación MSCU882104 — ETA 26/08", time: "09:42", type: "impo" as const, extracted: ["BL MSCU882104", "1×40 HC", "ETA 26/08", "San Antonio"], status: "Procesado" },
  { id: 2, from: "export@kronos.cl", company: "Kronos Logistics", subject: "Booking MAEU-2988401 / Retiro vacío Makita", time: "08:16", type: "expo" as const, extracted: ["Booking MAEU-2988401", "1×40 STD", "Makita", "Valparaíso"], status: "Revisar" },
  { id: 3, from: "docs@dsv.com", company: "DSV Air & Sea", subject: "Liberación HLCU771908 — documentos adjuntos", time: "Ayer", type: "impo" as const, extracted: ["BL HLCU771908", "1×20 OT", "Komatsu", "ZEAL"], status: "Procesado" },
]

// ── 4. DATOS DE PROVEEDORES (Para la vista "Proveedores y margen") ───────────
export const providersSeed = [
  { name: "Transportes Andinos", service: "BL-HLCU771908", clientRate: 485000, providerRate: 352000, margin: 133000, payment: "Crédito 30 días", due: "18 sep" },
  { name: "Logística Costa Central", service: "EXP-2908-NES", clientRate: 420000, providerRate: 315000, margin: 105000, payment: "Crédito 15 días", due: "05 sep" },
  { name: "Carga Express Chile", service: "BL-ONEY334015", clientRate: 510000, providerRate: 389000, margin: 121000, payment: "Crédito 30 días", due: "22 sep" },
]