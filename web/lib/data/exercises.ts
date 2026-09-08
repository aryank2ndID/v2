/**
 * USP 4 — visual guided exercises and pain-relief techniques.
 *
 * Three constraints shaped this file:
 *
 *  1. It must work offline. That rules out streamed video, so each movement is
 *     a looping figure drawn in SVG and animated in CSS (`ex-*` keyframes in
 *     globals.css). A few kilobytes, no network, and it never buffers.
 *  2. It must work for someone who cannot read. Every step is one short
 *     spoken line, and the talk-back script is the same text — so what is on
 *     screen and what is heard never drift apart.
 *  3. The prescription must follow the band. A "refer" knee should not be
 *     given the same loading as a "low" knee.
 *
 * The movements are the standard conservative-management set for knee OA
 * (quadriceps strengthening, range of motion, and the 30-second chair-stand
 * that the screening itself measures). Guidance, not prescription — the slip
 * still routes a flagged person to a clinician.
 */

export type Band = "low" | "watch" | "refer";
export type Figure = "knee" | "raise" | "stand" | "step";

export interface Exercise {
  id: string;
  /** Short enough to fit on one line on a 360 px phone. */
  name: Record<string, string>;
  figure: Figure;
  /** Which risk bands this movement is offered for. */
  bands: Band[];
  /** "3 × 10" or "5 × hold 5 s" — shown as a chip, never a sentence. */
  dose: string;
  /** Seconds the guided player spends per repetition. */
  tempo: number;
  reps: number;
  /** One line each. Spoken in order by talk-back. */
  steps: Record<string, string[]>;
  /** Why this movement, in one clause. */
  why: Record<string, string>;
  /** The mistake that makes it useless or unsafe. */
  caution: Record<string, string>;
}

export interface Relief {
  id: string;
  name: Record<string, string>;
  detail: Record<string, string>;
  icon: "warm" | "cold" | "load" | "shoe";
}

const EN = "en", HI = "hi", AS = "as", BN = "bn";

export const EXERCISES: Exercise[] = [
  {
    id: "quad-set",
    figure: "knee",
    bands: ["low", "watch", "refer"],
    dose: "3 × hold 5 s",
    tempo: 5,
    reps: 10,
    name: {
      [EN]: "Thigh squeeze",
      [HI]: "जांघ दबाएं",
      [AS]: "কাঁপ টিপক",
      [BN]: "উরু চাপুন",
    },
    steps: {
      [EN]: ["Sit with the leg straight out.", "Press the back of the knee down.", "Hold while you count to five.", "Let go slowly."],
      [HI]: ["पैर सीधा करके बैठें।", "घुटने के पीछे दबाएं।", "पाँच तक गिनते हुए रोकें।", "धीरे से छोड़ें।"],
      [AS]: ["ভৰি পোন কৰি বহক।", "আঁঠুৰ পিছফালে হেঁচা দিয়ক।", "পাঁচলৈ গণি ৰাখক।", "লাহে লাহে এৰি দিয়ক।"],
      [BN]: ["পা সোজা করে বসুন।", "হাঁটুর পিছনে চাপ দিন।", "পাঁচ পর্যন্ত গুনে ধরে রাখুন।", "ধীরে ছেড়ে দিন।"],
    },
    why: {
      [EN]: "Wakes up the thigh muscle that carries the knee.",
      [HI]: "घुटने को सहारा देने वाली मांसपेशी जगाता है।",
      [AS]: "আঁঠু ধৰি ৰখা মাংসপেশী সজাগ কৰে।",
      [BN]: "হাঁটু ধরে রাখা পেশি জাগায়।",
    },
    caution: {
      [EN]: "Keep breathing. Do not hold your breath.",
      [HI]: "साँस लेते रहें, रोकें नहीं।",
      [AS]: "উশাহ লৈ থাকক, বন্ধ নকৰিব।",
      [BN]: "শ্বাস নিতে থাকুন, আটকাবেন না।",
    },
  },
  {
    id: "leg-raise",
    figure: "raise",
    bands: ["low", "watch"],
    dose: "2 × 10",
    tempo: 4,
    reps: 10,
    name: {
      [EN]: "Straight leg raise",
      [HI]: "सीधा पैर उठाएं",
      [AS]: "পোন ভৰি দাঙক",
      [BN]: "সোজা পা তুলুন",
    },
    steps: {
      [EN]: ["Lie down, one knee bent.", "Keep the other leg straight.", "Lift it a hand's height.", "Lower it slowly."],
      [HI]: ["लेट जाएं, एक घुटना मोड़ें।", "दूसरा पैर सीधा रखें।", "एक हाथ जितना ऊपर उठाएं।", "धीरे नीचे लाएं।"],
      [AS]: ["শুই পৰক, এখন আঁঠু ভাঁজ কৰক।", "আনখন ভৰি পোন ৰাখক।", "এখন হাতৰ সমান দাঙক।", "লাহে লাহে নমাওক।"],
      [BN]: ["শুয়ে পড়ুন, এক হাঁটু ভাঁজ করুন।", "অন্য পা সোজা রাখুন।", "এক হাত উঁচু তুলুন।", "ধীরে নামান।"],
    },
    why: {
      [EN]: "Builds strength without bending the sore joint.",
      [HI]: "दर्द वाले जोड़ को मोड़े बिना ताकत बढ़ाता है।",
      [AS]: "বিষ থকা গাঁঠি নভাঁজিয়েই শক্তি বঢ়ায়।",
      [BN]: "ব্যথার জয়েন্ট না ভাঁজ করেই শক্তি বাড়ায়।",
    },
    caution: {
      [EN]: "Stop if the back hurts.",
      [HI]: "कमर में दर्द हो तो रुकें।",
      [AS]: "পিঠিত বিষ হ'লে বন্ধ কৰক।",
      [BN]: "পিঠে ব্যথা হলে থামুন।",
    },
  },
  {
    id: "heel-slide",
    figure: "knee",
    bands: ["watch", "refer"],
    dose: "2 × 10",
    tempo: 6,
    reps: 10,
    name: {
      [EN]: "Heel slide",
      [HI]: "एड़ी सरकाएं",
      [AS]: "গোৰোহা খিচক",
      [BN]: "গোড়ালি সরান",
    },
    steps: {
      [EN]: ["Lie down, legs straight.", "Slide one heel toward you.", "Go only as far as is comfortable.", "Slide it back out."],
      [HI]: ["लेट जाएं, पैर सीधे।", "एक एड़ी अपनी ओर सरकाएं।", "जितना आराम से हो उतना ही।", "वापस सीधा करें।"],
      [AS]: ["শুই পৰক, ভৰি পোন।", "এখন গোৰোহা নিজৰ ফালে আনক।", "যিমান আৰামত হয় সিমানেই।", "পুনৰ পোন কৰক।"],
      [BN]: ["শুয়ে পড়ুন, পা সোজা।", "এক গোড়ালি নিজের দিকে আনুন।", "যতটা আরামে হয় ততটাই।", "আবার সোজা করুন।"],
    },
    why: {
      [EN]: "Keeps the bend in the knee from being lost.",
      [HI]: "घुटने का मुड़ना बना रहता है।",
      [AS]: "আঁঠু ভাঁজ হোৱাটো ৰক্ষা কৰে।",
      [BN]: "হাঁটুর ভাঁজ ধরে রাখে।",
    },
    caution: {
      [EN]: "Never force past pain.",
      [HI]: "दर्द से आगे ज़ोर न लगाएं।",
      [AS]: "বিষৰ সীমা পাৰ নকৰিব।",
      [BN]: "ব্যথার সীমা পার করবেন না।",
    },
  },
  {
    id: "chair-stand",
    figure: "stand",
    bands: ["low", "watch", "refer"],
    dose: "3 × 5",
    tempo: 5,
    reps: 5,
    name: {
      [EN]: "Chair stand",
      [HI]: "कुर्सी से उठें",
      [AS]: "চকীৰ পৰা উঠক",
      [BN]: "চেয়ার থেকে উঠুন",
    },
    steps: {
      [EN]: ["Sit at the front of a firm chair.", "Lean forward a little.", "Stand up without using hands.", "Sit down slowly."],
      [HI]: ["मजबूत कुर्सी के किनारे बैठें।", "थोड़ा आगे झुकें।", "हाथ के बिना खड़े हों।", "धीरे से बैठें।"],
      [AS]: ["শকত চকীৰ আগত বহক।", "অলপ আগলৈ হাওক।", "হাত নলগাই থিয় হওক।", "লাহে লাহে বহক।"],
      [BN]: ["শক্ত চেয়ারের সামনে বসুন।", "একটু সামনে ঝুঁকুন।", "হাত ছাড়া দাঁড়ান।", "ধীরে বসুন।"],
    },
    why: {
      [EN]: "The same movement the screening measures — progress is visible.",
      [HI]: "यही जांच में मापा जाता है — सुधार दिखता है।",
      [AS]: "স্ক্ৰীনিঙে ইয়াকেই জোখে — উন্নতি দেখা যায়।",
      [BN]: "স্ক্রিনিং এটাই মাপে — উন্নতি দেখা যায়।",
    },
    caution: {
      [EN]: "Keep the chair against a wall.",
      [HI]: "कुर्सी दीवार से टिकी रखें।",
      [AS]: "চকীখন বেৰত লগাই ৰাখক।",
      [BN]: "চেয়ার দেয়ালে ঠেকিয়ে রাখুন।",
    },
  },
  {
    id: "calf-raise",
    figure: "step",
    bands: ["low", "watch"],
    dose: "2 × 12",
    tempo: 3,
    reps: 12,
    name: {
      [EN]: "Heel rise",
      [HI]: "एड़ी उठाएं",
      [AS]: "গোৰোহা দাঙক",
      [BN]: "গোড়ালি তুলুন",
    },
    steps: {
      [EN]: ["Stand holding a chair back.", "Rise onto the toes.", "Hold for two counts.", "Lower with control."],
      [HI]: ["कुर्सी पकड़कर खड़े हों।", "पंजों पर उठें।", "दो गिनती रुकें।", "संभलकर नीचे आएं।"],
      [AS]: ["চকী ধৰি থিয় হওক।", "আঙুলিৰ ওপৰত উঠক।", "দুটা গণনালৈ ৰাখক।", "নিয়ন্ত্ৰণেৰে নমাওক।"],
      [BN]: ["চেয়ার ধরে দাঁড়ান।", "আঙুলের ওপর উঠুন।", "দুই গোনা ধরে রাখুন।", "নিয়ন্ত্রণে নামুন।"],
    },
    why: {
      [EN]: "Steadies the leg on slopes and uneven ground.",
      [HI]: "ढलान और ऊबड़-खाबड़ ज़मीन पर संतुलन देता है।",
      [AS]: "ঢাল আৰু বেয়া মাটিত ভাৰসাম্য দিয়ে।",
      [BN]: "ঢাল ও অসমান মাটিতে ভারসাম্য দেয়।",
    },
    caution: {
      [EN]: "Always hold something steady.",
      [HI]: "हमेशा किसी सहारे को पकड़ें।",
      [AS]: "সদায় কিবা এটা ধৰি ৰাখক।",
      [BN]: "সবসময় কিছু ধরে রাখুন।",
    },
  },
  {
    id: "mini-squat",
    figure: "stand",
    bands: ["low"],
    dose: "2 × 8",
    tempo: 4,
    reps: 8,
    name: {
      [EN]: "Wall slide",
      [HI]: "दीवार पर झुकें",
      [AS]: "বেৰত হেলনীয়া",
      [BN]: "দেয়ালে হেলান",
    },
    steps: {
      [EN]: ["Stand with your back on a wall.", "Slide down a little way.", "Stop before the knees pass the toes.", "Push back up."],
      [HI]: ["पीठ दीवार से लगाकर खड़े हों।", "थोड़ा नीचे सरकें।", "घुटने पंजों से आगे न जाएं।", "वापस ऊपर आएं।"],
      [AS]: ["পিঠি বেৰত লগাই থিয় হওক।", "অলপ তললৈ যাওক।", "আঁঠু আঙুলিৰ আগত নাযাওক।", "ওপৰলৈ উঠক।"],
      [BN]: ["পিঠ দেয়ালে রেখে দাঁড়ান।", "একটু নিচে নামুন।", "হাঁটু আঙুল ছাড়িয়ে যাবে না।", "উপরে উঠুন।"],
    },
    why: {
      [EN]: "Loads the thigh safely with the wall taking the weight.",
      [HI]: "दीवार सहारा देती है, जांघ पर सुरक्षित भार पड़ता है।",
      [AS]: "বেৰে ভাৰ লয়, কাঁপত নিৰাপদ চাপ পৰে।",
      [BN]: "দেয়াল ভার নেয়, উরুতে নিরাপদ চাপ পড়ে।",
    },
    caution: {
      [EN]: "Only for a low-risk knee. Stop if it clicks painfully.",
      [HI]: "केवल कम जोखिम वाले घुटने के लिए। दर्द के साथ आवाज़ आए तो रुकें।",
      [AS]: "কম ঝুঁকিৰ আঁঠুৰ বাবেহে। বিষেৰে শব্দ হ'লে বন্ধ কৰক।",
      [BN]: "শুধু কম ঝুঁকির হাঁটুর জন্য। ব্যথায় শব্দ হলে থামুন।",
    },
  },
];

export const RELIEF: Relief[] = [
  {
    id: "warm",
    icon: "warm",
    name: { [EN]: "Warm cloth before moving", [HI]: "चलने से पहले गर्म सेंक", [AS]: "লৰচৰৰ আগতে গৰম সেক", [BN]: "নড়ার আগে গরম সেঁক" },
    detail: {
      [EN]: "Ten minutes on the knee loosens it before exercise.",
      [HI]: "व्यायाम से पहले दस मिनट घुटने पर रखें।",
      [AS]: "ব্যায়ামৰ আগত দহ মিনিট আঁঠুত ৰাখক।",
      [BN]: "ব্যায়ামের আগে দশ মিনিট হাঁটুতে রাখুন।",
    },
  },
  {
    id: "cold",
    icon: "cold",
    name: { [EN]: "Cold pack after a long day", [HI]: "दिन भर बाद ठंडी सिकाई", [AS]: "দীঘলীয়া দিনৰ পিছত ঠাণ্ডা সেক", [BN]: "লম্বা দিনের পরে ঠান্ডা সেঁক" },
    detail: {
      [EN]: "Ten minutes wrapped in cloth settles swelling.",
      [HI]: "कपड़े में लपेटकर दस मिनट, सूजन कम होती है।",
      [AS]: "কাপোৰত মেৰিয়াই দহ মিনিট, ফুলা কমে।",
      [BN]: "কাপড়ে মুড়ে দশ মিনিট, ফোলা কমে।",
    },
  },
  {
    id: "load",
    icon: "load",
    name: { [EN]: "Split the load", [HI]: "बोझ बाँटें", [AS]: "ভাৰ ভাগ কৰক", [BN]: "ভার ভাগ করুন" },
    detail: {
      [EN]: "Two smaller trips beat one heavy one on a slope.",
      [HI]: "ढलान पर एक भारी से दो हल्के फेरे बेहतर हैं।",
      [AS]: "ঢালত এবাৰ গধুৰতকৈ দুবাৰ পাতল ভাল।",
      [BN]: "ঢালে একবার ভারীর চেয়ে দুবার হালকা ভালো।",
    },
  },
  {
    id: "shoe",
    icon: "shoe",
    name: { [EN]: "Cushioned footwear", [HI]: "गद्देदार जूते", [AS]: "নৰম জোতা", [BN]: "নরম জুতো" },
    detail: {
      [EN]: "A soft sole takes impact the knee would otherwise absorb.",
      [HI]: "नरम तला वह झटका लेता है जो घुटने पर पड़ता।",
      [AS]: "নৰম তলিয়ে আঁঠুত পৰা ধক্কা লয়।",
      [BN]: "নরম সোল হাঁটুর ধাক্কা নেয়।",
    },
  },
];

/** The set of movements offered for a band, in the order they should be done. */
export function planFor(band: Band): Exercise[] {
  return EXERCISES.filter((e) => e.bands.includes(band));
}

/** Pick a language string, falling back to English rather than showing blank. */
export function tr(rec: Record<string, string> | undefined, lang: string): string {
  if (!rec) return "";
  return rec[lang] ?? rec.en ?? "";
}

export function trList(rec: Record<string, string[]> | undefined, lang: string): string[] {
  if (!rec) return [];
  return rec[lang] ?? rec.en ?? [];
}

/** Full talk-back script for one exercise: name, then each step. */
export function speech(ex: Exercise, lang: string): string[] {
  return [tr(ex.name, lang), ...trList(ex.steps, lang)];
}
