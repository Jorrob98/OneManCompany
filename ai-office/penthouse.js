// AI Office Studio: illustrated penthouse, interactive employee selector.
// Real prototype state comes from app.js, never from placeholder counters.
(() => {
  const stage = document.getElementById("penthouseStage");
  const markers = document.getElementById("penthouseMarkers");
  const bridge = window.AIOStudio;
  if (!stage || !markers || !bridge) return;

  const spots = [
    [59, 77], [44, 62], [70, 74], [84, 43],
    [18, 55], [89, 76], [76, 80], [24, 54]
  ];
  let cameraMode = 0;
  function refresh() {
    const selected = bridge.getSelected();
    const present = bridge.getAgents().filter(a => a.status !== "retired");
    const onSite = present.filter(a => a.status === "available");
    stage.classList.toggle("daytime", bridge.getMood() === "day");
    markers.replaceChildren();
    present.forEach((agent, i) => {
      if (agent.status !== "available") return;
      const [x, y] = spots[i % spots.length];
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.agentId = agent.id;
      button.className = "agent-hotspot" + (selected === agent.id ? " selected" : "");
      button.style.left = x + "%";
      button.style.top = y + "%";
      button.title = agent.name + " - " + agent.role;
      button.setAttribute("aria-label", "Seleziona " + agent.name);
      const core = document.createElement("span");
      core.className = "hotspot-core";
      core.textContent = "+";
      const label = document.createElement("span");
      label.className = "hotspot-label";
      const strong = document.createElement("strong");
      strong.textContent = agent.name;
      const small = document.createElement("small");
      small.textContent = agent.role;
      label.append(strong, small);
      button.append(core, label);
      button.addEventListener("click", () => bridge.select(agent.id));
      markers.append(button);
    });
    const counter = document.getElementById("penthousePresent");
    if(counter) counter.textContent = String(onSite.length).padStart(2,"0");
  }
  window.addEventListener("studio:changed", refresh);
  document.getElementById("roomMood")?.addEventListener("click",()=>queueMicrotask(refresh));
  document.getElementById("roomZoom")?.addEventListener("click",()=>{
    cameraMode=(cameraMode+1)%3;
    stage.classList.toggle("close-view",cameraMode===1);
    stage.classList.toggle("focus-view",cameraMode===2);
    stage.dataset.cameraMode=["overview","close","focus"][cameraMode];
  });
  const img=stage.querySelector("img");
  img?.addEventListener("load",()=>stage.classList.add("scene-loaded"));
  img?.addEventListener("error",()=>stage.classList.add("scene-error"));
  if(img?.complete && img?.naturalWidth)stage.classList.add("scene-loaded");
  refresh();
})();
