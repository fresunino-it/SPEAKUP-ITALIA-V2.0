// app.js — SpeakUp Italia v2.0
// Unified, deduplicated, fully validated script.
// Replaces both app.js and script.js (remove script.js from pages).

// ─── CONFIGURATION ───────────────────────────────────────────────────────────
const CONFIG = Object.freeze({
  wa: { country: "591", number: "69064630" },
  lang: { default: "it", supported: ["it", "es"] },
  zoom: "https://us05web.zoom.us/j/85152068635?pwd=VWI550PTkO1hnnttNRE9ayTUAIPUbB.1",
});

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function log(level, msg, data) {
  if (typeof console !== "undefined") {
    const fn = console[level] || console.log;
    fn(`[SpeakUp][${level.toUpperCase()}] ${msg}`, data ?? "");
  }
}

// ─── FIRST-PASS GLOBAL ERROR GUARD ───────────────────────────────────────────
window.addEventListener("error", (e) => {
  log("error", "Runtime error caught", e.message);
  showErrorBanner(`Errore tecnico: ${e.message}`);
});
window.addEventListener("unhandledrejection", (e) => {
  log("warn", "Unhandled promise rejection", String(e.reason));
  // Silenzioso per errori audio/autoplay
});

function showErrorBanner(msg) {
  if (document.getElementById("_sua-error-banner")) return;
  const banner = document.createElement("div");
  banner.id = "_sua-error-banner";
  banner.setAttribute("role", "alert");
  banner.style.cssText =
    "position:fixed;top:0;left:0;right:0;background:#fff3cd;color:#856404;" +
    "padding:10px 16px;font-size:13px;text-align:center;z-index:9999;" +
    "border-bottom:1px solid #ffc107;font-family:system-ui,sans-serif";
  banner.textContent = `⚠️ ${msg} — ricarica la pagina o contattaci su WhatsApp.`;
  document.body?.prepend(banner);
}

// ─── WHATSAPP ─────────────────────────────────────────────────────────────────
function buildWaUrl() {
  const num = `${CONFIG.wa.country}${CONFIG.wa.number}`;
  // Second-pass: validate number format before using it
  if (!/^\d{10,15}$/.test(num)) {
    log("error", "WA number format invalid", num);
    throw new Error("WhatsApp number configuration invalid");
  }
  return `https://wa.me/${num}`;
}

function setWhatsAppLinks() {
  try {
    const url = buildWaUrl();
    $$('a.whatsapp-link, a[href*="wa.me"]').forEach((a) => {
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
    log("info", "WhatsApp links updated", url);
  } catch (err) {
    log("error", "setWhatsAppLinks failed", err.message);
    showErrorBanner("Link WhatsApp non disponibile.");
  }
}

// ─── LANGUAGE TOGGLE ─────────────────────────────────────────────────────────
function setLang(lang) {
  // Second-pass: validate against allowed list
  if (!CONFIG.lang.supported.includes(lang)) {
    log("warn", "Unsupported lang, falling back", lang);
    lang = CONFIG.lang.default;
  }
  $$("[data-lang]").forEach((el) => {
    el.style.display = el.dataset.lang === lang ? "" : "none";
  });
  CONFIG.lang.supported.forEach((l) => {
    const btn = document.getElementById(`to-${l}`);
    if (btn) btn.setAttribute("aria-pressed", String(l === lang));
  });
  try { localStorage.setItem("sua_lang", lang); } catch (_) {}
  log("info", "Language set to", lang);
}

function initLang() {
  let preferred = CONFIG.lang.default;
  try {
    const saved = localStorage.getItem("sua_lang");
    if (saved && CONFIG.lang.supported.includes(saved)) preferred = saved;
  } catch (_) {}
  if (preferred === CONFIG.lang.default) {
    const nav = navigator.language || navigator.userLanguage || "it";
    if (nav.startsWith("es")) preferred = "es";
  }
  setLang(preferred);
}

function bindLangButtons() {
  CONFIG.lang.supported.forEach((l) => {
    const btn = document.getElementById(`to-${l}`);
    if (btn) btn.addEventListener("click", () => setLang(l));
  });
}

// ─── CONTACT FORM — DOUBLE VALIDATION ─────────────────────────────────────────
function initContactForm() {
  const form = $('form[action*="formspree"]');
  if (!form) return;

  // First-pass: warn if form ID is still placeholder
  if (form.action.includes("your-form-id")) {
    log("warn", "Formspree form ID not configured");
    const notice = document.createElement("p");
    notice.className = "small";
    notice.style.color = "#dc3545";
    notice.textContent = "⚠️ Modulo non ancora configurato. Contattaci via WhatsApp.";
    form.prepend(notice);
    const sb = form.querySelector('button[type="submit"]');
    if (sb) sb.disabled = true;
    return;
  }

  const feedback = document.createElement("p");
  feedback.className = "small";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  form.appendChild(feedback);

  function setFeedback(msg, ok) {
    feedback.textContent = msg;
    feedback.style.color = ok ? "#25D366" : "#dc3545";
  }

  form.setAttribute("novalidate", "");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.querySelector('[name="name"]');
    const email = form.querySelector('[name="email"]');
    const message = form.querySelector('[name="message"]');
    const errors = [];

    // Second-pass: manual JS validation with friendly messages
    if (!name || name.value.trim().length < 2)
      errors.push("Il nome deve avere almeno 2 caratteri.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
      errors.push("Inserisci un indirizzo email valido.");
    if (!message || message.value.trim().length < 10)
      errors.push("Il messaggio deve avere almeno 10 caratteri.");

    if (errors.length > 0) {
      setFeedback("❌ " + errors.join(" "), false);
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    setFeedback("Invio in corso…", true);

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      if (res.ok) {
        setFeedback("✅ Messaggio inviato! Ti risponderemo presto.", true);
        form.reset();
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      log("error", "Form submission failed", err.message);
      setFeedback("❌ Invio fallito. Riprova o contattaci su WhatsApp.", false);
      if (btn) btn.disabled = false;
    }
  });
}

// ─── HERO ANIMATION ──────────────────────────────────────────────────────────
function initHeroAnimations() {
  const logo = $(".logo-hero");
  const title = $(".hero h2");
  if (logo) setTimeout(() => { logo.style.opacity = 1; logo.style.transform = "none"; }, 160);
  if (title) setTimeout(() => title.classList.add("animate-in"), 360);
}

// ─── FOCUS VISIBLE ───────────────────────────────────────────────────────────
function initFocusVisible() {
  const s = document.createElement("style");
  s.textContent = ":focus-visible{outline:3px solid rgba(0,123,255,0.5);outline-offset:3px}";
  document.head.appendChild(s);
}

// ─── AUDIO UTILITY (usata dai giochi) ────────────────────────────────────────
function playSuccess() {
  const a = document.getElementById("success-sound");
  if (!a) return;
  a.currentTime = 0;
  a.play().catch((err) => log("warn", "Audio play blocked", err.message));
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  try {
    setWhatsAppLinks();
    bindLangButtons();
    initLang();
    initContactForm();
    initHeroAnimations();
    initFocusVisible();
    log("info", "SpeakUp Italia v2.0 boot OK ✓");
  } catch (err) {
    log("error", "Boot failed", err.message);
    showErrorBanner("Errore durante il caricamento della pagina.");
  }
});
