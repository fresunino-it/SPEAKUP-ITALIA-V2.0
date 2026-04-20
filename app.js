// app.js — SpeakUp Italia v3.0
// ─────────────────────────────────────────────────────────────────────────────

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CONFIG = Object.freeze({
  wa:   { country: "591", number: "69064630" },
  lang: { default: "it", supported: ["it", "es"] },
  zoom: "https://us05web.zoom.us/j/85152068635?pwd=VWI550PTkO1hnnttNRE9ayTUAIPUbB.1",
  storageKey: "sua_lang",
  cookieKey:  "sua_cookie_consent",
});

// ── UTILITIES ─────────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function log(level, msg, data) {
  if (typeof console !== "undefined") {
    (console[level] || console.log)(`[SpeakUp][${level.toUpperCase()}] ${msg}`, data ?? "");
  }
}

// ── FIRST-PASS GLOBAL ERROR GUARD ─────────────────────────────────────────────
window.addEventListener("error", (e) => {
  log("error", "Runtime error", e.message);
  showErrorBanner(`Errore tecnico: ${e.message}`);
});
window.addEventListener("unhandledrejection", (e) => {
  // Silenzioso per audio/autoplay rejection
  log("warn", "Promise rejection", String(e.reason));
});

function showErrorBanner(msg) {
  if (document.getElementById("_sua-error-banner")) return;
  const b = document.createElement("div");
  b.id = "_sua-error-banner";
  b.setAttribute("role", "alert");
  b.setAttribute("aria-live", "assertive");
  b.style.cssText =
    "position:fixed;top:0;left:0;right:0;background:#fff3cd;color:#856404;" +
    "padding:10px 16px;font-size:13px;text-align:center;z-index:9999;" +
    "border-bottom:1px solid #ffc107;font-family:system-ui,sans-serif";
  b.textContent = `⚠️ ${msg} — ricarica la pagina o contattaci su WhatsApp.`;
  document.body?.prepend(b);
}

// ── WHATSAPP ──────────────────────────────────────────────────────────────────
function buildWaUrl() {
  const num = `${CONFIG.wa.country}${CONFIG.wa.number}`;
  // Second-pass: validates number format
  if (!/^\d{10,15}$/.test(num)) {
    log("error", "WA number invalid", num);
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
    log("info", "WA links set", url);
  } catch (err) {
    log("error", "setWhatsAppLinks failed", err.message);
    showErrorBanner("Link WhatsApp non disponibile.");
  }
}

// ── LANGUAGE TOGGLE ───────────────────────────────────────────────────────────
function setLang(lang) {
  // Second-pass: validate against allowlist
  if (!CONFIG.lang.supported.includes(lang)) {
    log("warn", "Unknown lang, fallback", lang);
    lang = CONFIG.lang.default;
  }
  $$("[data-lang]").forEach((el) => {
    el.style.display = el.dataset.lang === lang ? "" : "none";
  });
  CONFIG.lang.supported.forEach((l) => {
    const btn = document.getElementById(`to-${l}`);
    if (btn) btn.setAttribute("aria-pressed", String(l === lang));
  });
  try { localStorage.setItem(CONFIG.storageKey, lang); } catch (_) {}
  log("info", "Lang →", lang);
}

function initLang() {
  let preferred = CONFIG.lang.default;
  try {
    const saved = localStorage.getItem(CONFIG.storageKey);
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

// ── HAMBURGER MENU ────────────────────────────────────────────────────────────
function initHamburger() {
  const toggle = document.getElementById("navToggle");
  const nav    = document.getElementById("mainNav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!nav.contains(e.target) && !toggle.contains(e.target)) {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    }
  });
}

// ── CONTACT FORM — DOUBLE VALIDATION ─────────────────────────────────────────
function initContactForm() {
  const form = $('form[action*="formspree"]');
  if (!form) return;

  // First-pass: detect unconfigured placeholder
  if (form.action.includes("your-form-id")) {
    log("warn", "Formspree ID not configured");
    const notice = document.createElement("p");
    notice.className = "small";
    notice.style.cssText = "color:#dc3545;margin-top:8px";
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
    const nameEl  = form.querySelector('[name="name"]');
    const emailEl = form.querySelector('[name="email"]');
    const msgEl   = form.querySelector('[name="message"]');
    const errors  = [];

    // Second-pass: JS manual validation
    if (!nameEl  || nameEl.value.trim().length < 2)
      errors.push("Il nome deve avere almeno 2 caratteri.");
    if (!emailEl || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim()))
      errors.push("Inserisci un indirizzo email valido.");
    if (!msgEl   || msgEl.value.trim().length < 10)
      errors.push("Il messaggio deve avere almeno 10 caratteri.");

    if (errors.length) { setFeedback("❌ " + errors.join(" "), false); return; }

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
      log("error", "Form submit failed", err.message);
      setFeedback("❌ Invio fallito. Riprova o contattaci su WhatsApp.", false);
      if (btn) btn.disabled = false;
    }
  });
}

// ── HERO ANIMATIONS ───────────────────────────────────────────────────────────
function initHeroAnimations() {
  const logo  = $(".logo-hero");
  const title = $(".hero h2");
  if (logo)  setTimeout(() => { logo.style.opacity = 1; logo.style.transform = "none"; }, 160);
  if (title) setTimeout(() => title.classList.add("animate-in"), 360);
}

// ── FOCUS VISIBLE ─────────────────────────────────────────────────────────────
function initFocusVisible() {
  // Solo per browser che non supportano :focus-visible nativo
  if (CSS?.supports?.("selector(:focus-visible)")) return;
  const s = document.createElement("style");
  s.textContent = ":focus{outline:3px solid rgba(0,123,255,.45);outline-offset:3px}";
  document.head.appendChild(s);
}

// ── COOKIE CONSENT (GDPR) ─────────────────────────────────────────────────────
function initCookieConsent() {
  let consent;
  try { consent = localStorage.getItem(CONFIG.cookieKey); } catch (_) {}
  if (consent) return; // già risposto

  const banner = document.createElement("div");
  banner.className = "cookie-banner";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", "Consenso cookie");
  banner.innerHTML = `
    <p>🍪 Usiamo solo cookie tecnici essenziali per il funzionamento del sito. Nessun dato venduto a terzi.</p>
    <div class="cookie-btns">
      <button class="cookie-btn-accept" id="cookieAccept">Accetto</button>
      <button class="cookie-btn-decline" id="cookieDecline">Rifiuto</button>
    </div>
  `;
  document.body.appendChild(banner);

  function dismiss(accepted) {
    try { localStorage.setItem(CONFIG.cookieKey, accepted ? "accepted" : "declined"); } catch (_) {}
    banner.style.transform = "translateY(100%)";
    banner.style.transition = "transform .35s ease";
    setTimeout(() => banner.remove(), 400);
    log("info", "Cookie consent", accepted ? "accepted" : "declined");
  }

  document.getElementById("cookieAccept")?.addEventListener("click", () => dismiss(true));
  document.getElementById("cookieDecline")?.addEventListener("click", () => dismiss(false));
}

// ── SERVICE WORKER REGISTRATION ───────────────────────────────────────────────
function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js")
      .then(reg => log("info", "SW registered", reg.scope))
      .catch(err => log("warn", "SW registration failed", err.message));
  });
}

// ── AUDIO UTILITY (usata dai giochi) ─────────────────────────────────────────
function playSuccess() {
  const a = document.getElementById("success-sound");
  if (!a) return;
  a.currentTime = 0;
  a.play().catch((err) => log("warn", "Audio blocked", err.message));
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  try {
    setWhatsAppLinks();
    bindLangButtons();
    initLang();
    initHamburger();
    initContactForm();
    initHeroAnimations();
    initFocusVisible();
    initCookieConsent();
    initServiceWorker();
    log("info", "SpeakUp Italia v3.0 ✓");
  } catch (err) {
    log("error", "Boot failed", err.message);
    showErrorBanner("Errore durante il caricamento della pagina.");
  }
});
