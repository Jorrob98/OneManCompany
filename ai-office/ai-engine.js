/* AI OFFICE Sprint 06: direct, manually authorized Workers AI text draft generation.
 * The operator secret is deliberately held in memory only and never written to storage.
 * Visual agent animations are independent of AI execution state.
 */
"use strict";
(() => {
 const bridge=window.AIOStudio;
 if(!bridge)throw new Error("AIOStudio must be loaded before AI engine");
 const API="https://ai-office-api.jorrob98.workers.dev";
 const STORE="ai-office-ai-results-v1";
 const $=id=>document.getElementById(id);
 let key="",busy=false,ready=false,checking=false;
 let results={};
 try {
   const raw=JSON.parse(localStorage.getItem(STORE)||"{}");
   if(raw&&typeof raw==="object"&&!Array.isArray(raw)){
     for(const [id,r] of Object.entries(raw).slice(0,50))
       if(r?.kind==="text-draft"&&typeof r.output==="string"&&r.output.length<6200&&
          typeof r.model==="string"&&typeof r.title==="string")
         results[id]={kind:"text-draft",output:r.output,model:r.model,producedAt:r.producedAt,
           title:r.title,agent:r.agent,requestId:r.requestId,requiresReview:true};
   }
 } catch {}
 const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(results));}catch{bridge.toast("Spazio locale esaurito: risultato non salvato.");}};
 const status=(message,state="unavailable")=>{
   const node=$("aiEngineStatus");if(!node)return;
   node.textContent=message;node.dataset.state=state;
 };
 const getResult=id=>{
   const t=bridge.getTasks().find(x=>x.id===id),r=results[id];
   return t&&r&&r.title===t.title&&r.agent===t.agent?r:null;
 };
 const render=()=>{
   const node=$("aiEngineKeyState");if(node)node.textContent=key?"Chiave caricata solo per questa sessione":"Chiave non caricata";
   document.querySelectorAll('[data-ai-action="generate"]').forEach(button=>{
     button.disabled=busy||!ready||!key;
     button.title=!ready?"Worker AI non disponibile o non verificato":!key?"Inserisci prima la chiave operatore":"Genera una bozza reale con Workers AI";
   });
   const meta=$("aiEngineInfo");
   if(meta)meta.textContent="API: "+API+" · Dati elaborati soltanto su tua richiesta";
 };
 const timeoutFetch=async(url,options={},duration=25000)=>{
   const controller=new AbortController();
   const id=setTimeout(()=>controller.abort(),duration);
   try{return await fetch(url,{...options,signal:controller.signal,cache:"no-store"});}
   finally{clearTimeout(id);}
 };
 async function probe(){
   if(checking)return;
   checking=true;ready=false;
   status("Verifica Worker…","checking");render();
   try{
     const res=await timeoutFetch(API+"/api/ai/status",{},8500);
     if(!res.ok)throw Error("Worker HTTP "+res.status);
     const data=await res.json();
     ready=data?.ok===true&&data?.ready===true&&data?.engine==="cloudflare-workers-ai";
     const issues={
       ai_binding_unavailable:"Binding Workers AI non configurato sul Worker",
       operator_secret_missing_or_short:"Chiave AI_OFFICE_API_KEY assente o non valida su Cloudflare",
       allowed_origins_missing:"Imposta AI_OFFICE_ALLOWED_ORIGINS su Cloudflare"
     };
     status(ready?"Worker configurato · inferenza live da verificare":(issues[data?.setupIssue]||"Worker non configurato"),
       ready?"available":"unavailable");
   } catch {status("Worker non raggiungibile o API non pubblicata");}
   finally{checking=false;render();}
 }
 function storeResponse(task,data){
   results[task.id]={kind:"text-draft",title:task.title,agent:task.agent,
     output:data.output.slice(0,6000),model:data.model.slice(0,120),
     producedAt:data.producedAt,requestId:data.requestId,requiresReview:true};
   save();bridge.refresh();
 }
 async function generate(taskId){
   if(busy||!ready||!key){bridge.toast("Verifica il Worker e inserisci la chiave operatore.");return;}
   const t=bridge.getTasks().find(t=>t.id===taskId);
   if(!t)return;
   const agent=bridge.getAgents().find(a=>a.id===t.agent);
   if(agent&&agent.status!=="available"){bridge.toast("Agente assegnato non disponibile.");return;}
   busy=true;render();status("Generazione AI in corso…","checking");
   const button=document.querySelector('[data-ai-action="generate"][data-id="'+CSS.escape(taskId)+'"]');
   if(button)button.textContent="Generazione…";
   try{
     const res=await timeoutFetch(API+"/api/ai/generate",{
       method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+key},
       body:JSON.stringify({title:t.title,details:t.detail,role:agent?.role||"Assistente",
         instructions:($("aiEngineInstructions")?.value||"").slice(0,300)})
     },45000);
     const data=await res.json().catch(()=>({error:"invalid_response"}));
     if(!res.ok||!data.ok)throw Error(({
       unauthorized:"Chiave operatore non valida",origin_not_allowed:"Anteprima non autorizzata su Cloudflare",
       inference_failed:"Errore di inferenza",ai_rate_limited:"Troppe richieste: riprova più tardi",
       ai_quota_exceeded:"Quota Workers AI esaurita",ai_binding_unavailable:"Binding AI non configurato",
       operator_key_not_configured:"Chiave operatore non configurata sul Worker"
     })[data.error]||"Errore API "+res.status);
     if(data.kind!=="text-draft"||typeof data.output!=="string"||!data.output.trim()||
       typeof data.model!=="string"||typeof data.producedAt!=="string"||
       typeof data.requestId!=="string")throw Error("Risposta AI non verificabile");
     storeResponse(t,data);
     bridge.logEvent("✦","Bozza testuale generata da Workers AI per «"+t.title+"». Revisione umana necessaria.");
     bridge.toast("Bozza AI generata. Controlla il risultato.");
     status("Ultima generazione riuscita · verifica il contenuto","available");
   } catch(e){
     status("Nessun risultato generato: "+(e.name==="AbortError"?"tempo massimo superato":e.message),"error");
     bridge.toast("Generazione non riuscita: nessun completamento registrato.");
   } finally {
     busy=false;if(button)button.textContent="✦ Genera bozza AI";
     render();
   }
 }
 document.addEventListener("click",e=>{
   const b=e.target.closest("[data-ai-action]");if(!b)return;
   const action=b.dataset.aiAction;
   if(action==="probe"){probe();return;}
   if(action==="unlock"){
     const input=$("aiEngineKey"),value=(input?.value||"").trim();
     if(input)input.value="";
     if(!/^[\x21-\x7E]{8,200}$/.test(value)){
       bridge.toast("Chiave non valida: minimo 8 caratteri (anche simboli), massimo 200; niente spazi.");return;
     }
     key=value;render();bridge.toast("Chiave conservata soltanto in memoria, fino alla chiusura della pagina.");return;
   }
   if(action==="forget-key"){key="";render();bridge.toast("Chiave eliminata dalla sessione.");return;}
   if(action==="generate"){generate(b.dataset.id);return;}
   if(action==="clear-result"){
     if(results[b.dataset.id]){
       delete results[b.dataset.id];save();bridge.refresh();
       bridge.toast("Bozza AI locale rimossa.");
     }
   }
 });
 window.addEventListener("studio:reset",()=>{results={};key="";busy=false;ready=false;localStorage.removeItem(STORE);render();status("Worker non verificato");});
 window.AIOEngine={getResult,probe,getStatus:()=>({ready,keyLoaded:Boolean(key),busy})};
 render();
 bridge.refresh();
 probe();
})();
