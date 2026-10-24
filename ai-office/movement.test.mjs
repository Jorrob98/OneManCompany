import test from "node:test";
import assert from "node:assert/strict";
import {ENTRIES,DESKS,MEETINGS,LOUNGES,routeGraph,shortestPath,
  planOfficeRoute,nextRoutine,dwellSeconds} from "./movement.mjs";

test("Aisle graph is fully connected for four employees and their permanent desks",()=>{
 const {nodes,edges}=routeGraph();
 assert.ok(Object.keys(nodes).length>=30);
 for(const id of Object.keys(nodes))assert.ok(edges.get(id)?.size>0,"Isolated office node "+id);
 for(let slot=0;slot<4;slot++){
  for(const kind of ["desk","meeting","lounge","entry"]){
   const path=planOfficeRoute(ENTRIES[slot],slot,kind);
   assert.ok(path.length>0,kind+" not reachable for employee "+slot);
   assert.equal(path.at(-1).node,kind+slot);
   const target={desk:DESKS,meeting:MEETINGS,lounge:LOUNGES,entry:ENTRIES}[kind][slot];
   assert.deepEqual({x:path.at(-1).x,y:path.at(-1).y},target);
  }
 }
});
test("Corridors are preferred to walking through desk island",()=>{
 const p=planOfficeRoute(DESKS[0],0,"lounge");
 const nodes=p.map(x=>x.node);
 assert.equal(nodes.at(-1),"lounge0");
 assert.ok(nodes.includes("deskDoor0"),"Employee must leave chair via desk access");
 assert.ok(nodes.includes("west"),"Employee must follow public aisle");
 assert.ok(nodes.includes("loungeAisle"),"Employee must approach lounge via corridor");
});
test("Dijkstra diverts around occupied corridor hubs",()=>{
 const normal=shortestPath("west","east");
 assert.ok(normal.includes("middle"));
 const bypass=shortestPath("west","east",new Set(["middle"]));
 assert.ok(!bypass.includes("middle"),"Alternative aisle was not selected");
 assert.equal(bypass[0],"west");
 assert.equal(bypass.at(-1),"east");
});
test("Invalid destinations and missing graph nodes do not produce impossible movement",()=>{
 assert.deepEqual(planOfficeRoute({x:42,y:60},0,"airport"),[]);
 assert.deepEqual(planOfficeRoute({x:42,y:60},99,"meeting"),[]);
 assert.deepEqual(shortestPath("wrong","east"),[]);
});
test("Role-dependent schedules keep desk work dominant and breaks bounded",()=>{
 for(let i=0;i<4;i++){
  assert.equal(nextRoutine("Analista","meeting",i,2),"desk");
  assert.equal(nextRoutine("Designer","lounge",i,2),"desk");
  const d=dwellSeconds("Analista","desk",i);
  assert.ok(d>=68);
  for(const zone of ["meeting","lounge"]){
   const p=dwellSeconds("Designer",zone,i);
   assert.ok(p>=12&&p<=27);
  }
 }
 assert.equal(nextRoutine("Responsabile","desk",0,1),"meeting");
 assert.equal(nextRoutine("Designer","desk",0,1),"lounge");
});
