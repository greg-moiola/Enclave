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
    <button class="future-voice-trigger" id="futureVoiceButton" type="button" aria-label="Attiva Enclave Voice"></button>
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
  let pendingSettingsDissolveDuration = 0;
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
        size: rand(.8,1.9),
        seed: rand(0,Math.PI*2),
        // Each particle begins at its own point in a 3D cloud, not on a flat ring.
        startX: rand(-2.05,2.05),
        startY: rand(-2.05,2.05),
        startZ: rand(-2.05,2.05),
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
    const formation = build * build * (3 - 2 * build);
    const collapse = phase === "closing" ? Math.max(0,1-elapsed/1.05) : 1;
    const routing = phase === "routing" ? Math.max(0,1-elapsed/.58) : 1;
    const overall = collapse * routing;
    const time = now*.00022;
    const speaking = hub.classList.contains("is-speaking");
    // A procedural energy envelope keeps the particle shell alive while EnclaveAI speaks.
    const voiceEnergy = speaking ? (.5 + .5 * Math.sin(now * .009)) : 0;
    const rotY = time*.75, rotX = Math.sin(time*.55)*.16;

    // The same particles form the entire object: no secondary cloud or pre-rendered orb layer.
    const projected=[];
    for (const p of particles) {
      let targetX=p.x*Math.cos(rotY)-p.z*Math.sin(rotY);
      let targetZ=p.x*Math.sin(rotY)+p.z*Math.cos(rotY);
      let targetY=p.y*Math.cos(rotX)-targetZ*Math.sin(rotX);
      targetZ=p.y*Math.sin(rotX)+targetZ*Math.cos(rotX);

      // Rotate the dispersed starting point with the same coordinate system,
      // then continuously morph it into its final position on the particle shell.
      let startX=p.startX*Math.cos(rotY)-p.startZ*Math.sin(rotY);
      let startZ=p.startX*Math.sin(rotY)+p.startZ*Math.cos(rotY);
      let startY=p.startY*Math.cos(rotX)-startZ*Math.sin(rotX);
      startZ=p.startY*Math.sin(rotX)+startZ*Math.cos(rotX);

      let x=startX+(targetX-startX)*formation;
      let y=startY+(targetY-startY)*formation;
      let z=startZ+(targetZ-startZ)*formation;
      const speechRipple = speaking
        ? (.026 * Math.sin(p.seed * 2.8 - now * .006) + .014 * Math.sin(p.seed * 5.2 + now * .009)) * (.35 + voiceEnergy)
        : 0;
      const pulse = 1 + .035*Math.sin(now*.0011+p.seed*2) + (speaking ? .035 * voiceEnergy : 0);
      const organic = 1 + .075*Math.sin(p.seed+now*.0007*p.drift) + .035*Math.cos(p.seed*2-now*.0004) + speechRipple;
      const depth=1/(1.8-z*.52);
      const breathe=radius*pulse*organic*overall;
      const px=cx+x*breathe*depth;
      const py=cy+y*breathe*depth;
      const front=(z+1)/2;
      const formationAlpha=phase === "opening" ? (.12+.88*formation) : 1;
      const alpha=(.22+front*.78)*p.alpha*overall*formationAlpha;
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
          const alpha=(1-Math.sqrt(dist)/(radius*.292))*(speaking ? .17 + voiceEnergy*.08 : .11)*Math.min(a.alpha,b.alpha);
          ctx.strokeStyle=`rgba(44,177,255,${alpha})`;
          ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        }
      }
    }

    // No pre-drawn orb: the luminous shell is made entirely from the projected particles.

    // Soft overlapping particle fields create a continuous shell during formation.
    // The luminous volume is accumulated from the particles themselves, never from a fixed orb image.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for(const p of projected) {
      if(p.alpha<.012) continue;
      const flicker=.82+.18*Math.sin(now*.0017+p.x*.014+p.y*.011);
      const voiceFlicker = speaking ? (.78 + .22 * Math.sin(now * .012 + p.x * .035 + p.y * .027)) : 1;
      const a=p.alpha*flicker*(speaking ? .9 + voiceEnergy*.24 : 1);
      const haloRadius=p.size*(speaking ? 8.8+voiceEnergy*2.4 : 7.2);
      ctx.beginPath();
      ctx.fillStyle=`rgba(${Math.round(24+35*p.front)},${Math.round(130+90*p.front)},255,${a*.075})`;
      ctx.shadowBlur=haloRadius;
      ctx.shadowColor=`rgba(34,174,255,${a*(speaking ? .48 : .34)})`;
      ctx.arc(p.x,p.y,haloRadius*.18,0,Math.PI*2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle=`rgba(${Math.round(55+35*p.front)},${Math.round(166+82*p.front)},255,${a})`;
      ctx.shadowBlur=4+p.front*8+(speaking ? 6+voiceFlicker*8 : 0);
      ctx.shadowColor=`rgba(28,164,255,${a*.92})`;
      ctx.arc(p.x,p.y,p.size*(speaking ? 1.08 : 1),0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur=0;

    // No geometric orb overlays: only the live particle field defines the sphere.

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
    if (!overlay || overlay.classList.contains("hidden") || !panel || overlay.dataset.futureDissolving === "true") return 0;
    overlay.dataset.futureDissolving = "true";

    // Snapshot the visible settings UI as thousands of tiny points. Text glyph
    // rectangles and real control/panel surfaces both contribute particles.
    const rect = panel.getBoundingClientRect();
    const layer = document.createElement("canvas");
    layer.className = "future-dissolve-canvas";
    layer.setAttribute("aria-hidden", "true");
    layer.width = Math.round(window.innerWidth * Math.min(devicePixelRatio || 1, 1.5));
    layer.height = Math.round(window.innerHeight * Math.min(devicePixelRatio || 1, 1.5));
    layer.style.width = "100vw";
    layer.style.height = "100vh";
    document.body.appendChild(layer);
    const paint = layer.getContext("2d");
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    paint.setTransform(scale, 0, 0, scale, 0, 0);

    const surfaces = [panel, ...panel.querySelectorAll("h1,h2,h3,p,button,label,input,select,textarea,.settings-tab,[role=tab],.settings-section,.settings-option,svg")]
      .map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(item => item.r.width > 2 && item.r.height > 2);
    const samples = [];
    const addSample = (x, y, color, size = 1.7) => {
      if (x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight) samples.push({ x, y, color, size });
    };

    // Sample panel/control surfaces in a fine pixel grid.
    for (const {el, r} of surfaces) {
      const style = getComputedStyle(el);
      const bg = style.backgroundColor;
      const fg = style.color || "#dff7ff";
      const opaque = bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)";
      const step = Math.max(4, Math.min(8, Math.round(Math.sqrt((r.width*r.height)/1800))));
      for (let y = r.top + 1; y < r.bottom; y += step) {
        for (let x = r.left + 1; x < r.right; x += step) {
          const edge = x-r.left < step || r.right-x < step || y-r.top < step || r.bottom-y < step;
          if (opaque ? Math.random() < .42 : edge && Math.random() < .18) addSample(x, y, opaque ? bg : fg, rand(1.1, 2.3));
        }
      }
    }

    // Text is sampled per glyph rectangle, so labels break apart at their real positions.
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      if (!textNode.nodeValue.trim()) continue;
      const range = document.createRange();
      const parent = textNode.parentElement;
      const color = parent ? getComputedStyle(parent).color : "#dff7ff";
      for (let i = 0; i < textNode.nodeValue.length; i++) {
        range.setStart(textNode, i); range.setEnd(textNode, i + 1);
        const r = range.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const n = Math.max(1, Math.ceil((r.width*r.height)/5));
        for (let k=0;k<n;k++) addSample(r.left+Math.random()*r.width, r.top+Math.random()*r.height, color, rand(.8,1.65));
      }
    }

    // Keep the particle field dense but bounded on mobile.
    const max = window.matchMedia("(pointer: coarse)").matches ? 1250 : 2200;
    if (samples.length > max) {
      for (let i=samples.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [samples[i],samples[j]]=[samples[j],samples[i]]; }
      samples.length = max;
    }
    const cx = innerWidth/2, cy = innerHeight/2;
    const orbRadius = Math.min(innerWidth, innerHeight) * (innerWidth < 700 ? .18 : .205);
    const dots = samples.map((p, i) => {
      const angle = Math.random()*Math.PI*2;
      const spread = Math.max(innerWidth,innerHeight) * (.28 + Math.random()*.68);
      const targetAngle = Math.random()*Math.PI*2;
      const targetY = Math.random()*2-1;
      const targetR = Math.sqrt(1-targetY*targetY);
      return {
        ...p,
        mx: cx + Math.cos(angle)*spread,
        my: cy + Math.sin(angle)*spread,
        tx: cx + Math.cos(targetAngle)*targetR*orbRadius,
        ty: cy + targetY*orbRadius,
        delay: Math.random()*.22,
        phase: Math.random()*Math.PI*2
      };
    });

    panel.classList.add("future-settings-disintegrating");
    const duration = 2250;
    const startAt = performance.now();
    const ease = t => t*t*(3-2*t);
    function render(now) {
      const t = Math.min(1, (now-startAt)/duration);
      paint.clearRect(0,0,innerWidth,innerHeight);
      for (const p of dots) {
        const local = Math.max(0, Math.min(1, (t-p.delay)/.92));
        let x, y, alpha, size;
        if (local < .55) {
          const q = ease(local/.55);
          x = p.x+(p.mx-p.x)*q; y = p.y+(p.my-p.y)*q;
          alpha = .96; size = p.size*(1+.22*Math.sin(q*Math.PI));
        } else {
          const q = ease((local-.55)/.45);
          x = p.mx+(p.tx-p.mx)*q; y = p.my+(p.ty-p.my)*q;
          alpha = 1-q*.08; size = p.size*(1-q*.32);
        }
        const shimmer = .78 + .22*Math.sin(now*.008+p.phase);
        paint.globalAlpha = alpha*shimmer;
        paint.fillStyle = p.color;
        paint.shadowColor = "rgba(52,190,255,.8)";
        paint.shadowBlur = 3.5;
        paint.fillRect(x, y, size, size);
      }
      paint.globalAlpha = 1; paint.shadowBlur = 0;
      if (t < 1) requestAnimationFrame(render);
      else {
        layer.remove();
        overlay.classList.add("hidden");
        panel.classList.remove("future-settings-disintegrating");
        overlay.dataset.futureDissolving = "false";
      }
    }
    requestAnimationFrame(render);
    return duration;
  }

  function restoreSearch() {
    searchDock.hidden = true;
    if (searchBox && searchHomeAnchor && searchBox.parentNode !== searchHomeAnchor) searchHomeAnchor.insertBefore(searchBox, searchBoxNext);
    if (searchResults && resultsHomeAnchor && searchResults.parentNode !== resultsHomeAnchor) resultsHomeAnchor.insertBefore(searchResults, resultsNext);
  }

  function showHub(animate = false) {
    if (localStorage.getItem("enclaveFutureMode") !== "true" || home.classList.contains("hidden")) return;
    futureDestination = null;
    const dissolveDuration = pendingSettingsDissolveDuration || dissolveSettingsScreen();
    pendingSettingsDissolveDuration = 0;
    hub.classList.remove("is-searching");
    if (searchBox) { const input = searchBox.querySelector("#chatSearch"); if (input) input.value = ""; }
    if (searchResults) searchResults.replaceChildren();
    restoreSearch();
    returnButton.classList.remove("is-visible");
    hub.classList.remove("is-shutting-down","is-routing");
    resize();
    const activate = () => {
      hub.classList.add("is-active");
      if (animate) startAnimation(reducedMotion ? "running" : "opening");
      else {
        phase = "running";
        phaseStarted = performance.now();
        active = true;
        if (!raf) raf = requestAnimationFrame(draw);
      }
    };
    if (dissolveDuration) window.setTimeout(activate, Math.max(0, dissolveDuration - 420));
    else activate();
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


  // Intercept the settings close gesture before the native panel is hidden,
  // so its actual interface can fragment into particles instead of fading away.
  document.addEventListener("click", event => {
    const overlay = document.getElementById("enclaveSettingsOverlay");
    if (!overlay || overlay.classList.contains("hidden") || futureDestination !== "settings") return;
    const close = event.target.closest(".group-info-close");
    const backdrop = event.target === overlay;
    if ((close && overlay.contains(close)) || backdrop) {
      pendingSettingsDissolveDuration = dissolveSettingsScreen();
    }
  }, true);

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
