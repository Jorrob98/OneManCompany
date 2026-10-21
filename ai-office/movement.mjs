/**
 * Living Office Sprint 03 — deterministic corridor navigation.
 *
 * Coordinates refer to the panoramic illustration (percentages), NOT an
 * actual reconstructed 3D collision mesh. The waypoint graph deliberately
 * routes along visible aisles instead of crossing photographed desks.
 */
export const HUBS=Object.freeze({
  foyer:{x:58,y:91}, west:{x:36,y:83}, middle:{x:55,y:83},
  east:{x:79,y:83}, rightDoor:{x:82,y:90},
  westAisle:{x:34,y:69},westEntry:{x:31,y:60},
  centerAisle:{x:53,y:69},
  eastCenter:{x:68,y:79},eastAisle:{x:68,y:64},
  rightAisle:{x:80,y:67},loungeAisle:{x:84,y:78},
  deskDoor0:{x:36,y:68},deskDoor1:{x:52,y:68},
  deskDoor2:{x:68,y:63},deskDoor3:{x:79,y:62}
});
export const DESKS=[
 {x:36,y:58},{x:52,y:59},{x:68,y:51},{x:79,y:50}
];
export const ENTRIES=[
 {x:58,y:93},{x:47,y:92},{x:72,y:92},{x:87,y:92}
];
export const MEETINGS=[
 {x:18,y:55},{x:23,y:58},{x:14,y:60},{x:27,y:53}
];
export const LOUNGES=[
 {x:89,y:76},{x:85,y:74},{x:91,y:72},{x:88,y:80}
];
const connections=[
 ["foyer","middle"],["foyer","west"],["foyer","rightDoor"],
 ["west","middle"],["middle","east"],["east","rightDoor"],
 ["west","westAisle"],["westAisle","westEntry"],
 ["middle","centerAisle"],["middle","eastCenter"],
 ["eastCenter","eastAisle"],["east","rightAisle"],
 ["rightAisle","loungeAisle"],["east","loungeAisle"],
 ["westAisle","deskDoor0"],["centerAisle","deskDoor1"],
 ["eastAisle","deskDoor2"],["rightAisle","deskDoor3"],
 ["east","eastCenter"]
];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const walkwayNodes=()=>{
 const nodes={...HUBS};
 for(let i=0;i<4;i++){
  nodes["desk"+i]=DESKS[i];
  nodes["meeting"+i]=MEETINGS[i];
  nodes["lounge"+i]=LOUNGES[i];
  nodes["entry"+i]=ENTRIES[i];
 }
 return nodes;
};
export const routeGraph=()=>{
 const nodes=walkwayNodes(),edges=new Map(Object.keys(nodes).map(id=>[id,new Set()]));
 const link=(a,b)=>{if(!nodes[a]||!nodes[b])throw new Error("Unknown route node");
   edges.get(a).add(b);edges.get(b).add(a);};
 connections.forEach(([a,b])=>link(a,b));
 for(let i=0;i<4;i++){
  link("desk"+i,"deskDoor"+i);
  link("meeting"+i,"westEntry");
  link("lounge"+i,"loungeAisle");
  link("entry"+i,i===3?"rightDoor":i===1?"west":"foyer");
 }
 return {nodes,edges};
};
const graph=routeGraph();
export function shortestPath(startId,endId,occupied=new Set()){
 const {nodes,edges}=graph;
 if(!nodes[startId]||!nodes[endId])return [];
 if(startId===endId)return [startId];
 const pending=new Set(Object.keys(nodes)),scores=new Map([[startId,0]]),prev=new Map();
 while(pending.size){
  let current=null,lowest=Infinity;
  for(const id of pending){const score=scores.get(id)??Infinity;
    if(score<lowest){lowest=score;current=id;}}
  if(current===null||!Number.isFinite(lowest))break;
  if(current===endId)break;
  pending.delete(current);
  for(const id of edges.get(current)){
    if(!pending.has(id))continue;
    const occupancyCost=occupied.has(id)&&id!==endId?24:0;
    const cost=lowest+distance(nodes[current],nodes[id])+occupancyCost;
    if(cost<(scores.get(id)??Infinity)){scores.set(id,cost);prev.set(id,current);}
  }
 }
 if(!prev.has(endId))return [];
 const path=[endId];
 while(path[0]!==startId){const p=prev.get(path[0]);
   if(p===undefined)return [];path.unshift(p);}
 return path;
}
export function planOfficeRoute(point,index,zone,occupied=new Set()){
 if(index<0||index>=4||!["entry","desk","meeting","lounge"].includes(zone))return [];
 const nodes=graph.nodes;
 const goal=zone+index;
 let closest="foyer",min=Infinity;
 for(const [id,p] of Object.entries(nodes)){
  // Do not select remote private desks/meeting seats as the starting hub.
  if(/^(desk|meeting|lounge|entry)\d+$/.test(id) && id!==goal)continue;
  const d=distance(point,p);
  if(d<min){closest=id;min=d;}
 }
 // A worker already leaving a desk starts via the reserved desk door,
 // rather than cutting across the desk on the way to the public corridor.
 for(let i=0;i<4;i++){
  if(distance(point,DESKS[i])<3.1){closest="desk"+i;break;}
  if(distance(point,MEETINGS[i])<3.1){closest="meeting"+i;break;}
  if(distance(point,LOUNGES[i])<3.1){closest="lounge"+i;break;}
 }
 const ids=shortestPath(closest,goal,occupied);
 if(!ids.length)return [];
 const output=ids.slice(distance(point,nodes[closest])<2.2?1:0)
   .map(id=>({x:nodes[id].x,y:nodes[id].y,node:id}));
 // Even when an agent is already at the exit, return one terminal station
 // so its arrival/leave callback runs and it cannot remain stuck in closing.
 if(!output.length)
  output.push({...nodes[goal],node:goal});
 return output;
}
export function nextRoutine(role,current,index,cycle){
 const job=String(role||"").toLowerCase();
 if(current==="lounge"||current==="meeting")return "desk";
 if(job.includes("manager")||job.includes("respons")||job.includes("director"))
   return cycle%3===0?"lounge":"meeting";
 if(job.includes("designer")||job.includes("creativ"))
   return cycle%3===0?"meeting":"lounge";
 return (cycle+index)%4===0?"meeting":"lounge";
}
export function dwellSeconds(role,zone,index,cycle=0){
 const variation=((index*7+cycle*11)%17);
 if(zone==="lounge")return 12+variation*.65;
 if(zone==="meeting")return 14+variation*.7;
 return 68+variation*2.7+(String(role||"").toLowerCase().includes("anal")?20:0);
}
