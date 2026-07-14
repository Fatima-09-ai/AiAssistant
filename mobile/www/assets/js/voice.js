const AuraVoice = (() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;

  function isSupported() {
    return !!SpeechRecognition;
  }

  function startListening({ onResult, onEnd, onError }) {
    if (!isSupported()) {
      onError && onError("Speech recognition is not supported in this browser. Try Chrome.");
      return;
    }
    if (isListening) return;

    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult && onResult(transcript);
    };
    recognition.onerror = (event) => onError && onError(event.error);
    recognition.onend = () => {
      isListening = false;
      onEnd && onEnd();
    };

    recognition.start();
    isListening = true;
  }

  function stopListening() {
    if (recognition && isListening) recognition.stop();
  }

  function speak(text, { rate = 1, pitch = 1 } = {}) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel(); // stop any current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  return { isSupported, startListening, stopListening, speak, stopSpeaking };
})();
