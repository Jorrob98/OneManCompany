/**
 * AI OFFICE / Sprint 02 - atmosphere, environmental depth and interactions.
 * Decorative monitor graphics represent office presence, not AI job execution.
 */
(() => {
  "use strict";
  const stage=document.getElementById("penthouseStage");
  const surface=document.getElementById("penthouseSurface");
  const toolbar=document.querySelector(".floor-toolbar");
  const bridge=window.AIOStudio;
  if(!stage||!surface||!toolbar||!bridge)return;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  const modeNames={day:"GIORNO",evening:"TRAMONTO",night:"NOTTE",auto:"AUTO"};
  const modes=Object.keys(modeNames);
  const zones={desk:{label:"Postazioni",x:52,y:56},
    meeting:{label:"Sala riunioni",x:19,y:54},
    lounge:{label:"Area relax",x:87,y:70}};
  const fx=document.createElement("div");
  fx.className="aio-environment";
  fx.setAttribute("aria-hidden","true");
  fx.innerHTML='<span class="aio-window-bloom"></span><span class="aio-sunlight"></span>'+
    '<span class="aio-architectural-light"></span><span class="aio-floor-reflection"></span>'+
    '<span class="aio-glass-reflection"></span><span class="aio-wall-lamp aio-wall-lamp--left"></span>'+
    '<span class="aio-wall-lamp aio-wall-lamp--right"></span>'+
    '<span class="aio-desktop-indicator aio-desktop-indicator--1"></span>'+
    '<span class="aio-desktop-indicator aio-desktop-indicator--2"></span>'+
    '<span class="aio-desktop-indicator aio-desktop-indicator--3"></span>'+
    '<span class="aio-desktop-indicator aio-desktop-indicator--4"></span>'+
    '<span class="aio-zone-halo" id="aioZoneHalo"></span>'+
    '<span class="aio-zone-caption" id="aioZoneCaption"></span>';
  surface.insertBefore(fx,surface.querySelector(".penthouse-wash"));
  const monitors=document.createElement("div");
  monitors.className="aio-monitor-layer";
  monitors.setAttribute("aria-hidden","true");
  [[39,44.1],[49.4,44.9],[60.5,45.2],[70.9,43.5]].forEach(([x,y],i)=>{
    const display=document.createElement("span");
    display.className="aio-monitor-ui aio-monitor-ui--"+(i+1);
    display.style.left=x+"%";display.style.top=y+"%";
    display.innerHTML="<i></i><i></i><i></i><i></i>";
    monitors.appendChild(display);
  });
  surface.appendChild(monitors);
  // Reuse the exact office picture as a foreground occlusion mask.
  // Only small desk fronts get copied, covering seated legs without faking 3D furniture.
  const source=surface.querySelector(".penthouse-artwork");
  const occlusion=document.createElement("div");
  occlusion.className="aio-furniture-occlusion";
  occlusion.setAttribute("aria-hidden","true");
  for(const kind of ["central","right"]){
    const piece=document.createElement("img");
    piece.className="aio-furniture-cutout aio-furniture-cutout--"+kind;
    piece.src=source?.getAttribute("src")||"";
    piece.alt="";piece.draggable=false;
    occlusion.appendChild(piece);
  }
  surface.appendChild(occlusion);
  const zoneBar=document.createElement("div");
  zoneBar.className="aio-zone-bar";
  zoneBar.setAttribute("role","group");
  zoneBar.setAttribute("aria-label","Esplora le aree dell'ufficio");
  for(const [id,area] of Object.entries(zones)){
    const btn=document.createElement("button");
    btn.type="button";btn.dataset.officeZone=id;btn.textContent=area.label;
    btn.setAttribute("aria-pressed","false");
    btn.title="Evidenzia "+area.label.toLowerCase()+" nella scena";
    zoneBar.appendChild(btn);
  }
  toolbar.appendChild(zoneBar);
  const moodLabel=document.createElement("span");
  moodLabel.id="aioModeLabel";moodLabel.className="aio-mode-label";
  moodLabel.setAttribute("aria-live","polite");
  document.getElementById("roomMood")?.before(moodLabel);
  let selectedZone=null;
  let latestSelection=null;
  let mood="evening";
  const hourMode=()=>{
    const h=new Date().getHours();
    return h>=7&&h<17?"day":h>=17&&h<21?"evening":"night";
  };
  function atmosphere(){
    const raw=bridge.getMood();
    const mode=modes.includes(raw)?raw:"evening";
    mood=mode==="auto"?hourMode():mode;
    stage.dataset.atmosphere=mood;
    stage.dataset.atmosphereSetting=mode;
    stage.classList.toggle("daytime",mood==="day");
    moodLabel.textContent="AMBIENTE "+modeNames[mode];
    document.getElementById("roomMood")?.setAttribute("aria-label",
      "Cambia illuminazione, attuale: "+modeNames[mode]);
    window.dispatchEvent(new CustomEvent("studio:environment-light",{detail:{mode:mood,setting:mode}}));
  }
  function focusPoint(){
    const a=window.AIOAgents3D?.snapshot?.().find(a=>a.id===bridge.getSelected());
    return zones[a?.goal]||zones.desk;
  }
  function zoneSelect(id){
    selectedZone=selectedZone===id?null:id;
    stage.classList.toggle("aio-zone-active",Boolean(selectedZone));
    [...zoneBar.children].forEach(btn=>
      btn.setAttribute("aria-pressed",String(btn.dataset.officeZone===selectedZone)));
    const cap=document.getElementById("aioZoneCaption");
    if(!selectedZone){cap.textContent="";return;}
    const area=zones[selectedZone];
    const halo=document.getElementById("aioZoneHalo");
    halo.style.left=area.x+"%";halo.style.top=area.y+"%";
    cap.style.left=area.x+"%";cap.style.top=(area.y-6)+"%";
    cap.textContent=area.label;
    if(stage.clientWidth<surface.clientWidth){
      const left=Math.max(0,Math.min(surface.scrollWidth-stage.clientWidth,
        surface.scrollWidth*area.x/100-stage.clientWidth*.5));
      stage.scrollTo({left,behavior:reduced.matches?"instant":"smooth"});
    }
  }
  zoneBar.addEventListener("click",e=>{
    const button=e.target.closest("[data-office-zone]");
    if(button)zoneSelect(button.dataset.officeZone);
  });
  function syncMonitors(){
    const present=bridge.getAgents().filter(a=>a.status==="available");
    const working=window.AIOAgents3D?.snapshot?.().filter(a=>
      a.point==="desk"&&a.animation!=="walk")||[];
    stage.dataset.visibleWorking=String(working.length);
    [...monitors.children].forEach((screen,i)=>{
      const on=Boolean(present[i])&&working.some(a=>a.id===present[i].id);
      screen.classList.toggle("active",on);
      screen.dataset.simulated=on?"workstation":"standby";
    });
  }
  function syncCamera(){
    const id=bridge.getSelected();
    if(id===latestSelection)return;
    latestSelection=id;
    const pos=focusPoint();
    surface.style.setProperty("--office-focus-x",pos.x+"%");
    surface.style.setProperty("--office-focus-y",pos.y+"%");
    // In portrait layout pan only inside the office, never the whole page.
    if(stage.clientWidth<surface.clientWidth){
      const left=Math.max(0,Math.min(surface.scrollWidth-stage.clientWidth,
        surface.scrollWidth*pos.x/100-stage.clientWidth*.5));
      stage.scrollTo({left,behavior:reduced.matches?"instant":"smooth"});
    }
  }
  function render(){atmosphere();syncMonitors();syncCamera();}
  window.AIOEnvironment={
    getStatus:()=>({mood,setting:bridge.getMood(),zone:selectedZone,
      workstations:Number(stage.dataset.visibleWorking||0),monitors:monitors.children.length}),
    highlight:zoneSelect
  };
  window.addEventListener("studio:changed",render);
  window.addEventListener("studio:atmosphere",render);
  window.addEventListener("studio:agents3d-ready",render);
  window.addEventListener("studio:office-visible",()=>{syncCamera();syncMonitors();});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)render();});
  window.setInterval(()=>{if(!document.hidden){
    if(bridge.getMood()==="auto")atmosphere();
    syncMonitors();
  }},2500);
  render();
})();