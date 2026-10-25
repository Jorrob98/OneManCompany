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
  // FLASH REGRESSION: DOM and CSS must never paint the photograph or legacy
  // Canvas2D before the external GLB models have loaded.
  const firstPaint=await page.evaluate(()=>{
    const old=document.getElementById("penthouseStage");
    const canvas=document.getElementById("roomCanvas");
    const loader=document.getElementById("aioStageLoader");
    return {
      mode:document.documentElement.classList.contains("aio-boot-3d"),
      legacyPhoto:getComputedStyle(old).display,
      oldCanvas:getComputedStyle(canvas).display,
      loader:getComputedStyle(loader).display,
      recovery:getComputedStyle(loader.querySelector(".aio-loader-recovery")).display
    };
  });
  assert.equal(firstPaint.mode,true,"Real-3D boot flag was not installed before paint");
  assert.equal(firstPaint.legacyPhoto,"none","Old office photo flashes during boot");
  assert.equal(firstPaint.oldCanvas,"none","Old Canvas2D flashes during boot");
  assert.equal(firstPaint.loader,"flex","Modern 3D loading state is missing");
  assert.equal(firstPaint.recovery,"none","Error recovery appears before any error");
  await page.waitForFunction(()=>["ready","error"].includes(window.AIOOffice3D?.status),
    null,{timeout:80000});
  const ready=await page.evaluate(()=>window.AIOOffice3D.status);
  assert.equal(ready,"ready","Default 3D scene not ready: "+
    JSON.stringify(await page.evaluate(()=>window.AIOOffice3D)));
  assert.equal(await page.evaluate(()=>document.documentElement.classList.contains("aio-stage-ready")),
    true,"Loading cover was not removed after first real GLB render");
  assert.equal(await page.locator("#aioStageLoader").evaluate(el=>getComputedStyle(el).opacity),
    "0","Loading overlay remains on top of rendered 3D");
  const desktopOrder=await page.evaluate(()=>{
    const office=document.querySelector('[data-view="office"].active');
    return {scene:office.querySelector(".room-card").getBoundingClientRect().top,
      headline:office.querySelector(".heading-row").getBoundingClientRect().top,
      kpis:office.querySelector(".stats").getBoundingClientRect().top};
  });
  assert.ok(desktopOrder.scene<desktopOrder.headline &&
    desktopOrder.scene<desktopOrder.kpis,
    "Desktop still shows old dashboard above the 3D office: "+JSON.stringify(desktopOrder));
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
  const working=await page.evaluate(()=>window.AIOAgents3D.snapshot());
  assert.ok(working.every(a=>a.workGesture>.15&&a.workGesture<.43),
    "Rigged employees have frozen/malformed typing gestures: "+JSON.stringify(working));
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
  assert.ok(desktopPerf.renderer.gpuGeometries<85,
    "Primitive geometry sharing has regressed: "+JSON.stringify(desktopPerf));
  assert.ok(desktopPerf.renderer.drawCalls<165,
    "Static furniture GPU instancing has regressed: "+JSON.stringify(desktopPerf));
  const batching=await page.evaluate(()=>window.AIOOffice3D.batching);
  assert.ok(batching.sourceMeshes>75&&batching.drawBatches>3,
    "Static furniture batching not active: "+JSON.stringify(batching));
  assert.equal(batching.mixedGeometryGroups,0,
    "A GPU batch mixes incompatible shapes: "+JSON.stringify(batching));
  assert.ok(batching.geometryTypes.BoxGeometry>20,
    "Desk box geometry lost during batching: "+JSON.stringify(batching));
  assert.ok((batching.geometryTypes.CylinderGeometry||0)>5,
    "Round chair/plant components were rendered as boxes: "+JSON.stringify(batching));
  assert.ok((batching.geometryTypes.SphereGeometry||0)>5,
    "Plant leaves/rounded furniture were rendered as boxes: "+JSON.stringify(batching));
  console.log("Geometry type integrity",JSON.stringify(batching));
  await page.waitForFunction(()=>window.AIOOffice3D.metrics?.sampleCount>=12,
    null,{timeout:15000});
  const observedDesktop=await page.evaluate(()=>window.AIOOffice3D.metrics);
  assert.equal(observedDesktop.source,"observed-render-cadence-not-GPU-timing");
  assert.ok(observedDesktop.observedFps>0&&observedDesktop.observedFps<=120,
    "Measured desktop FPS is invalid: "+JSON.stringify(observedDesktop));
  assert.ok(observedDesktop.p95IntervalMs>=observedDesktop.p50IntervalMs,
    "Frame time percentiles inverted");
  console.log("Measured desktop frame cadence",JSON.stringify(observedDesktop));
  console.log("Desktop real-3D renderer budget",JSON.stringify(desktopPerf));
  await page.locator("#roomZoom").click();
  assert.equal(await page.evaluate(()=>window.AIOOffice3D.cameraMode),"postazioni",
    "Camera focus preset is not interactive");
  await page.waitForTimeout(450);
  await page.screenshot({path:"ai-office/office-real3d-desktop.png"});
  await page.locator(".office3d-canvas").click({position:{x:13,y:14}});
  await page.waitForFunction(()=>document.querySelector(".room-hint")
    ?.classList.contains("aio-hint-dismissed"),null,{timeout:3000});
  await page.locator(".scene-wrap").screenshot({path:"ai-office/office-real3d-scene.png"});
  // Real focus must follow the employee's ACTUAL position throughout a walk,
  // instead of remaining fixed at the desk where the camera mode was selected.
  await page.locator("#roomZoom").click();
  assert.equal(await page.evaluate(()=>window.AIOOffice3D.cameraMode),"dipendente");
  await page.waitForFunction(()=>window.AIOOffice3D.following==="a1",
    null,{timeout:8000});
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
  await page.waitForFunction(()=>{
    const a=window.AIOAgents3D.snapshot().find(a=>a.id==="a1");
    const c=window.AIOOffice3D.cameraTarget;
    return a&&c&&Math.hypot(a.position.x-c.x,a.position.z-c.z)<.45;
  },null,{timeout:8000});
  const cameraTrack=await page.evaluate(()=>({
    person:window.AIOAgents3D.snapshot().find(a=>a.id==="a1").position,
    target:window.AIOOffice3D.cameraTarget
  }));
  assert.ok(Math.hypot(cameraTrack.person.x-cameraTrack.target.x,
    cameraTrack.person.z-cameraTrack.target.z)<.45,
    "Camera lost selected moving employee: "+JSON.stringify(cameraTrack));
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
  await page.waitForFunction(()=>window.AIOOffice3D.teamFraming?.count===4,
    null,{timeout:8000});
  const teamFraming=await page.evaluate(()=>window.AIOOffice3D.teamFraming);
  assert.ok(teamFraming.maxAbsX<=.86 && teamFraming.maxAbsY<=.85,
    "Mobile office crops one or more employees: "+JSON.stringify(teamFraming));
  assert.ok(teamFraming.distance<=31,
    "Automatic mobile team framing is outside safe zoom range: "+JSON.stringify(teamFraming));
  console.log("Mobile all-four-employee framing",JSON.stringify(teamFraming));
  const bounds=await page.evaluate(()=>({
    pageWidth:document.documentElement.scrollWidth,
    viewport:innerWidth,
    sceneHeight:document.querySelector(".scene-wrap")?.clientHeight,
    geometryVisible:getComputedStyle(document.querySelector(".office3d-canvas")).display
  }));
  assert.ok(bounds.pageWidth<=bounds.viewport+2,"3D caused mobile overflow "+JSON.stringify(bounds));
  assert.ok(bounds.sceneHeight>250,"3D camera is clipped on mobile");
  const mobileOrder=await page.evaluate(()=>{
    const office=document.querySelector('[data-view="office"].active');
    const scene=office.querySelector(".room-card").getBoundingClientRect();
    const heading=office.querySelector(".heading-row").getBoundingClientRect();
    const stats=office.querySelector(".stats").getBoundingClientRect();
    return {sceneTop:scene.top,headingTop:heading.top,statsTop:stats.top,
      canvasVisible:getComputedStyle(office.querySelector(".office3d-canvas")).opacity};
  });
  assert.ok(mobileOrder.sceneTop<mobileOrder.headingTop &&
    mobileOrder.sceneTop<mobileOrder.statsTop,
    "Mobile still buries 3D office below legacy dashboard intro: "+JSON.stringify(mobileOrder));
  assert.equal(mobileOrder.canvasVisible,"1","WebGL scene not visible on mobile");
  await page.screenshot({path:"ai-office/office-real3d-mobile.png"});
  assert.deepEqual(failures,[],"JavaScript errors in the real 3D scene");
  console.log("Actual shared-world 3D office PASS: GLB seating + desktop/mobile");
} finally {
  await browser?.close();
  server.kill();
}
