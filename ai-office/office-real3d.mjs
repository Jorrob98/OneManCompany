/**
 * AI OFFICE STUDIO — Office 3D / original procedural room.
 * Real-time Three.js geometry; no embedded office photograph or screenshot.
 * Intentional limitation: the agents' *visual* motions are a simulation.
 * The actual personnel and task state comes from app.js in localStorage.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneRig } from "three/addons/utils/SkeletonUtils.js";

const bridge=window.AIOStudio;
const info={status:"loading",engine:"real-geometry-glb",frames:0,agents:[],
  quality:"desktop",targetFps:60,renderPixelRatio:1,fps:0,cameraMode:"panoramica"};
window.AIOOffice3D=info;
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const modelPaths={f1:"business-female-01",f2:"business-female-02",f3:"business-female-03",f4:"business-female-04",
  m1:"business-male-01",m2:"business-male-02",m3:"business-male-03",m4:"business-male-04"};
const models=new Map(),pendingModels=new Map(),clips={};
const rootURL="https://models.codelove.in";
function ensureModel(style){
 if(models.has(style))return Promise.resolve(models.get(style));
 if(!modelPaths[style])return Promise.reject(new Error("Unknown GLB model style"));
 if(!pendingModels.has(style)){
   const promise=loader.loadAsync(rootURL+"/models/"+modelPaths[style]+".glb")
     .then(glb=>{models.set(style,glb.scene);return glb.scene;})
     .finally(()=>pendingModels.delete(style));
   pendingModels.set(style,promise);
 }
 return pendingModels.get(style);
}
async function preloadHumans(){
  const people=bridge.getAgents().filter(a=>a.status==="available").slice(0,4);
  const keys=[...new Set(people.map((a,i)=>modelPaths[a.modelStyle]?a.modelStyle:["f1","m1","f2","m2"][i]))];
  // Load people and animation clips concurrently instead of waiting for all
  // models first and starting the animation downloads only afterwards.
  const animations=["f","m"].map(async sex=>{
    const [idle,walk]=await Promise.all([
      loader.loadAsync(rootURL+"/animations/"+sex+"_idle_neutral_01.glb"),
      loader.loadAsync(rootURL+"/animations/"+sex+"_walk_neutral_01.glb")
    ]);
    clips[sex]={idle:idle.animations[0],walk:walk.animations[0]};
    if(!clips[sex].idle||!clips[sex].walk)throw Error("Missing Biped animation "+sex);
  });
  await Promise.all([...keys.map(key=>ensureModel(key)),...animations]);
}
const mount=document.querySelector(".scene-wrap");
const original=document.getElementById("roomCanvas");
if (!mount || !original || !bridge) throw new Error("AI Office scene mount unavailable");
// WebGLRenderer reports unsupported or lost contexts inside boot().
// Do not allocate a throwaway second GPU context during startup.

let scene,camera,renderer,root,agency,night=true,selected="",resizeObserver=null,raf=0;
const interactive=[],agents=new Map(),mouse=new THREE.Vector2(),raycaster=new THREE.Raycaster(),hotspots=[];
let azimuth=1.04,elevation=.33,distance=21,dragging=false,dragDistance=0,startX=0,startY=0,lastX=0,lastY=0,frame=0;
const target=new THREE.Vector3(0,1.15,0);
const colors={ink:0x111827,stone:0x27303d,slate:0x384352,wood:0x9a6a50,woodLight:0xc3926b,
 copper:0xe9a16a,glass:0x6c9db8,blue:0x4189d9,cyan:0x65e1df,violet:0x9a8cf1,cream:0xffe3b7};
// Share static materials and geometry so dozens of repeated furnishings
// can be submitted as one WebGL instance draw instead of separate meshes.
const materialCache=new Map(),geometryCache=new Map(),batchableGeometry=new Set();
function mat(c,roughness=.63,metalness=.02){
 const key=[c,roughness,metalness].join(":");
 if(!materialCache.has(key))materialCache.set(key,
   new THREE.MeshStandardMaterial({color:c,roughness,metalness}));
 return materialCache.get(key);
}
const unitBox=new THREE.BoxGeometry(1,1,1);
batchableGeometry.add(unitBox);
function staticPrimitive(key,factory){
 if(!geometryCache.has(key)){
   const geo=factory();geometryCache.set(key,geo);batchableGeometry.add(geo);
 }
 return geometryCache.get(key);
}
function sphereGeometry(segments=16,vertical=12){
 return staticPrimitive("sphere:"+segments+":"+vertical,
   ()=>new THREE.SphereGeometry(1,segments,vertical));
}
function cylinderGeometry(rTop,rBottom,sides=16){
 const max=Math.max(rTop,rBottom,.0001);
 const upper=Number((rTop/max).toFixed(4)),lower=Number((rBottom/max).toFixed(4));
 const geometry=staticPrimitive("cylinder:"+upper+":"+lower+":"+sides,
   ()=>new THREE.CylinderGeometry(upper,lower,1,sides));
 return {geometry,max};
}
const dark=mat(0x151c27,.57,.32),darker=mat(0x0b111a,.62,.28),metal=mat(0x343f4a,.39,.78),
chrome=mat(0x8b9aa4,.27,.85),wood=mat(colors.wood,.7),woodPale=mat(colors.woodLight,.72),floorMat=mat(0x292f39,.2,.35),
sand=mat(0x77736c,.86),linen=mat(0x65717a,.96),warm=mat(0xe3b57f,.8),
foliage=[mat(0x1b5447,.86),mat(0x33735a,.86),mat(0x507d55,.8)];
const glow=(c,intensity=2)=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:intensity,roughness:.36});
const neonWarm=glow(0xffb46e,2.3),neonBlue=glow(0x74dafe,2.2),neonPurple=glow(0xa18bff,1.5);
function add(parent,object,x=0,y=0,z=0){
 object.position.set(x,y,z);parent.add(object);return object;
}
function box(parent,x,y,z,w,h,d,material,shadow=true){
 const m=new THREE.Mesh(unitBox,material);
 m.scale.set(w,h,d);
 m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m;
}
function cylinder(parent,x,y,z,rTop,rBottom,height,material,sides=16){
 const entry=cylinderGeometry(rTop,rBottom,sides);
 const m=new THREE.Mesh(entry.geometry,material);
 m.scale.set(entry.max,height,entry.max);
 m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function sphere(parent,x,y,z,r,material,segments=16){
 const m=new THREE.Mesh(sphereGeometry(segments,12),material);
 m.scale.setScalar(r);
 m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;
}
function strip(parent,a,b,r,material,sides=8){
 const delta=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a));
 const obj=new THREE.Mesh(cylinderGeometry(1,1,sides).geometry,material);
 obj.scale.set(r,delta.length(),r);
 obj.position.copy(new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5));
 obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
 parent.add(obj);return obj;
}
function plane(parent,x,y,z,w,h,material,rotationY=0){
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);
 mesh.position.set(x,y,z);mesh.rotation.y=rotationY;
 parent.add(mesh);return mesh;
}
function track(parent,x1,z1,x2,z2,y,material=neonWarm,width=.035){
 const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz);
 const m=box(parent,(x1+x2)/2,y,(z1+z2)/2,width,width,len,material,false);
 m.rotation.y=Math.atan2(dx,dz);return m;
}
function textureDraw(w,h,painter){
 const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext("2d");painter(ctx,w,h);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=renderer?.capabilities.getMaxAnisotropy?.()||1;return texture;
}
// Screen graphics deliberately identify themselves as demo; they are visual
// surfaces, not a fake live dashboard or fabricated agent results.
const displayCache=new Map();
function screenSurface(parent,x,y,z,w,h,kind="code",rotationY=0){
 if(!displayCache.has(kind)){
  const titles={code:"ATTIVITA",board:"PROGETTI",chart:"PANORAMICA",city:"WORKSPACE"};
  const title=titles[kind]||"WORKSPACE";
  const tx=textureDraw(512,300,(g,W,H)=>{
   const rect=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h);};
   const round=(x,y,w,h,r,c)=>{
     g.fillStyle=c;g.beginPath();g.roundRect(x,y,w,h,r);g.fill();
   };
   rect(0,0,W,H,"#111e28");
   rect(0,0,W,62,"#1b3040");
   round(20,19,20,20,5,"#b8dac9");
   g.fillStyle="#ecf8ee";g.font="700 24px Arial";g.fillText(title,55,41);
   round(377,20,111,24,10,"#294d4b");
   g.fillStyle="#c1eadc";g.font="700 12px Arial";g.fillText("●  DEMO",394,37);
   const values=kind==="chart"?["24","08","92%"]:kind==="board"?["06","03","02"]:["12","04","08"];
   const subtitles=kind==="chart"?["PANNELLI","AREA AI","REVISIONI"]:
     kind==="board"?["ATTIVI","IN CORSO","IN ATTESA"]:["APERTI","PRIORITA","ARCHIVIATI"];
   const tones=["#abdbcd","#9cbcdf","#e3c5a3"];
   for(let i=0;i<3;i++){
     const x=20+i*160;
     round(x,78,151,91,9,"#203846");
     rect(x+12,95,4,14,tones[i]);
     g.fillStyle="#b7cbd3";g.font="700 13px Arial";g.fillText(subtitles[i],x+24,107);
     g.fillStyle="#f2f4ee";g.font="700 37px Arial";g.fillText(values[i],x+17,151);
   }
   round(20,183,472,100,9,"#1b303d");
   g.fillStyle="#abc4c9";g.font="700 14px Arial";g.fillText("FLUSSO OPERATIVO",36,208);
   g.fillStyle="#91b7ac";g.font="11px Arial";g.fillText("ANTEPRIMA VISIVA",359,207);
   if(kind==="code"||kind==="city"){
     for(let i=0;i<4;i++){
       const y=225+i*14;
       round(35,y,14,6,2,tones[i%3]);
       round(59,y,185-i*19,6,2,"#50727a");
       round(280,y,140+i*9,6,2,"#344f5d");
     }
   }else{
     g.strokeStyle="#98ddc5";g.lineWidth=4;
     g.beginPath();
     for(let i=0;i<22;i++){
       const px=36+i*20,py=251-((Math.sin(i*.48)+.4*Math.cos(i*.91))*19+i*.62);
       if(i===0)g.moveTo(px,py);else g.lineTo(px,py);
     }
     g.stroke();
     for(let i=0;i<9;i++){
       round(40+i*49,257-(i%3)*6,27,5,2,i%2?"#668d9e":"#b4cfc2");
     }
   }
  });
  displayCache.set(kind,new THREE.MeshBasicMaterial({
   map:tx,side:THREE.DoubleSide,toneMapped:false
  }));
 }
 return plane(parent,x,y,z,w,h,displayCache.get(kind),rotationY);
}
let keyboardMaterial=null;
function keyboardSurface(){
 if(!keyboardMaterial){
   const tx=textureDraw(256,92,(g)=>{
     g.fillStyle="#23343d";g.fillRect(0,0,256,92);
     g.fillStyle="#293f49";g.fillRect(5,6,246,80);
     for(let row=0;row<4;row++){
       const len=row===3?9:13,space=row===3?23:17;
       for(let k=0;k<len;k++){
         const wide=row===3&&k===4?54:12;
         const x=12+k*space+(row%2)*3,y=12+row*18;
         g.fillStyle=k===3&&row===0?"#6ca497":"#a0b4b8";
         g.fillRect(x,y,wide,10);
       }
     }
   });
   keyboardMaterial=new THREE.MeshBasicMaterial({map:tx,side:THREE.DoubleSide,toneMapped:false});
 }
 return keyboardMaterial;
}
function roundedPanel(parent,x,y,z,w,h,d,material){
 box(parent,x,y,z,w,h,d,material);
 const edgeMat=mat(0x675f5f,.6,.65);
 box(parent,x,y-h*.44,z,w,0.025,d,edgeMat,false);
}
function wall(parent,x,y,z,w,h,d,material){
 return box(parent,x,y,z,w,h,d,material,false);
}
function carpet(x,z,w,d,c=0x525b5e){
 box(root,x,.095,z,w,.12,d,mat(c,.95),false);
 box(root,x,.167,z,w-.1,.009,d-.1,mat(c,.94),false);
}
function createShell(){
 const floor=mat(0xd7d5cd,.93),wall=mat(0xf3f0ea,.94),edge=mat(0xaeb7b3,.82);
 box(root,0,-.22,0,19.6,.42,14.8,wall,false);
 box(root,0,.035,0,19.2,.09,14.4,floor,false);
 for(let x=-9;x<9;x+=1.75)box(root,x,.087,0,.012,.009,14.4,edge,false);
 box(root,0,2.35,-7.2,19.6,4.7,.16,wall,false);
 box(root,-9.6,2.35,0,.16,4.7,14.3,wall,false);
 // Calm, genuinely geometric acoustic timber panels in the room itself.
 // Keep them on the back wall (behind chairs) and out of the camera path.
 const mutedWood=mat(0xc4b8a8,.95);
 const softSage=mat(0x9bb3aa,.97);
 for(let x=-8.7;x<-6.3;x+=.22)
   box(root,x,2.46,-6.992,.105,2.65,.045,mutedWood,false);
 for(let x=-5.85;x<-3.65;x+=.30)
   box(root,x,2.56,-6.99,.16,2.0,.038,softSage,false);
 box(root,-5.1,1.43,-6.92,2.35,.035,.09,mat(0x657e79,.95),false);
 const pane=new THREE.MeshPhysicalMaterial({color:0xe6f1f4,roughness:.4,transparent:true,
   opacity:.45,depthWrite:false,side:THREE.DoubleSide});
 for(let i=0;i<5;i++){
   const x=-7.8+i*3.5;
   box(root,x,2.7,-7.08,3.25,2.9,.025,pane,false);
   box(root,x,2.7,-7.01,.035,3.05,.08,edge,false);
 }
 for(let i=0;i<5;i++)box(root,-7.7+i*3.5,4.52,-7.05,2.9,.11,.18,edge,false);
}
function ledUnder(x,y,z,w,d){
 box(root,x,y,z,w,.035,d,neonWarm,false);
}
function pot(x,z,scale=1){
 const grp=new THREE.Group();root.add(grp);grp.position.set(x,0,z);
 cylinder(grp,0,.24*scale,0,.26*scale,.19*scale,.46*scale,mat(0x4c5557,.85),10);
 cylinder(grp,0,.45*scale,0,.215*scale,.215*scale,.025*scale,mat(0x242b28,.9),12);
 const leafMaterial=foliage;
 for(let j=0;j<8;j++){
   const angle=j*Math.PI*2/8,rad=.25+(j%2)*.10;
   strip(grp,[0,.46*scale,0],[Math.cos(angle)*rad*scale,(.85+(j%3)*.09)*scale,Math.sin(angle)*rad*scale],.014*scale,foliage[0]);
   const leaf=new THREE.Mesh(sphereGeometry(8,6),leafMaterial[j%3]);
   leaf.scale.set(.47*.22*scale,.85*.22*scale,.34*.22*scale);
   leaf.position.set(Math.cos(angle)*rad*scale,.87*scale+(j%3)*.06*scale,Math.sin(angle)*rad*scale);
   leaf.rotation.z=(j%2?-.5:.5);grp.add(leaf);
 }
 return grp;
}
function trellis(x,z){
 for(let i=0;i<4;i++)pot(x+i*.28,z+(i%2)*.12,.7+(i%3)*.2);
}
function lounge(){
 carpet(-6.35,-1.9,5.5,4.0,0x9b9b91);
 // L-shaped contemporary sofa
 box(root,-6.8,.43,-2.12,3.8,.75,.96,linen);
 box(root,-8.2,.45,-1.2,.9,.8,2.35,linen);
 box(root,-6.7,.93,-2.57,3.9,.74,.27,mat(0x89959b,.96));
 box(root,-8.65,.98,-1.2,.32,.9,2.3,mat(0x89959b,.93));
 for(let i=0;i<3;i++){const cushion=box(root,-7.77+i*.9,.91,-2.27,.7,.26,.5,mat([0xadb3a8,0x8995a1,0xa79b9d][i],.97));cushion.rotation.y=i%2?.16:-.12;}
 cylinder(root,-5.1,.38,-.8,.85,.85,.11,mat(0x29333e,.24,.5),32);
 cylinder(root,-5.1,.19,-.8,.08,.08,.27,chrome);
 pot(-4.7,-1.12,.68);
 // floor lamp
 cylinder(root,-3.8,.12,-3.53,.20,.20,.2,dark);
 cylinder(root,-3.8,1.52,-3.53,.033,.033,2.8,chrome);
 sphere(root,-3.8,2.95,-3.53,.29,glow(0xffd3a4,.85));
 // wall logo + acoustic panelling
 for(let i=0;i<16;i++)box(root,-9.18,1.25+i*.14,-2.85,.05,.045,3.1,mat(0x344239),false);
 // accent wordmark on side with canvas texture
 const label=textureDraw(420,210,(g)=>{
   g.clearRect(0,0,420,210);g.fillStyle="#e9e9dc";g.font="bold 46px Arial";
   g.fillText("AI",20,60);g.fillText("OFFICE",20,119);g.fillText("STUDIO",20,178);
   g.fillStyle="#74c6ed";g.fillRect(213,12,7,135);
 });
 plane(root,-9.2,2.25,-2.3,2.6,1.5,new THREE.MeshBasicMaterial({map:label,transparent:true,side:THREE.DoubleSide}),Math.PI/2);
 pot(-8.62,-4.9,1.15);pot(-3.9,-4.9,.85);
}
function desk(x,z,rot=0,size=1){
 const grp=new THREE.Group();root.add(grp);grp.position.set(x,0,z);grp.rotation.y=rot;grp.scale.setScalar(size);
 roundedPanel(grp,0,.81,0,2.9,.13,1.5,woodPale);
 for(const s of [-1,1])for(const v of [-1,1])box(grp,s*1.2,.42,v*.52,.07,.72,.07,metal);
 // under-desk LED
 box(grp,0,.69,.45,2.6,.025,.045,neonWarm,false);
 // fabric desk pad, keyboard and mouse
 box(grp,.16,.902,.27,1.5,.025,.48,mat(0x29313f,.84));
 box(grp,-.2,.92,.3,.57,.024,.22,mat(0x2a3f45,.84));
 const keys=plane(grp,-.2,.938,.3,.55,.21,keyboardSurface());
 keys.rotation.x=-Math.PI/2;
 box(grp,.50,.92,.36,.12,.03,.14,dark);
 // monitor back stand and visible screen
 box(grp,0,1.15,-.25,.08,.52,.08,metal);
 box(grp,0,1.56,-.26,1.36,.81,.095,mat(0x0d1726,.3,.28));
 screenSurface(grp,0,1.58,-.199,1.24,.71,x<-4?"board":x<0?"code":"chart");
 // side tablet + coffee mug
 box(grp,1.07,.91,.08,.42,.025,.35,mat(0x1c2938));
 cylinder(grp,-1.1,.98,.18,.10,.09,.18,mat(0xe6c6ae,.8),12);
 return grp;
}
function chair(x,z,rotation=0){
 const grp=new THREE.Group();root.add(grp);grp.position.set(x,0,z);grp.rotation.y=rotation;
 cylinder(grp,0,.32,0,.26,.18,.12,mat(0x222733));
 cylinder(grp,0,.51,0,.042,.042,.42,chrome);
 // Fabric executive chair: backrest behind the worker, not in front of GLB.
 // Former large black backrest at z=-.32 occluded nearly the whole person.
 const chairFabric=mat(0x647775,.95),chairEdge=mat(0x46585a,.70);
 roundedPanel(grp,0,.74,0,.77,.105,.69,chairFabric);
 const back=box(grp,0,1.13,.40,.68,.70,.115,chairFabric);
 back.rotation.x=-.09;
 box(grp,0,1.13,.474,.54,.52,.025,chairEdge,false);
 for(const dx of [-.40,.40]){
   box(grp,dx,.96,.08,.055,.045,.53,chairEdge);
   box(grp,dx,.77,.14,.035,.35,.035,chrome);
 }
 for(let i=0;i<5;i++){
   const theta=i*Math.PI*2/5;
   const ray=box(grp,Math.cos(theta)*.28,.15,Math.sin(theta)*.28,.43,.05,.055,metal);
   ray.rotation.y=-theta;
   cylinder(grp,Math.cos(theta)*.46,.077,Math.sin(theta)*.46,.06,.06,.05,dark,10);
 }
 return grp;
}
function deskPods(){
 carpet(-3.0,3.25,10.9,5.4,0x71827e);
 const locations=[[-6.3,2.15,0],[-2.95,2.15,0],[.55,2.15,0],[-5.05,5.05,0],[-1.40,5.05,0],[2.15,5.05,0]];
 for(const [x,z,rot] of locations){
   desk(x,z,rot,.9);chair(x,z+1.36);
 }
 // workstation dividers, storage, tray, pot
 for(const x of [-4.8,-1.5,1.82]){
   box(root,x,1.09,2.1,.065,.42,1.3,mat(0x6b7474,.9));
 }
 box(root,-7.7,.48,5.9,1.4,.92,.7,mat(0x43464b,.8));
 box(root,-7.7,.93,5.9,1.4,.045,.7,wood);
 pot(-7.95,5.78,.55);pot(3.3,6,.72);pot(-7.4,1.0,.8);
}
function meeting(){
 const x=1.5,z=-3.35;
 carpet(x,z,6.4,4.8,0x85918f);
 // privacy glass meeting suite (thin glass with metal structure).
 const glass=new THREE.MeshPhysicalMaterial({color:0x7aa0b8,metalness:.16,roughness:.08,transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false});
 // front transparent glass, left and right walls
 box(root,1.5,2,-.85,6.25,3.9,.045,glass,false);
 for(const xx of [-1.65,1.5,4.63])box(root,xx,2,-.85,.055,3.95,.065,metal,false);
 box(root,1.5,3.95,-.85,6.25,.07,.08,metal,false);
 box(root,-1.65,2,-3.35,.06,3.9,4.95,glass,false);
 box(root,-1.65,3.94,-3.35,.08,.08,4.96,metal,false);
 // meeting table and chairs
 roundedPanel(root,1.45,.83,-3.32,3.6,.13,1.55,mat(0x6d5549,.63));
 for(const xx of [.1,2.85])for(const zz of [-3.9,-2.8])box(root,xx,.44,zz,.08,.72,.07,metal);
 for(const xx of [.1,1.5,2.9]){chair(xx,-2.05,Math.PI);chair(xx,-4.65,0);}
 // glass wall mounted strategy screen (faces front)
 box(root,1.7,2.70,-6.58,3.4,1.78,.13,dark);
 screenSurface(root,1.7,2.7,-6.495,3.18,1.58,"board");
 // suspended warm halo
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.18,.044,10,64),neonWarm);
 ring.position.set(1.5,3.72,-3.34);ring.rotation.x=Math.PI/2;root.add(ring);
 for(let i=0;i<4;i++){
   const x=1.5+Math.cos(i*Math.PI/2)*1.17,z=-3.34+Math.sin(i*Math.PI/2)*1.17;
   strip(root,[x,3.75,z],[x,4.31,z],.012,chrome);
 }
 pot(4.1,-5.8,.7);pot(-1.1,-5.5,.8);
}
function commandCenter(){
 carpet(6.45,-2.2,4.3,6.2,0x343d4b);
 box(root,7.22,2.5,-6.6,4.22,2.55,.17,dark);
 screenSurface(root,7.22,2.5,-6.49,3.98,2.33,"chart");
 // two monolithic console desks, blue lighting
 desk(7.35,-3.3,0,.92);chair(7.35,-1.85);
 // Wall-mounted rack storage with cyan status LEDs
 for(let j=0;j<3;j++){
   const z=-5.1+j*.75;
   box(root,9.1,.56,z,1,.98,.52,metal);
   box(root,9.1,.56,z+.28,.64,.68,.018,dark);
   for(let k=0;k<4;k++)box(root,8.85+k*.14,.66,z+.3,.055,.045,.018,neonBlue,false);
 }
 pot(4.65,-5.5,.78);pot(9,-.7,.8);
}
function partitionsAndLighting(){
 for(const z of [.4,5.85]){
   track(root,-8.85,z,4.25,z,.085,neonWarm,.035);
 }
 // linear architectural strips on walls
 for(let i=0;i<3;i++){
   const l=box(root,-8.97,1.15+i*.85,3.3,.035,.025,3.8,neonBlue,false);
   l.material=neonWarm;
 }
 // floor terminal planters along entrance
 for(let i=0;i<4;i++)pot(-8.2+i*.38,6.2,.62+(i%2)*.17);
}
// Seats, GLB rigs and office all inhabit the SAME metric 3D space.
const seats=[[-6.3,3.51],[-2.95,3.51],[.55,3.51],[2.15,6.41]];
function aimBone(bone,child,direction,weight){
 if(!child)return;
 const from=child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3()));
 if(from.lengthSq()<1e-7)return;
 const wanted=from.clone().normalize().lerp(direction.clone().normalize(),weight).normalize();
 const adjust=new THREE.Quaternion().setFromUnitVectors(from.normalize(),wanted);
 const q=bone.getWorldQuaternion(new THREE.Quaternion());
 bone.quaternion.multiply(q.clone().invert().multiply(adjust).multiply(q));
 bone.updateMatrixWorld(true);
}
function person(a,index){
 const key=models.has(a.modelStyle)?a.modelStyle:["f1","m1","f2","m2"][index%4];
 const body=cloneRig(models.get(key)),g=new THREE.Group(),[x,z]=seats[index%seats.length];
 agency.add(g);g.position.set(x,0,z);g.rotation.y=Math.PI;g.add(body);
 const bounds=new THREE.Box3().setFromObject(body);
 const scale=1.77/Math.max(.1,bounds.getSize(new THREE.Vector3()).y);
 body.scale.setScalar(scale);body.position.y=-bounds.min.y*scale;
 const mixer=new THREE.AnimationMixer(body),sex=key[0],idle=mixer.clipAction(clips[sex].idle);
 idle.play();
 const walk=mixer.clipAction(clips[sex].walk);walk.enabled=true;
 const limbs={thigh:[],calf:[],foot:[],arm:[],forearm:[]};
 body.traverse(obj=>{
   if(obj.isMesh){obj.castShadow=true;obj.userData.agentId=a.id;interactive.push(obj);}
   if(!obj.isBone)return;
   const n=obj.name.toLowerCase();
   if(/thigh|upperleg/.test(n))limbs.thigh.push(obj);
   else if(/calf|shin|lowerleg/.test(n))limbs.calf.push(obj);
   else if(/foot|ankle/.test(n))limbs.foot.push(obj);
   else if(/forearm|lowerarm/.test(n))limbs.forearm.push(obj);
   else if(/upperarm/.test(n))limbs.arm.push(obj);
 });
 // Runtime GLB skeletons can extend far beyond the bind-pose bounding box.
 // Calibrate using the ACTUAL animated hip-to-ankle distance, in this same 3D
 // room. This prevents 5.9m-high hips hovering over .79m-high chairs.
 mixer.update(.016);
 body.updateMatrixWorld(true);
 const meanY=(bones)=>bones.reduce((v,b)=>v+b.getWorldPosition(new THREE.Vector3()).y,0)/Math.max(1,bones.length);
 if(limbs.thigh.length>=2&&limbs.foot.length>=2){
   const measuredLeg=meanY(limbs.thigh)-meanY(limbs.foot);
   if(measuredLeg>.12 && Number.isFinite(measuredLeg)){
     const correction=THREE.MathUtils.clamp(.84/measuredLeg,.08,8);
     body.scale.multiplyScalar(correction);
     body.position.y*=correction;
     body.updateMatrixWorld(true);
   }
   const sole=meanY(limbs.foot);
   body.position.y+=.06-sole;
   body.updateMatrixWorld(true);
 }
 const tag=textureDraw(340,85,(c)=>{
   c.fillStyle="#23434c";c.fillRect(0,0,340,85);
   c.font="bold 30px Arial";c.fillStyle="white";c.textAlign="center";
   c.fillText(String(a.name).slice(0,15),170,56);
 });
 const label=plane(g,0,2.13,0,1.38,.33,new THREE.MeshBasicMaterial({
   map:tag,side:THREE.DoubleSide,transparent:true,depthWrite:false}));
 const halo=new THREE.Mesh(new THREE.RingGeometry(.34,.41,32),
   new THREE.MeshBasicMaterial({color:0x45a19e,side:THREE.DoubleSide}));
 halo.rotation.x=-Math.PI/2;halo.position.y=.10;g.add(halo);
 agents.set(a.id,{g,body,mixer,idle,walk,wasWalking:false,limbs,label,halo,baseY:body.position.y,
   seatY:.79,index,slot:{x,z},modelStyle:key,point:"desk",goal:"desk",sit:0});
}
function detachAgent(id){
 const a=agents.get(id);
 if(!a)return;
 a.mixer.stopAllAction();
 a.mixer.uncacheRoot(a.body);
 // GLB geometry/material are shared with cached templates; only free per-agent
 // labels, markers and their textures, never those GLB shared assets.
 const removed=new Set();
 a.body.traverse(o=>{if(o.isMesh)removed.add(o);});
 for(let i=interactive.length-1;i>=0;i--){
   if(removed.has(interactive[i]))interactive.splice(i,1);
 }
 if(a.label.material.map)a.label.material.map.dispose();
 a.label.material.dispose();a.label.geometry.dispose();
 a.halo.material.dispose();a.halo.geometry.dispose();
 agency.remove(a.g);agents.delete(id);
}
function syncPeople(){
 const list=bridge.getAgents().filter(a=>a.status==="available").slice(0,4);
 const ids=new Set(list.map(x=>x.id));
 for(const id of agents.keys())if(!ids.has(id))detachAgent(id);
 list.forEach((a,i)=>{
   const actor=agents.get(a.id);
   if(actor&&actor.modelStyle===a.modelStyle){
     // Rebind seats when the roster order changes after vacation/retirement.
     actor.index=i;
     const [x,z]=seats[i%seats.length];
     if(actor.slot.x!==x||actor.slot.z!==z)actor.slot={x,z};
     return;
   }
   if(actor)detachAgent(a.id);
   if(!models.has(a.modelStyle)){
     ensureModel(a.modelStyle).then(()=>syncPeople()).catch(error=>{
       info.modelWarning="A selected 3D character failed to load";
       console.warn("AI OFFICE optional model unavailable",error?.name||"load-error");
     });
   }else person(a,i);
 });
 selected=bridge.getSelected();
 for(const [id,a] of agents){a.halo.visible=id===selected;a.label.visible=id===selected;}
 info.agents=[...agents.keys()];
 info.pickableMeshes=interactive.length;
 info.pendingModelLoads=pendingModels.size;
 window.AIOAgents3D.agents=info.agents.slice();
}
info.rigContact=(id)=>{
 const a=agents.get(id);
 if(!a)return null;
 a.body.updateMatrixWorld(true);
 const y=b=>Number(b.getWorldPosition(new THREE.Vector3()).y.toFixed(3));
 return {seatY:a.seatY,blend:Number(a.sit.toFixed(3)),
   hips:a.limbs.thigh.map(y),knees:a.limbs.calf.map(y),
   ankles:a.limbs.foot.map(y),bodyY:Number(a.body.position.y.toFixed(3))};
};
window.AIOAgents3D={
 status:"loading",agents:[],
 command:(id,zone)=>{
   if(!["desk","meeting","lounge"].includes(zone)||!agents.has(id))return false;
   agents.get(id).goal=zone;return true;
 },
 snapshot:()=>[...agents.entries()].map(([id,a])=>({
   id,point:a.point,goal:a.goal,slot:a.index,modelStyle:a.modelStyle,
   position:{x:Number(a.g.position.x.toFixed(3)),z:Number(a.g.position.z.toFixed(3))},
   sittingBlend:Number(a.sit.toFixed(2)),posture:a.sit>.90?"sitting":"standing",
   realGeometry:true,chairY:.805
 })),
 setMeetingSession:()=>true
};
// Merge identical static box meshes with InstancedMesh after all furniture
// is constructed. World matrices preserve nested desk rotations/scales.
// Transparent meshes and moving GLBs stay untouched, maintaining correct order.
function batchFurniture(){
  root.updateMatrixWorld(true);
  const buckets=new Map();
  root.traverse(o=>{
    if(!o.isMesh || !batchableGeometry.has(o.geometry) || o.material.transparent)return;
    const k=o.material.uuid+":"+String(o.castShadow)+":"+String(o.receiveShadow);
    if(!buckets.has(k))buckets.set(k,[]);
    buckets.get(k).push(o);
  });
  let objects=0,batches=0;
  for(const bucket of buckets.values()){
    if(bucket.length<2)continue;
    const first=bucket[0];
    const merged=new THREE.InstancedMesh(unitBox,first.material,bucket.length);
    merged.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    merged.castShadow=first.castShadow;
    merged.receiveShadow=first.receiveShadow;
    merged.frustumCulled=false; // matrices use world coordinates across room
    bucket.forEach((o,i)=>{
      merged.setMatrixAt(i,o.matrixWorld);
      o.parent.remove(o);
    });
    merged.instanceMatrix.needsUpdate=true;
    root.add(merged);
    batches++;
    objects+=bucket.length;
  }
  info.batching={sourceMeshes:objects,drawBatches:batches,
    cachedGeometries:geometryCache.size,sharedMaterials:materialCache.size};
}
function selectAgent(id){
 bridge.select(id);syncPeople();
}
function lights(){
 scene.add(new THREE.AmbientLight(0xf0f5f1,.62));
 const hemi=new THREE.HemisphereLight(0xf3f6ef,0xaeb2a7,1.25);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xfff3e3,2.15);
 sun.position.set(-7,13,9);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);
 sun.shadow.radius=3;
 sun.shadow.camera.left=-13;sun.shadow.camera.right=13;sun.shadow.camera.top=14;sun.shadow.camera.bottom=-14;
 sun.shadow.normalBias=.035;sun.shadow.bias=-.00013;scene.add(sun);
 const key=new THREE.PointLight(0xffeddb,4.5,12,2);key.position.set(1.5,3.1,-3.3);scene.add(key);
 const accent=new THREE.PointLight(0xd2e7ef,3,12,2);accent.position.set(7,2.5,-4.8);scene.add(accent);
 const loungeLight=new THREE.PointLight(0xffe9d8,4,12,2);loungeLight.position.set(-5,2.9,-2.5);scene.add(loungeLight);
 return {sun,key,accent,loungeLight,hemi};
}
const cameraDestination=new THREE.Vector3(),cameraLookAt=new THREE.Vector3();
let cameraInitialized=false;
function cameraUpdate(){
 elevation=THREE.MathUtils.clamp(elevation,.25,.95);
 distance=THREE.MathUtils.clamp(distance,9,38);
 cameraDestination.set(target.x+distance*Math.sin(azimuth)*Math.cos(elevation),
    target.y+distance*Math.sin(elevation),target.z+distance*Math.cos(azimuth)*Math.cos(elevation));
 if(!cameraInitialized){
   camera.position.copy(cameraDestination);cameraLookAt.copy(target);
   camera.lookAt(target);cameraInitialized=true;
 }
}
let lastMobile=null, cameraMode=0;
function cameraPreset(mode){
 cameraMode=mode;
 info.cameraMode=["panoramica","postazioni","dipendente"][mode];
 if(mode===0){target.set(-2.25,1.10,.55);distance=17.8;elevation=.34;}
 else if(mode===1){target.set(lastMobile?-3.15:-2.9,1.07,3.45);
   distance=lastMobile?9.6:13.4;elevation=lastMobile?.29:.34;}
 else{
   const a=agents.get(selected)||agents.values().next().value;
   target.set(a?.g.position.x??-2.9,1.1,a?.g.position.z??3.5);
   distance=9.8;elevation=.30;
 }
 cameraUpdate();
}
function resize(){
 const rect=mount.getBoundingClientRect();
 if(!rect.width||!rect.height||!renderer)return;
 const w=Math.max(1,Math.floor(rect.width)),h=Math.max(1,Math.floor(rect.height));
 camera.aspect=w/h;camera.fov=w<660?40:38;camera.updateProjectionMatrix();
 const mobile=w<660;
 info.quality=mobile?"mobile":"desktop";
 info.targetFps=mobile||reducedMotion.matches?30:60;
 qualityPixels=Math.min(window.devicePixelRatio||1,mobile?1.24:1.65);
 renderer.setPixelRatio(qualityPixels);
 renderer.setSize(w,h,false);
 renderer.shadowMap.enabled=!mobile;
 info.renderPixelRatio=qualityPixels;
 slowFrames=0;qualityWindow=performance.now();
 if(lastMobile!==mobile){
   lastMobile=mobile;
   frameIntervals.length=0;
   info.metrics=null;
   // Mobile starts on people, not a tiny overhead dollhouse.
   cameraPreset(mobile?1:0);
 }
}
function pointXY(event){
 const r=renderer.domElement.getBoundingClientRect();
 return new THREE.Vector2(((event.clientX-r.left)/r.width)*2-1,-((event.clientY-r.top)/r.height)*2+1);
}
const activePointers=new Map();
let previousPinch=null;
function pointerDown(e){
 activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 dragging=true;startX=lastX=e.clientX;startY=lastY=e.clientY;dragDistance=0;
 if(activePointers.size>1){dragDistance=999;previousPinch=null;}
 renderer.domElement.setPointerCapture(e.pointerId);
}
function pointerMove(e){
 if(!activePointers.has(e.pointerId))return;
 activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(activePointers.size===2){
   const [a,b]=[...activePointers.values()];
   const pinch=Math.hypot(a.x-b.x,a.y-b.y);
   if(previousPinch&&pinch>8){
     distance=THREE.MathUtils.clamp(distance*previousPinch/pinch,9,38);
     cameraUpdate();
   }
   previousPinch=pinch;dragDistance=999;
   return;
 }
 if(!dragging)return;
 const dx=e.clientX-lastX,dy=e.clientY-lastY;
 dragDistance+=Math.abs(dx)+Math.abs(dy);
 if(dragDistance>2){
   azimuth=THREE.MathUtils.clamp(azimuth-dx*.006,.46,1.34);
   elevation=THREE.MathUtils.clamp(elevation+dy*.004,.25,.95);
   cameraUpdate();
 }
 lastX=e.clientX;lastY=e.clientY;
}
function pointerUp(e){
 const single=activePointers.size===1;
 activePointers.delete(e.pointerId);
 if(single&&dragging&&dragDistance<12){
   raycaster.setFromCamera(pointXY(e),camera);
   const list=raycaster.intersectObjects(interactive,false);
   if(list.length){
     const id=list[0].object.userData.agentId;
     if(id)selectAgent(id);
   }
 }
 dragging=false;previousPinch=null;
}
function hookup(){
 renderer.domElement.addEventListener("pointerdown",pointerDown);
 renderer.domElement.addEventListener("pointermove",pointerMove);
 renderer.domElement.addEventListener("pointerup",pointerUp);
 renderer.domElement.addEventListener("pointercancel",e=>{
   activePointers.delete(e.pointerId);dragging=false;previousPinch=null;
 });
 renderer.domElement.addEventListener("wheel",e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.015,9,38);cameraUpdate();},{passive:false});
 document.getElementById("roomZoom").addEventListener("click",()=>{
   cameraPreset((cameraMode+1)%3);
   document.getElementById("roomZoom").title="Camera: "+info.cameraMode;
 });
 document.getElementById("roomMood").addEventListener("click",()=>{
   // Listen after app.js changes the actual mood state.
   queueMicrotask(()=>setMood(bridge.getMood()));
 });
 window.addEventListener("studio:changed",syncPeople);
 resizeObserver=new ResizeObserver(resize);resizeObserver.observe(mount);
}
let illumination;
function setMood(mood){
 night=mood==="night"||mood==="evening";
 const background=night?0xc8d5d8:0xeaf1ed;
 scene.background.setHex(background);
 scene.fog.color.setHex(background);
 illumination.sun.intensity=night?1.75:2.35;
 illumination.accent.intensity=night?2.7:2.0;
 illumination.key.intensity=night?4.1:4.8;
 illumination.loungeLight.intensity=night?3.7:4.3;
 renderer.toneMappingExposure=night?1.08:1.13;
}
let prev=0,slowFrames=0,qualityWindow=0,qualityPixels=1,actualFrames=0;
const labelParentQuat=new THREE.Quaternion();
const frameIntervals=[];
function recordFrameInterval(ms){
  if(!Number.isFinite(ms)||ms<=0||ms>1000)return;
  frameIntervals.push(ms);
  if(frameIntervals.length>120)frameIntervals.shift();
}
function publishFrameStats(){
  if(frameIntervals.length<12)return;
  const sorted=frameIntervals.slice().sort((a,b)=>a-b);
  const quantile=p=>Number(sorted[Math.min(sorted.length-1,Math.ceil(p*sorted.length)-1)].toFixed(1));
  const sum=frameIntervals.reduce((a,b)=>a+b,0);
  const average=sum/frameIntervals.length;
  info.metrics={
    source:"observed-render-cadence-not-GPU-timing",
    sampleCount:frameIntervals.length,
    observedFps:Number((1000/average).toFixed(1)),
    p50IntervalMs:quantile(.5),
    p95IntervalMs:quantile(.95),
    targetFps:info.targetFps,
    quality:info.quality,
    pixelRatio:info.renderPixelRatio
  };
  info.fps=info.metrics.observedFps;
}
const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
function animate(t){
 raf=requestAnimationFrame(animate);
 if(document.hidden){prev=0;frameIntervals.length=0;return;}
 // Skip heavy WebGL and skeleton calculations above 60fps desktop / 30fps mobile.
 const interval=1000/info.targetFps;
 if(prev && t-prev<interval*.88)return;
 const elapsed=prev?t-prev:interval;
 // Rendering/rigging stay capped, but navigation uses elapsed wall time:
 // under a slow GPU a worker must not take minutes to cross the same room.
 const motionDt=Math.min(.25,elapsed/1000);
 const dt=Math.min(.05,motionDt);prev=t;
 actualFrames++;
 if(prev && actualFrames>1)recordFrameInterval(elapsed);
 const budget=info.targetFps===30?38:25;
 slowFrames=THREE.MathUtils.clamp(slowFrames+(elapsed>budget?1.5:-.36),0,80);
 if(t-qualityWindow>4000){
   qualityWindow=t;
   const max=info.quality==="mobile"?1.24:1.65;
   const next=slowFrames>22?Math.max(info.quality==="mobile"?.95:1,qualityPixels-.15):
     slowFrames<5?Math.min(max,qualityPixels+.08):qualityPixels;
   if(Math.abs(next-qualityPixels)>.03){
     qualityPixels=Number(next.toFixed(2));
     renderer.setPixelRatio(qualityPixels);
     info.renderPixelRatio=qualityPixels;
   }
 }
 for(const [id,a] of agents){
   const dest=a.goal==="desk"?new THREE.Vector3(a.slot.x,0,a.slot.z):
     a.goal==="meeting"?new THREE.Vector3(1+a.index*.8,0,-1.65):
       new THREE.Vector3(-5.5+a.index*.45,0,-.5);
   const walking=a.g.position.distanceTo(dest)>.05;
   a.sit=THREE.MathUtils.damp(a.sit,!walking&&a.goal==="desk"?1:0,3.5,motionDt);
   const canWalk=walking&&a.sit<.10;
   if(canWalk!==a.wasWalking){
     if(canWalk){a.walk.reset().play();a.walk.crossFadeFrom(a.idle,.22,false);}
     else {a.idle.reset().play();a.idle.crossFadeFrom(a.walk,.22,false);}
     a.wasWalking=canWalk;
   }
   a.mixer.update(dt);
   a.body.position.y=a.baseY;
   a.body.updateMatrixWorld(true);
   if(a.sit>.001){
     for(const thigh of a.limbs.thigh){
       const knee=a.limbs.calf.find(c=>c.parent===thigh);
       if(!knee)continue;
       aimBone(thigh,knee,new THREE.Vector3(0,-.05,-1),a.sit);
       const foot=a.limbs.foot.find(f=>f.parent===knee);
       if(foot)aimBone(knee,foot,new THREE.Vector3(0,-1,0),a.sit);
     }
     a.body.updateMatrixWorld(true);
     if(a.limbs.thigh.length){
       const hip=a.limbs.thigh.reduce((v,b)=>v+b.getWorldPosition(new THREE.Vector3()).y,0)/a.limbs.thigh.length;
       a.body.position.y+=THREE.MathUtils.clamp((a.seatY-hip)*a.sit,-.45,.45);
       a.body.updateMatrixWorld(true);
     }
   }
   if(canWalk){
     a.g.position.lerp(dest,1-Math.exp(-2.1*motionDt));
     if(a.g.position.distanceTo(dest)<.05){a.g.position.copy(dest);a.point=a.goal;}
   }else if(!walking){
     // A seated agent must first stand up, then walk; never claim it has
     // reached the next room while it is still blending out of the chair.
     a.point=a.goal;
   }
   // GLB actors are turned toward their desks (parent yaw=PI). Copying the
   // camera quaternion as a LOCAL child rotation mirrored the nameplate.
   // Convert camera WORLD orientation into the label parent's coordinates.
   a.g.getWorldQuaternion(labelParentQuat);
   a.label.quaternion.copy(labelParentQuat.invert().multiply(camera.quaternion));
   a.label.visible=id===selected;
   a.halo.visible=id===selected;
 }
 // In "dipendente" view the camera must follow the selected GLB while it
 // walks: formerly it focused only once, leaving the person outside frame.
 if(cameraMode===2){
   const followed=agents.get(selected)||agents.values().next().value;
   if(followed){
     const followBlend=1-Math.exp(-3.5*motionDt);
     target.x=THREE.MathUtils.lerp(target.x,followed.g.position.x,followBlend);
     target.y=THREE.MathUtils.lerp(target.y,1.1,followBlend);
     target.z=THREE.MathUtils.lerp(target.z,followed.g.position.z,followBlend);
     cameraUpdate();
     info.following=selected;
   }else{
     info.following=null;
   }
 }
 // Damped camera motion prevents abrupt cuts when changing view or using touch.
 const blend=1-Math.exp(-7.5*motionDt);
 camera.position.lerp(cameraDestination,blend);
 cameraLookAt.lerp(target,blend);
 camera.lookAt(cameraLookAt);
 // Keep the actual camera target current on every rendered frame; a snapshot
 // only every 24 frames lagged several seconds on slower mobile/WebGL devices.
 info.cameraTarget={x:Number(target.x.toFixed(3)),
   y:Number(target.y.toFixed(3)),z:Number(target.z.toFixed(3))};
 renderer.render(scene,camera);
 info.frames++;
 if(info.frames%24===0){
   publishFrameStats();
   info.renderStats={
     drawCalls:renderer.info.render.calls,
     triangles:renderer.info.render.triangles,
     gpuGeometries:renderer.info.memory.geometries
   };
 }
}
async function boot(){
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.10;
  renderer.shadowMap.enabled=!matchMedia("(max-width: 660px)").matches;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.className="office3d-canvas";
  renderer.domElement.setAttribute("aria-label","Ufficio tridimensionale interattivo: trascina per ruotare, scorri per ingrandire e tocca un agente per selezionarlo");
  renderer.domElement.setAttribute("tabindex","0");
  scene=new THREE.Scene();scene.background=new THREE.Color(0xe1e8e8);scene.fog=new THREE.FogExp2(0xe1e8e8,.003);
  root=new THREE.Group();scene.add(root);
  agency=new THREE.Group();scene.add(agency);
  camera=new THREE.PerspectiveCamera(38,1,.1,90);
  illumination=lights();
  floorMat.color.setHex(0xd6d3ca);woodPale.color.setHex(0xd2bda3);
  metal.color.setHex(0x62726f);chrome.color.setHex(0x96a5a1);
  linen.color.setHex(0x85928b);dark.color.setHex(0x293943);
  neonWarm.emissiveIntensity=.045;neonBlue.emissiveIntensity=.08;
  neonPurple.emissiveIntensity=.04;
  createShell();deskPods();lounge();meeting();
  batchFurniture();
  await preloadHumans();
  syncPeople();setMood(bridge.getMood());cameraUpdate();
  mount.insertBefore(renderer.domElement,original);
  original.style.visibility="hidden";mount.classList.add("real3d-active");
  document.querySelector(".room-hint").innerHTML="<span class='hint-icon'>⌖</span> Trascina per ruotare · Tocca un agente";
  const live=document.querySelector(".scene-label");
  if(live)live.textContent="3D INTERATTIVO · ANTEPRIMA";
  hookup();resize();animate(0);
  // First Three.js frame must actually render before the public scene becomes
  // visible. Never reveal the old photographic/canvas view as an interstitial.
  requestAnimationFrame(()=>{
    if(info.status==="error")return;
    info.status="ready";
    window.__AI_OFFICE_3D_READY=true;
    window.AIOAgents3D.status="ready";
    window.AIOAgents3D.agents=[...agents.keys()];
    document.documentElement.classList.add("aio-stage-ready");
  });
 }catch(err){
  info.status="error";info.error=String(err).slice(0,160);
  console.error("3D office initialization failed",err);
  if(renderer?.domElement?.parentNode)renderer.domElement.remove();
  window.AIOShowStageError?.();
  // Legacy remains opt-in via ?legacy=1; do not silently flash old graphics.
 }
}
boot();
