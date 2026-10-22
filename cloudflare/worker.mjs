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


/* Sprint 06: manual, authenticated text generation only.
 * Never expose a secret or invoke user-supplied tools.
 * The presence of a binding does not prove a successful inference. */
const OUTPUT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const RESPONSE_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'"
};
function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json; charset=utf-8",
      ...RESPONSE_HEADERS, ...extraHeaders }
  });
}
function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return { allowed: true, headers: {} };
  let originURL;
  try { originURL = new URL(origin); } catch { return { allowed: false, headers: {} }; }
  if (originURL.protocol !== "https:" &&
      !(originURL.protocol === "http:" && ["localhost","127.0.0.1"].includes(originURL.hostname))) {
    return { allowed: false, headers: {} };
  }
  const list = String(env.AI_OFFICE_ALLOWED_ORIGINS || "").split(",")
    .map(v => v.trim()).filter(Boolean);
  if (!list.includes(origin)) return { allowed: false, headers: {} };
  return { allowed: true, headers: {
    "access-control-allow-origin": origin, "vary": "Origin",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "600"
  }};
}
async function keyIsValid(header, expected) {
  if (typeof expected !== "string" || expected.length < 24 || expected.length > 200) return false;
  const token = /^Bearer ([A-Za-z0-9_-]{24,200})$/.exec(header || "")?.[1];
  if (!token || !crypto?.subtle) return false;
  const encode = value => new TextEncoder().encode(value);
  const [given, actual] = await Promise.all([crypto.subtle.digest("SHA-256", encode(token)),
    crypto.subtle.digest("SHA-256", encode(expected))]);
  const a = new Uint8Array(given), b = new Uint8Array(actual);
  let mismatch = 0;
  for (let i=0;i<a.length;i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}
async function aiAPI(request, env, url) {
  const cors = allowedOrigin(request, env);
  if (!cors.allowed) return json({ ok:false, error:"origin_not_allowed" },403);
  const headers = cors.headers;
  if (request.method==="OPTIONS")
    return new Response(null,{status:204,headers:{...RESPONSE_HEADERS,...headers}});
  if (url.pathname==="/api/ai/status") {
    if(request.method!=="GET")return json({ok:false,error:"method_not_allowed"},405,headers);
    return json({ok:true,service:"ai-office",version:"sprint-06",
      ready:Boolean(env.AI?.run && env.AI_OFFICE_API_KEY?.length >= 24),
      engine:"cloudflare-workers-ai",onemancompany_runtime:"not-connected"},200,headers);
  }
  if (url.pathname!=="/api/ai/generate") return json({ok:false,error:"not_found"},404,headers);
  if (request.method!=="POST")return json({ok:false,error:"method_not_allowed"},405,headers);
  if (!env.AI?.run)return json({ok:false,error:"ai_binding_unavailable"},503,headers);
  if (!env.AI_OFFICE_API_KEY)return json({ok:false,error:"operator_key_not_configured"},503,headers);
  if (!(await keyIsValid(request.headers.get("Authorization"), env.AI_OFFICE_API_KEY)))
    return json({ok:false,error:"unauthorized"},401,headers);
  if (!String(request.headers.get("content-type")||"").toLowerCase().startsWith("application/json"))
    return json({ok:false,error:"json_required"},415,headers);
  const raw=await request.text();
  if(raw.length > 4096)return json({ok:false,error:"payload_too_large"},413,headers);
  let body;
  try {body=JSON.parse(raw);}catch{return json({ok:false,error:"invalid_json"},400,headers);}
  const title=typeof body?.title==="string"?body.title.trim():"";
  const details=typeof body?.details==="string"?body.details.trim():"";
  const role=typeof body?.role==="string"?body.role.trim():"";
  const instructions=typeof body?.instructions==="string"?body.instructions.trim():"";
  if (!title || title.length>75 || details.length>450 || role.length>55 ||
      instructions.length>300 || typeof body!=="object" || Array.isArray(body))
    return json({ok:false,error:"invalid_input"},422,headers);
  const prompt=[
    "Titolo: "+title,"Descrizione: "+details,
    "Figura professionale: "+role,"Indicazioni aggiuntive: "+instructions
  ].join("\n");
  const started=Date.now();
  let result;
  try {
    result=await env.AI.run(OUTPUT_MODEL,{
      messages:[
        {role:"system",content:"Sei AI OFFICE, assistente di generazione testuale professionale in italiano. " +
        "Produci solo una bozza utile in testo semplice per la richiesta. " +
        "Non affermare di aver eseguito azioni esterne, navigato sul web, letto dati non forniti, " +
        "inviato messaggi, verificato fatti recenti o completato incarichi reali. " +
        "Se mancano dati, indica ipotesi e limiti. Nessun tool disponibile."},
        {role:"user",content:prompt}],
      max_tokens:600,temperature:0.35
    });
  } catch {
    return json({ok:false,error:"inference_failed",retryable:true},502,headers);
  }
  const output=typeof result?.response==="string"?result.response.trim():"";
  if(!output)return json({ok:false,error:"empty_model_response",retryable:true},502,headers);
  return json({ok:true,kind:"text-draft",output:output.slice(0,6000),
    model:OUTPUT_MODEL,producedAt:new Date().toISOString(),
    requestId:crypto.randomUUID(),elapsedMs:Date.now()-started,
    onemancompany_runtime:"not-connected",requiresReview:true},200,headers);
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

    if (url.pathname.startsWith("/api/ai/")) return aiAPI(request, env, url);

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

export { configured, handleUpdate, aiAPI, keyIsValid, allowedOrigin };
