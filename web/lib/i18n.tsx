/* SANDHI — lightweight client-side i18n.
 *
 * Light (not a full framework): a dictionary of keys -> per-language strings,
 * a provider that remembers the choice, and a `t(key)` helper. English is the
 * default. Deep body copy stays in English; navigation, hero, titles and the
 * common controls are translated so the app chrome is legible in each region
 * language the programme may run in.
 */
"use client";
import * as React from "react";

export const LANGS: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "as", name: "অসমীয়া" },
  { code: "bn", name: "বাংলা" },
  { code: "pa", name: "ਪੰਜਾਬੀ" },
  { code: "ur", name: "اردو" },
  { code: "mr", name: "मराठी" },
  { code: "ta", name: "தமிழ்" },
  { code: "te", name: "తెలుగు" },
  { code: "kn", name: "ಕನ್ನಡ" },
  { code: "or", name: "ଓଡ଼ିଆ" },
  { code: "ml", name: "മലയാളം" },
  { code: "sd", name: "سنڌي" },
  { code: "ks", name: "کٲشُر" },
  { code: "ne", name: "नेपाली" },
  { code: "kha", name: "Khasi (Ka Ktien)" },
  { code: "grt", name: "Aʼchik (Garo)" },
];

/* A dictionary is keyed by a stable English string; missing entries fall back
   to English so any untranslated key never shows empty. This keeps additions
   safe: a key added in one place degrades to English everywhere else. */
type Dict = Record<string, string>;

const HI: Dict = {
  "nav.field": "मैदान", "nav.programme": "कार्यक्रम",
  "nav.overview": "मुख्य पृष्ठ", "nav.screening": "जांच", "nav.kit": "किट कंसोल",
  "nav.dashboard": "जिला डैशबोर्ड", "nav.registry": "रजिस्ट्री",
  "hero.track": "हार्डवेयर ट्रैक", "hero.region": "पूर्वोत्तर क्षेत्र", "hero.scope": "जांच, निदान नहीं",
  "hero.h1a": "तीन मिनट, एक पट्टा,", "hero.h1b": "न डॉक्टर और न सिग्नल।",
  "hero.body": "SANDHI एक पहनने योग्य किट और ऑफ़लाइन मॉडल है जो ASHA कार्यकर्ता को 30 सेकंड की चाल और पांच बैठे-उठें से गांव में घुटनों के शुरुआती ऑस्टियोआर्थराइटिस जोखिम की जांच करने देता है।",
  "hero.run": "जांच शुरू करें", "hero.dash": "डैशबोर्ड देखें",
  "mark.tag": "घुटना जांच · NER", "conn.title": "कनेक्टिविटी",
  "conn.up": "नेटवर्क चालू", "conn.off": "एयरप्लेन मोड",
  "sync.title": "सिंक", "sync.syncing": "सिंक हो रहा है",
  "outbox": "आउटबॉक्स", "offline": "ऑफ़लाइन", "queued": "कतार में",
};

const AS: Dict = {
  "nav.field": "ক্ষেত্ৰ", "nav.programme": "কাৰ্যসূচী",
  "nav.overview": "আভাস", "nav.screening": "স্ক্ৰীনিং", "nav.kit": "কিট কনছ'ল",
  "nav.dashboard": "জিলা ডেশ্ববৰ্ড", "nav.registry": "ৰেজিষ্ট্ৰী",
  "hero.track": "হাৰ্ডৱেৰ ট্ৰেক", "hero.region": "উত্তৰ-পূব অঞ্চল", "hero.scope": "স্ক্ৰীনিং, ৰোগ নিৰ্ণয় নহয়",
  "hero.h1a": "তিনি মিনিট, এখন বান্ধনী,", "hero.h1b": "নাই ডাক্তৰ, নাই সিঙাল।",
  "hero.body": "SANDHI হৈছে এটা পিন্ধিব পৰা কিট আৰু অফলাইন মডেল যিয়ে এজন ASHA কৰ্মীকে ৩০ ছেকেণ্ডৰ খোজ আৰু পাঁচবাৰ বহা-উঠাৰ জৰিয়তে গাঁৱত গোৰুৰ প্ৰাথমিক অষ্টিঅ'আৰ্থৰাইটিছৰ ঝুঁকি স্ক্ৰীন কৰিব পৰা কৰে।",
  "hero.run": "স্ক্ৰীনিং চলাওক", "hero.dash": "ডেশ্ববৰ্ড চাওক",
  "mark.tag": "গোৰু স্ক্ৰীনিং · NER", "conn.title": "সংযোগ",
  "conn.up": "নেটৱৰ্ক চলিত", "conn.off": "এয়াৰপ্লেন ম'ড",
  "sync.title": "সিংক", "sync.syncing": "সিংক হৈ আছে",
  "outbox": "আউটবক্স", "offline": "অফলাইন", "queued": "কিউত",
};

const PA: Dict = {
  "nav.field": "ਖੇਤਰ", "nav.programme": "ਪ੍ਰੋਗਰਾਮ",
  "nav.overview": "ਮੰਚ", "nav.screening": "ਜਾਂਚ", "nav.kit": "ਕਿੱਟ ਕੰਸੋਲ",
  "nav.dashboard": "ਜ਼ਿਲ੍ਹਾ ਡੈਸ਼ਬੋਰਡ", "nav.registry": "ਰਜਿਸਟਰੀ",
  "hero.track": "ਹਾਰਡਵੇਅਰ ਟਰੈਕ", "hero.region": "ਉੱਤਰ-ਪੂਰਬੀ ਖੇਤਰ", "hero.scope": "ਜਾਂਚ, ਨਿਦਾਨ ਨਹੀਂ",
  "hero.h1a": "ਤਿੰਨ ਮਿੰਟ, ਇੱਕ ਪੱਟੀ,", "hero.h1b": "ਨਾ ਡਾਕਟਰ ਅਤੇ ਨਾ ਸਿਗਨਲ।",
  "hero.body": "SANDHI ਇੱਕ ਪਹਿਨਣਯੋਗ ਕਿੱਟ ਅਤੇ ਆਫਲਾਈਨ ਮਾਡਲ ਹੈ ਜੋ ASHA ਵਰਕਰ ਨੂੰ 30 ਸਕਿੰਟ ਦੀ ਤੁਰਨ ਅਤੇ ਪੰਜ ਬੈਠਣ-ਉੱਠਣ ਨਾਲ ਪਿੰਡ ਵਿੱਚ ਗੋਡਿਆਂ ਦੇ ਸ਼ੁਰੂਆਤੀ ਓਸਟੀਓਆਰਥਰਾਈਟਿਸ ਜੋਖਮ ਦੀ ਜਾਂਚ ਕਰਨ ਦਿੰਦਾ ਹੈ।",
  "hero.run": "ਜਾਂਚ ਚਲਾਓ", "hero.dash": "ਡੈਸ਼ਬੋਰਡ ਵੇਖੋ",
  "mark.tag": "ਗੋਡਾ ਜਾਂਚ · NER", "conn.title": "ਕਨੈਕਟੀਵਿਟੀ",
  "conn.up": "ਨੈੱਟਵਰਕ ਚਾਲੂ", "conn.off": "ਹਵਾਈ ਮੋਡ",
  "sync.title": "ਸਿੰਕ", "sync.syncing": "ਸਿੰਕ ਹੋ ਰਿਹਾ ਹੈ",
  "outbox": "ਆਉਟਬਾਕਸ", "offline": "ਆਫਲਾਈਨ", "queued": "ਕਤਾਰ ਵਿੱਚ",
};

const UR: Dict = {
  "nav.field": "میدان", "nav.programme": "پروگرام",
  "nav.overview": "خلاصہ", "nav.screening": "اسکریننگ", "nav.kit": "کٹ کنسول",
  "nav.dashboard": "ضلع ڈیش بورڈ", "nav.registry": "رجسٹری",
  "hero.track": "ہارڈویئر ٹریک", "hero.region": "شمال مشرقی خطہ", "hero.scope": "اسکریننگ، تشخیص نہیں",
  "hero.h1a": "تین منٹ، ایک پٹی،", "hero.h1b": "نہ ڈاکٹر اور نہ سگنل۔",
  "hero.body": "SANDHI ایک پہننے کے قابل کٹ اور آف لائن ماڈل ہے جو ASHA ورکر کو 30 سیکنڈ کی چہل قدمی اور پانچ بیٹھے-اٹھنے سے گاؤں میں گھٹنوں کے ابتدائی اوسٹیوآرتھرائٹس کے خطرے کی اسکریننگ کرنے دیتا ہے۔",
  "hero.run": "اسکریننگ چلائیں", "hero.dash": "ڈیش بورڈ دیکھیں",
  "mark.tag": "گھٹنوں کی اسکریننگ · NER", "conn.title": "کنیکٹیویٹی",
  "conn.up": "نیٹ ورک آن", "conn.off": "ایئرپلین موڈ",
  "sync.title": "سنک", "sync.syncing": "سنک ہو رہا ہے",
  "outbox": "آؤٹ باکس", "offline": "آف لائن", "queued": "قطار میں",
};

const BN: Dict = {
  "nav.field": "ক্ষেত্র", "nav.programme": "প্রোগ্রাম",
  "nav.overview": "ওভারভিউ", "nav.screening": "স্ক্রিনিং", "nav.kit": "কিট কনসোল",
  "nav.dashboard": "জেলা ড্যাশবোর্ড", "nav.registry": "রেজিস্ট্রি",
  "hero.track": "হার্ডওয়্যার ট্র্যাক", "hero.region": "উত্তর-পূর্ব অঞ্চল", "hero.scope": "স্ক্রিনিং, রোগ নির্ণয় নয়",
  "hero.h1a": "তিন মিনিট, একটি ব্যান্ড,", "hero.h1b": "না ডাক্তার, না সিগন্যাল।",
  "hero.body": "SANDHI একটি পরিধেয় কিট এবং অফলাইন মডেল যা ASHA কর্মীকে 30 সেকেন্ডের হাঁটা এবং পাঁচটি বসা-ওঠা থেকে গ্রামে হাঁটুর প্রাথমিক অস্টিওআর্থারাইটিস ঝুঁকি স্ক্রিন করতে দেয়।",
  "hero.run": "স্ক্রিনিং চালান", "hero.dash": "ড্যাশবোর্ড দেখুন",
  "mark.tag": "হাঁটু স্ক্রিনিং · NER", "conn.title": "সংযোগ",
  "conn.up": "নেটওয়ার্ক চালু", "conn.off": "এয়ারপ্লেন মোড",
  "sync.title": "সিঙ্ক", "sync.syncing": "সিঙ্ক হচ্ছে",
  "outbox": "আউটবক্স", "offline": "অফলাইন", "queued": "কিউতে",
};

const MR: Dict = {
  "nav.field": "क्षेत्र", "nav.programme": "कार्यक्रम",
  "nav.overview": "आढावा", "nav.screening": "तपासणी", "nav.kit": "किट कॉन्सोल",
  "nav.dashboard": "जिल्हा डॅशबोर्ड", "nav.registry": "नोंदणी",
  "hero.track": "हार्डवेअर ट्रॅक", "hero.region": "ईशान्य प्रदेश", "hero.scope": "तपासणी, निदान नाही",
  "hero.h1a": "तीन मिनिटे, एक पट्टा,", "hero.h1b": "न डॉक्टर, न सिग्नल.",
  "hero.body": "SANDHI ही एक परिधान करण्यायोग्य किट आणि ऑफलाइन मॉडेल आहे जी ASHA कार्यकर्त्याला ३० सेकंदांच्या चालण्याने आणि पाच बसणे-उठण्याने गावात गुडघ्यांच्या सुरुवातीच्या ऑस्टियोआर्थरायटिस जोखमीची तपासणी करू देते.",
  "hero.run": "तपासणी सुरू करा", "hero.dash": "डॅशबोर्ड पहा",
  "mark.tag": "गुडघा तपासणी · NER", "conn.title": "कनेक्टिव्हिटी",
  "conn.up": "नेटवर्क चालू", "conn.off": "एअरप्लेन मोड",
  "sync.title": "सिंक", "sync.syncing": "सिंक होत आहे",
  "outbox": "आउटबॉक्स", "offline": "ऑफलाइन", "queued": "रांगेत",
};

const TA: Dict = {
  "nav.field": "துறை", "nav.programme": "திட்டம்",
  "nav.overview": "மேலோட்டம்", "nav.screening": "திரையிடல்", "nav.kit": "கிட் கன்சோல்",
  "nav.dashboard": "மாவட்ட டாஷ்போர்டு", "nav.registry": "பதிவேடு",
  "hero.track": "வன்பொருள் தடம்", "hero.region": "வடகிழக்கு பகுதி", "hero.scope": "திரையிடல், நோயறிதல் அல்ல",
  "hero.h1a": "மூன்று நிமிடம், ஒரு பட்டை,", "hero.h1b": "மருத்துவர் இல்லை, சிக்னல் இல்லை.",
  "hero.body": "SANDHI என்பது அணியக்கூடிய கிட்டும் ஆஃப்லைன் மாதிரியும் ஆகும், இது ASHA பணியாளரை 30 வினாடி நடை மற்றும் ஐந்து உட்கார்ந்து-எழுந்திருத்தலில் கிராமத்தில் முழங்கால் ஆஸ்டியோஆர்த்ரிடிஸ் அபாயத்தைத் திரையிட அனுமதிக்கிறது.",
  "hero.run": "திரையிடலை இயக்கு", "hero.dash": "டாஷ்போர்டைப் பார்",
  "mark.tag": "முழங்கால் திரையிடல் · NER", "conn.title": "இணைப்பு",
  "conn.up": "நெட்வொர்க் இயங்குகிறது", "conn.off": "விமான முறை",
  "sync.title": "ஒத்திசை", "sync.syncing": "ஒத்திசைக்கிறது",
  "outbox": "அவுட்பாக்ஸ்", "offline": "ஆஃப்லைன்", "queued": "வரிசையில்",
};

const TE: Dict = {
  "nav.field": "విభాగం", "nav.programme": "కార్యక్రమం",
  "nav.overview": "అవలోకనం", "nav.screening": "స్క్రీనింగ్", "nav.kit": "కిట్ కన్సోల్",
  "nav.dashboard": "జిల్లా డాష్‌బోర్డ్", "nav.registry": "రిజిస్ట్రీ",
  "hero.track": "హార్డ్‌వేర్ ట్రాక్", "hero.region": "ఈశాన్య ప్రాంతం", "hero.scope": "స్క్రీనింగ్, రోగ నిర్ధారణ కాదు",
  "hero.h1a": "మూడు నిమిషాలు, ఒక పట్టీ,", "hero.h1b": "డాక్టర్ లేదు, సిగ్నల్ లేదు.",
  "hero.body": "SANDHI అనేది ధరించగల కిట్ మరియు ఆఫ్‌లైన్ మోడల్, ఇది ASHA కార్యకర్తను 30 సెకండ్ల నడక మరియు ఐదు కూర్చోవడం-లేవడం ద్వారా గ్రామంలో మోకాలి ఆస్టియోఆర్థరైటిస్ ప్రమాదాన్ని స్క్రీన్ చేయడానికి వీలు కల్పిస్తుంది.",
  "hero.run": "స్క్రీనింగ్ ప్రారంభించండి", "hero.dash": "డాష్‌బోర్డ్ చూడండి",
  "mark.tag": "మోకాలి స్క్రీనింగ్ · NER", "conn.title": "కనెక్టివిటీ",
  "conn.up": "నెట్‌వర్క్ ఆన్", "conn.off": "ఎయిర్‌ప్లేన్ మోడ్",
  "sync.title": "సింక్", "sync.syncing": "సింక్ అవుతోంది",
  "outbox": "అవుట్‌బాక్స్", "offline": "ఆఫ్‌లైన్", "queued": "క్యూలో",
};

const KN: Dict = {
  "nav.field": "ಕ್ಷೇತ್ರ", "nav.programme": "ಕಾರ್ಯಕ್ರಮ",
  "nav.overview": "ಅವಲೋಕನ", "nav.screening": "ಸ್ಕ್ರೀನಿಂಗ್", "nav.kit": "ಕಿಟ್ ಕನ್ಸೋಲ್",
  "nav.dashboard": "ಜಿಲ್ಲಾ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", "nav.registry": "ನೋಂದಾವಣೆ",
  "hero.track": "ಯಂತ್ರಾಂಶ ಟ್ರ್ಯಾಕ್", "hero.region": "ಈಶಾನ್ಯ ಪ್ರದೇಶ", "hero.scope": "ಸ್ಕ್ರೀನಿಂಗ್, ರೋಗನಿರ್ಣಯವಲ್ಲ",
  "hero.h1a": "ಮೂರು ನಿಮಿಷ, ಒಂದು ಪಟ್ಟಿ,", "hero.h1b": "ವೈದ್ಯನಿಲ್ಲ, ಚಿಹ್ನೆಯಿಲ್ಲ.",
  "hero.body": "SANDHI ಒಂದು ಧರಿಸಬಹುದಾದ ಕಿಟ್ ಮತ್ತು ಆಫ್‌ಲೈನ್ ಮಾದರಿಯಾಗಿದ್ದು, ASHA ಕಾರ್ಯಕರ್ತೆಗೆ 30 ಸೆಕೆಂಡ್ ನಡಿಗೆ ಮತ್ತು ಐದು ಕುಳಿತು-ಎದ್ದುಗಳಲ್ಲಿ ಹಳ್ಳಿಯಲ್ಲಿ ಮೊಣಕಾಲಿನ ಆಸ್ಟಿಯೋಆರ್ತ್ರೈಟಿಸ್ ಅಪಾಯವನ್ನು ಸ್ಕ್ರೀನ್ ಮಾಡಲು ಅನುವು ಮಾಡಿಕೊಡುತ್ತದೆ.",
  "hero.run": "ಸ್ಕ್ರೀನಿಂಗ್ ಆರಂಭಿಸಿ", "hero.dash": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ನೋಡಿ",
  "mark.tag": "ಮೊಣಕಾಲು ಸ್ಕ್ರೀನಿಂಗ್ · NER", "conn.title": "ಸಂಪರ್ಕ",
  "conn.up": "ನೆಟ್‌ವರ್ಕ್ ಆನ್", "conn.off": "ವಿಮಾನ ಮೋಡ್",
  "sync.title": "ಸಿಂಕ್", "sync.syncing": "ಸಿಂಕ್ ಆಗುತ್ತಿದೆ",
  "outbox": "ಔಟ್‌ಬಾಕ್ಸ್", "offline": "ಆಫ್‌ಲೈನ್", "queued": "ಕ್ಯೂನಲ್ಲಿ",
};

const OR: Dict = {
  "nav.field": "କ୍ଷେତ୍ର", "nav.programme": "କାର୍ଯ୍ୟକ୍ରମ",
  "nav.overview": "ଅବଲୋକନ", "nav.screening": "ସ୍କ୍ରିନିଂ", "nav.kit": "କିଟ କନସୋଲ",
  "nav.dashboard": "ଜିଲ୍ଲା ଡ୍ୟାସବୋର୍ଡ", "nav.registry": "ରେଜିଷ୍ଟ୍ରି",
  "hero.track": "ହାର୍ଡୱେୟାର ଟ୍ରାକ୍", "hero.region": "ଉତ୍ତର-ପୂର୍ବ ଅଞ୍ଚଳ", "hero.scope": "ସ୍କ୍ରିନିଂ, ରୋଗ ନିର୍ଣ୍ଣୟ ନୁହେଁ",
  "hero.h1a": "ତିନି ମିନିଟ୍, ଗୋଟିଏ ପଟି,", "hero.h1b": "ନା ଡାକ୍ତର, ନା ସିଗନାଲ୍।",
  "hero.body": "SANDHI ଏକ ପିନ୍ଧିବା ଯୋଗ୍ୟ କିଟ୍ ଏବଂ ଅଫଲାଇନ ମଡେଲ, ଯାହା ASHA କର୍ମୀଙ୍କୁ ୩୦ ସେକେଣ୍ଡ ଚାଲିବା ଏବଂ ପାଞ୍ଚ ବସା-ଉଠା ସହିତ ଗାଁରେ ଆଣ୍ଠୁର ପ୍ରାରମ୍ଭିକ ଅଷ୍ଟିଓଆର୍ଥ୍ରାଇଟିସ୍ ବିପଦ ସ୍କ୍ରିନ କରିବାକୁ ଦିଏ।",
  "hero.run": "ସ୍କ୍ରିନିଂ ଆରମ୍ଭ କରନ୍ତୁ", "hero.dash": "ଡ୍ୟାସବୋର୍ଡ ଦେଖନ୍ତୁ",
  "mark.tag": "ଆଣ୍ଠୁ ସ୍କ୍ରିନିଂ · NER", "conn.title": "ସଂଯୋଗ",
  "conn.up": "ନେଟୱର୍କ ଚାଲିଛି", "conn.off": "ବିମାନ ମୋଡ୍",
  "sync.title": "ସିଙ୍କ୍", "sync.syncing": "ସିଙ୍କ୍ ହେଉଛି",
  "outbox": "ଆଉଟବକ୍ସ", "offline": "ଅଫଲାଇନ", "queued": "ଧାଡିରେ",
};

const ML: Dict = {
  "nav.field": "മേഖല", "nav.programme": "പ്രോഗ്രാം",
  "nav.overview": "അവലോകനം", "nav.screening": "സ്ക്രീനിംഗ്", "nav.kit": "കിറ്റ് കൺസോൾ",
  "nav.dashboard": "ജില്ലാ ഡാഷ്‌ബോർഡ്", "nav.registry": "രജിസ്ട്രി",
  "hero.track": "ഹാർഡ്‌വെയർ ട്രാക്ക്", "hero.region": "വടക്കുകിഴക്കൻ മേഖല", "hero.scope": "സ്ക്രീനിംഗ്, രോഗനിർണയമല്ല",
  "hero.h1a": "മൂന്ന് മിനിറ്റ്, ഒരു സ്ട്രാപ്പ്,", "hero.h1b": "ഡോക്ടറില്ല, സിഗ്നലില്ല.",
  "hero.body": "SANDHI ഒരു ധരിക്കാവുന്ന കിറ്റും ഓഫ്‌ലൈൻ മോഡലുമാണ്, ഇത് ASHA വർക്കറെ 30 സെക്കൻഡ് നടത്തവും അഞ്ച് ഇരിക്കൽ-എഴുന്നേൽപ്പും ഉപയോഗിച്ച് ഗ്രാമത്തിൽ കാൽമുട്ട് ഓസ്റ്റിയോ ആർത്രൈറ്റിസ് അപകടസാധ്യത സ്ക്രീൻ ചെയ്യാൻ അനുവദിക്കുന്നു.",
  "hero.run": "സ്ക്രീനിംഗ് ആരംഭിക്കുക", "hero.dash": "ഡാഷ്‌ബോർഡ് കാണുക",
  "mark.tag": "കാൽമുട്ട് സ്ക്രീനിംഗ് · NER", "conn.title": "കണക്റ്റിവിറ്റി",
  "conn.up": "നെറ്റ്‌വർക്ക് ഓൺ", "conn.off": "വിമാന മോഡ്",
  "sync.title": "സിൻക്", "sync.syncing": "സിൻക് ചെയ്യുന്നു",
  "outbox": "ഔട്ട്‌ബോക്സ്", "offline": "ഓഫ്‌ലൈൻ", "queued": "ക്യൂവിൽ",
};

const SD: Dict = {
  "nav.field": "ميدان", "nav.programme": "پروگرام",
  "nav.overview": "خلاصو", "nav.screening": "اسڪريننگ", "nav.kit": "ڪٽ ڪنسول",
  "nav.dashboard": "ضلعي ڊيش بورڊ", "nav.registry": "رجسٽري",
  "hero.track": "هارڊويئر ٽريڪ", "hero.region": "اتر-اوڀر وارو علائقو", "hero.scope": "اسڪريننگ، تشخيص نه",
  "hero.h1a": "ٽي منٽ، هڪ پٽي،", "hero.h1b": "نه ڊاڪٽر، نه سگنل.",
  "hero.body": "SANDHI هڪ پائڻ واري ڪٽ ۽ آف لائن ماڊل آهي جيڪو ASHA ڪم ڪندڙ کي 30 سيڪنڊن جي هلڻ ۽ پنجن ويٺي-اٿڻ سان ڳوٺ ۾ گوڏن جي شروعاتي اوسٽيوآرٿرائٽس خطري جي اسڪريننگ ڪرڻ ڏئي ٿو.",
  "hero.run": "اسڪريننگ شروع ڪريو", "hero.dash": "ڊيش بورڊ ڏسو",
  "mark.tag": "گوڏي اسڪريننگ · NER", "conn.title": "ڪنيڪٽوٽي",
  "conn.up": "نيٽ ورڪ آن", "conn.off": "ايئرپلين موڊ",
  "sync.title": "سنڪ", "sync.syncing": "سنڪ ٿي رهيو آهي",
  "outbox": "آئوٽ باڪس", "offline": "آف لائن", "queued": "قطار ۾",
};

const KS: Dict = {
  "nav.field": "میدان", "nav.programme": "پرۆگرام",
  "nav.overview": "جائزہ", "nav.screening": "اسکریننگ", "nav.kit": "کٹ کنسول",
  "nav.dashboard": "ضِلہ ڈیش بورڈ", "nav.registry": "رجسٹری",
  "hero.track": "ہارڈویئر ٹریک", "hero.region": "شُمٲلی-مشرقی علاقہ", "hero.scope": "اسکریننگ، چیک نہٕ",
  "hero.h1a": "ترٛے منٹھ, اَکھ پٹہٕ,", "hero.h1b": "نہ ڈاکٹر، نہ سگنل۔",
  "hero.body": "SANDHI چھُ اَکھ پہننہٕ یوٗنہٕ یوان کِٹ تہٕ آف لائن ماڈل یُس ASHA کارکنہٕ چھُ ۳۰ سیکنڈ چہِ وُنٹہٕ تہٕ پانٛژھ بیہہ-اوتہٕ سٕتہِ گامہِ مَنٛز گۄڈٕ-وٲلہِ گۄڈٕ یأرٕرس اوسٹیوآرٿرایٹس رسک چھانٛٹھنہٕ دِوان۔",
  "hero.run": "اسکریننگ شۆروٗ کٔرِو", "hero.dash": "ڈیش بورڈ وُچھِو",
  "mark.tag": "گۄڈٕ اسکریننگ · NER", "conn.title": "کنیکٹوٹی",
  "conn.up": "نیٹ ورک آن", "conn.off": "ایئرپلین موڈ",
  "sync.title": "سنک", "sync.syncing": "سنک پکنہٕ چھُ",
  "outbox": "آؤٹ باکس", "offline": "آف لائن", "queued": "قطارہِ مَنٛز",
};

const NE: Dict = {
  "nav.field": "क्षेत्र", "nav.programme": "कार्यक्रम",
  "nav.overview": "अवलोकन", "nav.screening": "स्क्रिनिङ", "nav.kit": "किट कन्सोल",
  "nav.dashboard": "जिल्ला ड्यासबोर्ड", "nav.registry": "दर्ता",
  "hero.track": "हार्डवेयर ट्र्याक", "hero.region": "उत्तर-पूर्व क्षेत्र", "hero.scope": "स्क्रिनिङ, निदान होइन",
  "hero.h1a": "तीन मिनेट, एउटा पट्टा,", "hero.h1b": "न डाक्टर, न सिग्नल।",
  "hero.body": "SANDHI एउटा लगाउन मिल्ने किट र अफलाइन मोडेल हो जसले ASHA कार्यकर्तालाई ३० सेकेन्डको हिँडाइ र पाँच बस्ने-उठ्नेमा गाउँमा घुँडाको प्रारम्भिक ओस्टियोआर्थ्राइटिस जोखिमको स्क्रिनिङ गर्न दिन्छ।",
  "hero.run": "स्क्रिनिङ सुरु गर्नुहोस्", "hero.dash": "ड्यासबोर्ड हेर्नुहोस्",
  "mark.tag": "घुँडा स्क्रिनिङ · NER", "conn.title": "कनेक्टिभिटी",
  "conn.up": "नेटवर्क चालू", "conn.off": "हवाई मोड",
  "sync.title": "सिंक", "sync.syncing": "सिंक हुँदैछ",
  "outbox": "आउटबक्स", "offline": "अफलाइन", "queued": "लाइनमा",
};

/* Khasi (Meghalaya) and Aʼchik/Garo (Meghalaya, Assam) are offered in the
   selector so the health worker can pick their tongue even before native
   translations land; untranslated keys fall back to English chrome. */
const KHA: Dict = {};
const GRT: Dict = {};

const EN: Dict = {
  "nav.field": "Field", "nav.programme": "Programme",
  "nav.overview": "Overview", "nav.screening": "Screening", "nav.kit": "Kit console",
  "nav.dashboard": "District dashboard", "nav.registry": "Registry",
  "hero.track": "Hardware track", "hero.region": "North-Eastern Region", "hero.scope": "Screening, not diagnosis",
  "hero.h1a": "Three minutes, one strap,", "hero.h1b": "no doctor and no signal.",
  "hero.body": "SANDHI is a wearable kit and an offline model that let an ASHA worker screen a village for early knee osteoarthritis risk — from a 30-second walk, and five sit-to-stands.",
  "hero.run": "Run a screening", "hero.dash": "View the dashboard",
  "mark.tag": "Knee screening · NER", "conn.title": "Connectivity",
  "conn.up": "Network up", "conn.off": "Airplane mode",
  "sync.title": "Sync", "sync.syncing": "Syncing",
  "outbox": "Outbox", "offline": "Offline", "queued": "queued",
};

const MESSAGES: Record<string, Dict> = {
  en: EN, hi: HI, as: AS, pa: PA, ur: UR, bn: BN, mr: MR,
  ta: TA, te: TE, kn: KN, or: OR, ml: ML, sd: SD, ks: KS,
  ne: NE, kha: KHA, grt: GRT,
};

const LANG_KEY = "sandhi.lang.v1";

/* scripts written right-to-left */
const RTL = new Set(["ur", "sd", "ks"]);

interface I18nCtx {
  lang: string;
  setLang: (l: string) => void;
  t: (key: string) => string;
}

const Ctx = React.createContext<I18nCtx | null>(null);

function applyLang(l: string) {
  const root = document.documentElement;
  root.lang = l;
  root.dir = RTL.has(l) ? "rtl" : "ltr";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<string>("en");

  // read the saved language after mount (SSR-safe: default is English)
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && MESSAGES[saved]) { applyLang(saved); setLangState(saved); }
      else applyLang("en");
    } catch { applyLang("en"); }
  }, []);

  const setLang = React.useCallback((l: string) => {
    const next = MESSAGES[l] ? l : "en";
    setLangState(next);
    applyLang(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* ignore */ }
  }, []);

  const t = React.useCallback((key: string) => {
    return MESSAGES[lang]?.[key] ?? EN[key] ?? key;
  }, [lang]);

  const value = React.useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}
