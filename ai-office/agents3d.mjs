/**
 * AI OFFICE — Live 3D Agents, MVP (two people).
 * Real GLB rigged humans + separate Biped animation clips; three.js/WebGL.
 * MIT model/clip licensing: https://models.codelove.in/licensing
 * Motion is only a simulation of office presence, NEVER evidence of task execution.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneRig } from "three/addons/utils/SkeletonUtils.js";

const stage = document.getElementById("penthouseStage");
const surface = document.getElementById("penthouseSurface");
const bridge = window.AIOStudio;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const assetBase = "https://models.codelove.in";
const modelURLs = {
  female: assetBase + "/models/business-female-01.glb",
  male: assetBase + "/models/business-male-01.glb"
};
const clipURLs = {
  female: {
    idle: assetBase + "/animations/f_idle_neutral_01.glb",
    walk: assetBase + "/animations/f_walk_neutral_01.glb",
    talk: assetBase + "/animations/f_talk_01.glb"
  },
  male: {
    idle: assetBase + "/animations/m_idle_neutral_01.glb",
    walk: assetBase + "/animations/m_walk_neutral_01.glb",
    talk: assetBase + "/animations/m_talk_01.glb"
  }
};
const info = { status: "loading", agents: [], frames: 0, animationSource: "real-glb-clips" };
window.AIOAgents3D = info;
if (!stage || !surface || !bridge) throw new Error("Office scene is missing");

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const stages = [
  {
    entry: {x:56,y:91}, desk: {x:56,y:71}, lounge: {x:41,y:70},
    routes: ["desk","lounge","desk"], duration: [10,7,8]
  },
  {
    entry: {x:73,y:90}, desk: {x:68,y:73}, lounge: {x:78,y:66},
    routes: ["desk","lounge","desk"], duration: [11,7,8]
  }
];
const MAX_AGENTS = 2;
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
const assets={};
async function preload() {
  const bundles=await Promise.all(["female","male"].map(async sex=>{
    const [gltf,anim]=await Promise.all([
      loader.loadAsync(modelURLs[sex]),
      Promise.all(Object.entries(clipURLs[sex]).map(async ([name,url])=>{
        try { const g=await loader.loadAsync(url);return [name,g.animations[0]||null];}
        catch(e){console.warn("Animation unavailable:",name,sex);return [name,null];}
      }))
    ]);
    return [sex,{template:gltf.scene,animations:Object.fromEntries(anim)}];
  }));
  for(const [sex,bundle] of bundles) {
    if(!bundle.animations.idle || !bundle.animations.walk)
      throw new Error("Missing actual GLB idle/walk animation clips: "+sex);
    assets[sex]=bundle;
  }
  info.activeClips=["idle","walk"];
}
function select(id) {
  bridge.select(id);
  sync();
}
function nameButton(a, actor){
  const button=document.createElement("button");
  button.type="button";button.className="office-agent-select";
  button.dataset.agentId=a.id;
  button.setAttribute("aria-label","Seleziona agente 3D "+a.name);
  button.title=a.name+" · 3D";
  const text=document.createElement("span");
  text.textContent=a.name;
  button.append(text);
  button.addEventListener("click",()=>select(a.id));
  pickLayer.appendChild(button);
  actor.hit=button;
}
function build(a,index) {
  const sex=index===0?"female":"male";
  const source=assets[sex];if(!source)return;
  const holder=new THREE.Group();
  const body=cloneRig(source.template);
  holder.add(body);
  const bounds=new THREE.Box3().setFromObject(body);
  const size=bounds.getSize(new THREE.Vector3());
  const safeHeight=Math.max(size.y,.15);
  body.position.y-=bounds.min.y;
  const template=stages[index];
  const position=place(template.entry);
  holder.position.copy(position);
  // GLB skin rest-pose bounding boxes under-report actual animated extent:
  // calibrate against the photographed 2.5D office (not a full-world 3D camera).
  const factor=0.38*(index===0?1.45:1.50)/safeHeight;
  body.scale.setScalar(factor);
  const shade=shadow();holder.add(shade);
  world.add(holder);
  const mixer=new THREE.AnimationMixer(body);
  const actions={};
  Object.entries(source.animations).forEach(([name,clip])=>{
    if(clip) {
      actions[name]=mixer.clipAction(clip);
      actions[name].setLoop(THREE.LoopRepeat,Infinity);
    }
  });
  const actor={id:a.id,sex,index,holder,body,mixer,actions,state:"",point:"entry",
    from:place(template.entry),to:place(template.desk),travel:0,wait:0,
    next:0,routeIndex:0,closing:false,hit:null};
  nameButton(a,actor);
  stagePeople.set(a.id,actor);
  updateClip(actor,"walk");
  info.agents=Array.from(stagePeople.keys());
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
}
function move(actor,target){
  actor.from.copy(actor.holder.position);
  actor.to.copy(place(target));
  actor.travel=0;
  updateClip(actor,"walk");
}
function removeActor(actor){
  actor.hit?.remove();
  actor.mixer.stopAllAction();
  world.remove(actor.holder);
  actor.body.traverse(o=>{
    // GLTF geometries/textures are shared and cached for both instances.
    if(o.isSkinnedMesh)o.skeleton?.dispose?.();
  });
  stagePeople.delete(actor.id);
  info.agents=Array.from(stagePeople.keys());
}
function sync() {
  if(info.status!=="ready")return;
  const people=bridge.getAgents();
  const candidates=people.filter(a=>a.status!=="retired").slice(0,MAX_AGENTS);
  const wanted=new Set(candidates.map(a=>a.id));
  for(const [id,actor] of stagePeople) {
    const a=people.find(p=>p.id===id);
    if(!a||a.status!=="available"||!wanted.has(id)){
      if(!actor.closing) {
        actor.closing=true;
        move(actor,stages[actor.index].entry);
      }
    }
  }
  candidates.forEach((a,index)=>{
    if(a.status==="available"&&!stagePeople.has(a.id))build(a,index);
  });
  document.querySelectorAll(".agent-hotspot").forEach(el=>{
    el.classList.toggle("has-animated-agent",stagePeople.has(el.dataset.agentId));
  });
  const chosen=bridge.getSelected();
  stagePeople.forEach(actor=>actor.hit?.classList.toggle("selected",chosen===actor.id));
}
function animateActor(actor,delta,time){
  actor.mixer.update(delta);
  if(actor.state==="walk"){
    const distance=actor.from.distanceTo(actor.to);
    actor.travel=Math.min(1,actor.travel+delta*1.4/Math.max(distance,.1));
    const f=actor.travel*actor.travel*(3-2*actor.travel);
    actor.holder.position.lerpVectors(actor.from,actor.to,f);
    actor.body.rotation.y=THREE.MathUtils.lerp(actor.body.rotation.y,
      actor.to.x>actor.from.x?.20:-.20,.06);
    if(actor.travel>=1){
      if(actor.closing){removeActor(actor);return;}
      actor.wait=0;updateClip(actor,"idle");
    }
  } else if(!actor.closing) {
    actor.wait+=delta;
    const templates=stages[actor.index];
    if(actor.wait>7+actor.index*2&&!reducedMotion.matches) {
      actor.wait=0;
      actor.routeIndex=(actor.routeIndex+1)%templates.routes.length;
      move(actor,templates[templates.routes[actor.routeIndex]]);
    }
  }
  if(actor.hit){
    const rect=surface.getBoundingClientRect();
    const projected=actor.holder.position.clone();
    projected.y+=.85;
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
  stagePeople.forEach(actor=>animateActor(actor,dt));
  renderer.render(world,camera);
  info.frames++;
}
function centerForMobile(){
  if(matchMedia("(max-width: 750px)").matches) {
    const delta=surface.scrollWidth-stage.clientWidth;
    if(delta>0) stage.scrollLeft=Math.max(0,delta*.52);
  }
}
// Viewport may change after the module has already loaded (desktop -> phone emulation,
// rotation, or returning to the office from another application section).
window.addEventListener("resize",()=>requestAnimationFrame(centerForMobile));
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
window.addEventListener("studio:changed",sync);
init();
