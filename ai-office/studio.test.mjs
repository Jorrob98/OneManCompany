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
  assert.match(js,/Non esegue attività AI/);
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
