// src/lib/outlookParser.ts
import type { OutlookEmailForIE } from '../hooks/useOutlookForImportExport';

export type CargoMode = "fcl" | "lcl"

export type Operation = {
  id: string
  type: "impo" | "expo"
  cargoMode?: CargoMode // FCL = carga de contenedor · LCL = carga suelta
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
  countdown?: number // días hasta el carguío/retiro; se calcula con la fecha real (sin fecha: undefined)
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
  // Conversación de Outlook: un mensaje por entrada, del más antiguo al más nuevo
  thread?: ThreadMessage[]
}

export type ThreadMessage = { id: string; date: string; from: string; snippet: string; status?: Operation["status"] }

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
  // Solo para distinguir FCL/LCL (no cuentan para decidir si es carga)
  tipoCarga: ["tipo de carga", "tipo carga", "modalidad"],
  bultos: ["cantidad de bultos", "n bultos", "bultos"],
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

// Todos los campos reconocidos en un cuerpo (vacíos si no aparecen), sin exigir mínimo
export function extractFields(body: string): Record<ParsedField, string> {
  const result = Object.fromEntries(Object.keys(FIELD_SYNONYMS).map((k) => [k, ""])) as Record<ParsedField, string>;
  if (!body) return result;

  // DOMParser también sirve para cuerpos en texto plano (soporta correos reenviados)
  // Saltos de línea tras bloques para que textContent conserve las líneas "Etiqueta: valor"
  const withBreaks = body.replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "$&\n");
  const doc = new DOMParser().parseFromString(withBreaks, "text/html");

  for (const [label, value] of extractPairs(doc)) {
    const field = matchField(label);
    if (field && !result[field] && value) result[field] = value;
  }
  return result;
}

const isCargo = (fields: Record<ParsedField, string>) => CORE_FIELDS.filter((f) => fields[f]).length >= MIN_CORE_MATCHES;

export function parseTableFromEmail(body: string) {
  const result = extractFields(body);
  return isCargo(result) ? result : null;
}

const htmlToText = (html: string) =>
  html.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// Estado según lo que dice un mensaje del hilo (orden: gana el estado más avanzado que aparezca)
const STATUS_WORDS: [Operation["status"], RegExp][] = [
  ["Entregado", /\b(entregad[oa]s?|descargad[oa]s?|recepcionad[oa]s?|carga recibida|recibid[oa]s? conforme|pod firmado)\b/],
  ["En tránsito", /\b(en transito|en ruta|en camino|despachad[oa]s?|ya salio)\b/],
  ["Full / Cargado", /\b(cargad[oa]s?|carga lista|contenedor full|sellad[oa]s?)\b/],
  ["Vacío", /\b(vacio retirado|retiro de vacio realizado|retiramos (el )?vacio)\b/],
];
// shortcut: palabras clave sin negación ("no ha sido entregado" cuenta como entregado); si molesta, usar reglas por frase
export function detectStatus(text: string): Operation["status"] | null {
  const t = normalize(text);
  return STATUS_WORDS.find(([, re]) => re.test(t))?.[0] ?? null;
}

// Agrupa los correos por conversación de Outlook (sin conversationId: cada correo es su propia conversación)
export function groupByConversation(emails: OutlookEmailForIE[]): OutlookEmailForIE[][] {
  const groups = new Map<string, OutlookEmailForIE[]>();
  for (const email of emails) {
    const key = email.conversationId || email.id;
    groups.set(key, [...(groups.get(key) || []), email]);
  }
  return Array.from(groups.values());
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
  // Outlook escribe "De: Nombre &lt;correo&gt;": se decodifican las entidades antes de buscar
  const text = htmlBody.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
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

// N° de contenedor ISO 6346: 4 letras + 7 dígitos (ej. MSCU 123456-7)
const CONTAINER_NUMBER = /\b[A-Z]{4}\s*-?\s*\d{6}\s*-?\s*\d\b/i;
// Tamaños de contenedor: 20' / 40 HC / 40DV / 45 pies...
const CONTAINER_SIZE = /\b(20|40|45)\s*(st|dv|dc|hc|hq|rf|nor|ft|pies)\b|\b(20|40|45)\s*'/i;

// FCL (contenedor) o LCL (carga suelta).
// Orden de decisión:
//   1. Campo "Tipo de carga" / "Modalidad" de la tabla.
//   2. Mención explícita en el hilo, del mensaje MÁS NUEVO al más antiguo (el último que lo dice manda):
//      LCL: "LCL", "carga suelta", "consolidado/a", "desconsolidación", "less than container", "bultos/pallets sueltos"
//      FCL: "FCL", "FLC" (error de tipeo común), "full container", "contenedor completo/full/de 20/40", "carga en contenedor"
//   3. Señales indirectas: n° o tamaño de contenedor => FCL; la palabra "contenedor" => FCL; bultos sin contenedor => LCL.
const LCL_EXPLICIT = /\b(lcl|carga suelta|cargas sueltas|consolidad[oa]s?|carga consolidada|desconsolidacion|less than (a )?container( load)?|(bultos|pallets|cajas) sueltos?)\b/
const FCL_EXPLICIT = /\b(fcl|flc|full container( load)?|contenedor (completo|full|lleno|de (20|40|45))|contenedores (completos|de (20|40|45))|carga (en|de) contenedor|en contenedor(es)? (de )?(20|40|45))\b/
const FCL_WEAK = /\b(contenedor(es)?|container(s)?|cntr)\b/

function explicitMode(text: string): CargoMode | null {
  const t = normalize(text)
  const lcl = LCL_EXPLICIT.test(t)
  const fcl = FCL_EXPLICIT.test(t)
  return lcl === fcl ? null : lcl ? "lcl" : "fcl"
}

export function detectCargoMode(subject: string, text: string, parsed: Record<string, string>, messagesNewestFirst: string[] = []): CargoMode {
  const tipo = normalize(parsed.tipoCarga || "");
  if (/\blcl\b|suelta|consolidad/.test(tipo)) return "lcl";
  if (/\bfcl\b|\bflc\b|contenedor|full/.test(tipo)) return "fcl";
  // El mensaje más nuevo que lo diga explícitamente manda (la conversación puede corregir el tipo)
  for (const message of messagesNewestFirst) {
    const mode = explicitMode(message)
    if (mode) return mode
  }
  const fromAll = explicitMode(`${subject} ${text}`)
  if (fromAll) return fromAll
  if (CONTAINER_NUMBER.test(parsed.container || "") || CONTAINER_SIZE.test(`${subject} ${text}`)) return "fcl";
  if (FCL_WEAK.test(normalize(`${subject} ${text}`))) return "fcl";
  if (parsed.bultos) return "lcl";
  return parsed.container ? "fcl" : "lcl";
}

// Para fichas guardadas antes de existir cargoMode
export const cargoModeOf = (op: Pick<Operation, "cargoMode" | "container" | "size">): CargoMode =>
  op.cargoMode ?? (CONTAINER_NUMBER.test(op.container || "") || CONTAINER_SIZE.test(op.size || "") ? "fcl" : "lcl");

export function mapEmailToOperation(email: OutlookEmailForIE): Operation | null {
  return mapConversationToOperation([email]);
}

// Lee TODOS los mensajes de la conversación, del más antiguo al más nuevo:
// lo nuevo de cada mensaje (uniqueBody) actualiza los campos; el cuerpo completo solo rellena los que falten.
export function mapConversationToOperation(messages: OutlookEmailForIE[]): Operation | null {
  const ordered = [...messages].sort((a, b) => a.receivedDateTime.localeCompare(b.receivedDateTime));
  const parsed = extractFields("");
  let status: Operation["status"] = "Standby";
  let html = "";
  const thread: ThreadMessage[] = [];

  for (const message of ordered) {
    const full = message.body?.content || "";
    const fresh = message.uniqueBody?.content || full;
    const fromFull = extractFields(full);
    const fromFresh = fresh === full ? fromFull : extractFields(fresh);
    for (const key of Object.keys(parsed) as ParsedField[]) {
      if (fromFresh[key]) parsed[key] = fromFresh[key];
      else if (!parsed[key] && fromFull[key]) parsed[key] = fromFull[key];
    }
    if (!html && isCargo(fromFull)) html = full; // mensaje base con la tabla (remitente real del reenvío)
    const freshText = htmlToText(fresh);
    const messageStatus = detectStatus(freshText);
    if (messageStatus) status = messageStatus;
    thread.push({
      id: message.id,
      date: message.receivedDateTime,
      from: message.from?.emailAddress?.name || message.from?.emailAddress?.address || "Desconocido",
      snippet: freshText.slice(0, 220),
      status: messageStatus ?? undefined,
    });
  }
  if (!isCargo(parsed)) return null;
  const email = ordered[0];
  if (!html) html = email.body?.content || "";
  const allText = ordered.map((m) => htmlToText(m.uniqueBody?.content || m.body?.content || "")).join(" ");

  const numericKilos = parseKilos(parsed.kilos);
  // Si el asunto no dice IMPO/EXPO, manda lo que escribió quien reenvió el adjunto ("EXPOS.")
  const subjectNorm = normalize(email.subject || "");
  const subjectDecides = SUBJECT_IMPO.test(subjectNorm) || SUBJECT_EXPO.test(subjectNorm);
  const hint = ordered.find((message) => message.typeHint)?.typeHint;
  const type = !subjectDecides && hint ? hint : detectOperationType(email.subject || "", allText, parsed);
  // Asunto + lo nuevo de cada mensaje, del más reciente al más antiguo
  const messagesNewestFirst = [...ordered].reverse().map((m, index, list) => `${index === list.length - 1 ? m.subject || "" : ""} ${htmlToText(m.uniqueBody?.content || m.body?.content || "")}`)
  const cargoMode = detectCargoMode(email.subject || "", allText, parsed, messagesNewestFirst);

  // Extraemos el remitente real del cuerpo (para reenvíos)
  const realSender = extractSenderFromBody(html);
  // Si el correo es directo, usa el `from` de Graph; si es reenviado, usa el que sacamos del texto.
  const senderName = realSender.name !== "Desconocido" ? realSender.name : (email.from?.emailAddress?.name || "Desconocido");

  return {
    id: email.conversationId || email.id, // estable aunque lleguen mensajes nuevos al hilo
    type,
    cargoMode,
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
    status,
    seal: "—",
    weight: parsed.kilos ? `${parsed.kilos} kg` : "—",
    deadline: parsed.pickUp ? `Pick up: ${parsed.pickUp}` : parsed.ets ? `ETS: ${parsed.ets}` : "Sin fecha",
    booking: parsed.booking || parsed.bl || undefined,
    bookingStatus: "Vigente",
    depot: parsed.bodega || "Por definir",
    gateOut: parsed.pickUp,
    loadingAt: parsed.hora,
    stackingAt: parsed.stacking,
    weightKg: numericKilos,
    earlyGateOut: false,
    stackingCollision: false,
    noStock: false,
    roleHistory: [],
    documents: [],
    currentStep: 0,
    steps: type === "impo"
      ? ["Arribo / BL", "Retiro full", "Entrega cliente", "Devolución vacío"]
      : ["Folio / Booking", "Retiro vacío", "Carga cliente", "Sello naviera", "Ingreso puerto"],
    thread,
  };
}

// --- FECHA Y HORA DE CARGUÍO ---
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// "06/11/2026", "06-11", "6 de Noviembre", "12 Nov" -> Date (sin año: año de `ref`, o el siguiente si quedó muy atrás)
export function parseLoadingDate(text: string | undefined, ref: Date): Date | null {
  if (!text) return null;
  text = text.replace(/\d{1,2}:\d{2}/g, " "); // quita horas ("08:00-12:00") para no leerlas como fecha
  const t = normalize(text);
  let day: number, month: number, year: number | undefined;
  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  const named = t.match(/\b(\d{1,2}) (?:de )?(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*(?: (?:de )?(\d{4}))?/);
  if (numeric) {
    [day, month] = [Number(numeric[1]), Number(numeric[2])];
    if (numeric[3]) year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
  } else if (named) {
    day = Number(named[1]);
    month = MONTHS.indexOf(named[2] === "set" ? "sep" : named[2]) + 1;
    if (named[3]) year = Number(named[3]);
  } else return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year ?? ref.getFullYear(), month - 1, day);
  // Fin de año: un "05/01" leído en diciembre es del año siguiente
  if (year === undefined && ref.getTime() - date.getTime() > 180 * 86_400_000) date.setFullYear(date.getFullYear() + 1);
  return date;
}

// "08:00", "8:30 hrs", "12.00 Hrs" -> "08:00"
export function parseLoadingTime(text: string | undefined): string | null {
  const m = text?.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/) ?? text?.match(/\b([01]?\d|2[0-3])\.([0-5]\d)\s*h/i);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Día del carguío: hora de presentación, si no Pick up, si no fecha de retiro/ETA. Hora: de la presentación.
export function loadingSchedule(op: Operation, ref: Date): { key: string | null; date: Date | null; time: string | null } {
  const date = parseLoadingDate(op.loadingAt, ref) ?? parseLoadingDate(op.gateOut, ref) ?? parseLoadingDate(op.eta, ref);
  const time = parseLoadingTime(op.loadingAt) ?? parseLoadingTime(op.gateOut);
  return { key: date ? dayKey(date) : null, date, time };
}
