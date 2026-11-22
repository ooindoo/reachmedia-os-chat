/**
 * Claude agent for the Telegram bot: turns a short message into calendar
 * actions through 4 wrapped tools (create, search, update, delete).
 * Claude picks area, reminder category, date and time; the code computes
 * calendars, reminder minutes and durations, and enforces the rules.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  AREAS, AREA_KEYS, BOT_MODEL, CATEGORIE, TIPI_ATTIVITA,
  isArea, isCategoria, isTipoAttivita, type Area,
} from "./config";
import { createEvent, deleteEvent, patchEvent, searchEvents, nextTiming, type FoundEvent } from "./calendar";
import { createFromDraft, planFromDraft } from "./actions";
import { getActiveClients, updateTaskDeadline } from "./notion";
import type { Azione, Draft } from "./log";
import { formatDayShort, nowRome, shiftDate, weekdayIt } from "../tz";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MAX_TURNS = 8;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM = `Sei l'assistente agenda di reachmedia OS. Ricevi da Telegram messaggi brevi, anche banali ("calcetto venerdì alle 20", "chiamare Sandro domani alle 11"), e li metti nel posto giusto usando i tool. Rispondi sempre in italiano.

COSA FARE
- Tutto ciò che ha una data diventa un evento con crea_evento. Se il messaggio contiene più cose con una data, crea un evento per ciascuna.
- Date relative ("venerdì", "domani", "tra due giorni", "entro il 31 gennaio") si calcolano rispetto a OGGI indicato nel messaggio (timezone Europe/Rome). Usa la tabella dei prossimi giorni. Un giorno della settimana indica la sua prossima occorrenza; oggi stesso solo se l'orario non è già passato. "Entro il X" = evento il giorno X. Se l'anno manca, usa la prossima occorrenza futura.
- Orario: se il messaggio non indica un'ora precisa, passa ora null: il sistema chiederà l'ora all'utente con dei bottoni. Non fare domande tu e non inventare l'ora.
- Durata: quella indicata nel messaggio, altrimenti 30 minuti.
- Titolo: breve e chiaro, senza data né ora (es. "Calcetto", "Chiamare Sandro", "Campagna NL Squale SA", "Pagare bollo auto"). Per il lavoro clienti includi il nome del cliente.

AREA (decide il calendario: conta l'area, non il tipo di cosa)
- chiamate_lavoro: chiamate e call di lavoro (clienti, fornitori, collaboratori). Una chiamata a un nome sconosciuto va qui, salvo quando dal messaggio è chiaramente personale (familiari, amici, cene): allora va in personale.
- lavoro_clienti: lavoro per i clienti: campagne, newsletter (NL), flow, consegne, setup, report, sviluppo, copy.
- burocrazia_soldi: tasse, commercialista, multe, pagamenti, bollette, bollo, banca, documenti, avvocato.
- airbnb: check-in, check-out, ospiti, pulizie, proprietario dell'appartamento.
- personale: sport, amici, famiglia, casa, svago, salute, appuntamenti personali.
Una chiamata non di lavoro va nell'area del suo argomento (es. chiamata all'avvocato → burocrazia_soldi).

CATEGORIA PROMEMORIA
- chiamata: qualsiasi chiamata o call, in qualunque area.
- personale: appuntamento o evento personale.
- pratica: pratica personale o amministrativa (pagamenti, documenti, mail burocratiche).
- scadenza_lavoro: scadenze e consegne di lavoro, campagne NL.
- airbnb: check-in, check-out e cose Airbnb.

APPUNTAMENTO O COSA DA FARE (campo tipo, in qualunque area)
- appuntamento: qualcosa a orario fisso che succede comunque, con altre persone o in un posto: calcetto, cena, sport, visita, call/riunione/incontro già fissato con qualcuno ("call con Luxyt alle 10"), check-in e check-out Airbnb. Solo evento in calendario.
- cosa_da_fare: un'azione che devi completare tu, anche se ha giorno e ora: inserire ospiti, fatture, pagamenti, newsletter, campagne, report, setup, pratiche, documenti, mail. Evento in calendario + task Notion, che resta visibile finché non viene segnata come fatta. Una telefonata che devi fare tu ("chiamare X") non è un incontro concordato con l'altra persona.
- Se non è chiaro, scegli cosa_da_fare: meglio una task in più che una cosa persa.
cliente: nome esatto dalla lista clienti attivi se riguarda un cliente (es. "Squale" → "Squale SA"), altrimenti null.
tipo_attivita: solo per cosa_da_fare, il valore della lista che descrive meglio l'attività; null se nessuno è adatto.

INFORMAZIONI MANCANTI
Se manca un'informazione indispensabile (cosa fare, oppure la data) usa chiedi_informazione con una domanda breve e non creare nulla per quella richiesta. In promemoria scrivi la frase che il sistema userà se l'utente passa ad altro, nel formato "<cosa> è rimasto senza <informazione>: me la dici?" (es. "Ross1000 è rimasto senza data: me la dici?"). Se manca solo l'ora non chiedere: passa ora null (il sistema mostra i bottoni).

DOMANDA IN SOSPESO
Se nella conversazione hai già fatto una domanda, chiama sempre domanda_in_sospeso per dire se il nuovo messaggio è la risposta. Il nuovo messaggio può essere:
- la risposta: unisci la risposta alla richiesta originale e completa l'azione (es. "Inserire gli ospiti su Ross1000" + "domani alle 10" → un solo evento con quel titolo, domani alle 10:00). Se manca ancora qualcosa, chiedi di nuovo.
- una richiesta nuova e scollegata (descrive un'altra cosa da fare): gestisci solo il nuovo messaggio e ignora del tutto la richiesta in sospeso, senza mescolarle e senza creare niente per quella.

MODIFICARE O ELIMINARE
Usa prima cerca_eventi, poi modifica_evento o elimina_evento con l'event_id trovato. Se più eventi corrispondono e non è chiaro quale, non toccare nulla e rispondi elencandoli in breve.

RISPOSTA FINALE
Il sistema mostra già all'utente il riepilogo delle azioni eseguite. Dopo i tool rispondi con una sola riga breve, o niente se non serve. Se il messaggio non contiene nulla da fare, rispondi in una riga.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "crea_evento",
    description:
      "Crea un evento nel calendario dell'area indicata; per una cosa da fare crea anche la task Notion. Se manca l'ora passa ora null: il sistema la chiede all'utente.",
    input_schema: {
      type: "object",
      properties: {
        titolo: { type: "string", description: "Titolo breve, senza data né ora" },
        area: { type: "string", enum: AREA_KEYS },
        data: { type: "string", description: "YYYY-MM-DD" },
        ora: { type: ["string", "null"], description: "HH:MM (24h) oppure null se il messaggio non indica l'ora" },
        durata_minuti: { type: "integer", description: "Durata in minuti, 30 se non indicata" },
        categoria_promemoria: { type: "string", enum: [...CATEGORIE] },
        cliente: { type: ["string", "null"], description: "Nome esatto dalla lista clienti attivi, oppure null" },
        tipo: {
          type: "string",
          enum: ["appuntamento", "cosa_da_fare"],
          description: "appuntamento = solo calendario; cosa_da_fare = calendario + task Notion. Se non è chiaro: cosa_da_fare",
        },
        tipo_attivita: {
          type: ["string", "null"],
          enum: [...TIPI_ATTIVITA, null],
          description: "Solo per cosa_da_fare: il tipo più adatto, null se nessuno è adatto",
        },
        note: { type: ["string", "null"], description: "Dettagli utili dal messaggio, oppure null" },
      },
      required: [
        "titolo", "area", "data", "ora", "durata_minuti", "categoria_promemoria",
        "cliente", "tipo", "tipo_attivita", "note",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "cerca_eventi",
    description: "Cerca eventi nei calendari delle aree in un intervallo di date. Restituisce event_id, titolo, data, ora.",
    input_schema: {
      type: "object",
      properties: {
        testo: { type: ["string", "null"], description: "Parole da cercare nel titolo/descrizione, oppure null" },
        da: { type: "string", description: "YYYY-MM-DD, inizio intervallo" },
        a: { type: "string", description: "YYYY-MM-DD, fine intervallo (inclusa)" },
        area: { type: ["string", "null"], enum: [...AREA_KEYS, null] },
      },
      required: ["testo", "da", "a", "area"],
      additionalProperties: false,
    },
  },
  {
    name: "modifica_evento",
    description:
      "Modifica un evento trovato con cerca_eventi: titolo, data, ora, durata, area. Passa null per ciò che non cambia. Il cambio di area elimina e ricrea l'evento nel nuovo calendario.",
    input_schema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        nuovo_titolo: { type: ["string", "null"] },
        nuova_data: { type: ["string", "null"], description: "YYYY-MM-DD" },
        nuova_ora: { type: ["string", "null"], description: "HH:MM" },
        nuova_durata_minuti: { type: ["integer", "null"] },
        nuova_area: { type: ["string", "null"], enum: [...AREA_KEYS, null] },
        categoria_promemoria: { type: ["string", "null"], enum: [...CATEGORIE, null] },
      },
      required: [
        "event_id", "nuovo_titolo", "nuova_data", "nuova_ora",
        "nuova_durata_minuti", "nuova_area", "categoria_promemoria",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "chiedi_informazione",
    description:
      "Fa una domanda all'utente quando manca un'informazione indispensabile (cosa fare o la data). Non creare nulla per quella richiesta finché l'utente non risponde.",
    input_schema: {
      type: "object",
      properties: {
        domanda: { type: "string", description: "Domanda breve in italiano" },
        promemoria: {
          type: "string",
          description: "Frase breve per ricordare la richiesta se l'utente passa ad altro, es. \"Ross1000 è rimasto senza data: me la dici?\"",
        },
      },
      required: ["domanda", "promemoria"],
      additionalProperties: false,
    },
  },
  {
    name: "domanda_in_sospeso",
    description:
      "Da chiamare solo quando sopra c'è una tua domanda ancora senza risposta: indica se il nuovo messaggio è la risposta a quella domanda (true) oppure una richiesta nuova e scollegata (false).",
    input_schema: {
      type: "object",
      properties: { e_la_risposta: { type: "boolean" } },
      required: ["e_la_risposta"],
      additionalProperties: false,
    },
  },
  {
    name: "elimina_evento",
    description: "Elimina un evento trovato con cerca_eventi. La task Notion collegata, se c'è, non viene toccata.",
    input_schema: {
      type: "object",
      properties: { event_id: { type: "string" } },
      required: ["event_id"],
      additionalProperties: false,
    },
  },
];

async function contextBlock(): Promise<string> {
  const now = nowRome();
  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = shiftDate(now.date, i);
    days.push(`${weekdayIt(d)} ${d}${i === 0 ? " (oggi)" : i === 1 ? " (domani)" : ""}`);
  }
  const clients = await getActiveClients().catch(() => []);
  return [
    `OGGI: ${weekdayIt(now.date)} ${now.date}, ore ${now.time} (Europe/Rome).`,
    `Prossimi giorni: ${days.join("; ")}.`,
    `Clienti attivi: ${clients.map((c) => c.nome).join(", ") || "(nessuno)"}.`,
  ].join("\n");
}

// ── Tool execution ────────────────────────────────────────────────────────────

export interface AgentResult {
  azioni: Azione[];
  bozze: Draft[];
  /** Real failures (Composio, Notion...), not input validation errors. */
  errori: string[];
  /** Question for the user when information is missing (nothing was created for it). */
  domanda: string | null;
  /** Reminder sentence for that question, used if the user moves on ("… me la dici?"). */
  promemoria: string | null;
  /** With a pending question: did this message answer it? null = no pending question. */
  rispostaSospeso: boolean | null;
  testo: string;
}

/** Previous turns of a conversation still waiting for the user's answer. */
export interface StoriaTurno {
  ruolo: "utente" | "bot";
  testo: string;
}

class ToolInputError extends Error {}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Input = Record<string, any>;

interface RunState {
  /** Dry run: decide everything, write nothing (no Composio, no Notion writes). */
  dryRun: boolean;
  azioni: Azione[];
  bozze: Draft[];
  errori: string[];
  domanda: string | null;
  promemoria: string | null;
  /** True when the conversation includes a pending bot question. */
  haSospeso: boolean;
  rispostaSospeso: boolean | null;
  found: Map<string, FoundEvent>;
}

async function runTool(name: string, input: Input, st: RunState): Promise<string> {
  switch (name) {
    case "crea_evento": {
      const titolo = str(input.titolo);
      const data = str(input.data);
      const ora = str(input.ora);
      if (!titolo) throw new ToolInputError("titolo mancante");
      if (!isArea(input.area)) throw new ToolInputError("area non valida");
      if (!data || !DATE_RE.test(data)) throw new ToolInputError("data non valida, usa YYYY-MM-DD");
      if (ora && !TIME_RE.test(ora)) throw new ToolInputError("ora non valida, usa HH:MM");
      if (!isCategoria(input.categoria_promemoria)) throw new ToolInputError("categoria_promemoria non valida");
      const draft: Draft = {
        titolo,
        area: input.area,
        data,
        ora,
        durataMinuti: Number.isFinite(input.durata_minuti) ? Number(input.durata_minuti) : 30,
        categoria: input.categoria_promemoria,
        cliente: str(input.cliente),
        tipoAttivita: isTipoAttivita(input.tipo_attivita) ? input.tipo_attivita : null,
        // Only an explicit "appuntamento" skips the task: when unclear it is a cosa da fare.
        creaTaskNotion: input.tipo !== "appuntamento",
        note: str(input.note),
      };
      if (!ora) {
        st.bozze.push(draft);
        return "Evento in attesa dell'ora: il sistema chiederà l'ora all'utente con i bottoni. Non fare domande.";
      }
      const azioni = st.dryRun ? await planFromDraft(draft, ora) : await createFromDraft(draft, ora);
      st.azioni.push(...azioni);
      const ev = azioni.find((a) => a.tipo === "evento_creato");
      const withTask = ev?.tipo === "evento_creato" && Boolean(ev.taskUrl);
      return `Creato evento in ${AREAS[draft.area].label}${withTask ? " con task Notion." : "."}`;
    }

    case "cerca_eventi": {
      const da = str(input.da);
      const a = str(input.a);
      if (!da || !DATE_RE.test(da) || !a || !DATE_RE.test(a)) throw new ToolInputError("intervallo date non valido");
      if (st.dryRun) return "Nessun evento trovato (prova senza scritture).";
      const results = await searchEvents({ testo: str(input.testo), da, a, area: isArea(input.area) ? input.area : null });
      for (const r of results) st.found.set(r.eventId, r);
      if (!results.length) return "Nessun evento trovato.";
      return JSON.stringify(
        results.slice(0, 30).map((r) => ({
          event_id: r.eventId, titolo: r.titolo, area: r.area, data: r.data, ora: r.ora,
          fine: r.fineOra, categoria: r.categoria,
        }))
      );
    }

    case "modifica_evento": {
      const ev = st.found.get(String(input.event_id));
      if (!ev) throw new ToolInputError("event_id sconosciuto: usa prima cerca_eventi");
      const nuovaData = str(input.nuova_data);
      const nuovaOra = str(input.nuova_ora);
      if (nuovaData && !DATE_RE.test(nuovaData)) throw new ToolInputError("nuova_data non valida");
      if (nuovaOra && !TIME_RE.test(nuovaOra)) throw new ToolInputError("nuova_ora non valida");
      const changes = {
        titolo: str(input.nuovo_titolo) ?? undefined,
        data: nuovaData ?? undefined,
        ora: nuovaOra ?? undefined,
        durataMinuti: Number.isFinite(input.nuova_durata_minuti) ? Number(input.nuova_durata_minuti) : undefined,
        categoria: isCategoria(input.categoria_promemoria) ? input.categoria_promemoria : undefined,
      };
      const nuovaArea: Area | null = isArea(input.nuova_area) && input.nuova_area !== ev.area ? input.nuova_area : null;

      if (nuovaArea) {
        // Never move between calendars: create in the new one, then delete the old one.
        const t = nextTiming(ev, changes);
        const categoria = changes.categoria ?? ev.categoria;
        if (!categoria) throw new ToolInputError("serve categoria_promemoria per ricreare l'evento in un'altra area");
        const created = await createEvent({
          area: nuovaArea, titolo: changes.titolo ?? ev.titolo, data: t.data, ora: t.ora,
          durataMinuti: t.durata, categoria, descrizione: ev.descrizione,
          notionPageId: ev.notionPageId ?? undefined,
        });
        await deleteEvent(ev.calendarId, ev.eventId);
        if (ev.notionPageId && (t.data !== ev.data || t.ora !== ev.ora)) {
          await updateTaskDeadline(ev.notionPageId, t.data, t.ora).catch(() => {});
        }
        st.found.delete(ev.eventId);
        st.azioni.push({
          tipo: "evento_ricreato", daArea: ev.area, area: nuovaArea, prima: ev,
          calendarId: created.calendarId, eventId: created.eventId, titolo: created.titolo,
          data: created.data, ora: created.ora, fineOra: created.fineOra,
        });
        return `Evento ricreato in ${AREAS[nuovaArea].label} (nuovo event_id ${created.eventId}), vecchio eliminato.`;
      }

      const r = await patchEvent(ev, changes);
      if (ev.notionPageId && r.timingChanged) {
        await updateTaskDeadline(ev.notionPageId, r.data, r.ora).catch(() => {});
      }
      st.azioni.push({
        tipo: "evento_modificato", area: ev.area, calendarId: ev.calendarId, eventId: ev.eventId,
        prima: ev, titolo: r.titolo, data: r.data, ora: r.ora, fineOra: r.fineOra,
      });
      return `Evento modificato: ${r.titolo}, ${formatDayShort(r.data)} ${r.ora}–${r.fineOra}.`;
    }

    case "chiedi_informazione": {
      const domanda = str(input.domanda);
      if (!domanda) throw new ToolInputError("domanda mancante");
      st.domanda = domanda;
      st.promemoria = str(input.promemoria);
      return "Domanda registrata: verrà inviata all'utente. Non creare nulla per questa richiesta e non aggiungere altro testo.";
    }

    case "domanda_in_sospeso": {
      if (!st.haSospeso) return "Nessuna domanda in sospeso: ignora.";
      st.rispostaSospeso = input.e_la_risposta === true;
      return st.rispostaSospeso
        ? "Ok: unisci la risposta alla richiesta originale."
        : "Ok: gestisci solo il nuovo messaggio, la richiesta in sospeso verrà ricordata dal sistema.";
    }

    case "elimina_evento": {
      const ev = st.found.get(String(input.event_id));
      if (!ev) throw new ToolInputError("event_id sconosciuto: usa prima cerca_eventi");
      await deleteEvent(ev.calendarId, ev.eventId);
      st.found.delete(ev.eventId);
      st.azioni.push({ tipo: "evento_eliminato", area: ev.area, calendarId: ev.calendarId, eventId: ev.eventId, prima: ev });
      return "Evento eliminato.";
    }

    default:
      throw new ToolInputError(`tool sconosciuto: ${name}`);
  }
}

// ── Loop ──────────────────────────────────────────────────────────────────────

export async function runAgent(
  text: string,
  opts: { dryRun?: boolean; storia?: StoriaTurno[] } = {}
): Promise<AgentResult> {
  // A pending exchange (user request → bot question) goes first as real turns,
  // so Claude can tell whether the new message answers it or is a new request.
  const storia = opts.storia ?? [];
  const st: RunState = {
    dryRun: opts.dryRun === true, azioni: [], bozze: [], errori: [],
    domanda: null, promemoria: null, haSospeso: storia.length > 0, rispostaSospeso: null, found: new Map(),
  };
  const messages: Anthropic.MessageParam[] = storia.map((t) => ({
    role: t.ruolo === "utente" ? ("user" as const) : ("assistant" as const),
    content: t.ruolo === "utente" ? `MESSAGGIO: ${t.testo}` : t.testo,
  }));
  const nota = storia.length
    ? "\n(Sopra c'è una tua domanda ancora senza risposta: questo messaggio può essere la risposta oppure una richiesta nuova.)"
    : "";
  messages.push({ role: "user", content: `${await contextBlock()}${nota}\n\nMESSAGGIO: ${text}` });

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: BOT_MODEL,
      max_tokens: 8000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      output_config: { effort: "medium" },
      messages,
    });

    if (response.stop_reason === "refusal") {
      return { ...st, testo: "Non posso gestire questo messaggio." };
    }

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const testo = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { ...st, testo };
    }

    // Keep the full assistant content (thinking blocks included) in the history.
    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      try {
        const out = await runTool(tu.name, tu.input as Input, st);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
      } catch (err) {
        if (!(err instanceof ToolInputError)) st.errori.push(`${tu.name}: ${(err as Error).message}`);
        results.push({
          type: "tool_result", tool_use_id: tu.id, is_error: true,
          content: err instanceof ToolInputError ? `Input non valido: ${err.message}` : `Errore: ${(err as Error).message}`,
        });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { ...st, testo: "" };
}
