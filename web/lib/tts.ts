/**
 * Talk-back — the app reads its own instructions aloud.
 *
 * This matters more than it looks. A large share of the people being screened
 * cannot read the screen, and the health worker's hands are on the patient,
 * not the phone. Web Speech is used because it is on-device on both Android
 * and iOS: no network, no per-request cost, no audio files to ship.
 *
 * Voice availability is the honest catch. A device with no Assamese voice will
 * either substitute a Hindi one or refuse; `voiceFor` reports what it actually
 * found so the UI can say "reading in Hindi" rather than silently lying about
 * the language.
 */

/** BCP-47 tags for the app's languages. Regional tags where a voice exists. */
const VOICE_TAG: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", as: "as-IN", bn: "bn-IN", pa: "pa-IN",
  ur: "ur-IN", mr: "mr-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN",
  or: "or-IN", ml: "ml-IN", ne: "ne-NP", sd: "sd-IN", ks: "ks-IN",
  kha: "en-IN", grt: "en-IN",
};

/** Languages we fall back through when the exact voice is missing. */
const FALLBACK: Record<string, string[]> = {
  as: ["bn-IN", "hi-IN", "en-IN"],
  kha: ["en-IN"], grt: ["en-IN"],
  ks: ["ur-IN", "hi-IN", "en-IN"],
  sd: ["hi-IN", "en-IN"],
  ne: ["hi-IN", "en-IN"],
};

export function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * The voice that will actually be used, and whether it is the intended one.
 *
 * `none` separates "this device has no voices at all" from "this device has
 * voices but not for Assamese" — the two need different things said to the
 * user, and conflating them produces the confusing "no voice for this
 * language, reading in en-IN" on a device that will not speak at all.
 */
export function voiceFor(lang: string): {
  voice: SpeechSynthesisVoice | null; tag: string; exact: boolean; none: boolean;
} {
  const want = VOICE_TAG[lang] ?? "en-IN";
  if (!speechSupported()) return { voice: null, tag: want, exact: false, none: true };
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return { voice: null, tag: want, exact: false, none: true };
  const byTag = (t: string) =>
    voices.find((v) => v.lang.replace("_", "-").toLowerCase() === t.toLowerCase()) ??
    voices.find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(t.split("-")[0]));

  const exactHit = byTag(want);
  if (exactHit) return { voice: exactHit, tag: want, exact: true, none: false };

  for (const alt of FALLBACK[lang] ?? ["en-IN"]) {
    const hit = byTag(alt);
    if (hit) return { voice: hit, tag: alt, exact: false, none: false };
  }
  return { voice: null, tag: want, exact: false, none: true };
}

export function cancelSpeech() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/**
 * Speak one line. Resolves when it finishes — so a caller can walk a script
 * line by line without guessing at durations.
 *
 * Rate is deliberately below normal: these are instructions being followed by
 * someone in motion, not prose being skimmed.
 */
export function speak(text: string, lang: string, rate = 0.88): Promise<void> {
  return new Promise((resolve) => {
    if (!speechSupported() || !text.trim()) { resolve(); return; }
    const { voice, tag } = voiceFor(lang);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = tag;
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = 1;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    u.onend = finish;
    u.onerror = finish;
    // Some engines drop `onend` on a cancelled utterance; a ceiling keeps the
    // caller's loop from stalling forever.
    setTimeout(finish, Math.max(2500, text.length * 130));
    window.speechSynthesis.speak(u);
  });
}

/**
 * Voice lists load asynchronously on most browsers. Call once on mount so the
 * first `voiceFor` is not answered from an empty list.
 */
export function warmVoices(onReady?: () => void) {
  if (!speechSupported()) return () => {};
  const s = window.speechSynthesis;
  if (s.getVoices().length) { onReady?.(); return () => {}; }
  const handler = () => onReady?.();
  s.addEventListener("voiceschanged", handler);
  return () => s.removeEventListener("voiceschanged", handler);
}
