// src/lib/outlookParser.ts
import type { OutlookEmailForIE } from '../hooks/useOutlookForImportExport';

export type Operation = {
  id: string
  type: "impo" | "expo"
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
  status: "Standby" | "Vacío" | "Full / Cargado" | "En tránsito" | "Entregado"
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

export function parseTableFromEmail(htmlBody: string) {
  if (!htmlBody) return null;
  
  // Usamos DOMParser para leer el HTML (soporta correos reenviados)
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlBody, "text/html");
  const tables = doc.querySelectorAll("table");
  
  for (const table of Array.from(tables)) {
    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length < 2) continue;

    const headers = Array.from(rows[0].querySelectorAll("th, td")).map(el => 
      el.textContent?.trim().toLowerCase() || ""
    );
    
    // Verificamos si esta tabla es la que buscamos
    const isTargetTable = headers.some(h => h.includes("contenedor")) && 
                          headers.some(h => h.includes("booking"));
    
    if (isTargetTable) {
      const dataRow = rows[1];
      const cells = Array.from(dataRow.querySelectorAll("td")).map(el => 
        el.textContent?.trim() || ""
      );

      const getValue = (keyword: string) => {
        const index = headers.findIndex(h => h.includes(keyword));
        return index !== -1 && cells[index] ? cells[index] : "";
      };

      return {
        container: getValue("contenedor"),
        refDR: getValue("referencia dr"),
        refCronos: getValue("referencia cronos"),
        kilos: getValue("kilos"),
        retiro: getValue("disponible para retiro"),
        pickUp: getValue("pick up"),
        hora: getValue("hora presentación"),
        stacking: getValue("stacking"),
        booking: getValue("booking"),
      };
    }
  }
  return null;
}

// Función auxiliar para buscar en el texto del correo (remitentes reenviados)
function extractSenderFromBody(htmlBody: string): { name: string, email: string } {
  const text = htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  // Busca patrones como "De: Nicolas Fabres <comercial@corposeidon.com>"
  const match = text.match(/De:\s*([^<]+)\s*<([^>]+)>/i);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: "Desconocido", email: "" };
}

export function mapEmailToOperation(email: OutlookEmailForIE): Operation | null {
  const html = email.body?.content || "";
  const parsed = parseTableFromEmail(html);
  if (!parsed) return null;

  const numericKilos = parseInt(parsed.kilos.replace(/\D/g, ''), 10) || 0;
  
  // Extraemos el remitente real del cuerpo (para reenvíos)
  const realSender = extractSenderFromBody(html);
  // Si el correo es directo, usa el `from` de Graph; si es reenviado, usa el que sacamos del texto.
  const senderName = realSender.name !== "Desconocido" ? realSender.name : (email.from?.emailAddress?.name || "Desconocido");

  return {
    id: email.id, 
    type: "expo", 
    client: senderName,
    owner: "Por definir", 
    reference: parsed.refCronos || parsed.refDR || "S/R",
    container: parsed.container || "S/N",
    size: "Por definir", 
    eta: parsed.retiro || "Por definir",
    port: "Por definir", 
    origin: "Depósito",
    destination: "Puerto",
    driver: "Por asignar",
    plate: "—",
    status: "Standby",
    seal: "—",
    weight: `${parsed.kilos} kg`,
    deadline: parsed.pickUp ? `Pick up: ${parsed.pickUp}` : "Sin fecha",
    countdown: 2, 
    booking: parsed.booking,
    shippingLine: "Por confirmar",
    bookingStatus: "Vigente",
    depot: "Por definir", 
    depotCity: "Santiago",
    containerClass: "Clase A",
    assistants: 0,
    gateOut: parsed.pickUp,
    loadingAt: parsed.hora,
    stackingAt: parsed.stacking,
    truckType: "Tracto",
    truckCapacityKg: 30000,
    weightKg: numericKilos,
    earlyGateOut: false,
    stackingCollision: false,
    noStock: false,
    roleHistory: [],
    freeDays: 5,
    documents: [],
    currentStep: 0,
    steps: ["Folio / Booking", "Retiro vacío", "Carga cliente", "Sello naviera", "Ingreso puerto"],
  };
}