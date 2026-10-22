/* AI OFFICE Sprint 05 — director-operated collaborative office prototype.
 * No AI dialogue or task execution is simulated as verified work.
 */
"use strict";
(() => {
 const bridge=window.AIOStudio;
 const KEY="ai-office-collab-v1",MAX_MEETINGS=30,MAX_REQUESTS=60;
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const now=()=>Date.now();
 const token=prefix=>prefix+now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
 const label=id=>bridge.getAgents().find(a=>a.id===id)?.name||"Profilo non disponibile";
 const available=()=>bridge.getAgents().filter(a=>a.status==="available");
 const button=(kind,id,labelText,extra="")=>'<button type="button" data-collab-action="'+kind+'" data-id="'+esc(id)+'" '+extra+'>'+esc(labelText)+'</button>';
 const clean=v=>String(v??"").slice(0,300);
 function load(){
   try{
     const raw=JSON.parse(localStorage.getItem(KEY)||"{}");
     return {
       meetings:(Array.isArray(raw.meetings)?raw.meetings:[]).filter(m=>m&&typeof m.title==="string"&&Array.isArray(m.participants)).slice(0,MAX_MEETINGS).map(m=>({
         id:clean(m.id),title:clean(m.title).slice(0,70),agenda:clean(m.agenda).slice(0,240),
         participants:[...new Set(m.participants.filter(v=>typeof v==="string"))].slice(0,4),
         status:["planned","active","closed","cancelled"].includes(m.status)?m.status:"planned",
         speaker:typeof m.speaker==="string"?clean(m.speaker):"",
         createdAt:Number(m.createdAt)||now(),
         decisions:(Array.isArray(m.decisions)?m.decisions:[]).slice(0,15).map(d=>({text:clean(d.text).slice(0,200),at:Number(d.at)||now()}))
       })),
       requests:(Array.isArray(raw.requests)?raw.requests:[]).filter(r=>r&&typeof r.topic==="string").slice(0,MAX_REQUESTS).map(r=>({
         id:clean(r.id),from:clean(r.from),to:clean(r.to),topic:clean(r.topic).slice(0,120),
         taskId:clean(r.taskId),status:["proposed","approved","rejected","handed-off"].includes(r.status)?r.status:"proposed",
         at:Number(r.at)||now()
       })),
       ledger:(Array.isArray(raw.ledger)?raw.ledger:[]).filter(x=>x&&typeof x.message==="string").slice(0,80).map(x=>({
         id:clean(x.id),message:clean(x.message).slice(0,180),at:Number(x.at)||now()
       }))
     };
   }catch{return {meetings:[],requests:[],ledger:[]};}
 }
 let state=load();
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch{bridge.toast("Salvataggio locale non disponibile.");}};
 function record(message){
   const safe=clean(message).slice(0,180);
   state.ledger.unshift({id:token("l"),message:safe,at:now()});
   state.ledger=state.ledger.slice(0,80);
   save();bridge.logEvent("♧",safe);render();
 }
 function itemMeeting(m){
   const eligible=m.participants.filter(id=>available().some(a=>a.id===id));
   const active=m.status==="active";
   const labelState={planned:"DA AVVIARE",active:"IN CORSO · SIMULAZIONE VISIVA",closed:"CONCLUSA",cancelled:"ANNULLATA"}[m.status];
   return '<article class="collab-card meeting-card" data-meeting-id="'+esc(m.id)+'">'+
     '<div class="collab-card-head"><span class="collab-icon">♧</span><span class="collab-tag">'+labelState+'</span></div>'+
     '<h3>'+esc(m.title)+'</h3><p>'+esc(m.agenda||"Nessun ordine del giorno")+'</p>'+
     '<div class="collab-members">'+m.participants.map(id=>'<span class="'+(available().some(a=>a.id===id)?"":"unavailable")+'">'+esc(label(id))+'</span>').join("")+'</div>'+
     (active?'<div class="speaker-row"><strong>Intervento visivo:</strong>'+
       m.participants.map(id=>button("speaker",m.id,((m.speaker===id)?"● ":"○ ")+label(id),'data-agent="'+esc(id)+'" '+(eligible.includes(id)?"":"disabled"))).join("")+'</div>':"")+
     '<div class="collab-records">'+m.decisions.map(d=>'<div>✓ '+esc(d.text)+'<small> · inserito manualmente</small></div>').join("")+'</div>'+
     '<div class="collab-actions">'+
       (m.status==="planned"?button("start-meeting",m.id,"▶ Avvia riunione")+button("cancel-meeting",m.id,"Annulla"):"")+
       (active?button("decision",m.id,"＋ Decisione")+button("end-meeting",m.id,"■ Concludi"):"")+
       (m.status==="closed"?button("decision",m.id,"＋ Nota finale"):"")+'</div>'+
     (active&&eligible.length<2?'<p class="collab-warning">Meno di due partecipanti disponibili.</p>':"")+
     '</article>';
 }
 function itemRequest(r){
   const stateLabels={proposed:"PROPOSTA",approved:"APPROVATA DAL DIRETTORE",rejected:"RESPINTA", "handed-off":"BOZZA RIASSEGNATA"};
   const task=bridge.getTasks().find(t=>t.id===r.taskId);
   return '<article class="collab-card" data-request-id="'+esc(r.id)+'">'+
    '<div class="collab-card-head"><span class="collab-icon">↗</span><span class="collab-tag">'+stateLabels[r.status]+'</span></div>'+
    '<h3>'+esc(r.topic)+'</h3>'+
    '<p><strong>'+esc(label(r.from))+' → '+esc(label(r.to))+'</strong></p>'+
    (r.taskId?'<div class="collab-task">◈ '+esc(task?.title||"Incarico non più presente")+'</div>':"")+
    '<div class="collab-actions">'+
    (r.status==="proposed"?button("approve-request",r.id,"✓ Approva")+button("reject-request",r.id,"✕ Rifiuta"):"")+
    (r.status==="approved"&&r.taskId?button("handoff",r.id,"↗ Passa incarico"):"")+
    '</div></article>';
 }
 function render(){
   const board=$("collabMeetings"),requests=$("collabRequests"),log=$("collabLedger");
   if(!board||!requests||!log)return;
   board.innerHTML=state.meetings.length?state.meetings.map(itemMeeting).join(""):
     '<div class="collab-empty">Nessuna riunione. Creane una per riunire i dipendenti.</div>';
   requests.innerHTML=state.requests.length?state.requests.map(itemRequest).join(""):
     '<div class="collab-empty">Nessuna proposta di collaborazione.</div>';
   log.innerHTML=state.ledger.length?state.ledger.slice(0,14).map(e=>'<div class="collab-ledger-row">'+esc(e.message)+
     '<time>'+new Date(e.at).toLocaleString("it-IT")+'</time></div>').join(""):
     '<p class="collab-empty">Le azioni confermate compariranno qui.</p>';
   $("collabMeetingsCount").textContent=String(state.meetings.filter(m=>m.status==="active").length);
   $("collabRequestsCount").textContent=String(state.requests.filter(r=>r.status==="proposed").length);
   const badge=$("nav-collab");if(badge)badge.textContent=String(state.meetings.filter(m=>m.status==="active").length).padStart(2,"0");
 }
 function syncScene(){
   const selected=state.meetings.find(m=>m.status==="active");
   const participants=selected?.participants.filter(id=>available().some(a=>a.id===id))||[];
   window.AIOAgents3D?.setMeetingSession?.({participants,speakerId:participants.includes(selected?.speaker)?selected.speaker:""});
 }
 function formMeeting(){
   const people=available();
   if(people.length<2){bridge.toast("Servono almeno due dipendenti disponibili.");return;}
   bridge.openModal("Nuova riunione",'<p class="modal-text">Solo animazione e note inserite dal direttore: nessun dialogo AI reale.</p>'+
     '<form id="meetingForm"><div class="field"><label for="meetingTitle">Titolo</label><input id="meetingTitle" name="title" required maxlength="70" placeholder="Es. Revisione progetto"></div>'+
     '<div class="field"><label for="meetingAgenda">Ordine del giorno</label><textarea id="meetingAgenda" name="agenda" maxlength="240" placeholder="Argomenti della riunione"></textarea></div>'+
     '<fieldset class="personnel-fieldset"><legend>Partecipanti (da 2 a 4)</legend><div class="collab-checks">'+
     people.map((a,i)=>'<label><input type="checkbox" name="members" value="'+esc(a.id)+'" '+(i<Math.min(people.length,3)?"checked":"")+'><span>'+esc(a.name)+'</span></label>').join("")+
     '</div></fieldset><div class="modal-actions"><button type="button" class="secondary-button" data-action="close">Annulla</button>'+
     '<button class="primary-button" type="submit">Salva riunione</button></div></form>');
 }
 function formRequest(){
   const people=available();
   if(people.length<2){bridge.toast("Servono due dipendenti disponibili.");return;}
   const fields=people.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+" · "+esc(a.role)+'</option>').join("");
   const tasks=bridge.getTasks().filter(t=>t.agent===people[0].id);
   bridge.openModal("Nuova collaborazione",'<p class="modal-text">Crea una richiesta da approvare manualmente. Gli agenti non rispondono automaticamente.</p>'+
    '<form id="collabRequestForm"><div class="field"><label for="collabFrom">Da</label><select id="collabFrom" name="from">'+fields+'</select></div>'+
    '<div class="field"><label for="collabTo">A</label><select id="collabTo" name="to">'+fields+'</select></div>'+
    '<div class="field"><label for="collabTopic">Obiettivo</label><input id="collabTopic" name="topic" maxlength="120" required placeholder="Es. Revisione del report"></div>'+
    '<div class="field"><label for="collabTask">Bozza incarico (facoltativa)</label><select id="collabTask" name="taskId"><option value="">Nessun incarico</option>'+
    tasks.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.title)+'</option>').join("")+'</select></div>'+
    '<div class="modal-actions"><button type="button" class="secondary-button" data-action="close">Annulla</button>'+
    '<button class="primary-button" type="submit">Crea proposta</button></div></form>');
 }
 function formDecision(meeting){
   bridge.openModal("Registra decisione",'<p class="modal-text">Scrivi soltanto una decisione reale inserita da te: non viene generata alcuna trascrizione.</p>'+
     '<form id="meetingDecisionForm"><input type="hidden" name="meetingId" value="'+esc(meeting.id)+'">'+
     '<div class="field"><label for="decisionText">Decisione / nota</label><textarea id="decisionText" name="text" required maxlength="200"></textarea></div>'+
     '<div class="modal-actions"><button type="button" class="secondary-button" data-action="close">Annulla</button>'+
     '<button class="primary-button" type="submit">Registra</button></div></form>');
 }
 function manageAction(kind,id,agentId){
   const meeting=state.meetings.find(m=>m.id===id),request=state.requests.find(r=>r.id===id);
   if(kind==="new-meeting")return formMeeting();
   if(kind==="new-request")return formRequest();
   if(kind==="decision"&&meeting&&["active","closed"].includes(meeting.status))return formDecision(meeting);
   if(kind==="start-meeting"&&meeting&&meeting.status==="planned"){
     if(state.meetings.some(m=>m.status==="active")){bridge.toast("Concludi prima la riunione già in corso.");return;}
     if(meeting.participants.filter(v=>available().some(a=>a.id===v)).length<2){bridge.toast("Servono almeno due partecipanti disponibili.");return;}
     meeting.status="active";meeting.speaker="";record("Riunione «"+meeting.title+"» avviata manualmente.");syncScene();return;
   }
   if(kind==="speaker"&&meeting&&meeting.status==="active"&&meeting.participants.includes(agentId)&&available().some(a=>a.id===agentId)){
     meeting.speaker=agentId;record("Intervento visivo selezionato: "+label(agentId)+" · "+meeting.title);syncScene();return;
   }
   if(["end-meeting","cancel-meeting"].includes(kind)&&meeting&&
     (kind==="end-meeting"?meeting.status==="active":meeting.status==="planned")){
     meeting.status=kind==="end-meeting"?"closed":"cancelled";meeting.speaker="";
     record("Riunione «"+meeting.title+"» "+(meeting.status==="closed"?"conclusa dal direttore.":"annullata."));syncScene();return;
   }
   if(kind==="approve-request"&&request&&request.status==="proposed"){
     if(!available().some(a=>a.id===request.to)&&!available().some(a=>a.id===request.from)){
       bridge.toast("Partecipanti non disponibili.");return;
     }
     request.status="approved";record("Collaborazione approvata manualmente: "+request.topic);return;
   }
   if(kind==="reject-request"&&request&&request.status==="proposed"){
     request.status="rejected";record("Proposta respinta manualmente: "+request.topic);return;
   }
   if(kind==="handoff"&&request&&request.status==="approved"&&request.taskId){
     if(!bridge.transferTask(request.taskId,request.from,request.to)){
       bridge.toast("Passaggio impossibile: controlla assegnazione, disponibilità o capacità (3).");return;
     }
     request.status="handed-off";record("Passaggio confermato: "+request.topic+" · "+label(request.from)+" → "+label(request.to));return;
   }
 }
 document.addEventListener("click",e=>{
   const btn=e.target.closest("[data-collab-action]");if(btn)manageAction(btn.dataset.collabAction,btn.dataset.id,btn.dataset.agent);
 });
 document.addEventListener("change",e=>{
   if(e.target?.id!=="collabFrom")return;
   const from=e.target.value,sel=$("collabTask");if(!sel)return;
   sel.replaceChildren(new Option("Nessun incarico",""));
   bridge.getTasks().filter(t=>t.agent===from).forEach(t=>sel.add(new Option(t.title,t.id)));
 });
 document.addEventListener("submit",e=>{
   const form=e.target;
   if(!["meetingForm","collabRequestForm","meetingDecisionForm"].includes(form.id))return;
   e.preventDefault();const fd=new FormData(form);
   if(form.id==="meetingForm"){
     const title=clean(fd.get("title")).trim().slice(0,70);
     const members=[...new Set(fd.getAll("members").map(String))];
     if(!title||members.length<2||members.length>4||members.some(id=>!available().some(a=>a.id===id))){
       bridge.toast("Scegli da due a quattro dipendenti disponibili.");return;
     }
     state.meetings.unshift({id:token("m"),title,agenda:clean(fd.get("agenda")).trim().slice(0,240),
       participants:members,status:"planned",speaker:"",decisions:[],createdAt:now()});
     state.meetings=state.meetings.slice(0,MAX_MEETINGS);
     bridge.closeModal();record("Riunione «"+title+"» creata dal direttore.");
   }
   if(form.id==="collabRequestForm"){
     const from=clean(fd.get("from")),to=clean(fd.get("to")),topic=clean(fd.get("topic")).trim().slice(0,120),
       taskId=clean(fd.get("taskId"));
     const tasks=bridge.getTasks();
     if(!topic||from===to||!available().some(a=>a.id===from)||!available().some(a=>a.id===to)||
       (taskId&&!tasks.some(t=>t.id===taskId&&t.agent===from))){
       bridge.toast("Verifica colleghi distinti e incarico del mittente.");return;
     }
     state.requests.unshift({id:token("r"),from,to,topic,taskId,status:"proposed",at:now()});
     state.requests=state.requests.slice(0,MAX_REQUESTS);
     bridge.closeModal();record("Proposta da "+label(from)+" a "+label(to)+": "+topic);
   }
   if(form.id==="meetingDecisionForm"){
     const meeting=state.meetings.find(m=>m.id===fd.get("meetingId")),decision=clean(fd.get("text")).trim().slice(0,200);
     if(!meeting||!decision||!["active","closed"].includes(meeting.status)){bridge.toast("Nota non valida.");return;}
     meeting.decisions.push({text:decision,at:now()});meeting.decisions=meeting.decisions.slice(-15);
     bridge.closeModal();record("Decisione inserita manualmente nella riunione «"+meeting.title+"».");render();
   }
 });
 window.addEventListener("studio:changed",()=>{render();syncScene();});
 window.addEventListener("studio:agents3d-ready",syncScene);
 window.addEventListener("studio:reset",()=>{
   state={meetings:[],requests:[],ledger:[]};save();syncScene();render();
 });
 window.AIOCollab={render,getSnapshot:()=>JSON.parse(JSON.stringify(state)),syncScene};
 render();syncScene();
})();
