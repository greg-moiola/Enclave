/*
 * ENCLAVE VOICE — cross-browser audio capture and authenticated transcription.
 * The orb is the only entry point. Audio is transcribed by the Enclave Worker;
 * every utterance captured after explicit activation is transcribed and sent to EnclaveAI.
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
    lastError: "",
    speechPrimed: false,
    speechStartTimer: null,
    ttsSource: null,
    speechRequestId: 0
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

  // Temporary on-device diagnostics: lets us see exactly where iPhone stops.
  // No audio is stored or displayed; only phase, byte count, duration and transcript.
  let diagnosticPanel = null;
  let diagnosticTitle = null;
  let diagnosticDetail = null;

  function ensureDiagnosticPanel() {
    if (diagnosticPanel) return;
    diagnosticPanel = document.createElement("div");
    diagnosticPanel.id = "enclaveVoiceDiagnostic";
    diagnosticPanel.setAttribute("role", "status");
    diagnosticPanel.setAttribute("aria-live", "polite");
    diagnosticPanel.style.cssText = [
      "position:fixed", "left:12px", "right:12px",
      "bottom:calc(env(safe-area-inset-bottom, 0px) + 12px)",
      "z-index:2147483646", "display:none", "padding:11px 13px",
      "border:1px solid rgba(255,255,255,.2)", "border-radius:12px",
      "background:rgba(12,18,25,.94)", "color:#fff",
      "font:13px/1.4 -apple-system,BlinkMacSystemFont, sans-serif",
      "box-shadow:0 5px 24px rgba(0,0,0,.28)", "pointer-events:none",
      "overflow-wrap:anywhere"
    ].join(";");
    diagnosticTitle = document.createElement("div");
    diagnosticTitle.style.cssText = "font-weight:700;margin-bottom:3px";
    diagnosticDetail = document.createElement("div");
    diagnosticDetail.style.cssText = "opacity:.88;white-space:pre-wrap";
    diagnosticPanel.append(diagnosticTitle, diagnosticDetail);
    document.body.appendChild(diagnosticPanel);
  }

  function diagnostic(stage, detail = "") {
    ensureDiagnosticPanel();
    diagnosticTitle.textContent = `Enclave Voice · ${stage}`;
    diagnosticDetail.textContent = String(detail || "");
    diagnosticPanel.style.display = state.enabled ? "block" : "none";
    emit("diagnostic", { stage, detail: String(detail || "") });
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

  // iOS Safari may reject speech synthesis started after an asynchronous
  // network request unless the speech engine was first activated by a tap.
  // Prime it synchronously from the user's orb tap, with a muted short utterance.
  function primeSpeechSynthesisFromGesture() {
    if (!speechAvailable) return;
    try {
      const synth = window.speechSynthesis;
      const primer = new SpeechSynthesisUtterance("Enclave.");
      primer.lang = "it-IT";
      primer.volume = 0;
      primer.rate = 1;
      primer.onstart = () => {
        state.speechPrimed = true;
        diagnostic("Voce di sistema sbloccata", "Motore vocale pronto.");
      };
      primer.onerror = event => {
        diagnostic("Sblocco voce non riuscito", event?.error || "speech-primer-error");
      };
      synth.cancel();
      synth.resume?.();
      synth.speak(primer);
      // Do not cancel the primer immediately: WebKit needs to start it
      // while the original tap activation is still valid.
    } catch (error) {
      diagnostic("Errore inizializzazione voce", error?.message || error);
    }
  }

  async function speak(text, options = {}) {
    const message = cleanForSpeech(text);
    if (!message) return false;

    // ElevenLabs audio is generated by the isolated Voice Worker and decoded
    // through the AudioContext unlocked by the user's orb tap. This avoids
    // iOS Safari's unreliable speechSynthesis queue after asynchronous fetches.
    if (state.enabled && state.audioContext && window.EnclaveAI?.speakFromVoice) {
      stopCaptureLoop();
      if (state.ttsSource) {
        try { state.ttsSource.stop(); } catch (_) {}
        state.ttsSource = null;
      }
      const requestId = ++state.speechRequestId;
      state.speaking = true;
      setOrbState();
      diagnostic("Generazione voce Enclave", "Preparazione della risposta audio…");
      try {
        const audioData = await window.EnclaveAI.speakFromVoice(message);
        if (!state.enabled || requestId !== state.speechRequestId) return false;

        const context = state.audioContext;
        if (!context) throw new Error("AudioContext non disponibile.");
        if (context.state === "suspended") await context.resume();
        const audioBuffer = await context.decodeAudioData(audioData.slice(0));
        if (!state.enabled || requestId !== state.speechRequestId) return false;

        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        state.ttsSource = source;
        source.onended = () => {
          if (state.ttsSource !== source) return;
          state.ttsSource = null;
          state.speaking = false;
          diagnostic("Risposta pronunciata", "Puoi parlare di nuovo.");
          setOrbState();
          emit("speaking", { active: false });
          if (state.enabled) startCaptureLoop();
        };
        diagnostic("Voce avviata", "Riproduzione ElevenLabs in corso.");
        emit("speaking", { active: true, provider: "elevenlabs" });
        source.start(0);
        return true;
      } catch (error) {
        if (!state.enabled || requestId !== state.speechRequestId) return false;
        console.error("Enclave Voice TTS:", error);
        state.lastError = error?.message || "elevenlabs-tts-failed";
        state.speaking = false;
        state.ttsSource = null;
        setOrbState();
        diagnostic("Sintesi ElevenLabs non disponibile", `${state.lastError} · Provo la voce del dispositivo.`);
        // Keep a fallback for local prompts and temporary provider outages.
        return speakWithBrowser(message, options);
      }
    }

    return speakWithBrowser(message, options);
  }

  function speakWithBrowser(text, options = {}) {
    const message = cleanForSpeech(text);
    if (!message || !speechAvailable) {
      diagnostic("Voce non disponibile", "Speech Synthesis non supportato o testo vuoto.");
      return false;
    }
    stopCaptureLoop();
    const synth = window.speechSynthesis;
    try {
      // Avoid cancel() on every response: on iOS Safari it can leave the
      // synthesis queue stalled. Cancel only a genuinely active old utterance.
      if (state.speaking || synth.speaking || synth.pending) synth.cancel();
      synth.resume?.();
    } catch (_) {}

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = options.lang || "it-IT";
    utterance.rate = options.rate ?? 0.96;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1;
    const voices = synth.getVoices?.() || [];
    const italianVoice = voices.find(v => /^it(?:-|$)/i.test(v.lang));
    if (italianVoice) utterance.voice = italianVoice;

    state.speaking = true;
    setOrbState();
    diagnostic("Riproduzione risposta in attesa", `${message.slice(0, 180)}\nVoci italiane disponibili: ${voices.filter(v => /^it(?:-|$)/i.test(v.lang)).length} · Motore sbloccato: ${state.speechPrimed ? "sì" : "non confermato"}`);

    let started = false;
    if (state.speechStartTimer) clearTimeout(state.speechStartTimer);
    state.speechStartTimer = setTimeout(() => {
      if (started || !state.speaking) return;
      state.speaking = false;
      state.lastError = "speech-start-timeout";
      diagnostic("ERRORE: iPhone non avvia la voce", "La risposta è arrivata, ma Safari non ha avviato la sintesi vocale. Riprova toccando l'orbita per riattivare la voce.");
      emit("error", { error: state.lastError, stage: "speech-synthesis-start" });
      setOrbState();
      if (state.enabled) startCaptureLoop();
    }, 5000);

    utterance.onstart = () => {
      started = true;
      if (state.speechStartTimer) clearTimeout(state.speechStartTimer);
      state.speechStartTimer = null;
      state.speechPrimed = true;
      diagnostic("Voce avviata", `Riproduzione in corso · ${italianVoice?.name || "voce italiana predefinita"}`);
      emit("speaking", { active: true });
    };
    utterance.onend = () => {
      if (state.speechStartTimer) clearTimeout(state.speechStartTimer);
      state.speechStartTimer = null;
      state.speaking = false;
      diagnostic("Risposta pronunciata", "Puoi parlare di nuovo.");
      setOrbState();
      emit("speaking", { active: false });
      if (state.enabled) startCaptureLoop();
    };
    utterance.onerror = event => {
      if (state.speechStartTimer) clearTimeout(state.speechStartTimer);
      state.speechStartTimer = null;
      state.speaking = false;
      state.lastError = event?.error || "speech-synthesis-error";
      diagnostic("Errore riproduzione voce", `${state.lastError} · ${event?.message || ""}`);
      emit("error", { error: state.lastError, stage: "speech-synthesis" });
      setOrbState();
      if (state.enabled) startCaptureLoop();
    };

    try {
      synth.resume?.();
      synth.speak(utterance);
      // A second resume helps with WebKit's suspended speech queue.
      setTimeout(() => {
        if (state.speaking && !started) synth.resume?.();
      }, 250);
    } catch (error) {
      if (state.speechStartTimer) clearTimeout(state.speechStartTimer);
      state.speechStartTimer = null;
      state.speaking = false;
      state.lastError = error?.message || "speech-synthesis-exception";
      diagnostic("Errore avvio sintesi vocale", state.lastError);
      setOrbState();
      if (state.enabled) startCaptureLoop();
      return false;
    }
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
    if (/^(aiuto|(?:che )?cosa puoi fare|comandi vocali)$/.test(value)) {
      speak("Puoi parlarmi direttamente, chiedermi informazioni oppure dirmi di aprire chat, impostazioni o ricerca utenti. Puoi anche chiedermi di ripetere l'ultima risposta."); return true;
    }
    if (/^(ripeti|ripeti risposta|leggi ultima risposta)$/.test(value) && state.lastAIAnswer) {
      speak(state.lastAIAnswer); return true;
    }
    if (/^(non parlare|silenzio|muto)$/.test(value)) {
      state.speechRequestId++;
      if (state.ttsSource) { try { state.ttsSource.stop(); } catch (_) {} }
      state.ttsSource = null;
      if (speechAvailable) window.speechSynthesis.cancel();
      state.speaking = false; setOrbState(); startCaptureLoop(); return true;
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

    // Voice is explicitly activated by the user from the central orb.
    // Therefore every recognized utterance is an intentional request: do not
    // silently discard it merely because the wake phrase was not recognized.
    state.inConversation = true;
    if (runLocalCommand(transcript)) return;
    await sendToAI(transcript);
  }

  async function sendToAI(text) {
    const message = String(text || "").trim();
    if (!message || state.busy || !state.enabled) return false;
    state.busy = true;
    stopCaptureLoop();
    emit("thinking", { active: true, stage: "answer" });
    diagnostic("Invio domanda a EnclaveAI", message.slice(0, 180));
    try {
      if (!window.EnclaveAI?.askFromVoice) throw new Error("Motore EnclaveAI non disponibile.");
      const answer = await window.EnclaveAI.askFromVoice(message);
      if (!state.enabled) return false;
      if (!answer) throw new Error("EnclaveAI non ha restituito una risposta.");
      state.lastAIAnswer = answer;
      diagnostic("Risposta IA ricevuta", answer.slice(0, 220));
      emit("answer", { answer });
      return speak(answer);
    } catch (error) {
      console.error("Enclave Voice → EnclaveAI:", error);
      state.lastError = error?.message || "ai-send-failed";
      diagnostic("ERRORE IA", state.lastError);
      emit("error", { error: state.lastError, stage: "answer" });
      if (state.enabled) speak(error?.message || "Non riesco a raggiungere Enclave Voice in questo momento. Riprova tra poco.");
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
    if (!state.enabled) return;
    if (!blob || blob.size < 256 || duration < MIN_UTTERANCE_MS) {
      state.lastError = `Registrazione audio non valida (dimensione: ${blob?.size || 0} byte; durata: ${Math.round(duration || 0)} ms).`;
      diagnostic("Registrazione non valida", state.lastError);
      emit("error", { error: state.lastError, stage: "recording-validation" });
      if (state.enabled) speak("Non ho ricevuto una registrazione audio valida. Riprova parlando un po' più a lungo.");
      return;
    }
    state.busy = true;
    state.listening = false;
    setOrbState();
    emit("thinking", { active: true, stage: "transcription" });
    diagnostic("Invio audio a Whisper", `${blob.size} byte · ${Math.round(duration)} ms · ${mimeType || "MIME sconosciuto"}`);
    try {
      const transcript = await transcribe(blob, mimeType);
      if (!state.enabled) return;
      state.busy = false;
      diagnostic("Trascrizione completata", transcript ? transcript.slice(0, 220) : "Whisper ha restituito testo vuoto.");
      if (transcript) await processTranscript(transcript);
    } catch (error) {
      console.error("Enclave Voice transcription:", error);
      state.lastError = error?.message || "transcription-failed";
      diagnostic("ERRORE TRASCRIZIONE", state.lastError);
      emit("error", { error: state.lastError, stage: "transcription" });
      if (state.enabled) speak(error?.message || "Non sono riuscito a trascrivere l'audio. Riprova.");
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
      diagnostic("Registrazione in corso", `MediaRecorder: ${state.mimeType}`);
      state.silenceStartedAt = 0;
      recorder.onstart = () => diagnostic("Registrazione avviata", `Formato: ${state.mimeType}`);
      recorder.ondataavailable = event => {
        if (event.data?.size) {
          state.chunks.push(event.data);
          emit("recording-data", { chunkBytes: event.data.size, chunks: state.chunks.length });
        }
      };
      recorder.onerror = event => {
        state.lastError = event.error?.message || "recorder-error";
        diagnostic("ERRORE REGISTRATORE", state.lastError);
        emit("error", { error: state.lastError, stage: "recording" });
      };
      recorder.onstop = () => {
        const chunks = state.chunks;
        const blob = new Blob(chunks, { type: state.mimeType });
        const duration = performance.now() - state.recordingStartedAt;
        state.chunks = [];
        state.recorder = null;
        diagnostic("Registrazione conclusa", `${blob.size} byte · ${Math.round(duration)} ms · ${state.mimeType}`);
        if (state.enabled) handleRecordedAudio(blob, state.mimeType, duration);
      };
      recorder.start(250);
      setOrbState();
    } catch (error) {
      state.lastError = error?.message || "recorder-start-failed";
      diagnostic("ERRORE AVVIO REGISTRAZIONE", state.lastError);
      emit("error", { error: state.lastError, stage: "recording-start" });
      throw error;
    }
  }

  function finishRecording() {
    const recorder = state.recorder;
    if (!recorder || recorder.state === "inactive") return;
    diagnostic("Chiusura registrazione", "Attendo i dati finali del microfono…");
    try {
      recorder.stop();
      setTimeout(() => {
        if (state.enabled && state.recorder === recorder && recorder.state === "inactive") {
          diagnostic("Registratore bloccato", "Il browser ha chiuso il microfono ma non ha completato l'evento finale della registrazione.");
        }
      }, 3000);
    } catch (error) {
      state.lastError = error?.message || "recorder-stop-failed";
      diagnostic("ERRORE CHIUSURA REGISTRAZIONE", state.lastError);
      console.warn("MediaRecorder stop:", error);
    }
  }

  function captureFrame() {
    // The callback currently being executed is no longer pending. Reset its
    // handle before every early return so startCaptureLoop() can restart it.
    state.raf = 0;
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
    diagnostic("In ascolto", "Parla normalmente. La registrazione termina dopo circa 1,15 secondi di silenzio.");
    emit("listening", { active: true });
    state.raf = requestAnimationFrame(captureFrame);
  }

  async function startVoice() {
    if (state.enabled) return true;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !AudioContextClass) {
      hub.classList.add("voice-unavailable-pulse");
      setTimeout(() => hub.classList.remove("voice-unavailable-pulse"), 550);
      const reason = !window.isSecureContext ? "insecure-context" : !navigator.mediaDevices?.getUserMedia ? "microphone-api-unavailable" : !window.MediaRecorder ? "media-recorder-unavailable" : "audio-context-unavailable";
      emit("unavailable", { reason });
      return false;
    }

    // Prime speech synthesis synchronously inside the orb click. iOS Safari
    // can block speech started only after the later async Whisper/Groq response.
    primeSpeechSynthesisFromGesture();

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
      diagnostic("Microfono attivo", `AudioContext: ${state.audioContext.state} · MediaRecorder: disponibile`);
      startCaptureLoop();
      emit("started", { capabilities: { mediaRecorder: true, transcription: true, speechSynthesis: speechAvailable, neuralTTS: !!window.EnclaveAI?.speakFromVoice, mimeType: chooseMimeType() || "browser-default" } });
      return true;
    } catch (error) {
      console.error("Enclave Voice microphone:", error);
      state.lastError = error?.name || "microphone-error";
      diagnostic("ERRORE MICROFONO", state.lastError);
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
    if (state.speechStartTimer) clearTimeout(state.speechStartTimer);
    state.speechStartTimer = null;
    state.speechRequestId++;
    if (state.ttsSource) { try { state.ttsSource.stop(); } catch (_) {} }
    state.ttsSource = null;
    if (speechAvailable) window.speechSynthesis.cancel();
    state.speaking = false;
    releaseMicrophone();
    if (diagnosticPanel) diagnosticPanel.style.display = "none";
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
      return { mediaRecorder: !!window.MediaRecorder, transcription: !!window.EnclaveAI?.transcribeFromVoice, speechSynthesis: speechAvailable, neuralTTS: !!window.EnclaveAI?.speakFromVoice, secureContext: !!window.isSecureContext };
    }
  });
})();
