/*
 * ENCLAVE VOICE — conversational voice layer for EnclaveAI.
 * Uses the existing authenticated EnclaveAI form/Worker pipeline; it does not
 * create a second AI endpoint or bypass Firebase authentication.
 */
(() => {
  "use strict";

  const orbButton = document.getElementById("futureVoiceButton");
  const hub = document.getElementById("futureHub");
  if (!hub) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speechAvailable = "speechSynthesis" in window && !!window.SpeechSynthesisUtterance;
  const state = {
    enabled: false,
    listening: false,
    speaking: false,
    inConversation: false,
    busy: false,
    recognition: null,
    restartTimer: null,
    lastTranscript: "",
    lastSpoken: "",
    lastAIAnswer: "",
    observer: null,
    spokenNodes: new WeakSet(),
    aiMic: null,
    startRequested: false,
    requestTimeout: null
  };

  const WAKE = /\b(?:ehi|ei|hey|hei)\s+enclave\b|\benclave\b/i;
  const STOP = /^(?:stop|ferma|basta|termina|chiudi)\s*(?:enclave voice|la voce|ascolto|conversazione)?$/i;

  function normalize(value) {
    return String(value || "").toLocaleLowerCase("it-IT").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ").trim();
  }

  function setOrbState() {
    hub.classList.toggle("is-listening", state.listening && !state.speaking);
    hub.classList.toggle("is-speaking", state.speaking);
    hub.classList.toggle("is-voice-session", state.enabled);
    if (orbButton) {
      orbButton.setAttribute("aria-pressed", String(state.enabled));
      orbButton.setAttribute("aria-label", state.enabled ? "Disattiva Enclave Voice" : "Attiva Enclave Voice");
    }
    if (state.aiMic) {
      state.aiMic.classList.toggle("is-active", state.enabled);
      state.aiMic.setAttribute("aria-pressed", String(state.enabled));
    }
  }

  function emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(`enclave:voice-${name}`, { detail }));
  }

  function stopRecognition() {
    if (state.restartTimer) {
      clearTimeout(state.restartTimer);
      state.restartTimer = null;
    }
    const current = state.recognition;
    state.recognition = null;
    state.listening = false;
    if (current) {
      current.onend = null;
      try { current.stop(); } catch (_) {}
    }
    setOrbState();
  }

  function speak(text, options = {}) {
    const message = String(text || "").trim();
    if (!message || !speechAvailable) return false;
    if (state.recognition) stopRecognition();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = options.lang || "it-IT";
    utterance.rate = options.rate ?? 1;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const italianVoice = voices.find(voice => /^it(?:-|$)/i.test(voice.lang));
    if (italianVoice) utterance.voice = italianVoice;
    state.speaking = true;
    state.lastSpoken = message;
    setOrbState();
    utterance.onstart = () => emit("speaking", { active: true });
    utterance.onend = utterance.onerror = () => {
      state.speaking = false;
      setOrbState();
      emit("speaking", { active: false });
      if (state.enabled) scheduleRecognition(180);
    };
    window.speechSynthesis.speak(utterance);
    return true;
  }

  function openAI() {
    // script.js is an ES module, so its functions are intentionally not read
    // as globals. Use the existing app button, whose listener opens EnclaveAI.
    const quick = document.getElementById("enclaveAIQuickButton");
    if (quick) { quick.click(); return true; }
    return false;
  }

  function waitForAIComposer(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const check = () => {
        const form = document.getElementById("enclaveAIForm");
        const input = document.getElementById("enclaveAIInput");
        const send = document.getElementById("enclaveAISend");
        if (form && input && send && !send.disabled) return resolve({ form, input });
        if (Date.now() - started >= timeout) return reject(new Error("Interfaccia EnclaveAI non disponibile."));
        window.setTimeout(check, 60);
      };
      check();
    });
  }

  async function sendToAI(text) {
    const message = String(text || "").trim();
    if (!message || state.busy) return false;
    state.busy = true;
    state.inConversation = true;
    openAI();
    try {
      const { form, input } = await waitForAIComposer();
      input.value = message;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      form.requestSubmit();
      emit("request", { text: message });
      if (state.requestTimeout) clearTimeout(state.requestTimeout);
      state.requestTimeout = window.setTimeout(() => {
        state.busy = false;
        state.requestTimeout = null;
      }, 45000);
      return true;
    } catch (error) {
      console.error("Enclave Voice → EnclaveAI:", error);
      speak("Non riesco a raggiungere EnclaveAI in questo momento.");
      return false;
    }
  }

  function attachAIResponseObserver() {
    const messages = document.getElementById("enclaveAIMessages");
    if (!messages || state.observer?.target === messages) return;
    state.observer?.disconnect();
    const observer = new MutationObserver(records => {
      if (!state.enabled) return;
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          const candidates = [];
          if (node.matches?.(".enclave-ai-message.is-assistant")) candidates.push(node);
          candidates.push(...(node.querySelectorAll?.(".enclave-ai-message.is-assistant") || []));
          for (const item of candidates) {
            if (state.spokenNodes.has(item) || item.classList.contains("is-typing")) continue;
            const bubble = item.querySelector(".enclave-ai-bubble");
            const answer = bubble?.innerText?.trim();
            if (!answer) continue;
            state.spokenNodes.add(item);
            state.lastAIAnswer = answer;
            state.busy = false;
            if (state.requestTimeout) {
              clearTimeout(state.requestTimeout);
              state.requestTimeout = null;
            }
            speak(answer);
          }
        }
      }
    });
    observer.observe(messages, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    state.observer = observer;
    state.observer.target = messages;
  }

  function installAIMicrophone() {
    const row = document.querySelector("#enclaveAIForm .enclave-ai-composer-row");
    if (!row) return;
    if (state.aiMic?.isConnected) return;
    const send = row.querySelector("#enclaveAISend");
    if (!send) return;
    const mic = document.createElement("button");
    mic.type = "button";
    mic.id = "enclaveAIVoiceButton";
    mic.className = "enclave-ai-voice-button";
    mic.setAttribute("aria-label", "Attiva Enclave Voice");
    mic.setAttribute("aria-pressed", "false");
    mic.title = "Enclave Voice";
    mic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v4m-4 0h8"/></svg>';
    mic.addEventListener("click", toggleVoice);
    row.insertBefore(mic, send);
    state.aiMic = mic;
    setOrbState();
  }

  function route(target) {
    const branch = hub.querySelector(`[data-target="${target}"]`);
    if (branch) { branch.click(); return true; }
    return false;
  }

  function runLocalCommand(raw) {
    const value = normalize(raw);
    if (/^(apri|vai a|mostra) (la )?(chat|conversazioni|conversazione)$/.test(value)) return route("chat");
    if (/^(apri|vai a|mostra) (le )?impostazioni( avanzate)?$/.test(value)) return route("settings");
    if (/^(apri|vai a) enclave ?ai$/.test(value)) { openAI(); return true; }
    if (/^(cerca|apri) (un )?(utente|utenti|contatto|contatti)$/.test(value)) return route("search");
    const search = value.match(/^(cerca|trova) (.+)$/);
    if (search) {
      route("search");
      window.setTimeout(() => {
        const input = document.getElementById("chatSearch");
        if (!input) return;
        input.value = search[2].toUpperCase();
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, 160);
      return true;
    }
    if (/^(nuova conversazione|nuova chat|azzera conversazione)$/.test(value)) {
      document.getElementById("enclaveAINew")?.click();
      state.inConversation = true;
      speak("Nuova conversazione pronta.");
      return true;
    }
    if (/^(torna alla bolla|mostra la bolla|torna al menu)$/.test(value)) {
      document.getElementById("enclaveAIClose")?.click();
      document.getElementById("futureReturnButton")?.click();
      return true;
    }
    if (/^(aiuto|cosa puoi fare|comandi vocali)$/.test(value)) {
      speak("Puoi parlarmi dopo aver detto Ehi Enclave. Puoi anche chiedermi di aprire chat, impostazioni, ricerca utenti, oppure di ripetere l'ultima risposta.");
      return true;
    }
    if (/^(ripeti|ripeti risposta|leggi ultima risposta)$/.test(value) && state.lastAIAnswer) {
      speak(state.lastAIAnswer); return true;
    }
    if (/^(non parlare|silenzio|muto)$/.test(value)) {
      window.speechSynthesis?.cancel(); state.speaking = false; setOrbState(); return true;
    }
    return false;
  }

  function processTranscript(raw) {
    const transcript = String(raw || "").trim();
    if (!transcript) return;
    state.lastTranscript = transcript;
    emit("transcript", { transcript, source: "speech-recognition" });
    const normalized = normalize(transcript);

    if (STOP.test(normalized)) {
      stopVoice("spoken-stop");
      return;
    }

    const wakeMatch = WAKE.exec(transcript);
    if (!state.inConversation && wakeMatch) {
      const afterWake = transcript.slice(wakeMatch.index + wakeMatch[0].length).trim()
        .replace(/^[,.:;!?\s-]+/, "");
      state.inConversation = true;
      openAI();
      if (afterWake) {
        sendToAI(afterWake);
      } else {
        speak("Ti ascolto.");
      }
      return;
    }

    if (state.inConversation) {
      if (runLocalCommand(transcript)) return;
      sendToAI(transcript);
      return;
    }

    runLocalCommand(transcript);
  }

  function scheduleRecognition(delay = 250) {
    if (!state.enabled || state.speaking || document.hidden || state.restartTimer) return;
    state.restartTimer = window.setTimeout(() => {
      state.restartTimer = null;
      startRecognitionInstance();
    }, delay);
  }

  function startRecognitionInstance() {
    if (!state.enabled || state.speaking || document.hidden || !SpeechRecognition) return;
    if (state.recognition) return;
    try {
      const recognition = new SpeechRecognition();
      state.recognition = recognition;
      recognition.lang = "it-IT";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;
      recognition.onstart = () => { state.listening = true; setOrbState(); emit("listening", { active: true }); };
      recognition.onresult = event => {
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal && result[0]?.transcript) processTranscript(result[0].transcript);
        }
      };
      recognition.onerror = event => {
        state.listening = false;
        emit("error", { error: event.error });
        if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
          state.enabled = false;
          state.inConversation = false;
          setOrbState();
        }
      };
      recognition.onend = () => {
        if (state.recognition === recognition) state.recognition = null;
        state.listening = false;
        setOrbState();
        if (state.enabled && !state.speaking) scheduleRecognition(350);
      };
      recognition.start();
    } catch (error) {
      state.recognition = null;
      state.listening = false;
      setOrbState();
      emit("error", { error: error?.name || "start-failed" });
    }
  }

  function startVoice() {
    if (!SpeechRecognition || !window.isSecureContext) {
      hub.classList.add("voice-unavailable-pulse");
      window.setTimeout(() => hub.classList.remove("voice-unavailable-pulse"), 550);
      emit("unavailable", { reason: !window.isSecureContext ? "insecure-context" : "unsupported-browser" });
      return false;
    }
    if (state.enabled) return true;
    state.enabled = true;
    state.inConversation = false;
    state.startRequested = true;
    installAIMicrophone();
    setOrbState();
    startRecognitionInstance();
    return true;
  }

  function stopVoice(reason = "manual") {
    state.enabled = false;
    state.inConversation = false;
    state.busy = false;
    if (state.requestTimeout) {
      clearTimeout(state.requestTimeout);
      state.requestTimeout = null;
    }
    state.startRequested = false;
    stopRecognition();
    if (speechAvailable) window.speechSynthesis.cancel();
    state.speaking = false;
    setOrbState();
    emit("stopped", { reason });
  }

  function toggleVoice() {
    if (state.enabled) stopVoice("toggle");
    else startVoice();
  }

  if (orbButton) orbButton.addEventListener("click", toggleVoice);

  const bodyObserver = new MutationObserver(() => {
    if (document.getElementById("enclaveAIForm")) {
      installAIMicrophone();
      attachAIResponseObserver();
    }
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopRecognition();
    } else if (state.enabled) {
      scheduleRecognition(300);
    }
  });
  document.addEventListener("enclave:future-mode-change", event => {
    if (!event.detail?.enabled && !document.getElementById("enclaveAIOverlay")) stopVoice("future-mode-disabled");
  });
  document.addEventListener("click", event => {
    if (event.target.closest?.("#enclaveAIClose")) stopVoice("ai-closed");
  });

  window.EnclaveVoice = Object.freeze({
    speak,
    start: startVoice,
    stop: stopVoice,
    toggle: toggleVoice,
    get isListening() { return state.listening; },
    get isActive() { return state.enabled; },
    get isInConversation() { return state.inConversation; },
    get lastTranscript() { return state.lastTranscript; },
    get capabilities() {
      return {
        speechRecognition: !!SpeechRecognition,
        speechSynthesis: speechAvailable,
        continuousRecognition: !!SpeechRecognition,
        secureContext: !!window.isSecureContext
      };
    }
  });
})();
