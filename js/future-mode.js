/* Enclave FUTURE MODE — real-time particle navigation hub. */
(() => {
  "use strict";

  const home = document.getElementById("homeScreen");
  if (!home) return;

  const hub = document.createElement("section");
  hub.id = "futureHub";
  hub.setAttribute("aria-label", "Navigazione FUTURE");
  hub.innerHTML = `
    <canvas id="futureParticleField" aria-hidden="true"></canvas>
    <div class="future-search-dock" id="futureSearchDock" hidden><div id="futureSearchSlot"></div><div id="futureResultsSlot"></div></div>
    <div class="future-hub-core" aria-hidden="true"></div>
    <button class="future-voice-trigger" id="futureVoiceButton" type="button" aria-label="Parla con Enclave" title="Parla con Enclave"><span aria-hidden="true">⌁</span></button>
    <div class="future-voice-status" id="futureVoiceStatus" role="status" aria-live="polite">ENCLAVE VOICE · PRONTA</div>
    <button class="future-hub-branch" type="button" data-direction="top" data-target="search">RICERCA UTENTI</button>
    <button class="future-hub-branch" type="button" data-direction="left" data-target="chat">CHAT</button>
    <button class="future-hub-branch" type="button" data-direction="right" data-target="settings">IMPOSTAZIONI</button>
    <button class="future-hub-branch" type="button" data-direction="bottom" data-target="ai">ENCLAVEAI</button>
    <div class="future-hub-caption">ENCLAVE · FUTURE INTERFACE</div>`;
  document.body.appendChild(hub);

  const returnButton = document.createElement("button");
  returnButton.id = "futureReturnButton";
  returnButton.type = "button";
  returnButton.setAttribute("aria-label", "Torna alla navigazione FUTURE");
  returnButton.title = "Navigazione FUTURE";
  returnButton.textContent = "✧";
  document.body.appendChild(returnButton);

  const canvas = hub.querySelector("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 0, height = 0, dpr = 1, raf = 0, active = false;
  let phase = "idle", phaseStarted = 0, lastFrame = 0;
  let particles = [];
  const searchDock = hub.querySelector("#futureSearchDock");
  const searchSlot = hub.querySelector("#futureSearchSlot");
  const resultsSlot = hub.querySelector("#futureResultsSlot");
  const searchBox = document.querySelector(".sidebar-top");
  const searchResults = document.getElementById("searchResults");
  const searchHomeAnchor = searchBox?.parentNode;
  const resultsHomeAnchor = searchResults?.parentNode;
  const searchBoxNext = searchBox?.nextSibling || null;
  const resultsNext = searchResults?.nextSibling || null;
  let futureDestination = null;
  let homeWasHidden = home.classList.contains("hidden");
  const particleCount = () => Math.max(190, Math.min(520, Math.round((width * height) / 2600)));
  const rand = (min,max) => min + Math.random() * (max-min);

  function resize() {
    const rect = hub.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, window.matchMedia("(pointer: coarse)").matches ? 1.35 : 1.8);
    canvas.width = Math.round(width*dpr);
    canvas.height = Math.round(height*dpr);
    canvas.style.width = width+"px";
    canvas.style.height = height+"px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
    seedParticles();
  }

  function seedParticles() {
    const count = particleCount();
    particles = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i=0;i<count;i++) {
      const y = 1 - (i/(count-1))*2;
      const radius = Math.sqrt(1-y*y);
      const theta = golden*i;
      const spread = rand(.86,1.13);
      particles.push({
        x: Math.cos(theta)*radius*spread,
        y: y*spread,
        z: Math.sin(theta)*radius*spread,
        size: rand(.65,1.75),
        seed: rand(0,Math.PI*2),
        drift: rand(.3,1.25),
        alpha: rand(.48,1)
      });
    }
  }

  function draw(now) {
    if (!active && phase === "idle") return;
    const frameInterval = window.matchMedia("(pointer: coarse)").matches ? 1000/30 : 1000/45;
    if (lastFrame && now - lastFrame < frameInterval) {
      raf = requestAnimationFrame(draw);
      return;
    }
    const dt = Math.min(.04, (now-lastFrame)/1000 || .016);
    lastFrame = now;
    const elapsed = (now-phaseStarted)/1000;
    ctx.clearRect(0,0,width,height);

    const cx = width/2, cy = height/2;
    const minSide = Math.min(width,height);
    const radius = minSide * (width < 700 ? .185 : .205);
    const build = phase === "opening" ? Math.min(1,elapsed/1.55) : 1;
    const collapse = phase === "closing" ? Math.max(0,1-elapsed/1.05) : 1;
    const routing = phase === "routing" ? Math.max(0,1-elapsed/.58) : 1;
    const overall = build * collapse * routing;
    const time = now*.00022;
    const rotY = time*.75, rotX = Math.sin(time*.55)*.16;

    // Atmospheric particles converge from the periphery while opening, then scatter on exit.
    const cloudCount = Math.min(150, Math.round(particles.length*.34));
    for (let i=0;i<cloudCount;i++) {
      const p=particles[i];
      const a=p.seed + now*.00012*p.drift;
      const dist=radius*(1.7 + .7*Math.sin(a*1.7));
      const convergence = phase === "opening" ? Math.max(0,1-elapsed/1.6) : 0;
      const scatter = phase === "closing" ? Math.min(1,elapsed/1.05) : 0;
      const px=cx+Math.cos(a)*(dist*(convergence+scatter)*.65+radius*1.35);
      const py=cy+Math.sin(a*1.31)*(dist*(convergence+scatter)*.5+radius*1.2);
      const alpha=(convergence*.52+scatter*.36)*p.alpha;
      if(alpha>.015) {
        ctx.beginPath(); ctx.fillStyle=`rgba(75,190,255,${alpha})`;
        ctx.arc(px,py,p.size*.8,0,Math.PI*2); ctx.fill();
      }
    }

    const projected=[];
    for (const p of particles) {
      let x=p.x*Math.cos(rotY)-p.z*Math.sin(rotY);
      let z=p.x*Math.sin(rotY)+p.z*Math.cos(rotY);
      let y=p.y*Math.cos(rotX)-z*Math.sin(rotX);
      z=p.y*Math.sin(rotX)+z*Math.cos(rotX);
      const pulse=1 + .035*Math.sin(now*.0011+p.seed*2);
      const organic=1 + .075*Math.sin(p.seed+now*.0007*p.drift) + .035*Math.cos(p.seed*2-now*.0004);
      const depth=1/(1.8-z*.52);
      const breathe=radius*pulse*organic*overall;
      const px=cx+x*breathe*depth;
      const py=cy+y*breathe*depth;
      const front=(z+1)/2;
      const alpha=(.22+front*.78)*p.alpha*overall;
      projected.push({x:px,y:py,z,alpha,size:p.size*(.65+front*.9),front});
    }

    // Loose energy filaments: local links only, avoiding a geometric wireframe appearance.
    ctx.lineWidth=.55;
    for(let i=0;i<projected.length;i+=2) {
      const a=projected[i];
      for(let j=i+7;j<Math.min(i+22,projected.length);j+=5) {
        const b=projected[j];
        const dx=a.x-b.x,dy=a.y-b.y,dist=dx*dx+dy*dy;
        if(dist < radius*radius*.085 && a.z>-.35 && b.z>-.35) {
          const alpha=(1-Math.sqrt(dist)/(radius*.292))*.11*Math.min(a.alpha,b.alpha);
          ctx.strokeStyle=`rgba(44,177,255,${alpha})`;
          ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        }
      }
    }

    // Central luminous volume.
    const glow=ctx.createRadialGradient(cx,cy,radius*.12,cx,cy,radius*1.28);
    glow.addColorStop(0,"rgba(0,115,230,0)");
    glow.addColorStop(.55,`rgba(0,112,220,${.08*overall})`);
    glow.addColorStop(.82,`rgba(0,180,255,${.09*overall})`);
    glow.addColorStop(1,"rgba(0,100,220,0)");
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,radius*1.28,0,Math.PI*2);ctx.fill();

    // Bright particles, with depth-based glow and organic flicker.
    for(const p of projected) {
      if(p.alpha<.015) continue;
      const flicker=.72+.28*Math.sin(now*.002+p.x*.018+p.y*.013);
      const a=p.alpha*flicker;
      ctx.beginPath();
      ctx.fillStyle=`rgba(${Math.round(44+35*p.front)},${Math.round(150+85*p.front)},255,${a})`;
      ctx.shadowBlur=5+p.front*12;
      ctx.shadowColor=`rgba(28,164,255,${a*.8})`;
      ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx.fill();
    }
    ctx.shadowBlur=0;

    // A few moving energy arcs add volume without enclosing the sphere in a wire cage.
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(now*.00009);
    for(let k=0;k<3;k++) {
      ctx.beginPath();
      ctx.ellipse(0,0,radius*(.92+k*.055),radius*(.32+k*.025),k*.83,now*.00012+k*2,now*.00012+k*2+Math.PI*1.42);
      ctx.strokeStyle=`rgba(62,190,255,${.10*overall})`;
      ctx.lineWidth=.7;ctx.stroke();
    }
    ctx.restore();

    // Four delicate animated rays connect the orb to navigation nodes.
    const rayAlpha=overall*(phase==="opening"?Math.min(1,elapsed/1.25):1);
    const directions=[
      [0,-1],[-1,0],[1,0],[0,1]
    ];
    for(let i=0;i<4;i++) {
      const [dx,dy]=directions[i];
      const start=radius*.76, end=radius*(width<700?1.72:1.88);
      const x1=cx+dx*start,y1=cy+dy*start,x2=cx+dx*end,y2=cy+dy*end;
      const grad=ctx.createLinearGradient(x1,y1,x2,y2);
      grad.addColorStop(0,`rgba(35,164,255,${.55*rayAlpha})`);
      grad.addColorStop(.55,`rgba(52,210,255,${.25*rayAlpha})`);
      grad.addColorStop(1,"rgba(36,140,255,0)");
      ctx.strokeStyle=grad;ctx.lineWidth=1.15;
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
      const pulse=(now*.00032+i*.25)%1;
      const dotX=x1+(x2-x1)*pulse,dotY=y1+(y2-y1)*pulse;
      ctx.beginPath();ctx.fillStyle=`rgba(102,235,255,${.9*rayAlpha})`;
      ctx.shadowBlur=12;ctx.shadowColor="#159dff";ctx.arc(dotX,dotY,1.6,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }

    if(phase==="opening" && elapsed>=1.6) phase="running";
    if(phase==="closing" && elapsed>=1.08) {
      phase="idle"; active=false; hub.classList.remove("is-active","is-shutting-down");
      returnButton.classList.remove("is-visible");
      ctx.clearRect(0,0,width,height); cancelAnimationFrame(raf); raf=0; return;
    }
    if(phase==="routing" && elapsed>=.62) {
      phase="idle"; active=false; hub.classList.remove("is-active","is-routing");
      cancelAnimationFrame(raf);raf=0;return;
    }
    raf=requestAnimationFrame(draw);
  }

  function startAnimation(nextPhase) {
    active=true;phase=nextPhase;phaseStarted=performance.now();lastFrame=0;
    if(!raf) raf=requestAnimationFrame(draw);
  }

  function dissolveSettingsScreen() {
    const overlay = document.getElementById("enclaveSettingsOverlay");
    const panel = overlay?.querySelector(".enclave-settings-panel");
    if (!overlay || overlay.classList.contains("hidden") || !panel || overlay.dataset.futureDissolving === "true") return;
    overlay.dataset.futureDissolving = "true";
    const rect = panel.getBoundingClientRect();
    const layer = document.createElement("div");
    layer.className = "future-dissolve-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
    // Distribute the particles over the actual visible UI elements (text, controls,
    // icons and panel surface), rather than spawning an unrelated cloud above it.
    const surfaces = [panel, ...panel.querySelectorAll("h1,h2,h3,p,button,label,input,select,.settings-tab,[role=tab],.settings-section")]
      .map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(item => item.r.width > 2 && item.r.height > 2);
    const count = Math.min(620, Math.max(260, Math.round(rect.width * rect.height / 620)));
    for (let i = 0; i < count; i++) {
      const surface = surfaces[Math.floor(Math.random() * surfaces.length)] || {el:panel,r:rect};
      const r = surface.r;
      const x = r.left + Math.random() * r.width;
      const y = r.top + Math.random() * r.height;
      const dot = document.createElement("i");
      const computed = getComputedStyle(surface.el);
      const color = computed.color && computed.color !== "rgba(0, 0, 0, 0)" ? computed.color : "#64dfff";
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      dot.style.setProperty("--particle-color", color);
      dot.style.setProperty("--dx", `${(Math.random() - .5) * Math.max(width, window.innerWidth) * 1.25}px`);
      dot.style.setProperty("--dy", `${(Math.random() - .5) * Math.max(height, window.innerHeight) * 1.25}px`);
      dot.style.setProperty("--delay", `${Math.random() * 360}ms`);
      dot.style.setProperty("--size", `${1 + Math.random() * 2.5}px`);
      layer.appendChild(dot);
    }
    panel.classList.add("future-settings-disintegrating");
    window.setTimeout(() => { overlay.classList.add("hidden"); panel.classList.remove("future-settings-disintegrating"); overlay.dataset.futureDissolving = "false"; layer.remove(); }, 1550);
    window.setTimeout(() => layer.classList.add("is-converging"), 760);
  }

  function restoreSearch() {
    searchDock.hidden = true;
    if (searchBox && searchHomeAnchor && searchBox.parentNode !== searchHomeAnchor) searchHomeAnchor.insertBefore(searchBox, searchBoxNext);
    if (searchResults && resultsHomeAnchor && searchResults.parentNode !== resultsHomeAnchor) resultsHomeAnchor.insertBefore(searchResults, resultsNext);
  }

  function showHub(animate = false) {
    if (localStorage.getItem("enclaveFutureMode") !== "true" || home.classList.contains("hidden")) return;
    futureDestination = null;
    dissolveSettingsScreen();
    hub.classList.remove("is-searching");
    if (searchBox) { const input = searchBox.querySelector("#chatSearch"); if (input) input.value = ""; }
    if (searchResults) searchResults.replaceChildren();
    restoreSearch();
    returnButton.classList.remove("is-visible");
    hub.classList.remove("is-shutting-down","is-routing");
    hub.classList.add("is-active");
    returnButton.classList.remove("is-visible");
    resize();
    if (animate) startAnimation(reducedMotion ? "running" : "opening");
    else {
      phase = "running";
      phaseStarted = performance.now();
      active = true;
      if (!raf) raf = requestAnimationFrame(draw);
    }
  }

  function shutdown() {
    if (!hub.classList.contains("is-active")) {
      hub.classList.remove("is-shutting-down","is-routing");
      returnButton.classList.remove("is-visible");
      return;
    }
    hub.classList.remove("is-active");
    hub.classList.add("is-shutting-down");
    startAnimation(reducedMotion ? "closing" : "closing");
  }

  function routeAway(target) {
    if (!hub.classList.contains("is-active")) return;
    if (target === "search") {
      searchDock.hidden = false;
      if (searchBox) searchSlot.appendChild(searchBox);
      if (searchResults) resultsSlot.appendChild(searchResults);
      hub.classList.add("is-searching");
      returnButton.classList.add("is-visible");
      document.getElementById("chatSearch")?.focus({ preventScroll: true });
      return;
    }
    restoreSearch();
    hub.classList.remove("is-searching");
    // Each destination exits the hub before opening its existing Enclave view.
    if (target === "settings") {
      futureDestination = "settings";
      hub.classList.remove("is-active"); hub.classList.add("is-routing");
      startAnimation("routing");
      window.setTimeout(() => { returnButton.classList.add("is-visible"); document.getElementById("settingsButton")?.click(); }, 180);
      return;
    }
    futureDestination = target;
    hub.classList.remove("is-active");
    hub.classList.add("is-routing");
    startAnimation("routing");
    window.setTimeout(() => {
      returnButton.classList.add("is-visible");
      if (target === "search") {
        document.getElementById("chatSearch")?.focus({ preventScroll: true });
      } else if (target === "chat") {
        const activeChat = document.getElementById("activeChat");
        if (activeChat && !activeChat.classList.contains("hidden")) document.getElementById("chatBackButton")?.click();
        document.querySelector(".conversation-section")?.scrollIntoView({ block: "nearest" });
      } else if (target === "ai") {
        const ai = document.getElementById("enclaveAIQuickButton");
        if (ai) ai.click();
      }
    }, 180);
  }

  hub.querySelectorAll(".future-hub-branch").forEach(button => {
    button.addEventListener("click", () => routeAway(button.dataset.target));
  });
  returnButton.addEventListener("click", () => showHub(false));
  searchResults?.addEventListener("click", event => {
    const result = event.target.closest(".search-result, .user-result");
    if (!result || !hub.classList.contains("is-searching")) return;
    // The original Enclave result handler opens the private conversation.
    // FUTURE only gets out of the way; it must never replace that navigation.
    window.setTimeout(() => {
      hub.classList.remove("is-active", "is-searching", "is-routing");
      restoreSearch();
      returnButton.classList.add("is-visible");
      futureDestination = "search-chat";
    }, 0);
  });

  // Escape / native close gestures return directly to the orb when search is empty.
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && hub.classList.contains("is-searching")) {
      event.preventDefault(); showHub();
    }
  });

  // EnclaveAI is an independent destination. Its own close button/backdrop
  // returns to FUTURE, never to the classic conversation list.
  const aiObserver = new MutationObserver(() => {
    const ai = document.getElementById("enclaveAIOverlay");
    if (futureDestination === "ai" && !ai && !hub.classList.contains("is-active") && !home.classList.contains("hidden")) {
      futureDestination = null;
      showHub();
    }
  });
  aiObserver.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("enclave:future-mode-change", event => {
    if (event.detail?.enabled) showHub(true);
    else {
      futureDestination = null;
      shutdown();
    }
  });

  // The classic chat view owns its composer: the floating FUTURE return control
  // is hidden while a private conversation or group is actually open.
  const activeChatView = document.getElementById("activeChat");
  const syncReturnButtonWithChat = () => {
    const chatOpen = !!activeChatView && !activeChatView.classList.contains("hidden");
    if (chatOpen) returnButton.classList.remove("is-visible");
    else if (futureDestination === "chat" || futureDestination === "search-chat") returnButton.classList.add("is-visible");
  };
  if (activeChatView) {
    new MutationObserver(syncReturnButtonWithChat).observe(activeChatView, { attributes: true, attributeFilter: ["class"] });
    syncReturnButtonWithChat();
  }

  // Closing the native settings panel returns directly to the orb, without
  // replaying the particle-formation intro. Ignore transitions to nickname editor.
  const settingsCloseObserver = new MutationObserver(() => {
    const settings = document.getElementById("enclaveSettingsOverlay");
    const nicknameEditor = document.getElementById("ownProfileNicknameOverlay");
    if (futureDestination !== "settings" || !settings || !settings.classList.contains("hidden")) return;
    if (nicknameEditor && !nicknameEditor.classList.contains("hidden")) return;
    if (localStorage.getItem("enclaveFutureMode") !== "true") return;
    futureDestination = null;
    window.setTimeout(() => {
      if (settings.classList.contains("hidden") && !(nicknameEditor && !nicknameEditor.classList.contains("hidden"))) showHub(false);
    }, 80);
  });
  settingsCloseObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

  const observer = new MutationObserver(() => {
    const isHidden = home.classList.contains("hidden");
    if (isHidden) {
      if (hub.classList.contains("is-active")) shutdown();
      returnButton.classList.remove("is-visible");
    } else if (homeWasHidden && localStorage.getItem("enclaveFutureMode") === "true") {
      showHub();
    }
    homeWasHidden = isHidden;
  });
  observer.observe(home,{attributes:true,attributeFilter:["class"]});
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else if (hub.classList.contains("is-active")) {
      lastFrame = 0;
      if (!raf) raf = requestAnimationFrame(draw);
    }
  });
  window.addEventListener("resize", () => { if (hub.classList.contains("is-active")) resize(); }, {passive:true});
  window.addEventListener("orientationchange", () => { if (hub.classList.contains("is-active")) resize(); }, {passive:true});

  if (localStorage.getItem("enclaveFutureMode") === "true" && !home.classList.contains("hidden")) showHub(false);
})();
