/* AI OFFICE Studio — original pixel-isometric renderer & local management UI.
   This is a visual/product prototype: no AI calls, no server sync, no fake completions. */
"use strict";
(() => {
const KEY="ai-office-studio-v1",MAX=8;
const stations=[[2.45,3.25],[6.75,2.95],[3.65,6.75],[7.95,6.35],[9.15,3.7],[1.3,6.35],[9.3,7.7],[5.7,4.9]];
const roles=["Programmatore","Designer","Ricercatore","Revisore QA","Coordinatore","Automazioni","Analista","Comunicazione"];
const colors=["coral","mint","lavender","blue","gold"];
// Sprint 04: all personnel records are local prototype data, never AI activity.
const departments=["Direzione","Tecnologia","Design","Ricerca","Qualità","Operazioni","Analisi","Marketing"];
const levels=["Junior","Intermedio","Senior","Lead"];
const skillCatalog=["Programmazione","Design UI","Ricerca","Test QA","Coordinamento","Automazioni","Dati","Comunicazione"];
const departmentFor=role=>({"Programmatore":"Tecnologia","Designer":"Design","Ricercatore":"Ricerca","Revisore QA":"Qualità","Coordinatore":"Direzione","Automazioni":"Operazioni","Analista":"Analisi","Comunicazione":"Marketing"})[role]||"Operazioni";
const skillsFor=role=>({"Programmatore":["Programmazione"],"Designer":["Design UI"],"Ricercatore":["Ricerca"],"Revisore QA":["Test QA"],"Coordinatore":["Coordinamento"],"Automazioni":["Automazioni"],"Analista":["Dati"],"Comunicazione":["Comunicazione"]})[role]||[];
const validDate=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+"T12:00:00"));
const todayLocal=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
const options=(values,selected)=>values.map(v=>'<option value="'+esc(v)+'" '+(v===selected?"selected":"")+'>'+esc(v)+'</option>').join("");

// Eight genuinely different licensed GLB human models, not two repeated costumes.
const characterStyles=[
 ["f1","Donna · Executive 1"],["f2","Donna · Executive 2"],
 ["f3","Donna · Executive 3"],["f4","Donna · Executive 4"],
 ["m1","Uomo · Executive 1"],["m2","Uomo · Executive 2"],
 ["m3","Uomo · Executive 3"],["m4","Uomo · Executive 4"]
];
const validStyle=id=>characterStyles.some(([key])=>id===key);
const characterChoices=value=>characterStyles.map(([key,label])=>
 '<option value="'+key+'" '+(value===key?"selected":"")+'>'+label+'</option>').join("");
const templates=[
  {id:"a1",name:"Nora",role:"Coordinatore",color:"coral",modelStyle:"f1",avatar:"👩🏻‍💼",status:"available"},
  {id:"a2",name:"Leo",role:"Programmatore",color:"blue",modelStyle:"m1",avatar:"👨🏽‍💻",status:"available"},
  {id:"a3",name:"Mia",role:"Designer",color:"lavender",modelStyle:"f2",avatar:"👩🏾‍🎨",status:"available"},
  {id:"a4",name:"Teo",role:"Revisore QA",color:"mint",modelStyle:"m2",avatar:"🧑🏼‍🔬",status:"available"}
];
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
function initial(){return {agents:templates.map(x=>({...x,department:departmentFor(x.role),level:"Junior",skills:skillsFor(x.role),leaveStart:"",leaveEnd:""})),tasks:[],events:[{id:"welcome",kind:"✦",message:"Lo studio è pronto per essere personalizzato.",at:Date.now()}],selected:"a1",mood:"evening"};}
function load(){
  try {
    const data=JSON.parse(localStorage.getItem(KEY));
    if(!data||!Array.isArray(data.agents)||!Array.isArray(data.tasks)||!Array.isArray(data.events))throw Error("bad");
    return {
      agents:data.agents.slice(0,MAX).filter(a=>a&&typeof a.name==="string"&&typeof a.id==="string").map(a=>({
        id:String(a.id).slice(0,55),name:String(a.name).slice(0,30),role:String(a.role).slice(0,35),
        status:["available","vacation","retired"].includes(a.status)?a.status:"available",
        avatar:String(a.avatar||"🧑‍💼").slice(0,12),color:colors.includes(a.color)?a.color:"blue",
        modelStyle:validStyle(a.modelStyle)?a.modelStyle:(a.id==="a1"?"f1":a.id==="a3"?"f2":a.id==="a4"?"m2":"m1"),
        department:departments.includes(a.department)?a.department:departmentFor(a.role),
        level:levels.includes(a.level)?a.level:"Junior",
        skills:Array.isArray(a.skills)?[...new Set(a.skills.filter(v=>skillCatalog.includes(v)))].slice(0,5):skillsFor(a.role),
        leaveStart:validDate(a.leaveStart)?a.leaveStart:"",
        leaveEnd:validDate(a.leaveEnd)?a.leaveEnd:""
      })),
      tasks:data.tasks.slice(0,80).filter(t=>t&&typeof t.title==="string").map(t=>({
        id:String(t.id),title:String(t.title).slice(0,75),detail:String(t.detail||"").slice(0,450),
        agent:String(t.agent||""),at:Number(t.at)||Date.now()
      })),
      events:data.events.slice(0,80).filter(e=>e&&typeof e.message==="string").map(e=>({
        id:String(e.id),kind:String(e.kind).slice(0,5),message:String(e.message).slice(0,180),at:Number(e.at)||Date.now()
      })),
      selected:String(data.selected||"a1"),mood:["day","evening","night","auto"].includes(data.mood)?data.mood:"evening"
    };
  }catch{return initial();}
}
let state=load();
function reconcileLeave(){
 const today=todayLocal();
 for(const a of state.agents){
   if(a.status==="retired"||!a.leaveStart||!a.leaveEnd)continue;
   if(today>=a.leaveStart&&today<=a.leaveEnd)a.status="vacation";
   else if(today>a.leaveEnd){if(a.status==="vacation")a.status="available";a.leaveStart="";a.leaveEnd="";}
 }
}
const assignedCount=id=>state.tasks.filter(t=>t.agent===id).length;
reconcileLeave();
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch{toast("Il browser non consente di salvare i dati.");}};
let toastTimeout=0;
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove("show"),3200);}
function activity(kind,message){state.events.unshift({id:String(Date.now())+Math.random(),kind,message,at:Date.now()});state.events=state.events.slice(0,80);}
const statusLabel=a=>a.status==="retired"?"Pensionato":a.status==="vacation"?"In ferie":a.leaveStart&&a.leaveStart>todayLocal()?"Ferie programmate":"Disponibile";
const available=()=>state.agents.filter(a=>a.status==="available");
const active=()=>state.agents.filter(a=>a.status!=="retired");
const short=n=>String(n).padStart(2,"0");
function navigate(page){
  if(!["office","people","tasks","collab","activity"].includes(page))page="office";
  document.querySelectorAll("[data-view]").forEach(el=>el.classList.toggle("active",el.dataset.view===page));
  document.querySelectorAll("[data-page]").forEach(el=>el.classList.toggle("active",el.dataset.page===page));
  $("crumbName").textContent=({office:"Ufficio",people:"Dipendenti",tasks:"Incarichi",collab:"Collaborazione",activity:"Attività"})[page];
  if(location.hash!=="#"+page)history.replaceState(null,"","#"+page);
  window.scrollTo({top:0,behavior:"smooth"});
  if(page==="people")renderPeople();
  if(page==="tasks")renderTasks();
  if(page==="activity")renderActivity();
  if(page==="collab")window.AIOCollab?.render();
  if(page==="office")requestAnimationFrame(()=>{resizeCanvas();window.dispatchEvent(new Event("studio:office-visible"));});
}
function renderAll(){
  reconcileLeave();
  $("statEmployees").textContent=short(active().length);
  $("statAvailable").textContent=short(available().length);
  $("statTasks").textContent=short(state.tasks.length);
  $("nav-people").textContent=short(active().length);
  $("nav-tasks").textContent=short(state.tasks.length);
  $("sideCount").textContent=short(active().length);
  const list=$("teamMiniList");
  list.replaceChildren();
  state.agents.filter(a=>a.status!=="retired").forEach(a=>{
    const btn=document.createElement("button");btn.className="mini-person"+(state.selected===a.id?" selected":"");
    btn.dataset.select=a.id;btn.innerHTML='<span class="mini-face" data-tone="'+a.color+'">'+esc(a.avatar)+'</span><span><strong>'+esc(a.name)+'</strong><small>'+esc(a.role)+'</small></span><i class="tiny-led '+a.status+'"></i>';
    list.appendChild(btn);
  });
  if(!list.children.length)list.innerHTML='<p class="modal-text">Nessun dipendente attivo.</p>';
  renderFocus();renderPeople();renderTasks();renderActivity();save();
  window.dispatchEvent(new Event('studio:changed'));
}
function renderFocus(){
  const a=state.agents.find(e=>e.id===state.selected);
  const panel=$("focusPanel");
  if(!a||a.status==="retired"){
    panel.innerHTML='<div class="focus-eyebrow">DIPENDENTE SELEZIONATO</div><h3>Seleziona un agente</h3><p>Tocca un personaggio nella stanza o un nome nell’organico.</p>';
    return;
  }
  panel.innerHTML='<div class="focus-eyebrow">PROFILO DIPENDENTE / '+esc(a.id.slice(-3).toUpperCase())+'</div>'+
    '<div class="focus-avatar">'+esc(a.avatar)+'</div><h3>'+esc(a.name)+'</h3><p>'+esc(a.role)+' · '+esc(a.department||departmentFor(a.role))+' · '+esc(a.level||"Junior")+'</p>'+
    '<span class="focus-status">'+(a.status==="vacation"?"☼ In ferie — fuori ufficio":"● Disponibile — nessuna esecuzione AI")+'</span>'+
    '<div class="focus-buttons"><button data-action="new-task" data-id="'+esc(a.id)+'">＋ Incarico</button>'+
    '<button data-action="vacation" data-id="'+esc(a.id)+'">'+(a.status==="vacation"?"↩ Richiama":"☀ Ferie")+'</button>'+
    '<button class="danger" data-action="retire" data-id="'+esc(a.id)+'">Pensiona</button></div>'+
    '<div class="focus-buttons personnel-controls"><button data-action="edit-personnel" data-id="'+esc(a.id)+'">✎ Scheda</button>'+
    '<button data-action="promote" data-id="'+esc(a.id)+'">↑ Promuovi</button>'+
    '<button data-action="plan-leave" data-id="'+esc(a.id)+'">◷ Ferie</button></div>'+
    '<p class="personnel-focus-meta">Competenze: '+esc((a.skills||skillsFor(a.role)).join(" · ")||"Da definire")+
    ' · Incarichi in attesa: '+assignedCount(a.id)+'/3</p>'+
    '<button class="appearance-open" data-action="appearance" data-id="'+esc(a.id)+'">✦ Personalizza personaggio 3D</button>'+
    (a.status==="available"?'<div class="agent-director"><div class="focus-eyebrow">MOVIMENTI 3D · DEMO VISIVA</div>'+
    '<div class="focus-buttons"><button data-action="agent-desk" data-id="'+esc(a.id)+'">⌑ Scrivania</button>'+
    '<button data-action="agent-meeting" data-id="'+esc(a.id)+'">♧ Riunione</button>'+
    '<button data-action="agent-lounge" data-id="'+esc(a.id)+'">☕ Pausa</button></div></div>':'');
}
function renderPeople(){
  const filter=document.querySelector(".segment.active")?.dataset.filter||"all";
  const q=($("peopleSearch")?.value||"").trim().toLocaleLowerCase("it-IT");
  const dept=$("peopleDepartment")?.value||"all";
  const people=state.agents.filter(a=>(filter==="all"||a.status===filter)&&
    (dept==="all"||a.department===dept)&&
    (!q||[a.name,a.role,a.department,a.level,...(a.skills||[])].join(" ").toLocaleLowerCase("it-IT").includes(q)));
  if($("peopleSummary"))$("peopleSummary").textContent=people.length+" profili · "+state.agents.filter(a=>a.status==="available").length+" disponibili";
  const grid=$("peopleGrid");
  grid.innerHTML=people.length?people.map(a=>'<article class="person-card">'+
    '<div class="persona-avatar">'+esc(a.avatar)+'</div><h3>'+esc(a.name)+'</h3><p class="job">'+esc(a.role)+'</p>'+
    '<div class="personnel-meta">'+esc(a.department||departmentFor(a.role))+' · '+esc(a.level||"Junior")+'</div>'+
    '<div class="personnel-skills">'+(a.skills||skillsFor(a.role)).map(v=>'<span>'+esc(v)+'</span>').join("")+'</div>'+
    '<div class="personnel-load">Incarichi: '+assignedCount(a.id)+'/3'+(a.leaveStart&&a.status!=="retired"?' · Ferie '+esc(a.leaveStart)+" → "+esc(a.leaveEnd):"")+'</div>'+
    '<span class="state '+a.status+'">● '+statusLabel(a)+'</span>'+
    '<div class="card-actions"><button data-action="select" data-id="'+esc(a.id)+'">Visualizza</button>'+
    (a.status!=="retired"?'<button data-action="edit-personnel" data-id="'+esc(a.id)+'">Modifica</button>'+
     '<button data-action="promote" data-id="'+esc(a.id)+'">↑ Livello</button>'+
     '<button data-action="plan-leave" data-id="'+esc(a.id)+'">Calendario</button>':"")+
    (a.status==="retired"?'<button data-action="reinstate" data-id="'+esc(a.id)+'">↩ Riassumi</button>':
     '<button data-action="vacation" data-id="'+esc(a.id)+'">'+(a.status==="vacation"?"Rientra":"Ferie")+'</button><button data-action="retire" data-id="'+esc(a.id)+'">Pensiona</button>')+
    '</div></article>').join(""):
    '<div class="empty-state"><span>☾</span><strong>Nessun agente qui</strong><p>Seleziona un’altra categoria o crea il tuo primo agente.</p></div>';
}
function renderTasks(){
  const list=$("taskList");
  list.innerHTML=state.tasks.length?state.tasks.map(t=>{
    const a=state.agents.find(e=>e.id===t.agent);
    const ai=window.AIOEngine?.getResult?.(t.id);
    return '<article class="task-item"><div class="task-glyph">◈</div><div class="task-content"><strong>'+esc(t.title)+'</strong><p>'+esc(t.detail||"Nessuna descrizione")+'</p>'+
      '<div class="task-meta">'+(ai?"BOZZA AI GENERATA · DA REVISIONARE":"IN ATTESA")+' · '+esc(a?.name||"Da assegnare")+' · '+new Date(t.at).toLocaleDateString("it-IT")+'</div>'+
      (ai?'<details class="ai-result" open><summary>✦ Risultato generato · verifica umana necessaria</summary>'+
       '<div class="ai-provenance">Fonte: '+esc(ai.model)+' · '+esc(ai.producedAt)+
       ' · richiesta '+esc(ai.requestId)+'</div><pre>'+esc(ai.output)+'</pre></details>':"")+
      '<div class="ai-task-actions"><button type="button" data-ai-action="generate" data-id="'+esc(t.id)+'"'+
      (window.AIOEngine?.getStatus?.().ready&&window.AIOEngine?.getStatus?.().keyLoaded?"":" disabled")+
      '>✦ Genera bozza AI</button>'+
      (ai?'<button type="button" data-ai-action="clear-result" data-id="'+esc(t.id)+'">Rimuovi bozza</button>':"")+
      '</div></div><button data-action="delete-task" data-id="'+esc(t.id)+'" aria-label="Elimina incarico">✕</button></article>';
  }).join(""):'<div class="empty-state"><span>✧</span><strong>Una pagina tutta da scrivere.</strong><p>Prepara il tuo primo incarico: resterà in attesa finché non collegheremo l’AI.</p><button class="primary-button" data-action="new-task">＋ Crea un incarico</button></div>';
}
function renderActivity(){
 $("activityList").innerHTML=state.events.length?state.events.map(e=>
  '<article class="activity-row"><span class="activity-symbol">'+esc(e.kind)+'</span><div><strong>'+esc(e.message)+'</strong><time>'+new Date(e.at).toLocaleString("it-IT")+'</time></div></article>').join(""):"";
}
function closeModal(){$("modalShell").classList.remove("open");$("modalShell").setAttribute("aria-hidden","true");document.body.style.overflow="";}
function openModal(title,contents){
  $("modalTitle").textContent=title;
  $("modalContent").innerHTML=contents;
  $("modalShell").classList.add("open");
  $("modalShell").setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
  $("modalShell").querySelector("input,textarea,select,button")?.focus();
}
function hire(){
 if(state.agents.length>=MAX){toast("Lo studio ospita al massimo 8 agenti. Pensiona un agente e riprova.");return;}
 openModal("Un posto per una nuova idea.",
 '<p class="modal-text">Crea un nuovo profilo per il tuo ufficio. Non attiva ancora un modello AI.</p>'+
 '<form id="hireForm"><div class="field"><label for="employeeName">Nome del dipendente</label><input id="employeeName" name="name" required maxlength="30" autocomplete="off" placeholder="Es. Sofia"></div>'+
 '<div class="field"><label for="employeeRole">Professione</label><select id="employeeRole" name="role">'+roles.map(r=>'<option>'+esc(r)+'</option>').join("")+'</select></div>'+
 '<div class="field"><label for="employeeStyle">Stile del personaggio</label><select id="employeeStyle" name="color"><option value="coral">Corallo</option><option value="mint">Menta</option><option value="lavender">Lavanda</option><option value="blue">Blu</option><option value="gold">Oro</option></select></div>'+
 '<div class="field"><label for="employeeModelStyle">Modello 3D / volto e capelli</label><select id="employeeModelStyle" name="modelStyle">'+characterChoices("f1")+'</select></div>'+
 '<p class="modal-note">Il profilo apparirà realmente nella stanza animata e verrà salvato nel browser.</p>'+
 '<div class="modal-actions"><button type="button" class="secondary-button" data-action="close">Annulla</button><button class="primary-button" type="submit">Assumi agente ↗</button></div></form>');
}
function editPersonnel(id){
 const a=state.agents.find(v=>v.id===id);
 if(!a||a.status==="retired")return;
 openModal("Scheda · "+a.name,
 '<p class="modal-text">Ruolo, reparto, competenze e livello sono dati organizzativi salvati solo nel browser.</p>'+
 '<form id="personnelForm"><input type="hidden" name="agentId" value="'+esc(a.id)+'">'+
 '<div class="field"><label for="personnelName">Nome</label><input id="personnelName" name="name" required maxlength="30" value="'+esc(a.name)+'"></div>'+
 '<div class="field"><label for="personnelRole">Professione</label><select id="personnelRole" name="role">'+options(roles,a.role)+'</select></div>'+
 '<div class="field"><label for="personnelDepartment">Reparto</label><select id="personnelDepartment" name="department">'+options(departments,a.department||departmentFor(a.role))+'</select></div>'+
 '<div class="field"><label for="personnelLevel">Livello</label><select id="personnelLevel" name="level">'+options(levels,a.level||"Junior")+'</select></div>'+
 '<fieldset class="personnel-fieldset"><legend>Competenze · massimo 5</legend><div class="personnel-skills-picker">'+skillCatalog.map(v=>
 '<label><input type="checkbox" name="skills" value="'+esc(v)+'" '+((a.skills||[]).includes(v)?"checked":"")+'><span>'+esc(v)+'</span></label>').join("")+'</div></fieldset>'+
 '<div class="modal-actions"><button type="button" class="secondary-button" data-action="close">Annulla</button><button class="primary-button" type="submit">Salva profilo</button></div></form>');
}
function planLeave(id){
 const a=state.agents.find(v=>v.id===id);
 if(!a||a.status==="retired")return;
 openModal("Ferie · "+a.name,
 '<p class="modal-text">Le ferie future vengono applicate quando apri lo studio nel periodo indicato. Puoi interromperle con il pulsante Rientra.</p>'+
 '<form id="leaveForm"><input type="hidden" name="agentId" value="'+esc(a.id)+'">'+
 '<div class="field"><label for="leaveStart">Dal</label><input id="leaveStart" name="start" type="date" min="'+todayLocal()+'" required value="'+esc(a.leaveStart||todayLocal())+'"></div>'+
 '<div class="field"><label for="leaveEnd">Al (compreso)</label><input id="leaveEnd" name="end" type="date" min="'+todayLocal()+'" required value="'+esc(a.leaveEnd||a.leaveStart||todayLocal())+'"></div>'+
 '<div class="modal-actions"><button type="button" class="secondary-button" data-action="close">Annulla</button><button class="primary-button" type="submit">Programma ferie</button></div></form>');
}
function appearance(id){
 const a=state.agents.find(v=>v.id===id);
 if(!a||a.status==="retired")return;
 openModal("Personalizza "+a.name,
 '<p class="modal-text">Scegli tra 8 persone 3D realmente differenti. I modelli includono propri volti, capelli e abiti. Le modifiche si salvano nel browser.</p>'+
 '<form id="appearanceForm"><input type="hidden" name="agentId" value="'+esc(a.id)+'">'+
 '<div class="field"><label for="appearanceCharacter">Modello 3D</label><select id="appearanceCharacter" name="modelStyle">'+characterChoices(a.modelStyle)+'</select></div>'+
 '<div class="field"><label for="appearanceColor">Colore identificativo del dipendente</label><select id="appearanceColor" name="color">'+
 colors.map(c=>'<option value="'+c+'" '+(a.color===c?"selected":"")+'>'+c+'</option>').join("")+'</select></div>'+
 '<p class="modal-note">Il colore personalizza il contrassegno 3D e le etichette. Il colore degli abiti dipende dal modello scelto.</p>'+
 '<div class="modal-actions"><button type="button" class="secondary-button" data-action="close">Annulla</button><button class="primary-button" type="submit">Salva aspetto</button></div></form>');
}
function newTask(id){
 const people=state.agents.filter(a=>a.status==="available"&&assignedCount(a.id)<3);
 openModal("Diamo vita a un'idea.",
 '<p class="modal-text">Scrivi un incarico. Sarà registrato come <strong>in attesa</strong>, senza esecuzione AI finché non colleghiamo il motore.</p>'+
 '<form id="taskForm"><div class="field"><label for="taskTitle">Nome incarico</label><input id="taskTitle" name="title" required maxlength="75" placeholder="Es. Crea una landing page"></div>'+
 '<div class="field"><label for="taskDetail">Descrizione</label><textarea id="taskDetail" name="detail" maxlength="450" placeholder="Spiega cosa vorresti ottenere..."></textarea></div>'+
 '<div class="field"><label for="taskAgent">Assegna a</label><select id="taskAgent" name="agent"><option value="">Da assegnare</option>'+people.map(a=>'<option value="'+esc(a.id)+'" '+(id===a.id?"selected":"")+'>'+esc(a.name)+' · '+esc(a.role)+' ('+assignedCount(a.id)+'/3)</option>').join("")+'</select></div>'+
 '<p class="modal-note">Gli incarichi sono bozze locali: non vengono inviati a Telegram e non consumano crediti AI.</p>'+
 '<div class="modal-actions"><button type="button" class="secondary-button" data-action="close">Annulla</button><button class="primary-button" type="submit">Salva incarico ↗</button></div></form>');
}
function info(){
 openModal("Che cosa funziona già?",'<p class="modal-text"><strong>Questa è una vera anteprima interattiva.</strong> La scena premium contiene fino a quattro agenti con modelli GLB riggati professionali, animazioni e personalizzazione. Lo sfondo non contiene dipendenti statici.</p>'+
 '<p class="modal-text">Puoi assumere agenti, metterli in ferie, pensionarli, recuperarli e creare incarichi: i cambiamenti vengono salvati <strong>solo nel browser</strong> che stai usando.</p>'+
 '<p class="modal-note">Non è ancora collegata a Cloudflare, Telegram, al database o al motore multi-agente di OneManCompany. La scena 3D non esegue attività AI. Le bozze testuali possono essere generate solo dopo il collegamento del Worker con chiave operatore; non sincronizza i dati tra i dispositivi.</p>'+
 '<div class="modal-actions"><button class="primary-button" data-action="close">Ho capito</button></div>');
}
function roadmap(){
 openModal("Il prossimo capitolo.",'<p class="modal-text">La grafica è il primo pezzo. I prossimi passaggi saranno: autenticazione Telegram Mini App, database cloud, connessione al Worker e infine esecuzione verificabile degli agenti.</p>'+
 '<p class="modal-note">Non collegheremo un agente a un\'operazione rischiosa senza autorizzazione. Il progetto originale OneManCompany è conservato separatamente nel repository.</p><div class="modal-actions"><button class="primary-button" data-action="close">Perfetto</button></div>');
}
function reset(){
 openModal("Ripristinare lo studio?",'<p class="modal-text">Eliminerai soltanto i profili, gli incarichi e il diario salvati <strong>in questo browser</strong>. Il progetto su GitHub non verrà modificato.</p><div class="modal-actions"><button class="secondary-button" data-action="close">Annulla</button><button class="primary-button" data-action="confirm-reset">Ripristina</button></div>');
}
function action(kind,id){
 const a=state.agents.find(e=>e.id===id);
 if(kind==="close"){closeModal();return;}
 if(kind==="hire"){hire();return;}
 if(kind==="appearance"&&a){appearance(id);return;}
 if(kind==="edit-personnel"&&a){editPersonnel(id);return;}
 if(kind==="plan-leave"&&a){planLeave(id);return;}
 if(kind==="promote"&&a&&a.status!=="retired"){
   const level=levels.indexOf(a.level||"Junior");
   if(level>=levels.length-1){toast("Il dipendente è già Lead.");return;}
   const before=a.level||"Junior";a.level=levels[level+1];
   activity("↑",a.name+" promosso: "+before+" → "+a.level+".");renderAll();toast(a.name+" promosso a "+a.level);return;
 }
 if(kind==="new-task"){newTask(id||state.selected);return;}
 if(["agent-desk","agent-meeting","agent-lounge"].includes(kind)){
   if(!a||a.status!=="available"){toast("Il dipendente non è disponibile.");return;}
   const zone=kind.slice(6);
   if(window.AIOAgents3D?.command?.(id,zone)){
     toast(({desk:"Verso la scrivania",meeting:"Verso la riunione",lounge:"Verso la pausa"})[zone]+
       " · animazione dimostrativa");
   } else {
     toast("Questa versione anima fino a quattro agenti 3D disponibili.");
   }
   return;
 }
 if(kind==="select"&&a){state.selected=a.id;navigate("office");renderAll();return;}
 if(kind==="vacation"&&a&&a.status!=="retired"){
   a.status=a.status==="vacation"?"available":"vacation";a.leaveStart="";a.leaveEnd="";
   activity(a.status==="vacation"?"☼":"↩",a.name+(a.status==="vacation"?" è stato messo in ferie.":" è tornato dalle ferie."));
   toast(a.status==="vacation"?"Ferie registrate.":"Dipendente nuovamente disponibile.");renderAll();return;
 }
 if(kind==="retire"&&a&&a.status!=="retired"){
   openModal("Pensionare "+a.name+"?",'<p class="modal-text">Il profilo non verrà cancellato: resterà nell\'archivio pensionati e potrai riassumerlo quando vuoi.</p>'+
    '<div class="modal-actions"><button class="secondary-button" data-action="close">Annulla</button><button class="primary-button" data-action="confirm-retire" data-id="'+esc(a.id)+'">Conferma pensionamento</button></div>');return;
 }
 if(kind==="confirm-retire"&&a){
   a.status="retired";a.leaveStart="";a.leaveEnd="";state.selected=available()[0]?.id||"";
   const waiting=state.tasks.filter(t=>t.agent===a.id);
   waiting.forEach(t=>{t.agent="";});
   activity("▤",a.name+" è stato pensionato."+(waiting.length?" "+waiting.length+" incarichi riportati a da assegnare.":""));closeModal();renderAll();toast("Pensionamento registrato.");return;
 }
 if(kind==="reinstate"&&a&&a.status==="retired"){
   a.status="available";a.leaveStart="";a.leaveEnd="";state.selected=a.id;activity("✦",a.name+" è stato riassunto.");toast(a.name+" è di nuovo in ufficio.");renderAll();return;
 }
 if(kind==="delete-task"){
   const t=state.tasks.find(e=>e.id===id);if(t){state.tasks=state.tasks.filter(e=>e.id!==id);activity("×","Incarico eliminato: "+t.title);renderAll();toast("Incarico eliminato.");}return;
 }
 if(kind==="confirm-reset"){state=initial();window.dispatchEvent(new Event("studio:reset"));closeModal();navigate("office");renderAll();toast("Studio ripristinato.");}
}
document.addEventListener("click",event=>{
 const nav=event.target.closest("[data-page]");if(nav){navigate(nav.dataset.page);return;}
 const btn=event.target.closest("[data-action]");if(btn){action(btn.dataset.action,btn.dataset.id);return;}
 const select=event.target.closest("[data-select]");if(select){state.selected=select.dataset.select;renderAll();}
 const seg=event.target.closest("[data-filter]");if(seg){document.querySelectorAll("[data-filter]").forEach(b=>b.classList.remove("active"));seg.classList.add("active");renderPeople();}
});
$("modalShell").addEventListener("submit",event=>{
  if(event.target.id==="hireForm"){
    event.preventDefault();const fd=new FormData(event.target),name=String(fd.get("name")||"").trim();
    if(!name||state.agents.length>=MAX)return;
    const role=String(fd.get("role")),color=String(fd.get("color"));
    const emoji=({Programmatore:"👨‍💻",Designer:"👩‍🎨",Ricercatore:"🧑‍🔬","Revisore QA":"🧑‍🔬",Coordinatore:"👩‍💼",Automazioni:"🤖",Analista:"🧑‍💼",Comunicazione:"👩‍💻"})[role]||"🧑‍💼";
    const chosenStyle=String(fd.get("modelStyle")||"f1");
    const agent={id:"a"+Date.now().toString(36),name:name.slice(0,30),role:roles.includes(role)?role:"Analista",color:colors.includes(color)?color:"blue",modelStyle:validStyle(chosenStyle)?chosenStyle:"f1",avatar:emoji,status:"available",department:departmentFor(role),level:"Junior",skills:skillsFor(role),leaveStart:"",leaveEnd:""};
    state.agents.push(agent);state.selected=agent.id;
    activity("＋",agent.name+" è entrato nel team come "+agent.role+".");
    closeModal();renderAll();navigate("office");toast("Benvenuto nel team, "+agent.name+"!");
  }
  if(event.target.id==="personnelForm"){
    event.preventDefault();const fd=new FormData(event.target);
    const a=state.agents.find(v=>v.id===fd.get("agentId"));
    if(!a||a.status==="retired")return;
    const name=String(fd.get("name")||"").trim().slice(0,30);
    const role=String(fd.get("role")||""),department=String(fd.get("department")||"");
    const level=String(fd.get("level")||"");
    const skills=[...new Set(fd.getAll("skills").map(String))];
    if(!name||!roles.includes(role)||!departments.includes(department)||!levels.includes(level)||
       skills.length>5||skills.some(v=>!skillCatalog.includes(v))){toast("Controlla nome, reparto e competenze (massimo 5).");return;}
    a.name=name;a.role=role;a.department=department;a.level=level;a.skills=skills;
    activity("✎","Profilo aggiornato: "+a.name+" · "+a.department+" · "+a.level);
    closeModal();renderAll();toast("Scheda dipendente aggiornata.");return;
  }
  if(event.target.id==="leaveForm"){
    event.preventDefault();const fd=new FormData(event.target);
    const a=state.agents.find(v=>v.id===fd.get("agentId"));
    const start=String(fd.get("start")||""),end=String(fd.get("end")||"");
    if(!a||a.status==="retired"||!validDate(start)||!validDate(end)||start<todayLocal()||end<start){
      toast("Intervallo ferie non valido.");return;
    }
    a.leaveStart=start;a.leaveEnd=end;
    if(start<=todayLocal())a.status="vacation";
    else a.status="available";
    activity("☼","Ferie "+a.name+": "+start+" → "+end+".");
    closeModal();renderAll();toast("Ferie registrate.");return;
  }
  if(event.target.id==="appearanceForm"){
    event.preventDefault();
    const fd=new FormData(event.target);
    const a=state.agents.find(v=>v.id===String(fd.get("agentId")||""));
    if(!a||a.status==="retired")return;
    const style=String(fd.get("modelStyle")||"");
    const color=String(fd.get("color")||"");
    if(!validStyle(style)||!colors.includes(color))return;
    a.modelStyle=style;a.color=color;
    activity("✦","Aspetto di "+a.name+" aggiornato.");
    closeModal();renderAll();toast("Personaggio 3D aggiornato.");
    return;
  }
  if(event.target.id==="taskForm"){
    event.preventDefault();const fd=new FormData(event.target),title=String(fd.get("title")||"").trim();
    if(!title)return;
    const assignment=String(fd.get("agent")||"");
    const agent=available().some(a=>a.id===assignment&&assignedCount(a.id)<3)?assignment:"";
    state.tasks.unshift({id:"t"+Date.now().toString(36),title:title.slice(0,75),detail:String(fd.get("detail")||"").trim().slice(0,450),agent,at:Date.now()});
    activity("◈","Incarico salvato in attesa: "+title.slice(0,75));closeModal();renderAll();navigate("tasks");toast("Incarico salvato, in attesa del motore AI.");
  }
});
document.addEventListener("input",e=>{if(e.target?.id==="peopleSearch")renderPeople();});
document.addEventListener("change",e=>{if(e.target?.id==="peopleDepartment")renderPeople();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
$("infoBtn").addEventListener("click",info);
$("aboutBtn").addEventListener("click",info);
$("profileBtn").addEventListener("click",info);
$("roadmapBtn").addEventListener("click",roadmap);
$("resetDemo").addEventListener("click",reset);
window.addEventListener("hashchange",()=>navigate(location.hash.slice(1)));

// ISOMETRIC PIXEL-WORLD. Drawn locally; no borrowed sprites or image assets.
const canvas=$("roomCanvas"),cx=canvas.getContext("2d",{alpha:false});
const W=1000,H=610;
let dpr=1,scale=1,offX=0,offY=0,largeView=false,pickPoints=[],raf=0;
function resizeCanvas(){
 const rect=canvas.getBoundingClientRect();
 if(rect.width<10||rect.height<10)return;
 dpr=Math.min(devicePixelRatio||1,2);
 canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
 scale=Math.min(rect.width/W,rect.height/H)*(largeView?1.2:1);
 offX=(rect.width-W*scale)/2;offY=(rect.height-H*scale)/2;
}
function iso(x,y,z=0){return [508+(x-y)*38,120+(x+y)*20-z];}
function path(points,fill,stroke,line=1){
 cx.beginPath();cx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)cx.lineTo(points[i][0],points[i][1]);cx.closePath();
 if(fill){cx.fillStyle=fill;cx.fill();}
 if(stroke){cx.strokeStyle=stroke;cx.lineWidth=line;cx.stroke();}
}
function quad(a,b,c,d,fill,stroke){path([a,b,c,d],fill,stroke);}
function rect(x,y,w,h,fill){cx.fillStyle=fill;cx.fillRect(Math.round(x),Math.round(y),w,h);}
function text(str,x,y,size,color,weight="600",align="center"){
 cx.fillStyle=color;cx.textAlign=align;cx.font=weight+" "+size+"px 'Space Grotesk', sans-serif";cx.fillText(str,x,y);cx.textAlign="start";
}
function prism(x,y,w,h,height,top,front,right){
 const A=iso(x,y,height),B=iso(x+w,y,height),C=iso(x+w,y+h,height),D=iso(x,y+h,height);
 const B0=iso(x+w,y,0),C0=iso(x+w,y+h,0),D0=iso(x,y+h,0);
 quad(D,C,C0,D0,front,"#00000025");
 quad(B,C,C0,B0,right,"#00000027");
 quad(A,B,C,D,top,"#0000002c");
 return {top:[(A[0]+C[0])/2,(A[1]+C[1])/2],A,B,C,D};
}
function drawWall(mood){
 let A=iso(0,0),B=iso(11,0),C=iso(0,9);
 quad([A[0],A[1]-105],[B[0],B[1]-105],B,A,mood==="day"?"#4a5767":"#2f3c50","#64738644");
 quad([A[0],A[1]-105],[C[0],C[1]-105],C,A,mood==="day"?"#536477":"#344355","#8f98a422");
 // Huge windows on the north wall, each with glass reflections / city silhouettes
 for(let i=1;i<10;i+=3){
   const p=iso(i,0),q=iso(i+2.6,0);
   const a=[p[0],p[1]-91],b=[q[0],q[1]-91],c=[q[0],q[1]-20],d=[p[0],p[1]-20];
   quad(a,b,c,d,mood==="day"?"#668ca5":"#1d354d","#8ea9b64e",3);
   for(let k=0;k<4;k++){
     const xx=p[0]+(q[0]-p[0])*(k+.3)/4,yy=p[1]+(q[1]-p[1])*(k+.3)/4;
     rect(xx,yy-38+(k%2)*7,9,18+(k%2)*9,mood==="day"?"#49647a":"#172437");
     if(mood!=="day"){rect(xx+3,yy-30,2,3,"#d6ae74");rect(xx+6,yy-21,2,3,"#d6ae74");}
   }
   quad([a[0]+8,a[1]+7],[a[0]+21,a[1]+12],[d[0]+21,d[1]-9],[d[0]+8,d[1]-6],"#d0e5f117");
 }
 // Decor neon sign left wall.
 const v=iso(0,2.8,55);rect(v[0]-18,v[1]-20,31,27,"#14283b");text("✳",v[0]-2,v[1],20,"#efd1a5");
}
function drawFloor(mood){
 const v=[iso(0,0),iso(11,0),iso(11,9),iso(0,9)];
 cx.save();cx.shadowBlur=42;cx.shadowColor="#000000a0";cx.shadowOffsetY=16;
 path(v,"#8e715e","#786752",2);cx.restore();
 for(let x=0;x<11;x++)for(let y=0;y<9;y++){
   const dark=(x+y)%2===0;
   let c=dark?"#b79b7d":"#c2a787";
   if(x>=7&&y>=6)c=dark?"#7b9b91":"#83a599";
   if(mood==="day")c=x>=7&&y>=6?(dark?"#9db6a0":"#abc7ae"):(dark?"#c9b194":"#d3bd9e");
   quad(iso(x,y),iso(x+1,y),iso(x+1,y+1),iso(x,y+1),c,"#4d3f382d");
   if((x+y)%3===0){const a=iso(x+.23,y+.27);rect(a[0],a[1],2,2,"#f8deaf22");}
 }
 // small rug and perimeter trim
 quad(iso(1,3.9),iso(4.9,3.9),iso(4.9,5.5),iso(1,5.5),"#7e6870a8","#f3c19a50",3);
 quad(iso(7,6.1),iso(10.7,6.1),iso(10.7,8.6),iso(7,8.6),"#4b797188","#aec9a288",3);
}
function plant(x,y,s=1){
 const p=prism(x,y,.55*s,.55*s,12*s,"#d28f66","#82573e","#ae7251");
 const [cx0,cy0]=p.top;
 for(let i=0;i<7;i++){
   const angle=i*2.399,t=10+7*(i%2),dx=Math.cos(angle)*t,dy=Math.sin(angle)*t*.7;
   cx.beginPath();cx.ellipse(cx0+dx*.65,cy0-16+dy,7*s,13*s,angle,0,Math.PI*2);cx.fillStyle=["#315e5b","#477969","#5b8c6a"][i%3];cx.fill();
 }
 rect(cx0-2,cy0-14,4,12,"#69886e");
}
function desktop(x,y,mood){
 const p=prism(x,y,1.8,1.0,22,mood==="day"?"#94765e":"#8c6a59","#4b3840","#593f42");
 // pads / hardware
 const P=iso(x+.6,y+.48,25);
 rect(P[0]-15,P[1]+3,30,7,"#3b4659");rect(P[0]-13,P[1]+5,26,2,"#c4a7a1");
 // monitor screen, slight animated glint
 path([[P[0]-21,P[1]-32],[P[0]+19,P[1]-29],[P[0]+19,P[1]-4],[P[0]-21,P[1]-7]],"#253e53","#b0aba3",3);
 rect(P[0]-16,P[1]-27,29,17,mood==="day"?"#689caf":"#335e75");
 for(let i=0;i<3;i++)rect(P[0]-13,P[1]-24+i*5,17-i*3,2,["#bbd6a0","#b7c9db","#82bb9f"][i]);
 rect(P[0]-1,P[1]-5,4,12,"#5b6370");
 const m=iso(x+1.55,y+.2,25);rect(m[0]-6,m[1]-5,11,5,"#d0b097");
 return p;
}
function lamp(x,y,t){
 const p=iso(x,y);
 rect(p[0]-3,p[1]-65,6,62,"#3f5361");
 cx.beginPath();cx.arc(p[0],p[1]-70,14,Math.PI,0);cx.fillStyle="#e9bc78";cx.fill();
 cx.beginPath();cx.ellipse(p[0],p[1]-30,35,27,0,0,Math.PI*2);cx.fillStyle="#ffdd8a0c";cx.fill();
}
function server(x,y){
 const p=prism(x,y,1.0,1.0,61,"#74808b","#313e54","#293b53");
 for(let i=0;i<4;i++){
   const z=iso(x+.5,y+.92,47-i*10);rect(z[0]-11,z[1]-1,24,5,"#121f33");rect(z[0]-9,z[1],4,2,i===2?"#ffbb7f":"#7cdbb5");
 }
 return p;
}
function meeting(x,y){
 const p=prism(x,y,2.0,1.5,16,"#798680","#4b5553","#4b515b");
 for(let i=0;i<3;i++){const a=iso(x+.25+i*.55,y+.7,18);rect(a[0]-6,a[1]-3,11,6,["#c7ddd3","#deb19f","#a4bdd1"][i]);}
}
function coffee(x,y){
 prism(x,y,1,1.2,24,"#b28d73","#715650","#7e645a");
 const p=iso(x+.48,y+.55,28);rect(p[0]-11,p[1]-21,22,18,"#2f4e61");rect(p[0]-8,p[1]-18,14,9,"#a1d3cd");rect(p[0]+6,p[1]-1,4,6,"#ebb888");
}
function boxShadow(x,y,rx,ry){cx.beginPath();cx.ellipse(x,y,rx,ry,0,0,Math.PI*2);cx.fillStyle="#11162766";cx.fill();}
const clothes={coral:["#ee917f","#b65e66"],mint:["#63bda4","#3b8876"],lavender:["#a99eea","#7770bd"],blue:["#7faee9","#5179b8"],gold:["#e6be74","#a6814e"]};
function avatar(a,index,time){
 const [gx,gy]=stations[index%stations.length],p=iso(gx,gy);
 const bob=a.status==="vacation"?0:Math.sin(time*.0015+index)*2.2;
 const y=p[1]-bob,x=p[0],shade=clothes[a.color]||clothes.blue;
 pickPoints.push({id:a.id,x,y:y-32});
 boxShadow(x,p[1]-2,18,7);
 if(state.selected===a.id){
   cx.beginPath();cx.ellipse(x,p[1]-3,25,12,0,0,Math.PI*2);cx.strokeStyle="#f9d8a7";cx.lineWidth=3;cx.stroke();
   cx.beginPath();cx.ellipse(x,p[1]-3,30,16,0,0,Math.PI*2);cx.strokeStyle="#f9d8a735";cx.lineWidth=2;cx.stroke();
 }
 // feet and work attire (custom pixel character)
 rect(x-11,y-14,8,11,"#20273b");rect(x+3,y-14,8,11,"#20273b");
 rect(x-12,y-8,10,4,"#1a2030");rect(x+3,y-8,10,4,"#1a2030");
 rect(x-13,y-35,26,23,shade[0]);rect(x-13,y-16,26,7,shade[1]);rect(x-15,y-32,5,16,shade[1]);rect(x+11,y-32,5,16,shade[1]);
 rect(x-9,y-57,19,21,["#c88b65","#e9b38d","#8e584b","#e0a983"][index%4]);
 rect(x-10,y-59,21,7,["#392c30","#473238","#2c2834","#6c4334"][index%4]);
 rect(x-10,y-55,4,8,["#392c30","#473238","#2c2834","#6c4334"][index%4]);
 rect(x-5,y-48,2,3,"#302a32");rect(x+4,y-48,2,3,"#302a32");
 rect(x-2,y-42,6,2,"#9c5c59");
 if(a.status==="vacation"){
   rect(x-13,y-64,26,5,"#f8d09b");rect(x-7,y-69,14,7,"#f8d09b");
 }
 if(state.selected===a.id){
   const label=String(a.name).slice(0,14),lw=Math.max(77,24+label.length*7);
   cx.fillStyle="#101926";cx.strokeStyle="#f6c693";cx.lineWidth=1;
   cx.beginPath();cx.roundRect(x-lw/2,y-89,lw,22,6);cx.fill();cx.stroke();
   text(label,x,y-73,12,"#f3e0ce","700");
   path([[x-4,y-67],[x+4,y-67],[x,y-62]],"#f6c693");
 }
 if(a.status==="vacation"){text("☀",x+17,y-61,19,"#ffe1a2");}
}
function decor(t){
 // suspended lights and work-in-progress board (visual only)
 lamp(5.2,1.3,t);lamp(8.3,6,t);
 const board=iso(6.4,.2,80);
 path([[board[0]-41,board[1]-13],[board[0]+60,board[1]+34],[board[0]+60,board[1]+88],[board[0]-41,board[1]+41]],"#34475a","#b9cbd0",4);
 text("SPRINT",board[0]+7,board[1]+20,13,"#c9e0dc","700");
 for(let i=0;i<3;i++){const yy=board[1]+33+i*13;rect(board[0]-28,yy,26+(i%2)*13,5,["#b6c4be","#e8c092","#81b9bb"][i]);}
}
function scene(t){
 if(!canvas.width||!canvas.height)return;
 cx.setTransform(1,0,0,1,0,0);
 const bg=cx.createLinearGradient(0,0,canvas.width,canvas.height);
 if(state.mood==="day"){bg.addColorStop(0,"#324456");bg.addColorStop(1,"#1b2939");}
 else{bg.addColorStop(0,"#16293b");bg.addColorStop(1,"#0b1424");}
 cx.fillStyle=bg;cx.fillRect(0,0,canvas.width,canvas.height);
 cx.setTransform(dpr*scale,0,0,dpr*scale,dpr*offX,dpr*offY);
 // Ambient ambient dust and grid details.
 for(let i=0;i<31;i++){
   const x=(i*123.7+Math.sin(t*.0003+i)*18)%W,y=(i*79.1+Math.cos(t*.0004+i)*12)%H;
   rect(x,y,1.5,1.5,state.mood==="day"?"#ffffff28":"#adc7e01e");
 }
 cx.save();cx.shadowColor="#0009";cx.shadowBlur=30;cx.shadowOffsetY=11;
 drawFloor(state.mood);cx.restore();
 drawWall(state.mood);
 // Layered objects in world depth order.
 plant(.7,2.2,1.2);plant(9.8,.9,.9);
 desktop(1.7,2.05,state.mood);
 desktop(6.05,1.65,state.mood);
 meeting(1.6,5.8);
 desktop(6.5,5.1,state.mood);
 server(9.25,2.35);server(10.0,2.45);
 coffee(8.5,7.4);plant(10.3,7.75,.9);plant(.8,8.0,.9);
 decor(t);
 // Small wall clock.
 const ck=iso(3.2,0,62);cx.beginPath();cx.arc(ck[0],ck[1],15,0,Math.PI*2);cx.fillStyle="#eac89e";cx.fill();cx.beginPath();cx.arc(ck[0],ck[1],11,0,Math.PI*2);cx.fillStyle="#3d5162";cx.fill();rect(ck[0],ck[1]-7,2,9,"#eec892");rect(ck[0],ck[1],6,2,"#eec892");
 pickPoints=[];
 state.agents.forEach((a,i)=>{if(a.status!=="retired")avatar(a,i,t);});
 // In-studio identity sign.
 const s=iso(5.2,7.95);
 text("YOUR COMPANY, ALIVE",s[0],s[1]+28,12,"#f4e8d1aa","700");
}
let reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches,frameSkip=0;
function loop(t){if(canvas.offsetParent!==null&&document.visibilityState!=="hidden"&&(!reduced||frameSkip++%30===0))scene(t);raf=requestAnimationFrame(loop);}
canvas.addEventListener("click",event=>{
 const r=canvas.getBoundingClientRect();
 const x=(event.clientX-r.left-offX)/scale,y=(event.clientY-r.top-offY)/scale;
 let best=null,dist=Infinity;
 for(const p of pickPoints){const d=(p.x-x)**2+(p.y-y)**2;if(d<dist){best=p;dist=d;}}
 if(best&&dist<53**2){state.selected=best.id;renderAll();toast(state.agents.find(a=>a.id===best.id)?.name+" selezionato");}
});
$("roomZoom").addEventListener("click",()=>{largeView=!largeView;resizeCanvas();toast(largeView?"Vista ravvicinata":"Vista completa");});
$("roomMood").addEventListener("click",()=>{const modes=["evening","day","night","auto"];state.mood=modes[(modes.indexOf(state.mood)+1)%modes.length];save();window.dispatchEvent(new Event("studio:atmosphere"));toast(({day:"Luce diurna",evening:"Tramonto",night:"Luce notturna",auto:"Ambiente automatico"})[state.mood]);});
window.addEventListener("resize",resizeCanvas);
if("ResizeObserver" in window)new ResizeObserver(resizeCanvas).observe(canvas);
window.AIOStudio={
 getAgents:()=>state.agents,getTasks:()=>state.tasks.map(t=>({...t})),refresh:renderAll,
 getSelected:()=>state.selected,getMood:()=>state.mood,
 openModal:(title,contents)=>openModal(title,contents),closeModal,toast,
 logEvent:(kind,message)=>{activity(String(kind).slice(0,4),String(message).slice(0,180));renderAll();},
 transferTask:(taskId,fromId,toId)=>{
   const task=state.tasks.find(t=>t.id===taskId);
   const target=state.agents.find(a=>a.id===toId);
   if(!task||!target||target.status!=="available"||task.agent!==fromId||fromId===toId||
     assignedCount(toId)>=3)return false;
   task.agent=toId;
   activity("↗","Incarico in attesa «"+task.title+"» riassegnato a "+target.name+" su conferma del direttore.");
   renderAll();return true;
 },
 select:id=>{if(state.agents.some(a=>a.id===id&&a.status!=="retired")){state.selected=id;renderAll();}}
};
renderAll();navigate(["office","people","tasks","collab","activity"].includes(location.hash.slice(1))?location.hash.slice(1):"office");
resizeCanvas();raf=requestAnimationFrame(loop);
})();