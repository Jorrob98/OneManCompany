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
