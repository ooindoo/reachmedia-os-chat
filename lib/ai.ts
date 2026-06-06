import Anthropic from "@anthropic-ai/sdk";
import {
  CLIENT_NAMES, TIPI_ATTIVITA, PRIORITA,
  MESI, ANNI, STATI_PAGAMENTO, METODI_PAGAMENTO, TIPI_DOCUMENTO,
  TIPI_SESSIONE, ENERGIE, FATTURABILE_OPTS,
  STATI_TASK, BLOCCATO_DA_OPTS, APPROVAZIONE_OPTS,
} from "./clients";
import type {
  TipoAttivita, Priorita as PrioritaT,
  Mese, Anno, StatoPagamento, MetodoPagamento, TipoDocumento,
  TipoSessione, Energia, Fatturabile,
} from "./clients";
import type { TaskData } from "./notion";
import type { InvoiceData } from "./invoice";
import type { TimeLogData } from "./timelog";
import type { TaskUpdate } from "./update-task";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const today = () => new Date().toISOString().split("T")[0];
const currentMonthName = (): Mese => MESI[new Date().getMonth()];
const currentYear = (): Anno => String(new Date().getFullYear()) as Anno;

function nextWeekday(dayName: string, fromDate = new Date()): string {
  const map: Record<string, number> = {
    lunedì: 1, martedì: 2, mercoledì: 3, giovedì: 4,
    venerdì: 5, sabato: 6, domenica: 0,
  };
  const target = map[dayName.toLowerCase()];
  if (target === undefined) return today();
  let diff = target - fromDate.getDay();
  if (diff <= 0) diff += 7;
  const result = new Date(fromDate);
  result.setDate(fromDate.getDate() + diff);
  return result.toISOString().split("T")[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

export type ParsedIntent =
  | { intent: "create_task"; data: TaskData }
  | { intent: "create_invoice"; data: InvoiceData }
  | { intent: "create_timelog"; data: TimeLogData }
  | { intent: "update_task"; searchQuery: string; cliente: string; updates: TaskUpdate };

export async function parseIntent(userMessage: string): Promise<ParsedIntent> {
  const todayStr = today();

  const prompt = `Sei un assistente per l'agenzia di marketing reachmedia.it.
Analizza il messaggio e determina l'INTENT e i DATI.

Messaggio: "${userMessage}"
Oggi: ${todayStr}  |  Mese corrente: ${currentMonthName()}  |  Anno corrente: ${currentYear()}

Clienti: ${CLIENT_NAMES.join(", ")}

━━━ INTENTS ━━━
1. create_task   → nuova task (default se non è fattura/ore/aggiornamento)
2. create_invoice → fattura/ricevuta/proforma (parole: fattura, ricevuta, proforma, €, euro, importo, pagata, bonifico, emessa)
3. create_timelog → registra ore (parole: ho lavorato, ore su, sessione, traccia ore, log ore, lavorato)
4. update_task   → aggiorna task esistente (parole: segna, metti, aggiorna, fatto, completato, urgente, bloccato, approvato, done, cambia stato)

Rispondi SOLO con JSON valido (nessun testo extra).

━━━ FORMAT PER OGNI INTENT ━━━

create_task → {
  "intent":"create_task",
  "data":{
    "titolo":"...",
    "cliente":"nome esatto o ''",
    "deadline":"YYYY-MM-DD",
    "priorita":"${PRIORITA.join("|")}",
    "tipoAttivita":"${TIPI_ATTIVITA.join("|")}"
  }
}

create_invoice → {
  "intent":"create_invoice",
  "data":{
    "descrizione":"...",
    "cliente":"nome esatto o ''",
    "importoLordo":1234.56,
    "mese":"${MESI.join("|")}",
    "anno":"${ANNI.join("|")}",
    "statoPagamento":"${STATI_PAGAMENTO.join("|")}",
    "metodoPagamento":"${METODI_PAGAMENTO.join("|")}",
    "tipoDocumento":"${TIPI_DOCUMENTO.join("|")}",
    "dataEmissione":"YYYY-MM-DD",
    "dataScadenza":"YYYY-MM-DD"
  }
}

create_timelog → {
  "intent":"create_timelog",
  "data":{
    "descrizione":"...",
    "cliente":"nome esatto o ''",
    "oreLavorate":2.5,
    "data":"YYYY-MM-DD",
    "ora":"HH:MM o '' se non specificata",
    "tipoSessione":"${TIPI_SESSIONE.join("|")}",
    "energia":"${ENERGIE.join("|")}",
    "fatturabile":"${FATTURABILE_OPTS.join("|")}"
  }
}

update_task → {
  "intent":"update_task",
  "data":{
    "searchQuery":"parole chiave del titolo task",
    "cliente":"nome cliente o ''",
    "updates":{
      "stato":"${STATI_TASK.join("|")} oppure ometti",
      "priorita":"${PRIORITA.join("|")} oppure ometti",
      "bloccatoDa":"${BLOCCATO_DA_OPTS.join("|")} oppure ometti",
      "approvazioneCliente":"${APPROVAZIONE_OPTS.join("|")} oppure ometti",
      "tempoReale": numero oppure ometti,
      "deadline":"YYYY-MM-DD oppure ometti",
      "note":"testo oppure ometti"
    }
  }
}

━━━ REGOLE ━━━
- "entro venerdì/lunedì/..." → prossima occorrenza di quel giorno da oggi
- "oggi" → ${todayStr}
- "urgente" → priorità 🔴 Urgente
- "chiama/call" → tipo task 📞 Call / Meeting
- "newsletter" → tipo task 📧 Newsletter
- "fix/bug" → 🐛 Fix / Bug
- invoice: "pagata bonifico" → statoPagamento:"Pagata", metodoPagamento:"🏦 Bonifico"
- invoice: mese dal testo o corrente; anno dal testo o corrente; scadenza = emissione+30gg se non specificata
- timelog: ore come decimale (es. 3h30m→3.5); "oggi" → data odierna; default fatturabile "✅ Sì"; "alle 14" o "14:30" → ora in formato HH:MM, altrimenti ''
- update_task: negli updates includi SOLO i campi da modificare, ometti il resto
- Usa valori ESATTI con emoji dalle liste`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const block = msg.content[0];
  if (block.type !== "text") throw new Error("Risposta AI non valida");

  const match = block.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON non trovato nella risposta");

  const parsed = JSON.parse(match[0]);
  const todayDate = today();
  const dayNames = ["lunedì","martedì","mercoledì","giovedì","venerdì","sabato","domenica"];

  // ── create_task ─────────────────────────────────────────────────────────────
  if (parsed.intent === "create_task") {
    let deadline = parsed.data.deadline || todayDate;
    for (const day of dayNames) {
      if (userMessage.toLowerCase().includes(day) && deadline === todayDate) {
        deadline = nextWeekday(day); break;
      }
    }
    return {
      intent: "create_task",
      data: {
        titolo: parsed.data.titolo || "Nuova task",
        cliente: parsed.data.cliente || "",
        deadline,
        priorita: (PRIORITA as readonly string[]).includes(parsed.data.priorita)
          ? (parsed.data.priorita as PrioritaT) : "🟡 Media",
        tipoAttivita: (TIPI_ATTIVITA as readonly string[]).includes(parsed.data.tipoAttivita)
          ? (parsed.data.tipoAttivita as TipoAttivita) : "✍️ Copy / Content",
      },
    };
  }

  // ── create_invoice ──────────────────────────────────────────────────────────
  if (parsed.intent === "create_invoice") {
    const dataEmissione = parsed.data.dataEmissione || todayDate;
    return {
      intent: "create_invoice",
      data: {
        descrizione: parsed.data.descrizione || "Fattura",
        cliente: parsed.data.cliente || "",
        importoLordo: Number(parsed.data.importoLordo) || 0,
        mese: (MESI as readonly string[]).includes(parsed.data.mese)
          ? (parsed.data.mese as Mese) : currentMonthName(),
        anno: (ANNI as readonly string[]).includes(parsed.data.anno)
          ? (parsed.data.anno as Anno) : currentYear(),
        statoPagamento: (STATI_PAGAMENTO as readonly string[]).includes(parsed.data.statoPagamento)
          ? (parsed.data.statoPagamento as StatoPagamento) : "Da emettere",
        metodoPagamento: (METODI_PAGAMENTO as readonly string[]).includes(parsed.data.metodoPagamento)
          ? (parsed.data.metodoPagamento as MetodoPagamento) : "🏦 Bonifico",
        tipoDocumento: (TIPI_DOCUMENTO as readonly string[]).includes(parsed.data.tipoDocumento)
          ? (parsed.data.tipoDocumento as TipoDocumento) : "📄 Fattura",
        dataEmissione,
        dataScadenza: parsed.data.dataScadenza || addDays(dataEmissione, 30),
      },
    };
  }

  // ── create_timelog ──────────────────────────────────────────────────────────
  if (parsed.intent === "create_timelog") {
    return {
      intent: "create_timelog",
      data: {
        descrizione: parsed.data.descrizione || "Sessione di lavoro",
        cliente: parsed.data.cliente || "",
        oreLavorate: Number(parsed.data.oreLavorate) || 1,
        data: parsed.data.data || todayDate,
        ora: typeof parsed.data.ora === "string" ? parsed.data.ora : "",
        tipoSessione: (TIPI_SESSIONE as readonly string[]).includes(parsed.data.tipoSessione)
          ? (parsed.data.tipoSessione as TipoSessione) : "💻 Sviluppo",
        energia: (ENERGIE as readonly string[]).includes(parsed.data.energia)
          ? (parsed.data.energia as Energia) : "😐 Media",
        fatturabile: (FATTURABILE_OPTS as readonly string[]).includes(parsed.data.fatturabile)
          ? (parsed.data.fatturabile as Fatturabile) : "✅ Sì",
      },
    };
  }

  // ── update_task ─────────────────────────────────────────────────────────────
  if (parsed.intent === "update_task") {
    const raw = parsed.data.updates || {};
    const updates: TaskUpdate = {};
    if (raw.stato)               updates.stato = raw.stato;
    if (raw.priorita)            updates.priorita = raw.priorita;
    if (raw.bloccatoDa)          updates.bloccatoDa = raw.bloccatoDa;
    if (raw.approvazioneCliente) updates.approvazioneCliente = raw.approvazioneCliente;
    if (raw.tempoReale != null && raw.tempoReale !== "ometti") updates.tempoReale = Number(raw.tempoReale);
    if (raw.deadline && raw.deadline !== "ometti") updates.deadline = raw.deadline;
    if (raw.note && raw.note !== "ometti")         updates.note = raw.note;
    return {
      intent: "update_task",
      searchQuery: parsed.data.searchQuery || "",
      cliente: parsed.data.cliente || "",
      updates,
    };
  }

  throw new Error(`Intent non riconosciuto: ${parsed.intent}`);
}
