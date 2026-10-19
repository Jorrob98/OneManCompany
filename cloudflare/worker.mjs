/**
 * AI OFFICE — Cloudflare Worker / Telegram control channel (v0.1).
 *
 * OneManCompany's native Python engine is NOT executed by this Worker.
 * In this stage: private Telegram commands + optional Workers AI replies.
 * Secrets (never commit): TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
 * TELEGRAM_OWNER_ID. AI is a Cloudflare Workers AI binding.
 */

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function configured(env) {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET && env.TELEGRAM_OWNER_ID);
}

async function telegramSend(env, chatId, message) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: String(message).slice(0, 3900),
      disable_web_page_preview: true
    })
  });
  if (!res.ok) throw new Error("Telegram message delivery failed");
}

async function aiReply(env, question) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return "Il modello AI non è ancora collegato. È necessario attivare il binding Workers AI.";
  }

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content: "Sei AI OFFICE, un assistente italiano sintetico. " +
            "Per ora puoi solo rispondere a domande. " +
            "Non affermare di avere eseguito incarichi, assunto agenti, " +
            "modificato file o attivato OneManCompany."
        },
        { role: "user", content: question }
      ],
      max_tokens: 400
    });
    return String(result?.response || "Il modello non ha prodotto una risposta.").slice(0, 3500);
  } catch {
    return "Il modello AI al momento non risponde. Controllare le quote gratuite di Workers AI.";
  }
}

async function handleUpdate(env, update) {
  const message = update?.message;
  if (!message || !message.from || !message.chat || message.chat.type !== "private") return;
  if (String(message.from.id) !== String(env.TELEGRAM_OWNER_ID)) return;

  const userText = typeof message.text === "string" ? message.text.trim() : "";
  if (!userText) return;

  const command = userText.split(/\s+/)[0].split("@")[0].toLowerCase();
  if (command === "/start" || command === "/help") {
    await telegramSend(env, message.chat.id,
      "🏢 AI OFFICE\n\n" +
      "Comandi disponibili:\n" +
      "/status — stato del sistema\n" +
      "/ask domanda — chiedi all'AI\n" +
      "/help — guida\n\n" +
      "Gli agenti operativi di OneManCompany e l'ufficio grafico non sono ancora collegati.");
    return;
  }

  if (command === "/status") {
    await telegramSend(env, message.chat.id,
      "✅ Bot Telegram: attivo su Cloudflare\n" +
      "🧠 Workers AI: " + (env.AI ? "collegato" : "non collegato") + "\n" +
      "🏢 OneManCompany: motore non collegato\n" +
      "🔒 Accesso: limitato al proprietario");
    return;
  }

  if (userText.startsWith("/")) {
    if (command !== "/ask") {
      await telegramSend(env, message.chat.id, "Comando non riconosciuto. Digita /help.");
      return;
    }
    const question = userText.slice(userText.indexOf(" ") + 1).trim();
    if (!userText.includes(" ") || !question) {
      await telegramSend(env, message.chat.id, "Utilizzo: /ask la tua domanda");
      return;
    }
    await telegramSend(env, message.chat.id, await aiReply(env, question.slice(0, 1500)));
    return;
  }

  await telegramSend(env, message.chat.id, await aiReply(env, userText.slice(0, 1500)));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({
        service: "ai-office",
        status: "online",
        bot_configuration: configured(env) ? "ready" : "pending",
        onemancompany_runtime: "not-connected"
      }), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
      });
    }

    if (url.pathname !== "/telegram/webhook") return text("Not found", 404);
    if (request.method !== "POST") return text("Method not allowed", 405);
    if (!configured(env)) return text("Bot not configured", 503);

    const incomingSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (!incomingSecret || incomingSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return text("Forbidden", 403);
    }

    let update;
    try {
      const raw = await request.text();
      if (raw.length > 65536) return text("Payload too large", 413);
      update = JSON.parse(raw);
      if (!update || typeof update !== "object") throw new Error("Invalid update");
    } catch {
      return text("Invalid request", 400);
    }

    // The webhook acknowledges Telegram quickly while Cloudflare keeps the
    // delivery task alive. This initial stage has no durable job queue.
    const work = handleUpdate(env, update).catch(() => {
      console.error("Unable to process Telegram update");
    });
    ctx.waitUntil(work);
    return text("OK");
  }
};

export { configured, handleUpdate };
