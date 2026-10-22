import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const html=readFileSync(new URL("./index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("./style.css",import.meta.url),"utf8");
const js=readFileSync(new URL("./app.js",import.meta.url),"utf8");

test("all four navigable sections exist",()=>{
  for(const page of ["office","people","tasks","activity"]){
    assert.match(html,new RegExp('data-view="'+page+'"'));
    assert.match(html,new RegExp('data-page="'+page+'"'));
  }
});
test("responsive premium office and mobile layouts are included",()=>{
  assert.match(html,/id="roomCanvas"/);
  assert.match(css,/@media\(max-width:750px\)/);
  assert.match(html,/assets\/penthouse-living-v3\.webp/);
  assert.match(html,/id="penthouseMarkers"/);
});
test("actions manage real local prototype state",()=>{
  for(const command of ["hire","vacation","retire","reinstate","new-task","delete-task","confirm-reset"]){
    assert.ok(js.includes('"'+command+'"'),"Missing action "+command);
  }
  assert.match(js,/localStorage\.setItem/);
  assert.match(js,/localStorage\.getItem/);
});
test("all dynamic user supplied text is escaped for HTML",()=>{
  assert.match(js,/function initial\(\)/);
  assert.match(js,/const esc=v=>/);
  assert.match(js,/esc\(t\.title\)/);
  assert.match(js,/esc\(a\.name\)/);
});
test("prototype does not pretend to execute agent tasks",()=>{
  assert.match(html,/non agenti AI operativi/);
  assert.match(html,/Nessun dato viene sincronizzato/);
  assert.match(js,/La scena 3D non esegue attività AI/);
  assert.doesNotMatch(js,/TELEGRAM_BOT_TOKEN\s*=/);
});
test("interface loads the approved premium office asset instead of the old 3D module",()=>{
  assert.doesNotMatch(html,/cover\.png|raw\.githubusercontent/);
  assert.match(html,/\.\/penthouse\.js/);
  assert.doesNotMatch(html,/src="\.\/office3d\.js"/);
});

test("Sprint 04 personnel administration is present and remains local",()=>{
 for(const cmd of ["edit-personnel","promote","plan-leave","personnelForm","leaveForm","personnelDepartment"]){
   assert.ok(js.includes(cmd),"Missing personnel feature: "+cmd);
 }
 for(const field of ["peopleSearch","peopleDepartment","peopleSummary"]){
   assert.match(html,new RegExp('id="'+field+'"'));
 }
 assert.match(css,/personnel-skills-picker/);
 assert.match(js,/assignedCount\(a\.id\)<3/);
 assert.match(js,/reconcileLeave\(\)/);
 assert.match(js,/data-action="edit-personnel"/);
 assert.match(js,/getAll\("skills"\)/);
});

test("Sprint 05 collaboration workflow is explicitly director-controlled",()=>{
 const collab=readFileSync(new URL("./interactions.js",import.meta.url),"utf8");
 for(const id of ["collab","collabMeetings","collabRequests","collabLedger","collabMeetingsCount"]){
   assert.match(html,new RegExp('(?:data-view|id)="'+id+'"'),"Missing collaboration UI "+id);
 }
 for(const command of ["start-meeting","end-meeting","speaker","decision","approve-request","reject-request","handoff"]){
   assert.ok(collab.includes('"'+command+'"'),"Missing collaboration action: "+command);
 }
 assert.match(collab,/nessun dialogo AI reale/i);
 assert.match(collab,/setMeetingSession/);
 assert.match(js,/transferTask:/);
 assert.match(collab,/localStorage\.setItem/);
 assert.match(collab,/meetingDecisionForm/);
 assert.match(css,/\.collab-grid/);
});


test("Sprint 06: real AI invocation is explicit, secure and never conflated with visuals",()=>{
 const client=readFileSync(new URL("./ai-engine.js",import.meta.url),"utf8");
 for(const id of ["aiEngineKey","aiEngineInstructions","aiEngineStatus"]){
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/src="\.\/ai-engine\.js"/);
 assert.match(js,/data-ai-action="generate"/);
 assert.match(js,/BOZZA AI GENERATA · DA REVISIONARE/);
 assert.match(client,/\/api\/ai\/generate/);
 assert.match(client,/requiresReview:true/);
 assert.match(client,/sessione/);
 assert.doesNotMatch(client,/localStorage\.setItem\([^)]*key/i);
 assert.match(client,/getStatus:/);
});
