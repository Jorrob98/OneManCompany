import { spawn } from "node:child_process";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const port=4173;
const server=spawn("python3",["-m","http.server",String(port),"--directory",resolve("ai-office")],{stdio:"ignore"});
let browser;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try {
  let ready=false;
  for(let i=0;i<35;i++){
    try{const res=await fetch("http://127.0.0.1:"+port);if(res.ok){ready=true;break;}}catch{}
    await delay(250);
  }
  assert.ok(ready,"Local static server did not start");
  browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("http://127.0.0.1:"+port,{waitUntil:"domcontentloaded"});
  await page.locator("#statEmployees").waitFor();
  assert.equal(await page.locator("#statEmployees").innerText(),"04");

  // Personnel interaction and durable local browser storage.
  await page.locator('[data-action="hire"]').first().click();
  await page.locator("#employeeName").fill("Sofia");
  await page.locator("#employeeRole").selectOption("Designer");
  await page.locator('#hireForm button[type="submit"]').click();
  assert.equal(await page.locator("#statEmployees").innerText(),"05");
  assert.ok(await page.locator("#teamMiniList").innerText().then(s=>s.includes("Sofia")));
  await page.reload({waitUntil:"domcontentloaded"});
  assert.equal(await page.locator("#statEmployees").innerText(),"05");

  // Queue operations are explicit pending drafts, never faked AI work.
  await page.locator('[data-page="tasks"]').click();
  await page.locator('[data-view="tasks"] .head-button[data-action="new-task"]').click();
  await page.locator("#taskTitle").fill("Prepara il report vendite");
  await page.locator("#taskDetail").fill("Analizza i dati del mese quando sarà disponibile un motore AI.");
  await page.locator('#taskForm button[type="submit"]').click();
  assert.equal(await page.locator("#statTasks").innerText(),"01");
  assert.ok((await page.locator("#taskList").innerText()).includes("IN ATTESA"));
  await page.reload({waitUntil:"domcontentloaded"});
  assert.equal(await page.locator("#statTasks").innerText(),"01");

  // Mobile layout: no horizontal page overflow, navigation available.
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(300);
  assert.ok(await page.locator('[data-page="people"]').isVisible());
  const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(sizes.scroll<=sizes.viewport+2,"Horizontal overflow on mobile: "+JSON.stringify(sizes));
  assert.deepEqual(errors,[],"Browser runtime errors");
  console.log("Browser smoke test passed: hire + persist + task + mobile.");
} finally {
  await browser?.close();
  server.kill();
}
