/* ENCLAVE VOICE — browser capability layer. Explicit activation only. */
(() => {
  "use strict";
  const button = document.getElementById("futureVoiceButton");
  const status = document.getElementById("futureVoiceStatus");
  if (!button || !status) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let lastTranscript = "";

  const setStatus = (message, state = "ready") => {
    status.textContent = message;
    button.classList.toggle("is-listening", state === "listening");
    button.setAttribute("aria-pressed", String(state === "listening"));
    button.dataset.voiceState = state;
  };

  function speak(text, options = {}) {
    if (!text || !("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = options.lang || "it-IT";
    utterance.rate = options.rate || 1;
    utterance.pitch = options.pitch || 1;
    const hub = document.getElementById("futureHub");
    utterance.onstart = () => {
      hub?.classList.add("is-speaking");
      document.dispatchEvent(new CustomEvent("enclave:voice-speaking", { detail: { text: String(text), active: true } }));
    };
    utterance.onend = utterance.onerror = () => {
      hub?.classList.remove("is-speaking");
      document.dispatchEvent(new CustomEvent("enclave:voice-speaking", { detail: { text: String(text), active: false } }));
    };
    window.speechSynthesis.speak(utterance);
    return true;
  }

  function dispatchTranscript(text) {
    const transcript = String(text || "").trim();
    if (!transcript) return;
    lastTranscript = transcript;
    document.dispatchEvent(new CustomEvent("enclave:voice-transcript", { detail: { transcript, source: "speech-recognition" } }));
    const normalized = transcript.toLocaleLowerCase("it-IT").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.!?]/g, "").trim();
    const routes = [
      { match: /^(apri|vai a|mostra) (la )?(chat|chat|conversazioni|conversazione)$/, target: "chat" },
      { match: /^(apri|vai a|mostra) (le )?impostazioni( avanzate)?$/, target: "settings" },
      { match: /^(apri|vai a) enclave ?ai$/, target: "ai" },
      { match: /^(cerca|apri) (un )?(utente|utenti|contatto|contatti)$/, target: "search" }
    ];
    const route = routes.find(item => item.match.test(normalized));
    if (route) {
      const branch = document.querySelector(`#futureHub [data-target="${route.target}"]`);
      if (branch) {
        setStatus("COMANDO RICONOSCIUTO", "ready");
        branch.click();
        return;
      }
    }
    if (/^(ehi )?enclave$/.test(normalized)) {
      setStatus("ECCOMI · DIMMI PURE", "ready");
      speak("Eccomi. Dimmi pure.");
      return;
    }
    setStatus("VOCE RICEVUTA · IN ATTESA DI IA", "ready");
  }

  function stopListening() {
    if (recognition && listening) {
      try { recognition.stop(); } catch (_) {}
    }
    listening = false;
    setStatus("ENCLAVE VOICE · PRONTA", "ready");
  }

  function startListening() {
    if (!SpeechRecognition) {
      setStatus("RICONOSCIMENTO NON SUPPORTATO IN QUESTO BROWSER", "unsupported");
      return;
    }
    if (!window.isSecureContext) {
      setStatus("MICROFONO DISPONIBILE SOLO IN CONNESSIONE SICURA", "unsupported");
      return;
    }
    if (listening) { stopListening(); return; }
    try {
      recognition = new SpeechRecognition();
      recognition.lang = "it-IT";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => { listening = true; setStatus("TI ASCOLTO…", "listening"); };
      recognition.onresult = event => dispatchTranscript(event.results?.[0]?.[0]?.transcript || "");
      recognition.onerror = event => {
        listening = false;
        const message = event.error === "not-allowed" ? "PERMESSO MICROFONO NEGATO" : event.error === "no-speech" ? "NESSUNA VOCE RILEVATA" : "ERRORE DI RICONOSCIMENTO VOCALE";
        setStatus(message, "error");
      };
      recognition.onend = () => { listening = false; button.classList.remove("is-listening"); button.setAttribute("aria-pressed", "false"); if (button.dataset.voiceState === "listening") setStatus("ENCLAVE VOICE · PRONTA", "ready"); };
      recognition.start();
    } catch (error) {
      listening = false;
      setStatus("IMPOSSIBILE AVVIARE IL MICROFONO", "error");
      console.warn("Enclave Voice recognition:", error);
    }
  }

  button.addEventListener("click", startListening);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopListening(); });
  document.addEventListener("enclave:future-mode-change", event => { if (!event.detail?.enabled) stopListening(); });

  window.EnclaveVoice = Object.freeze({
    speak,
    stopListening,
    get isListening() { return listening; },
    get lastTranscript() { return lastTranscript; },
    get capabilities() { return { speechRecognition: !!SpeechRecognition, speechSynthesis: "speechSynthesis" in window, secureContext: !!window.isSecureContext }; }
  });
  setStatus(SpeechRecognition ? "ENCLAVE VOICE · PRONTA" : "RICONOSCIMENTO VOCALE NON DISPONIBILE", SpeechRecognition ? "ready" : "unsupported");
})();
