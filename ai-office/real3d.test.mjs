// Strict visual-scene integration: production default, NOT the legacy photograph.
import {spawn} from "node:child_process";
import {resolve} from "node:path";
import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const port=4185;
const server=spawn("python3",["-m","http.server",String(port),"--directory",resolve("ai-office")],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try {
  let started=false;
  for(let i=0;i<40;i++){
    try{if((await fetch("http://127.0.0.1:"+port)).ok){started=true;break;}}catch{}
    await sleep(250);
  }
  assert.ok(started,"Studio test server did not start");
  browser=await chromium.launch({channel:"chrome",headless:true,args:[
    "--no-sandbox","--use-gl=angle","--use-angle=swiftshader-webgl","--enable-unsafe-swiftshader"
  ]});
  const page=await browser.newPage({viewport:{width:1440,height:950}});
  const failures=[];
  page.on("pageerror",e=>failures.push(String(e)));
  await page.goto("http://127.0.0.1:"+port+"/",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>["ready","error"].includes(window.AIOOffice3D?.status),
    null,{timeout:80000});
  const ready=await page.evaluate(()=>window.AIOOffice3D.status);
  assert.equal(ready,"ready","Default 3D scene not ready: "+
    JSON.stringify(await page.evaluate(()=>window.AIOOffice3D)));
  assert.equal(await page.locator(".office3d-canvas").count(),1,"Physical 3D scene missing");
  assert.equal(await page.locator("#penthouseStage").evaluate(e=>getComputedStyle(e).display),
    "none","Old 2.5D photograph is still showing over the office geometry");
  // The invisible legacy 2D canvas must STOP consuming frames while 3D is live.
  const legacyStart=await page.evaluate(()=>window.AIOStudio.getLegacyRenderStats());
  assert.equal(legacyStart.real3dActive,true);
  await page.waitForTimeout(300);
  const legacyEnd=await page.evaluate(()=>window.AIOStudio.getLegacyRenderStats());
  assert.equal(legacyEnd.frames,legacyStart.frames,
    "Hidden legacy Canvas2D is still redrawing behind active Three.js");
  const data=await page.evaluate(()=>({
    agents:window.AIOOffice3D.agents,
    geometry:window.AIOOffice3D.engine,
    frames:window.AIOOffice3D.frames,
    poses:window.AIOAgents3D.snapshot()
  }));
  assert.equal(data.agents.length,4,"Expected four real GLB human models");
  assert.equal(data.geometry,"real-geometry-glb");
  assert.ok(data.frames>=1,"Three.js is not rendering");
  assert.ok(data.poses.every(p=>p.realGeometry),"Rig and chair do not share a 3D world");
  await page.waitForFunction(()=>window.AIOAgents3D.snapshot().every(a=>a.sittingBlend>.9),
    null,{timeout:12000});
  const joints=await page.evaluate(()=>window.AIOOffice3D.rigContact("a1"));
  assert.ok(joints.hips.length===2&&joints.knees.length===2&&joints.ankles.length===2,
    "Real GLB rig lacks both seated legs: "+JSON.stringify(joints));
  assert.ok(joints.hips.every(y=>Math.abs(y-joints.seatY)<.10),
    "Pelvis is not contacting the 3D chair: "+JSON.stringify(joints));
  console.log("Real-geometry seated pose joint heights",JSON.stringify(joints));
  await page.waitForFunction(()=>window.AIOOffice3D?.renderStats?.gpuGeometries>0,
    null,{timeout:10000});
  const desktopPerf=await page.evaluate(()=>({
    tier:window.AIOOffice3D.quality,
    fpsBudget:window.AIOOffice3D.targetFps,
    pixelRatio:window.AIOOffice3D.renderPixelRatio,
    renderer:window.AIOOffice3D.renderStats
  }));
  assert.equal(desktopPerf.tier,"desktop");
  assert.equal(desktopPerf.fpsBudget,60);
  assert.ok(desktopPerf.pixelRatio>0&&desktopPerf.pixelRatio<=1.65,
    "Desktop renderer pixel budget not controlled: "+JSON.stringify(desktopPerf));
  assert.ok(desktopPerf.renderer.gpuGeometries<800,
    "Too many unique geometries; shared GPU box reuse regressed: "+JSON.stringify(desktopPerf));
  console.log("Desktop real-3D renderer budget",JSON.stringify(desktopPerf));
  await page.locator("#roomZoom").click();
  assert.equal(await page.evaluate(()=>window.AIOOffice3D.cameraMode),"postazioni",
    "Camera focus preset is not interactive");
  await page.waitForTimeout(450);
  await page.screenshot({path:"ai-office/office-real3d-desktop.png"});
  await page.locator(".scene-wrap").screenshot({path:"ai-office/office-real3d-scene.png"});
  // Debug gate 1: no false arrival while a seated GLB is still standing up.
  const departure=await page.evaluate(()=>{
    const ok=window.AIOAgents3D.command("a1","meeting");
    const actor=window.AIOAgents3D.snapshot().find(x=>x.id==="a1");
    return {ok,actor};
  });
  assert.equal(departure.ok,true,"Agent command was not accepted");
  assert.equal(departure.actor.goal,"meeting");
  assert.equal(departure.actor.point,"desk",
    "Agent falsely arrived in meeting before walking");
  await page.waitForFunction(()=>window.AIOAgents3D.snapshot()
    .some(a=>a.id==="a1"&&a.point==="meeting"),null,{timeout:20000});
  const arrived=await page.evaluate(()=>window.AIOAgents3D.snapshot().find(a=>a.id==="a1"));
  assert.equal(arrived.point,"meeting");
  assert.ok(arrived.sittingBlend<.2,"Agent is still seated in the meeting room");
  assert.ok(await page.evaluate(()=>window.AIOAgents3D.command("a1","desk")));
  await page.waitForFunction(()=>window.AIOAgents3D.snapshot()
    .some(a=>a.id==="a1"&&a.point==="desk"&&a.sittingBlend>.90),
    null,{timeout:20000});
  // Debug gate 2: removing/reinstating personnel cannot leave invisible GLB
  // meshes selectable, nor duplicate the actor. Mutate only this isolated test.
  const beforeRoster=await page.evaluate(()=>window.AIOOffice3D.pickableMeshes);
  await page.evaluate(()=>{
    window.AIOStudio.getAgents().find(a=>a.id==="a4").status="retired";
    window.AIOStudio.refresh();
  });
  await page.waitForFunction(()=>window.AIOOffice3D.agents.length===3);
  const removedState=await page.evaluate(()=>({
    count:window.AIOOffice3D.agents.length,
    pickables:window.AIOOffice3D.pickableMeshes,
    removed:window.AIOAgents3D.snapshot().some(a=>a.id==="a4")
  }));
  assert.equal(removedState.removed,false,"Retired GLB remains in scene");
  assert.ok(removedState.pickables<beforeRoster,
    "Retired GLB's raycast targets were retained");
  await page.evaluate(()=>{
    window.AIOStudio.getAgents().find(a=>a.id==="a4").status="available";
    window.AIOStudio.refresh();
  });
  await page.waitForFunction(()=>window.AIOOffice3D.agents.length===4);
  const restoredState=await page.evaluate(()=>({
    ids:window.AIOAgents3D.snapshot().map(a=>a.id),
    pickables:window.AIOOffice3D.pickableMeshes
  }));
  assert.equal(new Set(restoredState.ids).size,4,"Duplicate GLB character after rehiring");
  assert.equal(restoredState.pickables,beforeRoster,
    "GLB pickables leaked or failed to re-register on rehire");
  console.log("3D movement & GLB lifecycle debug PASS",JSON.stringify({
    from:departure.actor.point,to:arrived.point,
    removedMeshes:beforeRoster-removedState.pickables,
    restoredMeshes:restoredState.pickables
  }));
  await page.setViewportSize({width:390,height:844});
  await sleep(300);
  assert.equal(await page.locator(".office3d-canvas").count(),1);
  const mobilePerf=await page.evaluate(()=>({
    tier:window.AIOOffice3D.quality,
    fpsBudget:window.AIOOffice3D.targetFps,
    pixelRatio:window.AIOOffice3D.renderPixelRatio
  }));
  assert.equal(mobilePerf.tier,"mobile");
  assert.equal(mobilePerf.fpsBudget,30);
  assert.ok(mobilePerf.pixelRatio>0&&mobilePerf.pixelRatio<=1.24,
    "Mobile GPU pixel budget not enforced: "+JSON.stringify(mobilePerf));
  console.log("Mobile real-3D renderer budget",JSON.stringify(mobilePerf));
  const bounds=await page.evaluate(()=>({
    pageWidth:document.documentElement.scrollWidth,
    viewport:innerWidth,
    sceneHeight:document.querySelector(".scene-wrap")?.clientHeight,
    geometryVisible:getComputedStyle(document.querySelector(".office3d-canvas")).display
  }));
  assert.ok(bounds.pageWidth<=bounds.viewport+2,"3D caused mobile overflow "+JSON.stringify(bounds));
  assert.ok(bounds.sceneHeight>250,"3D camera is clipped on mobile");
  await page.screenshot({path:"ai-office/office-real3d-mobile.png"});
  assert.deepEqual(failures,[],"JavaScript errors in the real 3D scene");
  console.log("Actual shared-world 3D office PASS: GLB seating + desktop/mobile");
} finally {
  await browser?.close();
  server.kill();
}
