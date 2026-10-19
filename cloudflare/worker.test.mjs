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
