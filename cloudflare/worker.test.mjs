import test from "node:test";
import assert from "node:assert/strict";
import worker, { configured } from "./worker.mjs";

const endpoint = "https://ai-office-api.example.workers.dev";
const secrets = {
  TELEGRAM_BOT_TOKEN: "token-for-test-only",
  TELEGRAM_WEBHOOK_SECRET: "secret-for-test-only",
  TELEGRAM_OWNER_ID: "123"
};
const ctx = () => {
  const tasks = [];
  return { waitUntil(promise) { tasks.push(promise); }, tasks };
};

test("bot is unconfigured until all required secrets exist", () => {
  assert.equal(configured({}), false);
  assert.equal(configured(secrets), true);
});

test("health endpoint advertises the engine as not connected", async () => {
  const res = await worker.fetch(new Request(endpoint + "/health"), {}, ctx());
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, "online");
  assert.equal(data.onemancompany_runtime, "not-connected");
});

test("webhook rejects missing configuration and bad secret", async () => {
  const req = () => new Request(endpoint + "/telegram/webhook", {
    method: "POST", body: "{}"
  });
  assert.equal((await worker.fetch(req(), {}, ctx())).status, 503);
  assert.equal((await worker.fetch(req(), secrets, ctx())).status, 403);
});

test("webhook ignores messages from users other than the owner", async () => {
  const oldFetch = globalThis.fetch;
  let sent = 0;
  globalThis.fetch = async () => { sent++; return new Response('{"ok":true}'); };
  try {
    const context = ctx();
    const res = await worker.fetch(new Request(endpoint + "/telegram/webhook", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": secrets.TELEGRAM_WEBHOOK_SECRET },
      body: JSON.stringify({
        message: { from: { id: 999 }, chat: { id: 999, type: "private" }, text: "/start" }
      })
    }), secrets, context);
    assert.equal(res.status, 200);
    await Promise.all(context.tasks);
    assert.equal(sent, 0);
  } finally { globalThis.fetch = oldFetch; }
});

test("authorized owner can request status without invoking AI", async () => {
  const oldFetch = globalThis.fetch;
  const messages = [];
  globalThis.fetch = async (_url, options) => {
    messages.push(JSON.parse(options.body).text);
    return new Response('{"ok":true}');
  };
  try {
    const context = ctx();
    const res = await worker.fetch(new Request(endpoint + "/telegram/webhook", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": secrets.TELEGRAM_WEBHOOK_SECRET },
      body: JSON.stringify({
        message: { from: { id: 123 }, chat: { id: 123, type: "private" }, text: "/status" }
      })
    }), secrets, context);
    assert.equal(res.status, 200);
    await Promise.all(context.tasks);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /OneManCompany: motore non collegato/);
  } finally { globalThis.fetch = oldFetch; }
});

const apiKey="sprint_06_example_operator_key_123456";
const aiOrigin="https://hushed-cipher-xmu933h.shipstatic.com";
const aiEnv=()=>({AI_OFFICE_API_KEY:apiKey,AI_OFFICE_ALLOWED_ORIGINS:aiOrigin,
  AI:{run:async (model,input)=>({response:"Bozza concreta restituita da modello di prova"})}});
const requestAI=(body,key=apiKey,origin=aiOrigin,method="POST")=>new Request(endpoint+"/api/ai/generate",{
  method,headers:{"Origin":origin,"Authorization":"Bearer "+key,"Content-Type":"application/json"},
  body:method==="POST"?JSON.stringify(body):undefined
});
test("AI status advertises ready only with actual binding plus operator access key",async()=>{
  const empty=await worker.fetch(new Request(endpoint+"/api/ai/status"),{},ctx());
  assert.equal((await empty.json()).ready,false);
  const ready=await worker.fetch(new Request(endpoint+"/api/ai/status",{headers:{Origin:aiOrigin}}),aiEnv(),ctx());
  assert.equal((await ready.json()).ready,true);
  assert.equal(ready.headers.get("access-control-allow-origin"),aiOrigin);
  assert.equal((await worker.fetch(new Request(endpoint+"/api/ai/status",{headers:{Origin:"https://evil.example"}}),aiEnv(),ctx())).status,403);
});
test("AI preflight checks exact allowed origins and forbidden origins cannot infer",async()=>{
  const req=(origin)=>new Request(endpoint+"/api/ai/generate",{method:"OPTIONS",headers:{"Origin":origin}});
  assert.equal((await worker.fetch(req(aiOrigin),aiEnv(),ctx())).status,204);
  assert.equal((await worker.fetch(req("https://invalid.example"),aiEnv(),ctx())).status,403);
});
test("AI inference refuses missing key, incorrect key, and missing binding",async()=>{
  const input={title:"Elabora un sommario",details:"Tre punti utili",role:"Analista"};
  assert.equal((await worker.fetch(requestAI(input,"wrong"),aiEnv(),ctx())).status,401);
  assert.equal((await worker.fetch(requestAI(input),{...aiEnv(),AI:null},ctx())).status,503);
  assert.equal((await worker.fetch(requestAI(input),{...aiEnv(),AI_OFFICE_API_KEY:""},ctx())).status,503);
});
test("Only real AI.run output is accepted as a completed generated draft",async()=>{
  const input={title:"Scrivi una sintesi",details:"Fatti dati dall'utente",role:"Analista",instructions:"Usa 4 punti"};
  const env=aiEnv();
  let invoked=false;
  env.AI.run=async (model,payload)=>{
    invoked=true;
    assert.match(model,/llama-3\.1/);
    assert.equal(payload.messages[1].role,"user");
    assert.match(payload.messages[1].content,/Scrivi una sintesi/);
    assert.match(payload.messages[0].content,/Nessun tool disponibile/);
    return {response:"Risultato verificabile dal test di integrazione"};
  };
  const res=await worker.fetch(requestAI(input),env,ctx());
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(invoked,true);
  assert.equal(data.ok,true);
  assert.equal(data.kind,"text-draft");
  assert.equal(data.requiresReview,true);
  assert.equal(data.output,"Risultato verificabile dal test di integrazione");
  assert.equal(data.onemancompany_runtime,"not-connected");
  assert.match(data.requestId,/^[0-9a-f-]{36}$/i);
});
test("AI never reports generated output when model errors or yields empty text",async()=>{
  const input={title:"Sintesi",details:"",role:"Designer"};
  for(const run of [async()=>{throw Error("quota exceeded")},async()=>({response:" "})]){
    const res=await worker.fetch(requestAI(input),{...aiEnv(),AI:{run}},ctx());
    assert.equal(res.status,502);
    assert.equal((await res.json()).ok,false);
  }
});
test("AI rejects untrusted oversized and invalid requests without invoking model",async()=>{
  let invoked=0;
  const env={...aiEnv(),AI:{run:async()=>{invoked++;return {response:"should not run"};}}};
  assert.equal((await worker.fetch(requestAI({title:""}),env,ctx())).status,422);
  assert.equal((await worker.fetch(requestAI({title:"A".repeat(76)}),env,ctx())).status,422);
  assert.equal((await worker.fetch(requestAI({title:"OK",details:"A".repeat(4000)}),env,ctx())).status,422);
  assert.equal((await worker.fetch(new Request(endpoint+"/api/ai/generate",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"text/plain"},body:"test"}),env,ctx())).status,415);
  assert.equal(invoked,0);
});
