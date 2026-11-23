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
    <div class="future-hub-core" aria-hidden="true"></div>
    <button class="future-hub-branch" type="button" data-direction="top" data-target="search">RICERCA UTENTI</button>
    <button class="future-hub-branch" type="button" data-direction="left" data-target="chat">CHAT</button>
    <button class="future-hub-branch" type="button" data-direction="right" data-target="settings">IMPOSTAZIONI</button>
    <button class="future-hub-branch" type="button" data-direction="bottom" data-target="ai">ENCLAVEAI</button>
    <div id="futureSearchOverlay" class="future-search-overlay" aria-hidden="true">
      <div class="future-search-panel">
        <div class="future-search-bar-wrap">
          <span aria-hidden="true">🔍</span>
          <input type="text" id="futureSearchInput" placeholder="Cerca Enclave ID..." autocomplete="off">
          <button type="button" id="futureSearchClose" class="future-search-close" aria-label="Chiudi ricerca">✕</button>
        </div>
        <div id="futureSearchResultsMirror" class="search-results"></div>
      </div>
    </div>
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
  let dematerializeSparks = [];
  let inAIView = false;

  const particleCount = () => Math.max(220, Math.min(560, Math.round((width * height) / 2300)));
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
        size: rand(.65,1.8),
        seed: rand(0,Math.PI*2),
        drift: rand(.3,1.25),
        alpha: rand(.5,1),
        startX: rand(0, width || window.innerWidth),
        startY: rand(0, height || window.innerHeight)
      });
    }
  }

  // Genera scintille dall'area del menu impostazioni che "smolecola" verso il centro
  function spawnDematerializeSparks(rect) {
    dematerializeSparks = [];
    const r = rect && rect.width > 0 ? rect : { left: width * 0.15, top: height * 0.15, width: width * 0.7, height: height * 0.7 };
    const total = 240;
    for (let i = 0; i < total; i++) {
      dematerializeSparks.push({
        sx: r.left + Math.random() * r.width,
        sy: r.top + Math.random() * r.height,
        angle: rand(0, Math.PI * 2),
        swirl: rand(-2.8, 2.8),
        size: rand(1.1, 2.8),
        delay: rand(0, 0.25),
        alpha: rand(0.65, 1)
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
    lastFrame = now;
    const elapsed = (now-phaseStarted)/1000;
    ctx.clearRect(0,0,width,height);

    const cx = width/2, cy = height/2;
    const minSide = Math.min(width,height);
    const radius = minSide * (width < 700 ? .185 : .205);
    const build = phase === "opening" ? Math.min(1, elapsed / 1.65) : 1;
    const collapse = phase === "closing" ? Math.max(0, 1 - elapsed / 1.05) : 1;
    const routing = phase === "routing" ? Math.max(0, 1 - elapsed / .42) : 1;
    const overall = build * collapse * routing;
    const time = now*.00022;
    const rotY = time*.75, rotX = Math.sin(time*.55)*.16;

    // Scintille dello smolecolamento del menu che confluiscono nella bolla centrale
    if (phase === "opening" && dematerializeSparks.length > 0 && elapsed < 1.55) {
      for (const sp of dematerializeSparks) {
        const localT = Math.max(0, Math.min(1, (elapsed - sp.delay) / 1.25));
        if (localT <= 0) continue;
        const ease = 1 - Math.pow(1 - localT, 3);
        const swirlOffset = Math.sin(localT * Math.PI) * 55 * sp.swirl;
        const px = sp.sx + (cx - sp.sx) * ease + Math.cos(sp.angle) * swirlOffset;
        const py = sp.sy + (cy - sp.sy) * ease + Math.sin(sp.angle) * swirlOffset;
        const a = Math.sin(localT * Math.PI) * sp.alpha;
        ctx.beginPath();
        ctx.fillStyle = `rgba(120, 225, 255, ${a})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(40, 185, 255, 0.85)";
        ctx.arc(px, py, sp.size * (1 - localT * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // Particelle vaganti su tutto lo schermo che si riuniscono al centro
    const cloudCount = Math.min(200, Math.round(particles.length * .42));
    for (let i=0;i<cloudCount;i++) {
      const p=particles[i];
      const a=p.seed + now*.00012*p.drift;
      const maxSpread = Math.max(width, height) * 0.65;
      const dist = radius * 1.4 + maxSpread * (0.35 + 0.65 * Math.abs(Math.sin(a*1.7)));
      const convergence = phase === "opening" ? Math.pow(Math.max(0, 1 - elapsed / 1.6), 1.4) : 0;
      const scatter = phase === "closing" ? Math.min(1, elapsed / 1.05) : 0;
      const factor = convergence + scatter;
      const px = cx + Math.cos(a) * (radius * 1.15 + dist * factor);
      const py = cy + Math.sin(a * 1.31) * (radius * 1.1 + dist * factor);
      const alpha = (convergence * .75 + scatter * .5) * p.alpha;
      if(alpha>.015) {
        ctx.beginPath(); ctx.fillStyle=`rgba(75,190,255,${alpha})`;
        ctx.arc(px,py,p.size*(1 + factor * .5),0,Math.PI*2); ctx.fill();
      }
    }

    const projected=[];
    const gatherEase = phase === "opening" ? 1 - Math.pow(Math.max(0, 1 - elapsed / 1.55), 2.4) : 1;
    for (const p of particles) {
      let x=p.x*Math.cos(rotY)-p.z*Math.sin(rotY);
      let z=p.x*Math.sin(rotY)+p.z*Math.cos(rotY);
      let y=p.y*Math.cos(rotX)-z*Math.sin(rotX);
      z=p.y*Math.sin(rotX)+z*Math.cos(rotX);
      const pulse=1 + .035*Math.sin(now*.0011+p.seed*2);
      const organic=1 + .075*Math.sin(p.seed+now*.0007*p.drift) + .035*Math.cos(p.seed*2-now*.0004);
      const depth=1/(1.8-z*.52);
      const breathe=radius*pulse*organic*collapse*routing;
      const targetX=cx+x*breathe*depth;
      const targetY=cy+y*breathe*depth;
      const px = p.startX + (targetX - p.startX) * gatherEase;
      const py = p.startY + (targetY - p.startY) * gatherEase;
      const front=(z+1)/2;
      const alpha=(.22+front*.78)*p.alpha*overall;
      projected.push({x:px,y:py,z,alpha,size:p.size*(.65+front*.9),front});
    }

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

    const glow=ctx.createRadialGradient(cx,cy,radius*.12,cx,cy,radius*1.28);
    glow.addColorStop(0,"rgba(0,115,230,0)");
    glow.addColorStop(.55,`rgba(0,112,220,${.08*overall})`);
    glow.addColorStop(.82,`rgba(0,180,255,${.09*overall})`);
    glow.addColorStop(1,"rgba(0,100,220,0)");
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,radius*1.28,0,Math.PI*2);ctx.fill();

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

    const rayAlpha=overall*(phase==="opening"?Math.min(1,elapsed/1.25):1);

    const directions=[[0,-1],[-1,0],,];
for(let i=0;i<4;i++) {
const [dx,dy]=directions[i];
const start=radius*.76, end=radius*(width<700?1.72:1.88);
const x1=cx+dxstart,y1=cy+dystart,x2=cx+dxend,y2=cy+dyend;
const grad=ctx.createLinearGradient(x1,y1,x2,y2);
grad.addColorStop(0,rgba(35,164,255,${.55*rayAlpha}));
grad.addColorStop(.55,rgba(52,210,255,${.25*rayAlpha}));
grad.addColorStop(1,"rgba(36,140,255,0)");
ctx.strokeStyle=grad;ctx.lineWidth=1.15;
ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
const pulse=(now*.00032+i*.25)%1;
const dotX=x1+(x2-x1)*pulse,dotY=y1+(y2-y1)pulse;
ctx.beginPath();ctx.fillStyle=rgba(102,235,255,${.9*rayAlpha});
ctx.shadowBlur=12;ctx.shadowColor="#159dff";ctx.arc(dotX,dotY,1.6,0,Math.PI2);ctx.fill();ctx.shadowBlur=0;
}
if(phase==="opening" && elapsed>=1.65) phase="running";
if(phase==="closing" && elapsed>=1.08) {
phase="idle"; active=false; hub.classList.remove("is-active","is-shutting-down");
returnButton.classList.remove("is-visible");
ctx.clearRect(0,0,width,height); cancelAnimationFrame(raf); raf=0; return;
}
if(phase==="routing" && elapsed>=.45) {
phase="idle"; active=false; hub.classList.remove("is-active","is-routing");
cancelAnimationFrame(raf);raf=0;return;
}
raf=requestAnimationFrame(draw);
}
function startAnimation(nextPhase) {
active=true;phase=nextPhase;phaseStarted=performance.now();lastFrame=0;
if(!raf) raf=requestAnimationFrame(draw);
}
// Trova la modale impostazioni aperta, la "smolecola" e poi la chiude
function dematerializeSettingsAndShowHub() {
if (localStorage.getItem("enclaveFutureMode") !== "true" || home.classList.contains("hidden")) return;
// Cerca eventuali modali/overlay visibili fuori da #homeScreen e #futureHub
const candidates = Array.from(document.body.children).filter(el => {
if (el === home || el === hub || el === returnButton) return false;
if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return false;
if (el.classList.contains("hidden") || el.hidden) return false;
const st = getComputedStyle(el);
if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
return el.offsetWidth > 0 && el.offsetHeight > 0;
});
const openModal = candidates[candidates.length - 1];
let rect = null;
if (openModal) {
const innerPanel = openModal.firstElementChild || openModal;
rect = innerPanel.getBoundingClientRect();
openModal.classList.add("future-dematerialize");
}
closeFutureSearch();
inAIView = false;
returnButton.classList.remove("is-visible");
hub.classList.remove("is-shutting-down","is-routing");
hub.classList.add("is-active");
resize();
spawnDematerializeSparks(rect);
startAnimation(reducedMotion ? "running" : "opening");
if (openModal) {
window.setTimeout(() => {
// Prova a cliccare il tasto di chiusura nativo della modale per mantenere lo stato coerente in script.js
const closeBtn = openModal.querySelector("button[aria-label*='Chiudi'], button[class*='close'], .close-button, .modal-close");
if (closeBtn) {
closeBtn.click();
} else {
openModal.classList.add("hidden");
}
openModal.classList.remove("future-dematerialize");
}, 820);
}
}
function showHub(fromDematerialize = false) {
if (fromDematerialize) {
dematerializeSettingsAndShowHub();
return;
}
if (localStorage.getItem("enclaveFutureMode") !== "true" || home.classList.contains("hidden")) return;
closeFutureSearch();
inAIView = false;
returnButton.classList.remove("is-visible");
hub.classList.remove("is-shutting-down","is-routing");
hub.classList.add("is-active");
resize();
startAnimation(reducedMotion ? "running" : "opening");
}
function shutdown() {
closeFutureSearch();
inAIView = false;
if (!hub.classList.contains("is-active")) {
hub.classList.remove("is-shutting-down","is-routing");
returnButton.classList.remove("is-visible");
return;
}
hub.classList.remove("is-active");
hub.classList.add("is-shutting-down");
startAnimation("closing");
}
// Ricerca utenti sopra la bolla
const searchOverlay = hub.querySelector("#futureSearchOverlay");
const futureSearchInput = hub.querySelector("#futureSearchInput");
const futureSearchClose = hub.querySelector("#futureSearchClose");
const futureSearchMirror = hub.querySelector("#futureSearchResultsMirror");
const realSearchInput = document.getElementById("chatSearch");
const realSearchResults = document.getElementById("searchResults");
function openFutureSearch() {
if (!searchOverlay) return;
searchOverlay.classList.add("is-open");
searchOverlay.setAttribute("aria-hidden", "false");
if (realSearchInput && futureSearchInput) {
futureSearchInput.value = realSearchInput.value;
futureSearchInput.focus();
}
}
function closeFutureSearch() {
if (!searchOverlay) return;
searchOverlay.classList.remove("is-open");
searchOverlay.setAttribute("aria-hidden", "true");
if (futureSearchMirror) futureSearchMirror.innerHTML = "";
}
if (futureSearchInput && realSearchInput) {
futureSearchInput.addEventListener("input", () => {
realSearchInput.value = futureSearchInput.value;
realSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
});
}
if (realSearchResults && futureSearchMirror) {
const syncResults = () => {
if (!searchOverlay.classList.contains("is-open")) return;
futureSearchMirror.innerHTML = realSearchResults.innerHTML;
};
new MutationObserver(syncResults).observe(realSearchResults, { childList: true, subtree: true });
futureSearchMirror.addEventListener("click", (e) => {
const items = Array.from(futureSearchMirror.children);
const clickedItem = items.find(el => el.contains(e.target));
const idx = items.indexOf(clickedItem);
if (idx >= 0 && realSearchResults.children[idx]) {
closeFutureSearch();
hub.classList.remove("is-active");
returnButton.classList.add("is-visible");
realSearchResults.children[idx].click();
}
});
}
futureSearchClose?.addEventListener("click", closeFutureSearch);
searchOverlay?.addEventListener("click", (e) => {
if (e.target === searchOverlay) closeFutureSearch();
});
// Rileva la chiusura di EnclaveAI per tornare direttamente alla bolla (senza mostrare l'elenco chat)
const bodyObserver = new MutationObserver((mutations) => {
if (!inAIView || localStorage.getItem("enclaveFutureMode") !== "true") return;
for (const m of mutations) {
const removedAI = Array.from(m.removedNodes).some(n =>
n.nodeType === 1 && (n.id?.toLowerCase().includes("ai") || n.className?.toString().toLowerCase().includes("ai") || n.textContent?.includes("EnclaveAI"))
);
const hiddenAI = m.type === "attributes" && m.target instanceof Element &&
(m.target.id?.toLowerCase().includes("ai") || m.target.className?.toString().toLowerCase().includes("ai")) &&
(m.target.classList.contains("hidden") || m.target.hidden || getComputedStyle(m.target).display === "none");
if (removedAI || hiddenAI) {
inAIView = false;
showHub(false);
break;
}
}
});
bodyObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "style"] });
function routeAway(target) {
if (!hub.classList.contains("is-active")) return;
if (target === "settings") {
document.getElementById("settingsButton")?.click();
return;
}
if (target === "search") {
openFutureSearch();
return;
}
if (target === "ai") {
const ai = document.getElementById("enclaveAIQuickButton");
if (ai) {
inAIView = true;
ai.hidden = false;
ai.click();
}
returnButton.classList.add("is-visible");
hub.classList.remove("is-active");
hub.classList.add("is-routing");
startAnimation("routing");
return;
}
hub.classList.remove("is-active");
hub.classList.add("is-routing");
startAnimation("routing");
window.setTimeout(() => {
returnButton.classList.add("is-visible");
if (target === "chat") {
const back = document.getElementById("chatBackButton");
if (back && !document.getElementById("activeChat")?.classList.contains("hidden")) back.click();
document.querySelector(".conversation-section")?.scrollIntoView({ block: "nearest" });
}
}, 180);
}
hub.querySelectorAll(".future-hub-branch").forEach(button => {
button.addEventListener("click", () => routeAway(button.dataset.target));
});
returnButton.addEventListener("click", () => showHub(false));
document.addEventListener("enclave:future-mode-change", event => {
if (event.detail?.enabled) showHub(true);
else shutdown();
});
const observer = new MutationObserver(() => {
if (localStorage.getItem("enclaveFutureMode") === "true" && !home.classList.contains("hidden") && !hub.classList.contains("is-active") && !returnButton.classList.contains("is-visible") && !inAIView) {
showHub(false);
}
});
observer.observe(home, { attributes: true, attributeFilter: ["class"] });
window.addEventListener("resize", () => { if (active) resize(); });
})();
