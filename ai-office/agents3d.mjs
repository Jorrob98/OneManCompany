/**
 * AI OFFICE — Living Office 6: illustrated-office aisle navigation, collision yielding, varied worker routines.
 * Real GLB rigged humans + separate Biped animation clips; three.js/WebGL.
 * MIT model/clip licensing: https://models.codelove.in/licensing
 * Motion is only a simulation of office presence, NEVER evidence of task execution.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneRig } from "three/addons/utils/SkeletonUtils.js";
import {DESKS, ENTRIES, MEETINGS, LOUNGES, planOfficeRoute, nextRoutine, dwellSeconds} from "./movement.mjs";

const stage = document.getElementById("penthouseStage");
const surface = document.getElementById("penthouseSurface");
const bridge = window.AIOStudio;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const assetBase = "https://models.codelove.in";
const modelURLs = {
  f1: assetBase + "/models/business-female-01.glb",
  f2: assetBase + "/models/business-female-02.glb",
  f3: assetBase + "/models/business-female-03.glb",
  f4: assetBase + "/models/business-female-04.glb",
  m1: assetBase + "/models/business-male-01.glb",
  m2: assetBase + "/models/business-male-02.glb",
  m3: assetBase + "/models/business-male-03.glb",
  m4: assetBase + "/models/business-male-04.glb"
};
const appearanceColors={
  coral:0xe99f85,mint:0x78d9b2,lavender:0xbba9ee,
  blue:0x83b6f2,gold:0xf5c77f
};
const clipURLs = {
  female: {
    idle: assetBase + "/animations/f_idle_neutral_01.glb",
    look: assetBase + "/animations/f_idle_look_around_01.glb",
    think: assetBase + "/animations/f_gestic_thoughtful_01.glb",
    walk: assetBase + "/animations/f_walk_neutral_01.glb",
    talk: assetBase + "/animations/f_talk_01.glb"
  },
  male: {
    idle: assetBase + "/animations/m_idle_neutral_01.glb",
    look: assetBase + "/animations/m_idle_look_around_01.glb",
    think: assetBase + "/animations/m_gestic_thoughtful_01.glb",
    walk: assetBase + "/animations/m_walk_neutral_01.glb",
    talk: assetBase + "/animations/m_talk_01.glb"
  }
};
const info = { status: "loading", agents: [], frames: 0, animationSource: "real-glb-clips" };
window.AIOAgents3D = info;
if (!stage || !surface || !bridge) throw new Error("Office scene is missing");

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// Scenic coordinates are percentages of the *people-free* 1672x941 render.
// Keep meeting in the left glass pod, desks at actual consoles, lounge to the right.
const stages = ENTRIES.map((entry,index)=>({
  entry,desk:DESKS[index],meeting:MEETINGS[index],lounge:LOUNGES[index]
}));
// Navigable stations are visual anchors in the image; no physical scene collider.
const MAX_AGENTS = 4;
const DIM_X=16,DIM_Y=9;
const place = (p)=> new THREE.Vector3((p.x/100-.5)*DIM_X,(.5-p.y/100)*DIM_Y,0);
const stagePeople = new Map();
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const vector = new THREE.Vector2();
const world = new THREE.Scene();
world.background = null;
world.add(new THREE.HemisphereLight(0xeaf0ff,0x493f37,2.1));
const key = new THREE.DirectionalLight(0xffdec5,3.2);
key.position.set(-3,7,9);world.add(key);
const fill=new THREE.DirectionalLight(0x8cb5fc,1.7);
fill.position.set(8,3,4);world.add(fill);
const camera=new THREE.OrthographicCamera(-8,8,4.5,-4.5,.1,100);
camera.position.set(0,0,24);camera.lookAt(0,0,0);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"low-power"});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.setClearColor(0x000000,0);
  // Never clip animated limbs: the previous seated mask hid half of each GLB.
  renderer.localClippingEnabled=false;
  renderer.domElement.className="office-agent-canvas";
  renderer.domElement.setAttribute("aria-hidden","true");
  surface.appendChild(renderer.domElement);
} catch (err) {
  info.status="fallback-no-webgl";
  console.warn("AI Office 3D unavailable; original UI remains operational",err);
}
const pickLayer=document.createElement("div");
pickLayer.className="office-agent-controls";
surface.appendChild(pickLayer);
function resize() {
  if(!renderer)return;
  const width = surface.clientWidth, height=surface.clientHeight;
  if(!width||!height)return;
  renderer.setSize(width,height,false);
  const aspect=width/height;
  // Canvas composition always uses the same image coordinate system.
  camera.left=-DIM_Y*aspect/2; camera.right=DIM_Y*aspect/2;
  camera.top=DIM_Y/2; camera.bottom=-DIM_Y/2;
  camera.updateProjectionMatrix();
}
if(renderer){new ResizeObserver(resize).observe(surface);resize();}
function shadow() {
  const can=document.createElement("canvas");
  can.width=96;can.height=96;
  const c=can.getContext("2d");
  const gradient=c.createRadialGradient(48,48,3,48,48,44);
  gradient.addColorStop(0,"rgba(0,0,0,.55)");
  gradient.addColorStop(1,"rgba(0,0,0,0)");
  c.fillStyle=gradient;c.fillRect(0,0,96,96);
  const texture=new THREE.CanvasTexture(can);
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.3),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
  plane.position.set(0,.12,-.22);
  return plane;
}
const assets={models:new Map(),modelPromises:new Map(),clips:{}};
const safeStyle=(value,index=0)=>modelURLs[value]?value:["f1","m1","f2","m2"][index%4];
function ensureModel(style){
  if(assets.models.has(style))return Promise.resolve(assets.models.get(style));
  if(!assets.modelPromises.has(style)){
    assets.modelPromises.set(style,loader.loadAsync(modelURLs[style]).then(g=>{
      assets.models.set(style,g.scene);
      assets.modelPromises.delete(style);
      return g.scene;
    }).catch(err=>{assets.modelPromises.delete(style);throw err;}));
  }
  return assets.modelPromises.get(style);
}
async function preload() {
  const sexes=await Promise.all(["female","male"].map(async sex=>{
    const entries=await Promise.all(Object.entries(clipURLs[sex]).map(async ([name,url])=>{
      try {const glb=await loader.loadAsync(url);return [name,glb.animations[0]||null];}
      catch(err){console.warn("Optional animation unavailable:",name,sex);return [name,null];}
    }));
    const animations=Object.fromEntries(entries);
    if(!animations.idle||!animations.walk)throw Error("Required GLB rig clips missing for "+sex);
    return [sex,animations];
  }));
  for(const [sex,clips] of sexes)assets.clips[sex]=clips;
  // Only preload models that are actually on stage; all remaining variants
  // are loaded lazily when the user chooses them, avoiding unnecessary MB.
  const needed=new Set(bridge.getAgents().filter(a=>a.status==="available").slice(0,MAX_AGENTS)
    .map((a,i)=>safeStyle(a.modelStyle,i)));
  await Promise.all([...needed].map(ensureModel));
  info.activeClips=["idle","walk","talk","look","think"].filter(name=>assets.clips.female[name]&&assets.clips.male[name]);
  info.modelVariants=Object.keys(modelURLs);
}
function select(id) {
  bridge.select(id);
  sync();
}
function nameButton(a, actor){
  const button=document.createElement("button");
  button.type="button";button.className="office-agent-select";
  button.dataset.agentId=a.id;
  button.dataset.color=a.color;
  button.setAttribute("aria-label","Seleziona agente 3D "+a.name);
  button.title=a.name+" · 3D";
  const text=document.createElement("span");
  text.textContent=a.name;
  const state=document.createElement("small");
  state.className="office-agent-mode";
  state.textContent="In ingresso";
  button.append(text,state);
  button.addEventListener("click",()=>select(a.id));
  pickLayer.appendChild(button);
  actor.hit=button;
}
function createDeskChair(position) {
  // Actual 3D furniture, fixed at the workstation instead of moving with an actor.
  // All dimensions use the avatar's world coordinate scale (roughly 0.9 units tall).
  const chair=new THREE.Group();
  const upholstery=new THREE.MeshStandardMaterial({color:0x526272,roughness:.88,metalness:.04});
  const base=new THREE.MeshStandardMaterial({color:0x47515c,roughness:.65,metalness:.18});
  const add=(geometry,material,x,y,z)=>{
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x,y,z);
    chair.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(.50,.068,.30),upholstery,0,.25,-.13);
  add(new THREE.BoxGeometry(.47,.46,.065),upholstery,0,.52,-.28);
  add(new THREE.CylinderGeometry(.025,.025,.22,10),base,0,.12,-.13);
  add(new THREE.BoxGeometry(.39,.04,.045),base,0,.045,-.13);
  for(const side of [-1,1]){
    add(new THREE.BoxGeometry(.045,.025,.24),base,side*.17,.04,-.13);
  }
  chair.position.copy(place(position));
  chair.position.z=-.28; // Backrest remains behind the rig, not in front of its legs.
  world.add(chair);
  return chair;
}
function build(a,index) {
  const style=safeStyle(a.modelStyle,index);
  const sex=style.startsWith("f")?"female":"male";
  const template=assets.models.get(style);
  if(!template)return;
  const holder=new THREE.Group();
  const body=cloneRig(template);
  holder.add(body);
  const bounds=new THREE.Box3().setFromObject(body);
  const size=bounds.getSize(new THREE.Vector3());
  const safeHeight=Math.max(size.y,.15);
  body.position.y-=bounds.min.y;
  const workstation=stages[index];
  const position=place(workstation.entry);
  holder.position.copy(position);
  // GLB skin rest-pose bounding boxes under-report actual animated extent:
  // calibrate against the photographed 2.5D office (not a full-world 3D camera).
  const factor=.36*(sex==="female"?1.45:1.50)*[1,.96,.85,.82][index]/safeHeight;
  const avatarHeight=safeHeight*factor;
  body.scale.setScalar(factor);
  // Remove the photographic desk-plane clip: it previously erased legs when
  // the seated body was lowered by almost its entire visible height.
  const deskChair=createDeskChair(workstation.desk);
  const shade=shadow();holder.add(shade);
  world.add(holder);
  const mixer=new THREE.AnimationMixer(body);
  const actions={};
  Object.entries(assets.clips[sex]).forEach(([name,clip])=>{
    if(clip) {
      actions[name]=mixer.clipAction(clip);
      actions[name].setLoop(THREE.LoopRepeat,Infinity);
    }
  });
  // Each worker has their own rhythm and a reserved desk; their motions are visual only.
  const actor={id:a.id,sex,index,style,color:a.color,role:a.role||"Analista",holder,body,mixer,actions,state:"",point:"entry",
    goal:"desk",from:place(workstation.entry),to:place(workstation.desk),travel:0,wait:0,
    next:0,routeIndex:0,closing:false,manualUntil:0,hit:null,
    pauseSeconds:0,routeNodes:[],yieldCount:0,yieldDelay:0,occupiedNode:null,
    motionSeed:index*2.71+.4,gestureTimer:0,workMode:"work",
    path:[],pathGoal:null,lastTransition:0,walkSpeed:1.6+index*.09,
    handBones:[],poseBones:{thigh:[],calf:[],arm:[],forearm:[],finger:[],spine:[],head:[]},
    restoredRotations:new Map(),baseBodyY:body.position.y,seatedWeight:0,
    chair:deskChair,avatarHeight,seatDrop:0,
    typingActive:false,arrivedCount:0,activity:"Ingresso",normalScale:factor,contactShadow:shade,depthScale:1};
  // Use the GLB's actual Biped forearms for subtle computer-working gestures.
  body.traverse(node=>{
    if(!node.isBone)return;
    const name=node.name.toLowerCase();
    if(/(forearm|fore_arm|lowerarm|lower_arm)/.test(name)){
      actor.handBones.push(node);actor.poseBones.forearm.push(node);
    } else if(/thigh|upperleg|upper_leg/.test(name))actor.poseBones.thigh.push(node);
    else if(/calf|shin|lowerleg|lower_leg/.test(name))actor.poseBones.calf.push(node);
    else if(/upperarm|upper_arm/.test(name))actor.poseBones.arm.push(node);
    else if(/spine/.test(name))actor.poseBones.spine.push(node);
    else if(/(finger|thumb|index|pinky|middle|ring)/.test(name))actor.poseBones.finger.push(node);
    else if(/head/.test(name))actor.poseBones.head.push(node);
  });
  // Absent rig groups never crash the page: UI still shows the agent at work.
  info.rigBones=info.rigBones||{};
  info.rigBones[a.id]=Object.fromEntries(Object.entries(actor.poseBones).map(([kind,nodes])=>[kind,nodes.length]));
  // Distinct accessible identity and subtle colored floor highlight; the eight
  // original GLBs already contain genuinely different faces, clothes and hair.
  const accent=new THREE.Mesh(
    new THREE.TorusGeometry(.22,.017,8,40),
    new THREE.MeshBasicMaterial({color:appearanceColors[a.color]||appearanceColors.blue,transparent:true,opacity:.80,depthWrite:false})
  );
  accent.rotation.x=Math.PI/2;
  accent.position.y=.05;
  holder.add(accent);actor.accent=accent;
  nameButton(a,actor);
  stagePeople.set(a.id,actor);
  moveToZone(actor,"desk");
  info.agents=Array.from(stagePeople.keys());
}
function postureClip(actor){
  // The asset pack has no licensed sit/typing clip; leg bends and keyboard
  // motions are built from its real Biped skeleton, blended over idle.
  if(actor.point==="desk")return "idle";
  if(actor.point==="meeting")return actor.actions.talk?"talk":"idle";
  return actor.actions.look?"look":"idle";
}
function updateClip(actor,next){
  if(actor.state===next)return;
  let action=actor.actions[next]||actor.actions.idle;
  const old=actor.actions[actor.state];
  if(action&&action!==old) {
    action.reset();action.enabled=true;action.play();
    if(old) action.crossFadeFrom(old,.32,false);
  }
  actor.state=next;
  const status=actor.hit?.querySelector(".office-agent-mode");
  if(status){
    status.textContent=actor.closing?"In uscita":
      next==="walk"?"Si sposta…":
      actor.point==="meeting"?"Parla con colleghi":
      actor.point==="lounge"?"Pausa caffè":
      next==="think"?"Controlla i dati":
      next==="look"?"Legge il monitor":
      actor.point==="desk"?"Al computer · seduto":"Al computer";
  }
}
// Graph-based aisle navigation avoids pictured workstations and keeps each
// employee at a fixed seat. Endpoints are the photographed furniture, not
// full physical mesh colliders.
function scenePoint(actor){
 const p=actor.holder.position;
 return {x:(p.x/DIM_X+.5)*100,y:(.5-p.y/DIM_Y)*100};
}
function nextSegment(actor){
 if(!actor.path.length)return false;
 const target=actor.path.shift();
 actor.occupiedNode=target.node;
 actor.from.copy(actor.holder.position);
 actor.to.copy(place(target));
 actor.travel=0;actor.yieldDelay=0;
 updateClip(actor,"walk");
 return true;
}
function moveToZone(actor,zone){
 if(!stages[actor.index]?.[zone])return false;
 const occupied=new Set([...stagePeople.values()].filter(x=>
   x.id!==actor.id && x.state==="walk" && x.occupiedNode).map(x=>x.occupiedNode));
 const steps=planOfficeRoute(scenePoint(actor),actor.index,zone,occupied);
 if(!steps.length)return false;
 actor.goal=zone;
 actor.wait=0;actor.gestureTimer=0;
 actor.path=steps;
 actor.routeNodes=steps.map(step=>step.node);
 actor.yieldDelay=0;
 return nextSegment(actor);
}
function hasTrafficConflict(actor,delta){
 const total=actor.to.clone().sub(actor.from);
 const progress=actor.holder.position.clone().addScaledVector(total,
  Math.min(.3,delta*actor.walkSpeed));
 for(const other of stagePeople.values()){
   if(other===actor || other.closing || other.state!=="walk")continue;
   // Smaller index gets right of way. This prevents mutual stand-offs.
   if(other.index>=actor.index)continue;
   const distance=progress.distanceTo(other.holder.position);
   if(distance<.53)return true;
 }
 return false;
}
function removeActor(actor){
  actor.hit?.remove();
  actor.mixer.stopAllAction();
  world.remove(actor.holder);
  if(actor.chair){
    world.remove(actor.chair);
    actor.chair.traverse(o=>{
      if(o.isMesh){o.geometry.dispose();o.material.dispose();}
    });
  }
  actor.accent.geometry.dispose();
  actor.accent.material.dispose();
  actor.body.traverse(o=>{
    // GLTF geometries/textures are shared, customized materials are private.
    if(o.isMesh){
      const mats=Array.isArray(o.material)?o.material:[o.material];
      mats.forEach(m=>m?.dispose?.());
    }
    if(o.isSkinnedMesh)o.skeleton?.dispose?.();
  });
  stagePeople.delete(actor.id);
  info.agents=Array.from(stagePeople.keys());
  // A new hire waiting for a fourth seat enters automatically as soon as
  // a vacation/retirement exit releases it. No extra UI click required.
  queueMicrotask(()=>{if(info.status==="ready")sync();});
}
function sync() {
  if(info.status!=="ready")return;
  const people=bridge.getAgents();
  const candidates=people.filter(a=>a.status==="available").slice(0,MAX_AGENTS);
  const wanted=new Set(candidates.map(a=>a.id));
  for(const [id,actor] of stagePeople) {
    const a=people.find(p=>p.id===id);
    if(a&&a.status==="available"&&safeStyle(a.modelStyle,actor.index)!==actor.style){
      removeActor(actor);
      continue;
    }
    if(a&&a.color!==actor.color){
      actor.color=a.color;
      actor.accent.material.color.setHex(appearanceColors[a.color]||appearanceColors.blue);
      actor.hit?.setAttribute("data-color",a.color);
    }
    if(!a||a.status!=="available"||!wanted.has(id)){
      if(!actor.closing) {
        actor.closing=true;
        actor.manualUntil=0;
        moveToZone(actor,"entry");
      }
    } else if(actor.closing){
      // A recalled employee must not disappear after a quick vacation toggle.
      actor.closing=false;
      moveToZone(actor,"desk");
    }
  }
  // Reserved desks must not jump around when another worker goes on leave.
  // Existing occupants keep their assigned workstation until they leave.
  const used=new Set([...stagePeople.values()].map(actor=>actor.index));
  candidates.forEach(a=>{
    if(a.status!=="available"||stagePeople.has(a.id))return;
    const index=[0,1,2,3].find(n=>!used.has(n));
    if(index===undefined)return;
    used.add(index);
    const style=safeStyle(a.modelStyle,index);
    if(assets.models.has(style))build(a,index);
    else if(!assets.modelPromises.has(style)){
      ensureModel(style).then(()=>{if(info.status==="ready")sync();}).catch(e=>{
        info.appearanceError="Unable to load character "+style;
        console.warn("Character variant unavailable:",style,e);
      });
    }
  });
  document.querySelectorAll(".agent-hotspot").forEach(el=>{
    el.classList.toggle("has-animated-agent",stagePeople.has(el.dataset.agentId));
  });
  const chosen=bridge.getSelected();
  stagePeople.forEach(actor=>actor.hit?.classList.toggle("selected",chosen===actor.id));
}
/**
 * Apply an additive procedural seated posture to the existing *rigged* GLB
 * character. Restore the baseline every frame, then let AnimationMixer
 * update it, then apply a fresh offset (prevents accumulating rotations).
 * The office remains a 2.5D background, not physical chair collisions.
 */
const xAxis=new THREE.Vector3(1,0,0);
const yAxis=new THREE.Vector3(0,1,0);
const tilt=new THREE.Quaternion();
function seatedPose(actor,delta,time){
  const target=actor.point==="desk"&&actor.state!=="walk"&&!actor.closing?1:0;
  actor.seatedWeight=THREE.MathUtils.damp(actor.seatedWeight,target,5.2,delta);
  const weight=actor.seatedWeight;
  // The former hard-coded .50 displacement was approximately a whole avatar
  // height. Keep the pelvis near the true 3D chair's seat, with smooth blending.
  actor.seatDrop=actor.avatarHeight*.29*weight;
  actor.body.position.y=actor.baseBodyY-actor.seatDrop;
  // Seated shoulders/head must actually drop to monitor height in this
  // orthographic 2.5D composition, not hover above the workstation.
  // Perspective-correct 2.5D sizing: smaller by the window, larger near camera.
  const yy=(.5-actor.holder.position.y/DIM_Y)*100;
  const distanceFactor=THREE.MathUtils.clamp(.85+yy*.00225,.93,1.06);
  actor.depthScale=distanceFactor;
  const scalar=actor.normalScale*distanceFactor;
  // Never squash the whole character by 14% to imitate sitting.
  actor.body.scale.set(scalar,scalar*(1-.025*weight),scalar);
  // A modest three-quarter view reveals knee bending; front-on rigs looked upright.
  const seatedFacing=(actor.index%2===0?-.48:.43)*weight;
  actor.body.rotation.y=THREE.MathUtils.damp(actor.body.rotation.y,seatedFacing,4.8,delta);
  actor.contactShadow.scale.setScalar(THREE.MathUtils.clamp(distanceFactor,.93,1.06));
  actor.contactShadow.material.opacity=(actor.state==="walk"?.70:.82)*(1-.10*weight);
  if(weight<.005)return;
  const signing=(key,angle,axis=xAxis)=>{
    const nodes=actor.poseBones[key];
    if(!nodes?.length)return;
    tilt.setFromAxisAngle(axis,angle*weight);
    for(const bone of nodes){
      actor.restoredRotations.set(bone,bone.quaternion.clone());
      bone.quaternion.multiply(tilt);
    }
  };
  // Biped thigh/calf hinges. Small spine lean and forward arms for typing.
  // Biped knee joints are oriented opposite to the naive local-X pose.
  // Forward thigh swing and opposing calf fold must be calibrated by
  // hip-to-knee joint coordinates, not by assuming the avatar label means seated.
  signing("thigh",-1.36);
  signing("calf",1.38);
  signing("spine",-.11);
  signing("arm",-.30);
  const isTyping=actor.point==="desk" && actor.workMode==="work" && !reducedMotion.matches;
  actor.typingActive=isTyping;
  const stroke=isTyping?.10*Math.sin(time*.009+actor.motionSeed):.01;
  const nodes=actor.poseBones.forearm;
  for(let i=0;i<nodes.length;i++){
    const bone=nodes[i];
    tilt.setFromAxisAngle(xAxis,weight*(-.5+(i%2===0?stroke:-stroke)));
    actor.restoredRotations.set(bone,bone.quaternion.clone());
    bone.quaternion.multiply(tilt);
  }
  // Finger bones oscillate in alternate pairs during desk work, not whole-arm flapping.
  if(isTyping){
    const fingers=actor.poseBones.finger;
    const max=Math.min(fingers.length,20);
    for(let i=0;i<max;i++){
      const bone=fingers[i];
      const pulse=.11*Math.max(0,Math.sin(time*.013+i*1.8+actor.motionSeed));
      tilt.setFromAxisAngle(xAxis,pulse*weight);
      actor.restoredRotations.set(bone,bone.quaternion.clone());
      bone.quaternion.multiply(tilt);
    }
  }
  // Gentle head movement while reading and talking, slightly different for
  // each worker; never continuously spin heads or accumulate bone rotations.
  if(!reducedMotion.matches && (actor.workMode==="look"||actor.point==="meeting")){
    signing("head",.042*Math.sin(time*.0012+actor.motionSeed),yAxis);
  }
}
function animateActor(actor,delta,time){
  for(const [bone,quaternion] of actor.restoredRotations)bone.quaternion.copy(quaternion);
  actor.restoredRotations.clear();
  actor.mixer.update(delta);
  if(actor.state==="walk"){
    const distance=actor.from.distanceTo(actor.to);
    const clip=actor.actions.walk;
    if(clip)clip.timeScale=THREE.MathUtils.clamp(.90+actor.walkSpeed*.09,.9,1.18);
    // Finish standing up before the character moves away from its chair.
    const standingDelay=actor.seatedWeight>.12;
    const traffic=hasTrafficConflict(actor,delta);
    if(traffic)actor.yieldCount+=actor.yieldDelay===0?1:0;
    actor.yieldDelay=traffic?actor.yieldDelay+delta:0;
    // Smooth easing at junctions and cautious right-of-way at intersections.
    const motionDelay=standingDelay||traffic;
    actor.travel=Math.min(1,actor.travel+(motionDelay?0:delta*actor.walkSpeed/Math.max(distance,.1)));
    const p=actor.travel;
    const f=p*p*(3-2*p);
    actor.holder.position.lerpVectors(actor.from,actor.to,Math.max(0,Math.min(1,f)));
    const dx=actor.to.x-actor.from.x;
    actor.body.rotation.y=THREE.MathUtils.lerp(actor.body.rotation.y,
      dx>.04?.35:dx<-.04?-.35:0,Math.min(1,delta*4.5));
    if(actor.travel>=1){
      if(nextSegment(actor))return;
      if(actor.closing){removeActor(actor);return;}
      actor.point=actor.goal;
      actor.occupiedNode=null;
      actor.arrivedCount++;
      actor.wait=0;
      actor.gestureTimer=0;
      actor.workMode="work";
      actor.pauseSeconds=dwellSeconds(actor.role,actor.point,actor.index,actor.routeIndex);
      updateClip(actor,postureClip(actor));
    }
  } else if(!actor.closing){
    actor.wait+=delta;
    actor.gestureTimer+=delta;
    // At desks, colleagues mainly work: subtle repeated shoulder/forearm movement
    // plus occasional glances, instead of non-stop walking.
    if(actor.point==="desk"){
      const cycle=actor.gestureTimer+actor.motionSeed;
      const nextMode=cycle%19>15?"look":cycle%19>9?"think":"work";
      if(nextMode!==actor.workMode){
        actor.workMode=nextMode;
        updateClip(actor,postureClip(actor));
      }

    }
    if(actor.wait>actor.pauseSeconds && !actor.sessionMeeting && !reducedMotion.matches && performance.now()>actor.manualUntil){
      actor.routeIndex++;
      const nextZone=nextRoutine(actor.role,actor.point,actor.index,actor.routeIndex);
      moveToZone(actor,nextZone);
    }
    // People in meeting occasionally switch between listening and speaking.
    if(actor.point==="meeting" && !actor.sessionMeeting && actor.gestureTimer>8+actor.index*2){
      actor.gestureTimer=0;
      updateClip(actor,actor.state==="talk"?"idle":(actor.actions.talk?"talk":"idle"));
    }
  }
  // A real person explicitly directs which avatar gestures during the meeting.
  // No spoken words or autonomous AI conversations are inferred here.
  if(actor.sessionMeeting && actor.point==="meeting" && actor.state!=="walk"){
    const requested=actor.sessionSpeaker&&actor.actions.talk?"talk":"idle";
    if(actor.state!==requested)updateClip(actor,requested);
  }
  // Posture is applied *after* the mixer and locomotion, with stable quaternions.
  seatedPose(actor,delta,time);
  if(actor.hit && actor.point==="desk" && actor.seatedWeight>.75){
    const label=actor.hit.querySelector(".office-agent-mode");
    if(label)label.textContent=actor.typingActive?"Seduto · digita al PC":
      actor.workMode==="look"?"Seduto · legge":"Seduto · lavora";
  }
  if(actor.hit){
    const projected=actor.holder.position.clone();
    projected.y+=actor.avatarHeight+.13-actor.seatDrop;
    projected.project(camera);
    actor.hit.style.left=(projected.x*.5+.5)*100+"%";
    actor.hit.style.top=(-projected.y*.5+.5)*100+"%";
  }
}

function loop(){
  if(info.status!=="ready"||!renderer)return;
  requestAnimationFrame(loop);
  if(document.hidden || !stage.getClientRects().length){clock.getDelta();return;}
  const dt=Math.min(clock.getDelta(),.05);
  const time=performance.now();
  stagePeople.forEach(actor=>animateActor(actor,dt,time));
  renderer.render(world,camera);
  info.frames++;
}
// Director-controlled group meeting positions and speaker gestures.
info.setMeetingSession=({participants=[],speakerId=""}={})=>{
  if(info.status!=="ready")return false;
  const active=new Set(participants);
  for(const actor of stagePeople.values()){
    const was=!!actor.sessionMeeting;
    actor.sessionMeeting=active.has(actor.id)&&!actor.closing;
    actor.sessionSpeaker=actor.sessionMeeting&&speakerId===actor.id;
    if(actor.sessionMeeting && !was && actor.goal!=="meeting"){
      actor.manualUntil=performance.now()+30000;
      moveToZone(actor,"meeting");
    }
    if(!actor.sessionMeeting && was && actor.goal==="meeting" && !actor.closing)
      moveToZone(actor,"desk");
  }
  return true;
};
// User-triggered directions are only visual commands, never real AI tasks.
info.command=(id,zone)=>{
  if(!["desk","meeting","lounge"].includes(zone)||info.status!=="ready")return false;
  const actor=stagePeople.get(id);
  if(!actor||actor.closing)return false;
  actor.manualUntil=performance.now()+30000;
  return moveToZone(actor,zone);
};
// Read-only rig diagnostics for visual QA: actual world-space joint contacts.
info.rigDiagnostics=(id)=> {
  const actor=stagePeople.get(id);
  if(!actor)return null;
  actor.body.updateMatrixWorld(true);
  const sample=(kind)=>actor.poseBones[kind].map(b=>{
    const p=b.getWorldPosition(new THREE.Vector3());
    return {name:b.name,parent:b.parent?.name||"",x:Number(p.x.toFixed(3)),y:Number(p.y.toFixed(3)),
      z:Number(p.z.toFixed(3)),rotation:[b.rotation.x,b.rotation.y,b.rotation.z].map(x=>Number(x.toFixed(2)))};
  });
  return {height:actor.avatarHeight,point:actor.point,
    seatedWeight:actor.seatedWeight,
    hips:actor.body.position.y,
    thighs:sample("thigh"),calves:sample("calf"),arms:sample("arm"),forearms:sample("forearm")};
};
info.snapshot=()=>Array.from(stagePeople.values()).map(a=>({
  id:a.id,point:a.point,goal:a.goal,animation:a.state,closing:a.closing,
  sessionMeeting:!!a.sessionMeeting,sessionSpeaker:!!a.sessionSpeaker,
  modelStyle:a.style,color:a.color,fingers:a.poseBones.finger.length,
  depthScale:Number(a.depthScale.toFixed(3)),shadowOpacity:Number(a.contactShadow.material.opacity.toFixed(2)),
  posture:a.seatedWeight>.75?"sitting":a.seatedWeight>.08?"transition":"standing",
  sittingBlend:Number(a.seatedWeight.toFixed(3)),typing:a.typingActive,
  avatarHeight:Number(a.avatarHeight.toFixed(3)),
  seatDrop:Number(a.seatDrop.toFixed(3)),
  chairVisible:Boolean(a.chair?.parent),clipEnabled:false,
  rigLegs:a.poseBones.thigh.length+a.poseBones.calf.length,
  activity:a.point==="desk"?"Al computer":a.point==="meeting"?"Riunione":a.point==="lounge"?"Pausa":"Ingresso",
  routeSegments:a.path.length,arrivals:a.arrivedCount,
  slot:a.index,role:a.role,pauseSeconds:a.pauseSeconds,
  routeNodes:a.routeNodes.slice(),occupiedNode:a.occupiedNode,yieldCount:a.yieldCount,
  location:{x:Number(((a.holder.position.x/DIM_X+.5)*100).toFixed(2)),
            y:Number(((.5-a.holder.position.y/DIM_Y)*100).toFixed(2))}
}));
function centerForMobile(){
  if(matchMedia("(max-width: 750px)").matches) {
    const delta=surface.scrollWidth-stage.clientWidth;
    if(delta>0) stage.scrollLeft=Math.max(0,delta*.52);
  }
}
// Viewport may change after the module has already loaded (desktop -> phone emulation,
// rotation, or returning to the office from another application section).
window.addEventListener("resize",()=>requestAnimationFrame(centerForMobile));
window.addEventListener("studio:office-visible",()=>requestAnimationFrame(centerForMobile));
async function init() {
  if(!renderer)return;
  try {
    await preload();
    info.status="ready";
    stage.classList.add("has-live-3d");
    sync();
    // Show the moving agents immediately on narrow phones (the office pans horizontally).
    centerForMobile();
    loop();
    window.dispatchEvent(new CustomEvent("studio:agents3d-ready",{detail:{count:info.agents.length}}));
  } catch(err){
    info.status="fallback-load-error";
    info.error=String(err.message||err).slice(0,130);
    console.warn("Live 3D models could not be loaded; office controls remain usable",err);
    renderer.domElement.remove();
  }
}
const lightStyles={
  day:{sky:0xf6f1e2,ground:0x5f594d,ambient:2.32,key:3.14,fill:1.15,exposure:1.19},
  evening:{sky:0xeaf0ff,ground:0x493f37,ambient:2.10,key:3.20,fill:1.70,exposure:1.25},
  night:{sky:0x9cb9ea,ground:0x343d52,ambient:1.90,key:2.35,fill:2.15,exposure:1.35}
};
function setEnvironmentLight(mode) {
  const preset=lightStyles[mode]||lightStyles.evening;
  const hemisphere=world.children.find(x=>x.isHemisphereLight);
  if(hemisphere) {
    hemisphere.color.setHex(preset.sky);hemisphere.groundColor.setHex(preset.ground);
    hemisphere.intensity=preset.ambient;
  }
  key.intensity=preset.key;
  key.color.setHex(mode==="night"?0xc5d9ff:0xffdec5);
  fill.intensity=preset.fill;
  fill.color.setHex(mode==="day"?0xa8bfc6:0x8cb5fc);
  if(renderer)renderer.toneMappingExposure=preset.exposure;
  info.environmentMode=mode;
}
window.addEventListener("studio:environment-light",e=>setEnvironmentLight(e.detail?.mode));
setEnvironmentLight(bridge.getMood()==="day"?"day":bridge.getMood()==="night"?"night":"evening");

window.addEventListener("studio:changed",sync);
init();
