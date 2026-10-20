/**
 * AI OFFICE STUDIO — Office 3D / original procedural room.
 * Real-time Three.js geometry; no embedded office photograph or screenshot.
 * Intentional limitation: the agents' *visual* motions are a simulation.
 * The actual personnel and task state comes from app.js in localStorage.
 */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";

const bridge=window.AIOStudio;
const mount=document.querySelector(".scene-wrap");
const original=document.getElementById("roomCanvas");
if (!mount || !original || !bridge) throw new Error("AI Office scene mount unavailable");
const test=document.createElement("canvas");
if (!test.getContext("webgl2") && !test.getContext("webgl")) {
  mount.insertAdjacentHTML("beforeend",'<div class="office3d-warning">3D non disponibile su questo browser. Attiva WebGL per vedere il nuovo ufficio.</div>');
  throw new Error("WebGL is not supported");
}

let scene,camera,renderer,root,agency,night=true,selected="",resizeObserver=null,raf=0;
const interactive=[],agents=new Map(),mouse=new THREE.Vector2(),raycaster=new THREE.Raycaster(),hotspots=[];
let azimuth=.80,elevation=.69,distance=27,dragging=false,dragDistance=0,startX=0,startY=0,lastX=0,lastY=0,frame=0;
const target=new THREE.Vector3(0,1.15,0);
const colors={ink:0x111827,stone:0x27303d,slate:0x384352,wood:0x9a6a50,woodLight:0xc3926b,
 copper:0xe9a16a,glass:0x6c9db8,blue:0x4189d9,cyan:0x65e1df,violet:0x9a8cf1,cream:0xffe3b7};
const mat=(c,roughness=.63,metalness=.02)=>new THREE.MeshStandardMaterial({color:c,roughness,metalness});
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
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
 m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m;
}
function cylinder(parent,x,y,z,rTop,rBottom,height,material,sides=16){
 const m=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBottom,height,sides),material);
 m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function sphere(parent,x,y,z,r,material,segments=16){
 const m=new THREE.Mesh(new THREE.SphereGeometry(r,segments,12),material);
 m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;
}
function strip(parent,a,b,r,material,sides=8){
 const delta=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a));
 const obj=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),sides),material);
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
function screenSurface(parent,x,y,z,w,h,kind="code",rotationY=0){
 const tx=textureDraw(512,300,(g,W,H)=>{
   g.fillStyle="#091626";g.fillRect(0,0,W,H);
   const grad=g.createLinearGradient(0,0,W,H);
   grad.addColorStop(0,"#1e3558");grad.addColorStop(1,"#08111f");
   g.fillStyle=grad;g.fillRect(13,14,W-26,H-28);
   g.strokeStyle="#4fa3df55";g.strokeRect(16,17,W-32,H-34);
   g.fillStyle="#cee6ff";g.font="bold 20px Arial";
   g.fillText(kind==="chart"?"OPERATIONS / ANALYTICS":kind==="board"?"STUDIO STRATEGY":kind==="city"?"ACTIVE WORKSPACE":"AGENT CONSOLE",31,48);
   g.fillStyle="#64d3e8";g.fillRect(30,62,108,3);
   if(kind==="code"||kind==="city"){
     for(let i=0;i<11;i++){g.fillStyle=["#8eb6c0","#62cdbb","#c6a7c8"][i%3];g.globalAlpha=.48+i%3*.14;
       g.fillRect(32,86+i*17,60+((i*39)%250),5);}
     g.globalAlpha=1;
     g.fillStyle="#4ed2cc";g.fillRect(310,92,165,98);g.fillStyle="#1b3956";g.fillRect(320,103,144,77);
     g.strokeStyle="#8ee7c8";g.lineWidth=3;g.beginPath();
     for(let i=0;i<12;i++){let xx=325+i*12,yy=158-Math.sin(i*.7)*18-i*.8;if(i===0)g.moveTo(xx,yy);else g.lineTo(xx,yy);}g.stroke();
   }else{
     g.strokeStyle="#85c8f0";g.lineWidth=4;g.beginPath();
     for(let i=0;i<12;i++){let xx=37+i*38,yy=222-Math.sin(i*.68)*28-(i*3);if(i===0)g.moveTo(xx,yy);else g.lineTo(xx,yy);}g.stroke();
     for(let i=0;i<9;i++){g.fillStyle=i%3===0?"#6ce6c9":"#669bd3";g.fillRect(50+i*48,247-(((i*19)%80)),15,((i*19)%80));}
   }
   g.fillStyle="#91afc4";g.font="13px Arial";g.fillText("VISUAL DATA · DEMO",32,H-18);
 });
 const material=new THREE.MeshBasicMaterial({map:tx,side:THREE.DoubleSide});
 return plane(parent,x,y,z,w,h,material,rotationY);
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
 const slab=box(root,0,-.28,0,19,.56,14,mat(0x171c24,.38,.5),false);
 slab.receiveShadow=true;
 box(root,0,.02,0,18.65,.05,13.65,floorMat,false);
 const tileA=mat(0x353b41,.27,.25),tileB=mat(0x323a40,.23,.25);
 for(let x=-9;x<9;x+=1.2)for(let z=-6.6;z<6.6;z+=1.2){
   box(root,x+.6,.058,z+.6,1.182,.02,1.182,Math.round((x+z)*3)%4===0?tileB:tileA,false);
 }
 // perimeter light channel and brass edge
 const corners=[[-9.55,-7.05],[9.55,-7.05],[9.55,7.05],[-9.55,7.05]];
 for(let i=0;i<4;i++){
   const a=corners[i],b=corners[(i+1)%4];
   track(root,a[0],a[1],b[0],b[1],-.05,neonWarm,.075);
 }
 // Back and left transparent-looking architectural walls, black mullions
 wall(root,0,2.3,-6.95,19,4.7,.18,mat(0x1c2634,.8));
 wall(root,-9.35,2.1,-.3,.18,4.35,13.3,mat(0x22303a,.68));
 box(root,0,4.69,-6.95,18.8,.13,.22,metal,false);
 // Panoramic windows behind office + deep city beyond
 const sky=mat(0x0a1426,.88),glass=new THREE.MeshPhysicalMaterial({color:0x6e9eb9,transparent:true,opacity:.13,metalness:.15,roughness:.08,depthWrite:false,side:THREE.DoubleSide});
 for(let i=0;i<7;i++){
   const x=-8.55+i*2.72;
   box(root,x,2.4,-6.83,.08,4.5,.13,metal,false);
   box(root,x+1.27,2.4,-6.82,2.48,4.12,.02,glass,false);
 }
 // decorative skyline outside (not a real-world image)
 for(let i=0;i<44;i++){
   const x=-9.2+(i*.447),height=.65+((i*37)%23)*.09;
   const b=box(root,x,height/2,-7.65-i%5*.09,.32,height,.28,mat(0x172439,.98),false);
   for(let j=1;j<Math.floor(height/.27);j++){
     if((i*17+j*7)%5!==0)continue;
     box(root,x-.07,j*.25,-7.47-i%5*.09,.034,.07,.012,glow((i+j)%3?0xc9a46e:0x7fc8e6,1),false);
   }
 }
 // top window trim
 box(root,0,4.5,-6.72,18.8,.12,.13,dark,false);
 for(let i=0;i<6;i++)box(root,-7.8+i*3.1,4.45,-6.68,.42,.14,.22,neonWarm,false);
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
   const leaf=new THREE.Mesh(new THREE.SphereGeometry(.22*scale,8,6),leafMaterial[j%3]);
   leaf.scale.set(.47,.85,.34);leaf.position.set(Math.cos(angle)*rad*scale,.87*scale+(j%3)*.06*scale,Math.sin(angle)*rad*scale);
   leaf.rotation.z=(j%2?-.5:.5);grp.add(leaf);
 }
 return grp;
}
function trellis(x,z){
 for(let i=0;i<4;i++)pot(x+i*.28,z+(i%2)*.12,.7+(i%3)*.2);
}
function lounge(){
 carpet(-6.35,-1.9,5.5,4.0,0x565355);
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
 box(grp,-.2,.92,.3,.5,.026,.16,mat(0x96a5ae,.7));
 box(grp,.50,.92,.36,.12,.03,.14,dark);
 // monitor back stand and visible screen
 box(grp,0,1.15,-.25,.08,.52,.08,metal);
 box(grp,0,1.56,-.26,1.36,.81,.095,mat(0x0d1726,.3,.28));
 screenSurface(grp,0,1.58,-.199,1.24,.71,"code");
 // side tablet + coffee mug
 box(grp,1.07,.91,.08,.42,.025,.35,mat(0x1c2938));
 cylinder(grp,-1.1,.98,.18,.10,.09,.18,mat(0xe6c6ae,.8),12);
 return grp;
}
function chair(x,z,rotation=0){
 const grp=new THREE.Group();root.add(grp);grp.position.set(x,0,z);grp.rotation.y=rotation;
 cylinder(grp,0,.32,0,.26,.18,.12,mat(0x222733));
 cylinder(grp,0,.51,0,.042,.042,.42,chrome);
 box(grp,0,.74,0,.78,.13,.73,mat(0x323943));
 box(grp,0,1.2,-.32,.78,.92,.17,mat(0x3c4855));
 for(const dx of [-.38,.38])box(grp,dx,.95,.02,.07,.07,.65,metal);
 return grp;
}
function deskPods(){
 carpet(-3.0,3.25,10.9,5.4,0x44454b);
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
 carpet(x,z,6.4,4.8,0x484a50);
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
function person(a,index){
 const colors={coral:0xae6f61,blue:0x526b98,lavender:0x6d6999,mint:0x41776d,gold:0xb28c54};
 const tones=[0xe2ad88,0xad704f,0xc99272,0xf1c19c,0x946849,0xd8a37f,0xa36f54,0xedb08a];
 const hair=[0x342c30,0x352c22,0x211b23,0x6d4933,0x251c26,0x382b2d,0x171e23,0x583b33];
 // Employees are 3D mannequins, not photorealistic humans.
 const sites=[
   [-6.35,2.95,Math.PI],[-2.95,2.95,Math.PI],[.5,2.95,Math.PI],
   [2.5,-2.20,Math.PI],[7.3,-1.95,Math.PI],[-5.1,5.86,Math.PI],[-1.4,5.86,Math.PI],[2.2,5.86,Math.PI]
 ];
 const loc=sites[index%sites.length],g=new THREE.Group();
 g.position.set(loc[0],0,loc[1]);g.rotation.y=loc[2];agency.add(g);
 const coat=mat(colors[a.color]||colors.blue,.85),skin=mat(tones[index%tones.length],.94),
   headhair=mat(hair[index%hair.length],.94),pants=mat(0x273041,.9);
 // seated stylized body
 sphere(g,0,1.23,.0,.32,coat).scale.set(.96,1.05,.7);
 cylinder(g,0,.90,.03,.24,.23,.41,coat,12);
 cylinder(g,-.16,.52,.21,.10,.12,.65,pants,10);cylinder(g,.16,.52,.21,.1,.12,.65,pants,10);
 sphere(g,0,1.75,-.03,.255,skin);
 sphere(g,0,1.94,-.11,.258,headhair).scale.set(1.0,.48,1.02);
 for(const sx of [-1,1])sphere(g,sx*.089,1.78,.18,.019,dark,8);
 // headset on alternate workers
 if(index%2===1){
   const band=new THREE.Mesh(new THREE.TorusGeometry(.255,.018,8,24,Math.PI),metal);
   band.position.set(0,1.77,0);g.add(band);
   sphere(g,.25,1.76,0,.085,dark);
 }
 const arms=[];
 for(const side of [-1,1]){
   const arm=new THREE.Group();arm.position.set(side*.34,1.3,0);g.add(arm);
   cylinder(arm,0,-.16,.14,.095,.09,.39,coat,10).rotation.x=-.62;
   sphere(arm,0,-.36,.26,.082,skin,10);arms.push(arm);
 }
 // glowing selection ring around person
 const halo=new THREE.Mesh(new THREE.TorusGeometry(.49,.032,8,52),neonBlue);
 halo.position.y=.095;halo.rotation.x=-Math.PI/2;g.add(halo);
 // name marker, actually visible only on selected agent
 const markerTex=textureDraw(512,128,(ctx)=>{
   ctx.fillStyle="#121c30ee";ctx.fillRect(0,0,512,128);
   ctx.strokeStyle="#85cfee";ctx.lineWidth=5;ctx.strokeRect(3,3,506,122);
   ctx.fillStyle="#faf3e5";ctx.textAlign="center";ctx.font="bold 51px Arial";
   ctx.fillText(String(a.name).slice(0,14),256,84);
 });
 const label=plane(g,0,2.33,.05,1.6,.4,new THREE.MeshBasicMaterial({map:markerTex,transparent:true,side:THREE.DoubleSide}));
 label.rotation.y=Math.PI;
 for(const part of g.children){part.traverse?.(c=>{if(c.isMesh){c.userData.agentId=a.id;interactive.push(c);}});}
 agents.set(a.id,{g,arms,halo,label,location:loc,status:a.status});
}
function syncPeople(){
 agency.clear();agents.clear();interactive.length=0;
 const list=bridge.getAgents().filter(a=>a.status!=="retired");
 list.forEach((a,i)=>person(a,i));
 selected=bridge.getSelected();
 for(const [id,e] of agents){e.halo.visible=id===selected;e.label.visible=id===selected;}
}
function selectAgent(id){
 bridge.select(id);syncPeople();
}
function lights(){
 scene.add(new THREE.AmbientLight(0xa2b2d6,.73));
 const hemi=new THREE.HemisphereLight(0xc9deec,0x44302a,1.12);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffe1c5,2.25);
 sun.position.set(-7,13,9);sun.castShadow=true;
 sun.shadow.mapSize.set(2048,2048);
 sun.shadow.camera.left=-13;sun.shadow.camera.right=13;sun.shadow.camera.top=14;sun.shadow.camera.bottom=-14;
 sun.shadow.normalBias=.07;sun.shadow.bias=-.00015;scene.add(sun);
 const key=new THREE.PointLight(0xffbf88,34,13,1.6);key.position.set(1.5,3.1,-3.3);scene.add(key);
 const accent=new THREE.PointLight(0x659bff,30,12,1.7);accent.position.set(7,2.5,-4.8);scene.add(accent);
 const loungeLight=new THREE.PointLight(0xffd0a6,22,11,1.6);loungeLight.position.set(-5,2.9,-2.5);scene.add(loungeLight);
 return {sun,key,accent,loungeLight,hemi};
}
function cameraUpdate(){
 elevation=THREE.MathUtils.clamp(elevation,.40,1.19);
 distance=THREE.MathUtils.clamp(distance,17,38);
 camera.position.set(target.x+distance*Math.sin(azimuth)*Math.cos(elevation),
    target.y+distance*Math.sin(elevation),target.z+distance*Math.cos(azimuth)*Math.cos(elevation));
 camera.lookAt(target);
}
function resize(){
 const rect=mount.getBoundingClientRect();
 if(!rect.width||!rect.height||!renderer)return;
 const w=Math.max(1,Math.floor(rect.width)),h=Math.max(1,Math.floor(rect.height));
 camera.aspect=w/h;camera.fov=w<660?48:38;camera.updateProjectionMatrix();
 renderer.setSize(w,h,false);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,w<660?1.35:1.65));
}
function pointXY(event){
 const r=renderer.domElement.getBoundingClientRect();
 return new THREE.Vector2(((event.clientX-r.left)/r.width)*2-1,-((event.clientY-r.top)/r.height)*2+1);
}
function pointerDown(e){dragging=true;startX=lastX=e.clientX;startY=lastY=e.clientY;dragDistance=0;renderer.domElement.setPointerCapture(e.pointerId);}
function pointerMove(e){
 if(!dragging)return;
 const dx=e.clientX-lastX,dy=e.clientY-lastY;
 dragDistance+=Math.abs(dx)+Math.abs(dy);
 if(dragDistance>2){
 azimuth=THREE.MathUtils.clamp(azimuth-dx*.006,.46,1.34);
 elevation=THREE.MathUtils.clamp(elevation+dy*.004,.43,1.1);cameraUpdate();
 }
 lastX=e.clientX;lastY=e.clientY;
}
function pointerUp(e){
 if(dragging&&dragDistance<12){
 raycaster.setFromCamera(pointXY(e),camera);
 const list=raycaster.intersectObjects(interactive,false);
 if(list.length){
   const id=list[0].object.userData.agentId;
   if(id)selectAgent(id);
 }
 }
 dragging=false;
}
function hookup(){
 renderer.domElement.addEventListener("pointerdown",pointerDown);
 renderer.domElement.addEventListener("pointermove",pointerMove);
 renderer.domElement.addEventListener("pointerup",pointerUp);
 renderer.domElement.addEventListener("pointercancel",()=>{dragging=false;});
 renderer.domElement.addEventListener("wheel",e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.015,17,38);cameraUpdate();},{passive:false});
 document.getElementById("roomZoom").addEventListener("click",()=>{
   // Old roomZoom handler toggles the unused 2D fallback; this handler updates the 3D camera.
   distance=distance>24?19.5:28;cameraUpdate();
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
 night=mood!=="day";
 scene.background=new THREE.Color(night?0x0b1221:0x26384b);
 illumination.sun.intensity=night?2.25:3.3;
 illumination.accent.intensity=night?30:15;
 illumination.key.intensity=night?34:20;
 illumination.loungeLight.intensity=night?22:13;
 renderer.toneMappingExposure=night?1.17:1.3;
}
function animate(t){
 raf=requestAnimationFrame(animate);
 if(document.hidden)return;
 frame++;
 const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 if(!reduce||frame%25===0){
   for(const [id,a] of agents){
     const pulse=Math.sin(t*.0015+id.length);
     a.g.position.y=(reduce?0:.012*pulse);
     if(!reduce)for(let i=0;i<a.arms.length;i++)a.arms[i].rotation.x=Math.sin(t*.003+i*1.7+id.length)*.10;
     a.halo.visible=selected===id;
     a.label.visible=selected===id;
     a.label.quaternion.copy(camera.quaternion);
   }
   renderer.render(scene,camera);
 }
}
async function boot(){
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.17;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.className="office3d-canvas";
  renderer.domElement.setAttribute("aria-label","Ufficio tridimensionale interattivo: trascina per ruotare, scorri per ingrandire e tocca un agente per selezionarlo");
  renderer.domElement.setAttribute("tabindex","0");
  scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1221);scene.fog=new THREE.FogExp2(0x0b1221,.014);
  root=new THREE.Group();scene.add(root);
  agency=new THREE.Group();scene.add(agency);
  camera=new THREE.PerspectiveCamera(38,1,.1,90);
  illumination=lights();
  createShell();lounge();meeting();commandCenter();deskPods();partitionsAndLighting();
  syncPeople();setMood(bridge.getMood());cameraUpdate();
  mount.insertBefore(renderer.domElement,original);
  original.style.visibility="hidden";
  document.querySelector(".room-hint").innerHTML="<span class='hint-icon'>⌖</span> Trascina per ruotare · Tocca un agente";
  const live=document.querySelector(".scene-label");
  if(live)live.textContent="3D INTERATTIVO · ANTEPRIMA";
  hookup();resize();animate(0);
  window.__AI_OFFICE_3D_READY=true;
 }catch(err){
  console.error("3D office initialization failed",err);
  if(renderer?.domElement?.parentNode)renderer.domElement.remove();
  original.style.visibility="visible";
  mount.insertAdjacentHTML("beforeend",'<div class="office3d-warning">Il 3D non si è avviato: vista alternativa disponibile.</div>');
 }
}
boot();
