/*
 * ENCLAVE VOICE — orb-first conversational voice interface.
 * Voice calls the authenticated EnclaveAI core directly; it never opens the
 * EnclaveAI panel, writes into its composer, or simulates a form submission.
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
    lastFinalTranscript: "",
    lastFinalAt: 0,
    lastAIAnswer: "",
    lastError: "",
    startRequested: false,
    pendingWakeTimer: null,
    pendingWakeAt: 0,
    pendingWakeLead: false
  };

  const STOP = /^(?:stop|ferma|basta|termina|chiudi)(?:\s+(?:enclave voice|la voce|ascolto|conversazione))?$/i;

  function normalize(value) {
    return String(value || "").toLocaleLowerCase("it-IT").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ").trim();
  }

  function emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(`enclave:voice-${name}`, { detail }));
  }

  function setOrbState() {
    hub.classList.toggle("is-listening", state.listening && !state.speaking);
    hub.classList.toggle("is-speaking", state.speaking);
    hub.classList.toggle("is-voice-session", state.enabled);
    if (orbButton) {
      orbButton.setAttribute("aria-pressed", String(state.enabled));
      orbButton.setAttribute("aria-label", state.enabled ? "Disattiva Enclave Voice" : "Attiva Enclave Voice");
    }
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

  function scheduleRecognition(delay = 220) {
    if (!state.enabled || state.speaking || state.busy || document.hidden || !SpeechRecognition || state.restartTimer) return;
    state.restartTimer = window.setTimeout(() => {
      state.restartTimer = null;
      startRecognitionInstance();
    }, delay);
  }

  function speak(text, options = {}) {
    const message = String(text || "").trim();
    if (!message || !speechAvailable) {
      if (state.enabled) scheduleRecognition(180);
      return false;
    }
    stopRecognition();
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
    setOrbState();
    utterance.onstart = () => emit("speaking", { active: true });
    utterance.onend = utterance.onerror = () => {
      state.speaking = false;
      setOrbState();
      emit("speaking", { active: false });
      scheduleRecognition(180);
    };
    window.speechSynthesis.speak(utterance);
    return true;
  }

  async function waitForEnclaveAICore(timeout = 10000) {
    const started = Date.now();
    while (state.enabled && !window.EnclaveAI?.askFromVoice) {
      if (Date.now() - started >= timeout) throw new Error("Motore EnclaveAI non ancora disponibile.");
      await new Promise(resolve => window.setTimeout(resolve, 80));
    }
    if (!state.enabled) throw new Error("Sessione vocale interrotta.");
    return window.EnclaveAI;
  }

  async function sendToAI(text) {
    const message = String(text || "").trim();
    if (!message || state.busy || !state.enabled) return false;
    state.busy = true;
    state.inConversation = true;
    stopRecognition();
    emit("thinking", { active: true, text: message });
    try {
      const core = await waitForEnclaveAICore();
      emit("request", { text: message });
      const answer = await core.askFromVoice(message);
      if (!state.enabled) return false;
      if (!answer) throw new Error("EnclaveAI non ha restituito una risposta.");
      state.lastAIAnswer = answer;
      emit("answer", { answer });
      return speak(answer);
    } catch (error) {
      console.error("Enclave Voice → EnclaveAI:", error);
      emit("error", { error: error?.message || "ai-send-failed" });
      if (state.enabled) speak(error?.message?.includes("accedere")
        ? "Devi accedere a Enclave con un account verificato per usare EnclaveAI."
        : "Non riesco a raggiungere EnclaveAI in questo momento. Riprova tra poco.");
      return false;
    } finally {
      state.busy = false;
      emit("thinking", { active: false });
      if (state.enabled && !state.speaking) scheduleRecognition(250);
    }
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
    if (/^(apri|vai a) enclave ?ai$/.test(value)) {
      // Explicitly requested navigation is the only local command that opens the panel.
      document.getElementById("enclaveAIQuickButton")?.click();
      return true;
    }
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
    if (/^(torna alla bolla|mostra la bolla|torna al menu)$/.test(value)) {
      document.getElementById("enclaveAIClose")?.click();
      document.getElementById("futureReturnButton")?.click();
      return true;
    }
    if (/^(aiuto|cosa puoi fare|comandi vocali)$/.test(value)) {
      speak("Puoi parlarmi dopo aver detto Ehi Enclave. Puoi chiedermi di aprire chat, impostazioni o ricerca utenti, oppure di ripetere l'ultima risposta.");
      return true;
    }
    if (/^(ripeti|ripeti risposta|leggi ultima risposta)$/.test(value) && state.lastAIAnswer) {
      speak(state.lastAIAnswer); return true;
    }
    if (/^(non parlare|silenzio|muto)$/.test(value)) {
      window.speechSynthesis?.cancel();
      state.speaking = false;
      setOrbState();
      scheduleRecognition(180);
      return true;
    }
    return false;
  }

  function clearPendingWake() {
    if (state.pendingWakeTimer) {
      clearTimeout(state.pendingWakeTimer);
      state.pendingWakeTimer = null;
    }
    state.pendingWakeLead = false;
    state.pendingWakeAt = 0;
  }

  // Speech recognition frequently mishears or splits the product name.
  // Accept close phonetic spellings such as "encalve" and "enclav".
  function editDistanceAtMostOne(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else { i++; j++; }
    }
    if (i < a.length || j < b.length) edits++;
    return edits <= 1;
  }

  function parseWakePrefix(value) {
    const words = normalize(value).split(" ").filter(Boolean);
    if (!words.length) return { matched: false, remainder: "" };
    const greetings = new Set(["ehi", "ei", "hey", "hei", "e"]);
    const nameIndex = greetings.has(words[0]) ? 1 : 0;
    const candidate = words[nameIndex] || "";
    const aliases = new Set(["enclave", "encalve", "enclav", "enclabe", "enclaves"]);
    const matches = aliases.has(candidate) || (candidate.length >= 6 && editDistanceAtMostOne(candidate, "enclave"));
    if (!matches) return { matched: false, remainder: "" };
    return { matched: true, remainder: words.slice(nameIndex + 1).join(" ") };
  }

  function armWakePrompt() {
    clearPendingWake();
    state.pendingWakeAt = Date.now();
    state.pendingWakeTimer = window.setTimeout(() => {
      state.pendingWakeTimer = null;
      state.pendingWakeLead = false;
      state.pendingWakeAt = 0;
      if (!state.enabled || !state.inConversation || state.busy || state.speaking) return;
      speak("Ti ascolto.");
    }, 2100);
  }

  function processTranscript(raw) {
    const transcript = String(raw || "").trim();
    if (!transcript || !state.enabled || state.busy) return;
    const normalized = normalize(transcript);
    if (!normalized) return;
    const now = Date.now();
    if (normalized === state.lastFinalTranscript && now - state.lastFinalAt < 1800) return;
    state.lastFinalTranscript = normalized;
    state.lastFinalAt = now;
    state.lastTranscript = transcript;
    hub.classList.remove("is-hearing");
    emit("transcript", { transcript, normalized, source: "speech-recognition" });

    if (STOP.test(normalized)) {
      clearPendingWake();
      stopVoice("spoken-stop");
      return;
    }

    // A leading greeting may arrive as its own final result before the name.
    if (/^(?:ehi|ei|hey|hei|e)$/.test(normalized)) {
      state.pendingWakeLead = true;
      state.pendingWakeAt = now;
      if (state.pendingWakeTimer) clearTimeout(state.pendingWakeTimer);
      state.pendingWakeTimer = window.setTimeout(() => {
        state.pendingWakeTimer = null;
        state.pendingWakeLead = false;
        state.pendingWakeAt = 0;
        if (state.enabled && !state.busy && !state.speaking) {
          state.inConversation = true;
          speak("Ti ascolto.");
        }
      }, 2600);
      return;
    }

    let wakeInput = normalized;
    if (state.pendingWakeLead && now - state.pendingWakeAt < 5000) {
      wakeInput = `ei ${normalized}`;
      clearPendingWake();
    }

    const wake = parseWakePrefix(wakeInput);
    if (wake.matched) {
      state.inConversation = true;
      if (wake.remainder) {
        clearPendingWake();
        if (runLocalCommand(wake.remainder)) return;
        sendToAI(wake.remainder);
      } else {
        armWakePrompt();
      }
      return;
    }

    // If only the greeting/name was recognized in a previous segment, the
    // following final result is the rest of the same spoken request.
    if (state.pendingWakeTimer && now - state.pendingWakeAt < 5000) {
      clearPendingWake();
      state.inConversation = true;
      if (runLocalCommand(transcript)) return;
      sendToAI(transcript);
      return;
    }

    if (state.inConversation) {
      if (runLocalCommand(transcript)) return;
      sendToAI(transcript);
      return;
    }

    // The orb was explicitly activated by the user. Do not silently discard
    // the first sentence if the browser fails to recognize the wake phrase:
    // accept it as a direct prompt. Saying the wake phrase remains supported.
    state.inConversation = true;
    if (runLocalCommand(transcript)) return;
    sendToAI(transcript);
  }

  function startRecognitionInstance() {
    if (!state.enabled || state.speaking || state.busy || document.hidden || !SpeechRecognition || state.recognition) return;
    try {
      const recognition = new SpeechRecognition();
      state.recognition = recognition;
      recognition.lang = "it-IT";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        if (state.recognition !== recognition) return;
        state.listening = true;
        setOrbState();
        emit("listening", { active: true });
      };
      let processedFinalCount = 0;
      recognition.onresult = event => {
        let interim = "";
        const finalSegments = [];
        // Read the complete result list, not only resultIndex: Chrome can
        // deliver the wake word and the rest of the same utterance as separate
        // final segments in one event. Each final segment is processed once.
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          const spoken = result[0]?.transcript || "";
          if (result.isFinal && spoken.trim()) finalSegments.push(spoken.trim());
          else interim += spoken;
        }
        const freshSegments = finalSegments.slice(processedFinalCount);
        processedFinalCount = Math.max(processedFinalCount, finalSegments.length);
        // Treat final chunks delivered together as one utterance. Processing
        // them individually could send the first chunk and discard the rest
        // as soon as the AI request marks the engine busy.
        if (freshSegments.length) processTranscript(freshSegments.join(" "));
        hub.classList.toggle("is-hearing", Boolean(interim.trim()) && state.listening);
      };
        recognition.onerror = event => {
        state.listening = false;
        hub.classList.remove("is-hearing");
        state.lastError = event.error || "recognition-error";
        emit("error", { error: state.lastError, stage: "speech-recognition" });
        if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
          state.enabled = false;
          state.inConversation = false;
          stopRecognition();
          const explanation = event.error === "audio-capture"
            ? "Non riesco a trovare un microfono disponibile. Controlla il dispositivo audio."
            : "Il microfono non è autorizzato. Consenti a Enclave di usare il microfono nelle impostazioni del browser.";
          speak(explanation);
        }
        setOrbState();
      };
      recognition.onend = () => {
        if (state.recognition === recognition) state.recognition = null;
        state.listening = false;
        setOrbState();
        hub.classList.remove("is-hearing");
        scheduleRecognition(350);
      };
      recognition.start();
    } catch (error) {
      state.recognition = null;
      state.listening = false;
      state.lastError = error?.name || "start-failed";
      setOrbState();
      emit("error", { error: state.lastError, stage: "recognition-start" });
      if (state.enabled) speak("Non riesco ad avviare il microfono. Controlla i permessi del browser e riprova.");
    }
  }

  function startVoice() {
    if (!SpeechRecognition || !speechAvailable || !window.isSecureContext) {
      hub.classList.add("voice-unavailable-pulse");
      window.setTimeout(() => hub.classList.remove("voice-unavailable-pulse"), 550);
      const reason = !window.isSecureContext ? "insecure-context"
        : !SpeechRecognition ? "unsupported-speech-recognition"
        : "unsupported-speech-synthesis";
      emit("unavailable", { reason });
      return false;
    }
    if (state.enabled) return true;
    state.enabled = true;
    state.inConversation = false;
    state.startRequested = true;
    state.lastFinalTranscript = "";
    hub.classList.remove("is-hearing");
    setOrbState();
    startRecognitionInstance();
    return true;
  }

  function stopVoice(reason = "manual") {
    state.enabled = false;
    state.inConversation = false;
    state.busy = false;
    state.startRequested = false;
    clearPendingWake();
    hub.classList.remove("is-hearing");
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

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopRecognition();
    else if (state.enabled) scheduleRecognition(300);
  });
  document.addEventListener("enclave:future-mode-change", event => {
    if (!event.detail?.enabled) stopVoice("future-mode-disabled");
  });

  window.EnclaveVoice = Object.freeze({
    speak,
    start: startVoice,
    stop: stopVoice,
    toggle: toggleVoice,
    get isListening() { return state.listening; },
    get isActive() { return state.enabled; },
    get isInConversation() { return state.inConversation; },
    get isBusy() { return state.busy; },
    get lastTranscript() { return state.lastTranscript; },
    get lastError() { return state.lastError; },
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
