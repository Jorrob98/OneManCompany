// AI Office Studio: illustrated penthouse, interactive employee selector.
// Real prototype state comes from app.js, never from placeholder counters.
(() => {
  const stage = document.getElementById("penthouseStage");
  const markers = document.getElementById("penthouseMarkers");
  const bridge = window.AIOStudio;
  if (!stage || !markers || !bridge) return;

  const spots = [
    [43, 46], [60, 63], [83, 30], [52, 53],
    [27, 33], [38, 47], [67, 76], [15, 31]
  ];
  let zoomed = false;
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
    zoomed = !zoomed;
    stage.classList.toggle("close-view",zoomed);
  });
  const img=stage.querySelector("img");
  img?.addEventListener("load",()=>stage.classList.add("scene-loaded"));
  img?.addEventListener("error",()=>stage.classList.add("scene-error"));
  if(img?.complete && img?.naturalWidth)stage.classList.add("scene-loaded");
  refresh();
})();
