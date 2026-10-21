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
  browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader-webgl","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("http://127.0.0.1:"+port,{waitUntil:"domcontentloaded"});
  await page.locator("#statEmployees").waitFor();
  assert.equal(await page.locator("#statEmployees").innerText(),"04");
  // This project must render actual WebGL geometry, not a static image.
  await page.waitForFunction(() => document.querySelector(".penthouse-artwork")?.naturalWidth >= 1200, null, {timeout:25000});
  assert.equal(await page.locator(".penthouse-artwork").count(), 1, "Premium scene artwork missing");
  const background=await page.locator(".penthouse-artwork").getAttribute("src");
  assert.equal(background,"./assets/penthouse-living-v3.webp",
    "Old background with duplicate static people is still in use");
  assert.equal(await page.locator("#penthouseStage").getAttribute("data-background"),"living-v3");

  assert.equal(await page.locator(".agent-hotspot").count(),4);
  // Accept only actual GLB model/animation readiness, not a decorative screenshot.
  await page.waitForFunction(
    () => ["ready","fallback-load-error","fallback-no-webgl"].includes(window.AIOAgents3D?.status),
    null,{timeout:45000});
  const agentState=await page.evaluate(()=>({
    status:window.AIOAgents3D?.status,
    agents:window.AIOAgents3D?.agents||[],
    error:window.AIOAgents3D?.error||""
  }));
  assert.equal(agentState.status,"ready",JSON.stringify(agentState));
  assert.equal(agentState.agents.length,4);
  const clips=await page.evaluate(()=>window.AIOAgents3D.activeClips);
  assert.ok(clips.includes("idle")&&clips.includes("walk"),"Main GLB movement clips missing");
  assert.ok(clips.some(c=>c==="think"||c==="look"),"Natural office gestures missing");

  const firstPosition = await page.locator('.office-agent-select').first().evaluate(el=>el.style.top);
  await page.waitForTimeout(1100);
  const nextPosition = await page.locator('.office-agent-select').first().evaluate(el=>el.style.top);
  assert.notEqual(firstPosition,nextPosition,"Rigged avatar is not moving between office waypoints");

  assert.equal(await page.locator(".office-agent-canvas").count(),1);
  assert.equal(await page.locator(".office-agent-select").count(),4);
  // A real UI click must direct the selected human agent to a visible work zone.
  await page.locator('[data-action="agent-meeting"][data-id="a1"]').click();
  assert.equal(await page.evaluate(() => window.AIOAgents3D.snapshot()
    .find(a => a.id === "a1")?.goal),"meeting");
  await page.waitForFunction(() => window.AIOAgents3D.snapshot()
    .find(a => a.id === "a1")?.point === "meeting",null,{timeout:13000});
  assert.match(await page.locator('.office-agent-select[data-agent-id="a1"]').innerText(),/Parla con colleghi/);
  await page.locator('[data-action="agent-desk"][data-id="a1"]').click();
  assert.equal(await page.evaluate(() => window.AIOAgents3D.snapshot()
    .find(a => a.id === "a1")?.goal),"desk");
  await page.waitForFunction(() => window.AIOAgents3D.snapshot()
    .find(a => a.id === "a1")?.point === "desk",null,{timeout:15000});
  const worker=await page.evaluate(()=>window.AIOAgents3D.snapshot()
    .find(a=>a.id==="a1"));
  assert.equal(worker.activity,"Al computer","Employee is not at a real work location");
  assert.equal(worker.routeSegments,0,"Employee still has unfinished path segments");
  await page.waitForTimeout(2200);
  assert.equal(await page.evaluate(()=>window.AIOAgents3D.snapshot()
    .find(a=>a.id==="a1")?.goal),"desk","Employee wandered away immediately instead of working");
  const seated=await page.evaluate(()=>window.AIOAgents3D.snapshot()
    .find(a=>a.id==="a1"));
  assert.equal(seated.posture,"sitting","Worker did not transition into a chair posture");
  assert.ok(seated.sittingBlend>.75,"Seated pose did not finish blending");
  assert.ok(seated.rigLegs>=2,"Leg bones were not detected on the real rigged model");
  assert.match(await page.locator('.office-agent-select[data-agent-id="a1"]').innerText(),/Seduto/);
  await page.screenshot({path:"ai-office/office-seated-desktop.png"});
  await page.locator("#penthouseStage").screenshot({path:"ai-office/office-seated-scene.png"});
  // Clicking another room raises the employee from the seated pose before walking.
  await page.locator('[data-action="agent-lounge"][data-id="a1"]').click();
  await page.waitForFunction(()=>window.AIOAgents3D.snapshot().find(a=>a.id==="a1")?.sittingBlend<.12,
    null,{timeout:8000});
  assert.equal(await page.evaluate(()=>window.AIOAgents3D.snapshot().find(a=>a.id==="a1")?.goal),"lounge");




  await page.screenshot({path:"ai-office/office-premium-desktop.png"});


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
  await page.goto("http://127.0.0.1:"+port+"/#office",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(() => document.querySelector(".penthouse-artwork")?.naturalWidth >= 1200, null, {timeout:25000});
  await page.waitForFunction(()=>window.AIOAgents3D?.status==="ready",null,{timeout:45000});
  await page.waitForFunction(()=>document.querySelector("#penthouseStage")?.scrollLeft>80,null,{timeout:5000});
  const scroll = await page.locator("#penthouseStage").evaluate(el=>el.scrollLeft);
  assert.ok(scroll>80,"Mobile office did not pan to visible 3D people");
  await page.screenshot({path:"ai-office/office-premium-mobile.png"});

  assert.ok(sizes.scroll<=sizes.viewport+2,"Horizontal overflow on mobile: "+JSON.stringify(sizes));
  assert.deepEqual(errors,[],"Browser runtime errors");
  console.log("Browser smoke test passed: hire + persist + task + mobile.");
} finally {
  await browser?.close();
  server.kill();
}
