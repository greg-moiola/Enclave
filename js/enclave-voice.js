/* ENCLAVE VOICE — discreet, user-initiated voice control for FUTURE. */
(() => {
  "use strict";
  const button = document.getElementById("futureVoiceButton");
  const hub = document.getElementById("futureHub");
  if (!button || !hub) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let lastTranscript = "";
  let lastSpoken = "";

  function setListening(value) {
    listening = !!value;
    hub.classList.toggle("is-listening", listening);
    button.setAttribute("aria-pressed", String(listening));
  }

  function speak(text, options = {}) {
    if (!text || !("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = options.lang || "it-IT";
    utterance.rate = options.rate || 1;
    utterance.pitch = options.pitch || 1;
    utterance.onstart = () => {
      hub.classList.add("is-speaking");
      document.dispatchEvent(new CustomEvent("enclave:voice-speaking", { detail: { active: true } }));
    };
    utterance.onend = utterance.onerror = () => {
      hub.classList.remove("is-speaking");
      document.dispatchEvent(new CustomEvent("enclave:voice-speaking", { detail: { active: false } }));
    };
    lastSpoken = String(text);
    window.speechSynthesis.speak(utterance);
    return true;
  }

  function normalize(text) {
    return String(text || "").toLocaleLowerCase("it-IT").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[.,!?;:]/g, " ").replace(/\s+/g, " ").trim();
  }

  function route(target) {
    const branch = hub.querySelector(`[data-target="${target}"]`);
    if (branch) { branch.click(); return true; }
    return false;
  }

  function executeCommand(transcript) {
    const value = normalize(transcript);
    if (/^(apri|vai a|mostra) (la )?(chat|conversazioni|conversazione)$/.test(value)) return route("chat");
    if (/^(apri|vai a|mostra) (le )?impostazioni( avanzate)?$/.test(value)) return route("settings");
    if (/^(apri|vai a) enclave ?ai$/.test(value)) return route("ai");
    if (/^(cerca|apri) (un )?(utente|utenti|contatto|contatti)$/.test(value)) return route("search");
    const search = value.match(/^(cerca|trova) (.+)$/);
    if (search) {
      route("search");
      window.setTimeout(() => {
        const input = document.getElementById("chatSearch");
        if (!input) return;
        input.value = search[2].toUpperCase();
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, 120);
      return true;
    }
    if (/^(ferma|stop|annulla ascolto)$/.test(value)) { stopListening(); return true; }
    if (/^(ripeti|ripeti risposta)$/.test(value) && lastSpoken) return speak(lastSpoken);
    return false;
  }

  function stopListening() {
    if (recognition && listening) {
      try { recognition.stop(); } catch (_) {}
    }
    setListening(false);
  }

  function startListening() {
    if (!SpeechRecognition || !window.isSecureContext) {
      hub.classList.add("voice-unavailable-pulse");
      window.setTimeout(() => hub.classList.remove("voice-unavailable-pulse"), 500);
      document.dispatchEvent(new CustomEvent("enclave:voice-unavailable", {
        detail: { reason: !window.isSecureContext ? "insecure-context" : "unsupported-browser" }
      }));
      return;
    }
    if (listening) { stopListening(); return; }
    try {
      recognition = new SpeechRecognition();
      recognition.lang = "it-IT";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;
      recognition.onstart = () => setListening(true);
      recognition.onresult = event => {
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        if (!transcript.trim()) return;
        lastTranscript = transcript.trim();
        document.dispatchEvent(new CustomEvent("enclave:voice-transcript", {
          detail: { transcript: lastTranscript, source: "speech-recognition" }
        }));
        executeCommand(lastTranscript);
      };
      recognition.onerror = event => {
        setListening(false);
        document.dispatchEvent(new CustomEvent("enclave:voice-error", { detail: { error: event.error } }));
      };
      recognition.onend = () => setListening(false);
      recognition.start();
    } catch (error) {
      setListening(false);
      console.warn("Enclave Voice:", error);
      document.dispatchEvent(new CustomEvent("enclave:voice-error", { detail: { error: error?.name || "start-failed" } }));
    }
  }

  button.addEventListener("click", startListening);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopListening(); });
  document.addEventListener("enclave:future-mode-change", event => { if (!event.detail?.enabled) stopListening(); });
  document.addEventListener("enclave:voice-stop", stopListening);

  window.EnclaveVoice = Object.freeze({
    speak,
    stopListening,
    startListening,
    get isListening() { return listening; },
    get lastTranscript() { return lastTranscript; },
    get capabilities() {
      return { speechRecognition: !!SpeechRecognition, speechSynthesis: "speechSynthesis" in window, secureContext: !!window.isSecureContext };
    }
  });
})();
