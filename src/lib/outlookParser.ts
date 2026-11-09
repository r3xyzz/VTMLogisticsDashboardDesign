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

// Sinónimos por campo (ya normalizados: minúsculas, sin tildes ni signos).
// El orden importa: cada etiqueta se asigna al PRIMER campo que coincida
// (ej. "referencia dr" antes que "referencia", "disponible para retiro" antes que "retiro").
const FIELD_SYNONYMS = {
  container: ["n contenedor", "nro contenedor", "contenedor", "container", "cntr"],
  refDR: ["referencia dr", "ref dr"],
  refCronos: ["referencia cronos", "ref cronos", "referencia", "ref"],
  dAga: ["d aga", "aga", "agencia de aduana", "agente de aduana", "despachante"],
  kilos: ["kilos", "kgs", "kg", "peso bruto", "peso"],
  retiro: ["disponible para retiro", "fecha disponibilidad de carga", "fecha disponibilidad", "disponibilidad"],
  pickUp: ["pick up", "pickup", "fecha retiro", "retiro"],
  hora: ["hora presentacion", "hora de presentacion", "horario de atencion", "horario"],
  stacking: ["stacking", "recepcion de carga"],
  booking: ["booking", "bkg"],
  bl: ["bl", "b l", "hbl", "mbl", "bill of lading", "conocimiento de embarque"],
  eta: ["eta", "fecha arribo", "arribo"],
  nave: ["nave", "vessel", "buque"],
  viaje: ["viaje", "voyage"],
  ets: ["ets", "etd"],
  bodega: ["direccion de bodega", "direccion"],
} as const;

type ParsedField = keyof typeof FIELD_SYNONYMS;
// Campos que cuentan para decidir si un correo es una carga (nave/viaje/ets/bodega no bastan solos).
const CORE_FIELDS: ParsedField[] = ["container", "refDR", "refCronos", "dAga", "kilos", "retiro", "pickUp", "hora", "stacking", "booking", "bl", "eta"];
const MIN_CORE_MATCHES = 2;

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function matchField(label: string): ParsedField | null {
  const key = ` ${normalize(label)} `;
  if (key.trim().length === 0 || key.length > 70) return null;
  for (const field of Object.keys(FIELD_SYNONYMS) as ParsedField[]) {
    if (FIELD_SYNONYMS[field].some((syn) => key.includes(` ${syn} `))) return field;
  }
  return null;
}

const cellText = (el: Element) => (el.textContent || "").replace(/\s+/g, " ").trim();

// Extrae pares etiqueta/valor de tablas verticales (etiqueta | valor),
// tablas horizontales (fila de encabezados + fila de datos) y líneas "Etiqueta: valor".
function extractPairs(doc: Document): [string, string][] {
  const pairs: [string, string][] = [];
  for (const table of Array.from(doc.querySelectorAll("table"))) {
    // .rows / .cells = solo filas/celdas directas (evita mezclar tablas anidadas de Outlook)
    const rows = Array.from(table.rows).map((r) => Array.from(r.cells).map(cellText));
    for (const cells of rows) {
      if (cells.length === 2 && cells[0] && cells[1]) pairs.push([cells[0], cells[1]]);
    }
    for (let i = 0; i < rows.length - 1; i++) {
      const headers = rows[i];
      if (headers.length < 2 || headers.filter((h) => matchField(h)).length < 2) continue;
      const data = rows.slice(i + 1).find((r) => r.length === headers.length && r.some(Boolean));
      if (data) headers.forEach((h, j) => pairs.push([h, data[j]]));
      break;
    }
  }
  const text = doc.body?.textContent || "";
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([^:]{2,60}?)\s*:\s*(.+?)\s*$/);
    if (m) pairs.push([m[1], m[2]]);
  }
  return pairs;
}

export function parseTableFromEmail(body: string) {
  if (!body) return null;

  // DOMParser también sirve para cuerpos en texto plano (soporta correos reenviados)
  // Saltos de línea tras bloques para que textContent conserve las líneas "Etiqueta: valor"
  const withBreaks = body.replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "$&\n");
  const doc = new DOMParser().parseFromString(withBreaks, "text/html");
  const result = Object.fromEntries(Object.keys(FIELD_SYNONYMS).map((k) => [k, ""])) as Record<ParsedField, string>;

  for (const [label, value] of extractPairs(doc)) {
    const field = matchField(label);
    if (field && !result[field] && value) result[field] = value;
  }

  const coreMatches = CORE_FIELDS.filter((f) => result[f]).length;
  return coreMatches >= MIN_CORE_MATCHES ? result : null;
}

// "187,00" -> 187 · "18.500" -> 18500 · "18500 kg" -> 18500
export function parseKilos(raw: string): number {
  let s = raw.replace(/[^\d.,]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  return Math.round(parseFloat(s)) || 0;
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

const IMPO_WORDS = /\b(impo|importacion|import|pick ?up|desconsolidacion|arribo|eta|bl|hbl|mbl|devolucion de vacio)\b/g;
const EXPO_WORDS = /\b(expo|exportacion|export|stacking|booking|ets|etd|consolidado|matriz)\b/g;
const SUBJECT_IMPO = /\b(impo|importacion|pick ?up)\b/;
const SUBJECT_EXPO = /\b(expo|exportacion)\b/;

// Decide IMPO/EXPO. Manda el asunto: "IMPO", "Importación" o "Pick up" => impo; "EXPO"/"Exportación" => expo.
// Si el asunto no lo dice, se puntúan palabras clave del cuerpo y los campos encontrados.
export function detectOperationType(subject: string, body: string, parsed: Record<string, string>): "impo" | "expo" {
  const subj = normalize(subject);
  if (SUBJECT_IMPO.test(subj)) return "impo";
  if (SUBJECT_EXPO.test(subj)) return "expo";
  const count = (text: string, re: RegExp) => (normalize(text).match(re) || []).length;
  const text = body.replace(/<[^>]+>/g, " ");
  const impo = count(text, IMPO_WORDS) + (parsed.bl ? 2 : 0) + (parsed.eta ? 2 : 0) + (parsed.pickUp ? 2 : 0);
  const expo = count(text, EXPO_WORDS) + (parsed.booking ? 2 : 0) + (parsed.stacking ? 2 : 0) + (parsed.ets ? 2 : 0);
  return impo > expo ? "impo" : "expo";
}

export function mapEmailToOperation(email: OutlookEmailForIE): Operation | null {
  const html = email.body?.content || "";
  const parsed = parseTableFromEmail(html);
  if (!parsed) return null;

  const numericKilos = parseKilos(parsed.kilos);
  const type = detectOperationType(email.subject || "", html, parsed);
  
  // Extraemos el remitente real del cuerpo (para reenvíos)
  const realSender = extractSenderFromBody(html);
  // Si el correo es directo, usa el `from` de Graph; si es reenviado, usa el que sacamos del texto.
  const senderName = realSender.name !== "Desconocido" ? realSender.name : (email.from?.emailAddress?.name || "Desconocido");

  return {
    id: email.id, 
    type,
    client: senderName,
    owner: parsed.dAga || "Por definir",
    reference: parsed.refCronos || parsed.refDR || email.subject || "S/R",
    container: parsed.container || "S/N",
    size: "Por definir", 
    eta: parsed.eta || parsed.retiro || "Por definir",
    port: parsed.nave ? `${parsed.nave}${parsed.viaje ? ` / ${parsed.viaje}` : ""}` : "Por definir",
    origin: type === "impo" ? "Puerto" : parsed.bodega || "Depósito",
    destination: type === "impo" ? parsed.bodega || "Cliente" : "Puerto",
    driver: "Por asignar",
    plate: "—",
    status: "Standby",
    seal: "—",
    weight: `${parsed.kilos} kg`,
    deadline: parsed.pickUp ? `Pick up: ${parsed.pickUp}` : parsed.ets ? `ETS: ${parsed.ets}` : "Sin fecha",
    countdown: 2, 
    booking: parsed.booking || parsed.bl || undefined,
    shippingLine: "Por confirmar",
    bookingStatus: "Vigente",
    depot: parsed.bodega || "Por definir",
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
    steps: type === "impo"
      ? ["Arribo / BL", "Retiro full", "Entrega cliente", "Devolución vacío"]
      : ["Folio / Booking", "Retiro vacío", "Carga cliente", "Sello naviera", "Ingreso puerto"],
  };
}