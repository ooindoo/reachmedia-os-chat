import Anthropic from "@anthropic-ai/sdk";
import { CLIENT_NAMES, TIPI_ATTIVITA, PRIORITA } from "./clients";
import type { TipoAttivita, Priorita } from "./clients";
import type { TaskData } from "./notion";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const today = () => new Date().toISOString().split("T")[0];

function nextWeekday(dayName: string): string {
  const days: Record<string, number> = {
    lunedì: 1,
    martedì: 2,
    mercoledì: 3,
    giovedì: 4,
    venerdì: 5,
    sabato: 6,
    domenica: 0,
  };
  const target = days[dayName.toLowerCase()];
  if (target === undefined) return today();
  const now = new Date();
  const currentDay = now.getDay();
  let diff = target - currentDay;
  if (diff <= 0) diff += 7;
  const result = new Date(now);
  result.setDate(now.getDate() + diff);
  return result.toISOString().split("T")[0];
}

export async function parseTask(userMessage: string): Promise<TaskData> {
  const todayStr = today();

  const prompt = `Sei un assistente per l'agenzia di marketing reachmedia.it.
Analizza questo messaggio in italiano e estrai le informazioni per creare una task.

Messaggio: "${userMessage}"

Data di oggi: ${todayStr}

Clienti disponibili: ${CLIENT_NAMES.join(", ")}
Tipi di attività: ${TIPI_ATTIVITA.join(", ")}
Priorità: ${PRIORITA.join(", ")}

Rispondi SOLO con un JSON valido (nessun testo extra) con questa struttura:
{
  "titolo": "titolo breve e chiaro della task",
  "cliente": "nome esatto del cliente dalla lista (o stringa vuota se non specificato)",
  "deadline": "data in formato YYYY-MM-DD (usa la data di oggi se non specificata)",
  "priorita": "una delle priorità dalla lista",
  "tipoAttivita": "uno dei tipi dalla lista"
}

Regole:
- "entro venerdì" → calcola il prossimo venerdì dalla data odierna
- "per lunedì" → calcola il prossimo lunedì
- "urgente" → priorità 🔴 Urgente
- "chiama" o "call" → tipo "📞 Call / Meeting"
- "newsletter" → tipo "📧 Newsletter"
- "fix" o "bug" → tipo "🐛 Fix / Bug"
- "flow" o "automation" → tipo "🔄 Flow / Automation"
- "shopify" o "dev" → tipo "🛍 Shopify Dev"
- "report" o "analytics" → tipo "📊 Report / Analytics"
- "copy" o "content" → tipo "✍️ Copy / Content"
- "setup" o "configurazione" → tipo "🔧 Setup / Configurazione"
- "social" o "meta" o "ads" → tipo "📱 Social / Meta"
- "airbnb" o "messaggistica" → tipo "📬 Airbnb Messaggistica"
- IMPORTANTE: usa i valori ESATTI dalla lista tipi (con emoji incluse)
- Se il cliente non è nella lista, usa la stringa più simile o vuota
- Il titolo deve essere conciso e in italiano`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Risposta AI non valida");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Formato JSON non trovato nella risposta");

  const parsed = JSON.parse(jsonMatch[0]);

  // Resolve relative day names if deadline looks like a day name
  const dayNames = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
  for (const day of dayNames) {
    if (userMessage.toLowerCase().includes(day) && parsed.deadline === todayStr) {
      parsed.deadline = nextWeekday(day);
      break;
    }
  }

  return {
    titolo: parsed.titolo || "Nuova task",
    cliente: parsed.cliente || "",
    deadline: parsed.deadline || todayStr,
    priorita: (PRIORITA as readonly string[]).includes(parsed.priorita)
      ? (parsed.priorita as Priorita)
      : "🟡 Media",
    tipoAttivita: (TIPI_ATTIVITA as readonly string[]).includes(parsed.tipoAttivita)
      ? (parsed.tipoAttivita as TipoAttivita)
      : "✍️ Copy / Content",
  };
}
