/*
 * ENCLAVE VOICE — cross-browser audio capture and authenticated transcription.
 * The orb is the only entry point. Audio is transcribed by the Enclave Worker;
 * only an explicit wake phrase (or an already-open voice conversation) reaches EnclaveAI.
 */
(() => {
  "use strict";

  const orbButton = document.getElementById("futureVoiceButton");
  const hub = document.getElementById("futureHub");
  if (!hub) return;

  const speechAvailable = "speechSynthesis" in window && !!window.SpeechSynthesisUtterance;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const state = {
    enabled: false,
    listening: false,
    speaking: false,
    inConversation: false,
    busy: false,
    stream: null,
    audioContext: null,
    analyser: null,
    source: null,
    raf: 0,
    recorder: null,
    chunks: [],
    recordingStartedAt: 0,
    speechStartedAt: 0,
    silenceStartedAt: 0,
    noiseFloor: 0.006,
    mimeType: "",
    pendingWakeTimer: null,
    pendingWakeAt: 0,
    pendingWakeLead: false,
    lastTranscript: "",
    lastAIAnswer: "",
    lastError: ""
  };

  const SILENCE_MS = 1150;
  const MAX_UTTERANCE_MS = 14000;
  const MIN_UTTERANCE_MS = 350;
  const STOP = /^(?:stop|ferma|basta|termina|chiudi)(?:\s+(?:enclave voice|la voce|ascolto|conversazione))?$/i;

  function normalize(value) {
    return String(value || "").toLocaleLowerCase("it-IT").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  }

  function emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(`enclave:voice-${name}`, { detail }));
  }

  function setOrbState() {
    hub.classList.toggle("is-listening", state.listening && !state.speaking && !state.busy);
    hub.classList.toggle("is-speaking", state.speaking);
    hub.classList.toggle("is-voice-session", state.enabled);
    hub.classList.toggle("is-hearing", state.listening && !!state.recorder);
    if (orbButton) {
      orbButton.setAttribute("aria-pressed", String(state.enabled));
      orbButton.setAttribute("aria-label", state.enabled ? "Disattiva Enclave Voice" : "Attiva Enclave Voice");
    }
  }

  function cleanForSpeech(value) {
    return String(value || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s*/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*>\s?/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, "$1")
      .replace(/(?<!_)_(?!_)([^_]+)_(?!_)/g, "$1")
      .replace(/~~(.*?)~~/g, "$1")
      .replace(/[\*_#~]/g, "")
      .replace(/\s+/g, " ").trim();
  }

  function stopCaptureLoop() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    state.listening = false;
    setOrbState();
  }

  function releaseMicrophone() {
    stopCaptureLoop();
    if (state.recorder && state.recorder.state !== "inactive") {
      try { state.recorder.stop(); } catch (_) {}
    }
    state.recorder = null;
    state.chunks = [];
    if (state.stream) state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
    if (state.source) { try { state.source.disconnect(); } catch (_) {} }
    state.source = null;
    if (state.audioContext) {
      const context = state.audioContext;
      state.audioContext = null;
      context.close().catch(() => {});
    }
    state.analyser = null;
  }

  function speak(text, options = {}) {
    const message = cleanForSpeech(text);
    if (!message || !speechAvailable) return false;
    stopCaptureLoop();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = options.lang || "it-IT";
    utterance.rate = options.rate ?? 1;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1;
    const italianVoice = (window.speechSynthesis.getVoices?.() || []).find(v => /^it(?:-|$)/i.test(v.lang));
    if (italianVoice) utterance.voice = italianVoice;
    state.speaking = true;
    setOrbState();
    utterance.onstart = () => emit("speaking", { active: true });
    utterance.onend = utterance.onerror = () => {
      state.speaking = false;
      setOrbState();
      emit("speaking", { active: false });
      if (state.enabled) startCaptureLoop();
    };
    window.speechSynthesis.speak(utterance);
    return true;
  }

  function clearPendingWake() {
    if (state.pendingWakeTimer) clearTimeout(state.pendingWakeTimer);
    state.pendingWakeTimer = null;
    state.pendingWakeAt = 0;
    state.pendingWakeLead = false;
  }

  function parseWakePrefix(value) {
    const words = normalize(value).split(" ").filter(Boolean);
    if (!words.length) return { matched: false, remainder: "" };
    const greetings = new Set(["ehi", "ei", "hey", "hei", "e"]);
    const nameIndex = greetings.has(words[0]) ? 1 : 0;
    const candidate = words[nameIndex] || "";
    const aliases = new Set(["enclave", "encalve", "enclav", "enclabe", "enclaves"]);
    const matched = aliases.has(candidate);
    return { matched, remainder: words.slice(nameIndex + 1).join(" ") };
  }

  function armWakePrompt() {
    clearPendingWake();
    state.pendingWakeAt = Date.now();
    state.pendingWakeTimer = setTimeout(() => {
      state.pendingWakeTimer = null;
      state.pendingWakeAt = 0;
      if (state.enabled && !state.busy && !state.speaking) speak("Ti ascolto.");
    }, 1300);
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
      document.getElementById("enclaveAIQuickButton")?.click(); return true;
    }
    if (/^(cerca|apri) (un )?(utente|utenti|contatto|contatti)$/.test(value)) return route("search");
    const search = value.match(/^(cerca|trova) (.+)$/);
    if (search) {
      route("search");
      setTimeout(() => {
        const input = document.getElementById("chatSearch");
        if (input) { input.value = search[2].toUpperCase(); input.dispatchEvent(new Event("input", { bubbles: true })); }
      }, 160);
      return true;
    }
    if (/^(torna alla bolla|mostra la bolla|torna al menu)$/.test(value)) {
      document.getElementById("enclaveAIClose")?.click();
      document.getElementById("futureReturnButton")?.click(); return true;
    }
    if (/^(aiuto|cosa puoi fare|comandi vocali)$/.test(value)) {
      speak("Dopo aver detto Ehi Enclave, puoi chiedermi di aprire chat, impostazioni o ricerca utenti, oppure di ripetere l'ultima risposta."); return true;
    }
    if (/^(ripeti|ripeti risposta|leggi ultima risposta)$/.test(value) && state.lastAIAnswer) {
      speak(state.lastAIAnswer); return true;
    }
    if (/^(non parlare|silenzio|muto)$/.test(value)) {
      window.speechSynthesis.cancel(); state.speaking = false; setOrbState(); startCaptureLoop(); return true;
    }
    return false;
  }

  async function processTranscript(raw) {
    const transcript = String(raw || "").trim();
    if (!transcript || !state.enabled || state.busy) return;
    const normalized = normalize(transcript);
    if (!normalized) return;
    state.lastTranscript = transcript;
    emit("transcript", { transcript, normalized, source: "groq-whisper" });

    if (STOP.test(normalized)) { stopVoice("spoken-stop"); return; }

    if (/^(?:ehi|ei|hey|hei|e)$/.test(normalized)) {
      state.pendingWakeLead = true;
      state.pendingWakeAt = Date.now();
      clearTimeout(state.pendingWakeTimer);
      state.pendingWakeTimer = setTimeout(() => {
        state.pendingWakeTimer = null;
        if (!state.enabled || state.busy || state.speaking) return;
        state.pendingWakeLead = false;
        state.pendingWakeAt = 0;
        speak("Ti ascolto.");
      }, 2200);
      return;
    }

    let wakeInput = normalized;
    if (state.pendingWakeLead && Date.now() - state.pendingWakeAt < 4500) {
      wakeInput = `ehi ${normalized}`;
      clearPendingWake();
    }
    const wake = parseWakePrefix(wakeInput);
    if (wake.matched) {
      state.inConversation = true;
      if (wake.remainder) {
        if (runLocalCommand(wake.remainder)) return;
        await sendToAI(wake.remainder);
      } else armWakePrompt();
      return;
    }

    // Strict gate: outside an activated conversation, never forward ambient speech.
    if (!state.inConversation) return;
    if (runLocalCommand(transcript)) return;
    await sendToAI(transcript);
  }

  async function sendToAI(text) {
    const message = String(text || "").trim();
    if (!message || state.busy || !state.enabled) return false;
    state.busy = true;
    stopCaptureLoop();
    emit("thinking", { active: true, stage: "answer" });
    try {
      if (!window.EnclaveAI?.askFromVoice) throw new Error("Motore EnclaveAI non disponibile.");
      const answer = await window.EnclaveAI.askFromVoice(message);
      if (!state.enabled) return false;
      if (!answer) throw new Error("EnclaveAI non ha restituito una risposta.");
      state.lastAIAnswer = answer;
      emit("answer", { answer });
      return speak(answer);
    } catch (error) {
      console.error("Enclave Voice → EnclaveAI:", error);
      state.lastError = error?.message || "ai-send-failed";
      emit("error", { error: state.lastError, stage: "answer" });
      if (state.enabled) speak(error?.message?.includes("accedere")
        ? "Devi accedere a Enclave con un account verificato per usare EnclaveAI."
        : "Non riesco a raggiungere EnclaveAI in questo momento. Riprova tra poco.");
      return false;
    } finally {
      state.busy = false;
      emit("thinking", { active: false, stage: "answer" });
      if (state.enabled && !state.speaking) startCaptureLoop();
    }
  }

  async function transcribe(blob, mimeType) {
    if (!window.EnclaveAI?.transcribeFromVoice) throw new Error("Servizio di trascrizione non disponibile.");
    const extension = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : mimeType.includes("wav") ? "wav" : "webm";
    return window.EnclaveAI.transcribeFromVoice(blob, `enclave-voice.${extension}`);
  }

  async function handleRecordedAudio(blob, mimeType, duration) {
    if (!state.enabled || !blob || blob.size < 1200 || duration < MIN_UTTERANCE_MS) return;
    state.busy = true;
    state.listening = false;
    setOrbState();
    emit("thinking", { active: true, stage: "transcription" });
    try {
      const transcript = await transcribe(blob, mimeType);
      if (!state.enabled) return;
      state.busy = false;
      if (transcript) await processTranscript(transcript);
    } catch (error) {
      console.error("Enclave Voice transcription:", error);
      state.lastError = error?.message || "transcription-failed";
      emit("error", { error: state.lastError, stage: "transcription" });
      if (state.enabled) speak("Non sono riuscito a capire l'audio. Riprova.");
    } finally {
      state.busy = false;
      emit("thinking", { active: false });
      if (state.enabled && !state.speaking) startCaptureLoop();
    }
  }

  function chooseMimeType() {
    if (!window.MediaRecorder) return "";
    const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    return candidates.find(type => MediaRecorder.isTypeSupported?.(type)) || "";
  }

  function beginRecording(now) {
    if (!state.stream || state.recorder || state.busy || state.speaking) return;
    try {
      const mimeType = chooseMimeType();
      const recorder = mimeType ? new MediaRecorder(state.stream, { mimeType }) : new MediaRecorder(state.stream);
      state.mimeType = recorder.mimeType || mimeType || "audio/webm";
      state.recorder = recorder;
      state.chunks = [];
      state.recordingStartedAt = now;
      state.speechStartedAt = now;
      state.silenceStartedAt = 0;
      recorder.ondataavailable = event => { if (event.data?.size) state.chunks.push(event.data); };
      recorder.onerror = event => {
        state.lastError = event.error?.message || "recorder-error";
        emit("error", { error: state.lastError, stage: "recording" });
      };
      recorder.onstop = () => {
        const chunks = state.chunks;
        const blob = new Blob(chunks, { type: state.mimeType });
        const duration = performance.now() - state.recordingStartedAt;
        state.chunks = [];
        state.recorder = null;
        if (state.enabled) handleRecordedAudio(blob, state.mimeType, duration);
      };
      recorder.start(250);
      setOrbState();
    } catch (error) {
      state.lastError = error?.message || "recorder-start-failed";
      emit("error", { error: state.lastError, stage: "recording-start" });
      throw error;
    }
  }

  function finishRecording() {
    const recorder = state.recorder;
    if (!recorder || recorder.state === "inactive") return;
    try { recorder.stop(); } catch (error) { console.warn("MediaRecorder stop:", error); }
  }

  function captureFrame() {
    if (!state.enabled || !state.analyser || state.busy || state.speaking) return;
    const data = new Uint8Array(state.analyser.fftSize);
    state.analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const sample = (data[i] - 128) / 128;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / data.length);
    const now = performance.now();

    if (!state.recorder) {
      state.noiseFloor = state.noiseFloor * 0.96 + Math.min(rms, 0.04) * 0.04;
      const threshold = Math.max(0.014, state.noiseFloor * 2.8);
      if (rms > threshold) {
        if (!state.speechStartedAt) state.speechStartedAt = now;
        if (now - state.speechStartedAt >= 120) {
          try { beginRecording(now); } catch (_) { stopVoice("recording-error"); }
        }
      } else state.speechStartedAt = 0;
    } else {
      const threshold = Math.max(0.012, state.noiseFloor * 2.2);
      if (rms < threshold) {
        if (!state.silenceStartedAt) state.silenceStartedAt = now;
        if (now - state.silenceStartedAt >= SILENCE_MS) finishRecording();
      } else state.silenceStartedAt = 0;
      if (now - state.recordingStartedAt >= MAX_UTTERANCE_MS) finishRecording();
    }
    state.raf = requestAnimationFrame(captureFrame);
  }

  function startCaptureLoop() {
    if (!state.enabled || state.busy || state.speaking || !state.stream || !state.analyser || state.raf) return;
    state.listening = true;
    state.speechStartedAt = 0;
    setOrbState();
    emit("listening", { active: true });
    state.raf = requestAnimationFrame(captureFrame);
  }

  async function startVoice() {
    if (state.enabled) return true;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !AudioContextClass || !speechAvailable) {
      hub.classList.add("voice-unavailable-pulse");
      setTimeout(() => hub.classList.remove("voice-unavailable-pulse"), 550);
      const reason = !window.isSecureContext ? "insecure-context" : !navigator.mediaDevices?.getUserMedia ? "microphone-api-unavailable" : !window.MediaRecorder ? "media-recorder-unavailable" : !AudioContextClass ? "audio-context-unavailable" : "unsupported-speech-synthesis";
      emit("unavailable", { reason });
      return false;
    }

    // getUserMedia is invoked directly from the orb click to preserve iOS permission/user-gesture behavior.
    state.enabled = true;
    state.inConversation = false;
    state.lastError = "";
    setOrbState();
    try {
      const streamPromise = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      // Create/resume AudioContext inside the original orb gesture (important on iOS Safari).
      state.audioContext = new AudioContextClass();
      const resumePromise = state.audioContext.state === "suspended" ? state.audioContext.resume() : Promise.resolve();
      state.stream = await streamPromise;
      await resumePromise;
      if (!state.enabled) { releaseMicrophone(); return false; }
      state.source = state.audioContext.createMediaStreamSource(state.stream);
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 2048;
      state.analyser.smoothingTimeConstant = 0.15;
      state.source.connect(state.analyser);
      startCaptureLoop();
      emit("started", { capabilities: { mediaRecorder: true, transcription: true, speechSynthesis: true, mimeType: chooseMimeType() || "browser-default" } });
      return true;
    } catch (error) {
      console.error("Enclave Voice microphone:", error);
      state.lastError = error?.name || "microphone-error";
      state.enabled = false;
      releaseMicrophone();
      setOrbState();
      emit("error", { error: state.lastError, stage: "microphone-permission" });
      speak(error?.name === "NotAllowedError" ? "Consenti a Enclave di utilizzare il microfono nelle impostazioni del browser." : "Non riesco ad avviare il microfono. Controlla che sia disponibile e riprova.");
      return false;
    }
  }

  function stopVoice(reason = "manual") {
    state.enabled = false;
    state.inConversation = false;
    state.busy = false;
    clearPendingWake();
    if (speechAvailable) window.speechSynthesis.cancel();
    state.speaking = false;
    releaseMicrophone();
    setOrbState();
    emit("stopped", { reason });
  }

  function toggleVoice() { if (state.enabled) stopVoice("toggle"); else startVoice(); }

  if (orbButton) orbButton.addEventListener("click", toggleVoice);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.enabled) stopVoice("page-hidden");
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
      return { mediaRecorder: !!window.MediaRecorder, transcription: !!window.EnclaveAI?.transcribeFromVoice, speechSynthesis: speechAvailable, secureContext: !!window.isSecureContext };
    }
  });
})();
