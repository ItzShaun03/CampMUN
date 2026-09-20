/* ============================================================
   CAMP MUN — SHARED PAGE INTERACTIONS
   One script used by every page, grouped into clear sections:
     1. Feature-flag visibility   (features.js)
     2. Event content             (site-config.js)
     3. Content sections: committees, resources, contact, gallery
     4. Navigation & scroll/tilt animations
     5. Registration & accounts   (register.html)
   All editable event data lives in site-config.js.
   ============================================================ */
(() => {
  "use strict";

  /* Reveal animations only activate when this script runs — with JS
     disabled, no content is ever hidden. Also add a keyboard skip link. */
  document.documentElement.classList.add("js");
  const mainLandmark = document.querySelector("main");
  if (mainLandmark && !mainLandmark.id) mainLandmark.id = "site-main";
  const skipLink = document.createElement("a");
  skipLink.className = "skip-link";
  skipLink.href = "#site-main";
  skipLink.textContent = "Skip to content";
  document.body.prepend(skipLink);

  const config = window.CAMPMUN_CONFIG || {};
  const API_BASE = String(config.apiBase || "").replace(/\/+$/, "");
  const api = (path) => API_BASE + path;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = (value) => String(value || "").trim();
  const setText = (selector, value) => { const element = $(selector); if (element) element.textContent = value; };
  const toast = (message) => { const element = $("#toast"); if (!element) return; element.textContent = message; element.classList.add("visible"); clearTimeout(window.toastTimer); window.toastTimer = window.setTimeout(() => element.classList.remove("visible"), 4500); };
  const features = window.CAMPMUN_FEATURES || {};
  const featureOn = (name) => features[name] !== false;

  /* Read an API response safely. Static hosts (e.g. GitHub Pages)
     answer /api/* with an HTML 404 page, which response.json() would
     fail on with a cryptic "Unexpected token <" error. Converting that
     into a TypeError lets every catch block show its clear
     "service is offline" message instead. */
  const readJson = async (response) => {
    const text = await response.text();
    const trimmed = text.trimStart();
    if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) {
      throw new TypeError("The server returned an unexpected response. Please start the CampMUN Node server and try again.");
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new TypeError("The server returned an unexpected response. Please start the CampMUN Node server and try again.");
    }
  };

  /* ------------------------------------------------------------
     1) FEATURE-FLAG VISIBILITY
     Respects features.js: hides the Manage/Register links when a
     feature is off, and swaps the form for a "currently closed"
     notice when registrations are paused.
     ------------------------------------------------------------ */
  const manageLink = $(".nav-manage");
  if (manageLink && !featureOn("uploads")) manageLink.hidden = true;

  if (!featureOn("registrations")) {
    $$("a[href*='register.html']").forEach((link) => { link.style.display = "none"; });
    const formElement = $("#registration-forms");
    if (formElement) {
      const shell = formElement.closest(".registration-shell");
      const notice = document.createElement("div");
      notice.className = "registration-closed";
      notice.innerHTML = "<span>APPLICATIONS</span><h2>Registration is <em>currently closed.</em></h2><p>Online applications will reopen shortly. Please contact the Secretariat for any questions in the meantime.</p>";
      (shell || formElement).replaceWith(notice);
    }
  }

  setText("#edition-label", config.event?.edition || ""); setText("#event-name", config.event?.name || ""); setText("#event-theme", config.event?.theme || ""); setText("#event-day-one", config.event?.dayOne || ""); setText("#event-day-two", config.event?.dayTwo || ""); setText("#event-year", config.event?.year || ""); setText("#current-year", new Date().getFullYear());
  /* ------------------------------------------------------------
     2) EVENT CONTENT
     Copies names, dates and theme from site-config.js into the
     page so one file keeps the whole site consistent.
     ------------------------------------------------------------ */
  $$("[data-event-dates]").forEach((element) => element.textContent = config.event?.dates || "");

  /* ------------------------------------------------------------
     3) CONTENT SECTIONS
     Committees list, resource cards, contact details and gallery.
     ------------------------------------------------------------ */
  const committeeList = $("#committee-list"); const committeeSelect = $("#committee");
  (config.committees || []).forEach((committee, index) => {
    if (committeeList) { const row = document.createElement("article"); row.className = "committee reveal"; row.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><strong>${committee.code}</strong><h3>${committee.name}</h3><p>${committee.topic}</p><i aria-hidden="true">↗</i>`; committeeList.append(row); }
    if (committeeSelect) { const option = document.createElement("option"); option.value = committee.name; option.textContent = `${committee.code} — ${committee.name}`; committeeSelect.append(option); }
  });

  /* 3b) RESOURCES — cards from config + uploaded files from /api/content */
  const resourceGrid = $("#resource-grid");
  if (!featureOn("resources")) { const resourcesSection = $(".resources"); if (resourcesSection) resourcesSection.style.display = "none"; }
  if (resourceGrid) {
    (config.resources || []).forEach((resource) => { const card = document.createElement("a"); card.className = `resource-card reveal${resource.available ? "" : " disabled"}`; card.href = resource.available && resource.href ? resource.href : "#"; if (resource.available) { card.target = "_blank"; card.rel = "noreferrer"; } card.innerHTML = `<span>${resource.type}</span><h3>${resource.title}</h3><p>${resource.text}</p><b>${resource.available ? "Open resource ↗" : "Coming soon"}</b>`; if (!resource.available) card.addEventListener("click", (event) => { event.preventDefault(); toast("This resource will be published shortly."); }); resourceGrid.append(card); });
    if (featureOn("resources")) {
      (async () => {
        let documents = [];
        try { const response = await fetch(api("/api/content")); const data = await readJson(response); if (response.ok && data.ok) documents = data.documents || []; } catch {}
        documents.forEach((href) => {
          const name = href.split("/").pop().replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
          const card = document.createElement("a");
          card.className = "resource-card reveal";
          card.href = href; card.target = "_blank"; card.rel = "noreferrer";
          const tag = document.createElement("span"); tag.textContent = "FILE";
          const heading = document.createElement("h3"); heading.textContent = name || "Document";
          const paragraph = document.createElement("p"); paragraph.textContent = "Download from the CampMUN resource collection.";
          const badge = document.createElement("b"); badge.textContent = "Open document ↗";
          card.append(tag, heading, paragraph, badge);
          resourceGrid.append(card);
        });
      })();
    }
  }

  /* 3c) CONTACT — email, venue and social links */
  const email = clean(config.contact?.email); $$("[data-contact-email]").forEach((element) => { element.textContent = element.dataset.plain ? email : `${email} ↗`; element.href = `mailto:${email}`; });
  const venue = $("#venue-text"); if (venue) venue.innerHTML = clean(config.contact?.venue).replace(/\n/g, "<br>");
  [["#instagram-link", config.contact?.instagram], ["#linkedin-link", config.contact?.linkedin]].forEach(([selector, url]) => { const element = $(selector); if (!element) return; if (clean(url)) element.href = url; else element.hidden = true; });

  /* 3d) GALLERY — photos from /api/content, captions from config */
  const galleryGrid = $("#gallery-grid");
  if (!featureOn("gallery")) { const gallerySection = $("#gallery-section"); if (gallerySection) gallerySection.style.display = "none"; }
  if (galleryGrid && featureOn("gallery")) {
    const captions = config.gallery || [];
    (async () => {
      let images = [];
      try { const response = await fetch(api("/api/content")); const data = await readJson(response); if (response.ok && data.ok) images = data.images || []; } catch {}
      const slots = Array.from({ length: Math.max(captions.length, images.length, 6) }, (_, index) => ({ title: captions[index]?.title || "CampMUN", caption: captions[index]?.caption || "A moment from the conference." }));
      const blocks = [];
      slots.forEach((item, index) => {
        const block = document.createElement("figure");
        block.className = "gallery-block reveal";
        if (index < images.length) {
          const img = document.createElement("img");
          img.src = images[index]; img.alt = item.title; img.loading = "lazy"; img.decoding = "async";
          block.append(img);
        } else {
          block.classList.add("is-empty");
          const slot = document.createElement("span");
          slot.className = "gallery-slot";
          slot.innerHTML = "<i aria-hidden=\"true\"></i><b>Photo slot</b>";
          block.append(slot);
        }
        const figcaption = document.createElement("figcaption");
        const heading = document.createElement("h3"); heading.textContent = item.title;
        const paragraph = document.createElement("p"); paragraph.textContent = item.caption;
        figcaption.append(heading, paragraph);
        block.append(figcaption);
        galleryGrid.append(block);
        blocks.push(block);
      });
      requestAnimationFrame(() => requestAnimationFrame(() => blocks.forEach((block) => block.classList.add("in-view"))));
    })();
  }

  /* ------------------------------------------------------------
     4) NAVIGATION & MOTION
     Mobile menu toggle, scroll-reveal and pointer tilt effects.
     ------------------------------------------------------------ */
  const nav = $("#site-nav"); const menu = $(".menu-toggle");
  if (nav && menu) {
    if (!menu.getAttribute("aria-label")) menu.setAttribute("aria-label", "Toggle navigation");
    const overlay = document.createElement("div");
    overlay.className = "nav-overlay";
    overlay.setAttribute("aria-hidden", "true");
    document.body.append(overlay);
    const setMenu = (open) => {
      nav.classList.toggle("open", open);
      menu.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("nav-open", open);
      overlay.classList.toggle("is-visible", open);
    };
    menu.addEventListener("click", () => {
      const open = !nav.classList.contains("open");
      setMenu(open);
      if (open) { const first = $("a", nav); if (first) first.focus(); }
    });
    overlay.addEventListener("click", () => setMenu(false));
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && nav.classList.contains("open")) { setMenu(false); menu.focus(); } });
    $$("a", nav).forEach((link) => link.addEventListener("click", () => setMenu(false)));
  }

  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const element = entry.target;
      if (element.classList.contains("in-view")) { revealObserver.unobserve(element); return; }
      if (!reduceMotion()) {
        const siblings = Array.from(element.parentElement ? element.parentElement.children : []).filter((sibling) => sibling.classList.contains("reveal"));
        const index = siblings.indexOf(element);
        if (index > 0) {
          element.style.transitionDelay = `${Math.min(index * 60, 420)}ms`;
          window.setTimeout(() => { element.style.transitionDelay = ""; }, 1100 + index * 60);
        }
      }
      element.classList.add("in-view");
      revealObserver.unobserve(element);
    }), { threshold: 0.12, rootMargin: "0px 0px -4% 0px" });
    const watchReveals = (scope) => $$(".reveal:not(.in-view)", scope).forEach((element) => revealObserver.observe(element));
    watchReveals(document);
    if (window.MutationObserver) {
      new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches(".reveal:not(.in-view)")) revealObserver.observe(node);
        watchReveals(node);
      }))).observe(document.body, { childList: true, subtree: true });
    }
  } else {
    $$(".reveal").forEach((element) => element.classList.add("in-view"));
  }
  $$("[data-tilt]").forEach((element) => {
    let hovering = false;
    const rotate = (event) => { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; const box = element.getBoundingClientRect(), x = (event.clientX - box.left) / box.width - .5, y = (event.clientY - box.top) / box.height - .5; element.style.transform = `perspective(950px) rotateX(${y * -7}deg) rotateY(${x * 9}deg) translateY(-7px) scale(${hovering ? 1.06 : 1})`; };
    element.addEventListener("pointerenter", () => { hovering = true; }); element.addEventListener("pointerleave", () => { hovering = false; element.style.transform = ""; }); element.addEventListener("pointermove", rotate);
  });

  /* ------------------------------------------------------------
     5) REGISTRATION & ACCOUNTS
     register.html only. Signs a School or Individual in/up, then
     renders seat-based application forms with live seat counting,
     editing and account settings.
     ------------------------------------------------------------ */
  const form = $("#registration-form");
  const authPanel = $("#auth-panel"); const applicationPanel = $("#application-panel");
  if (authPanel && applicationPanel) {
    const tokenKey = "campmun_token";
    const getToken = () => { try { return localStorage.getItem(tokenKey) || ""; } catch { return ""; } };
    const setToken = (value) => { try { localStorage.setItem(tokenKey, value); } catch {} };
    const clearToken = () => { try { localStorage.removeItem(tokenKey); } catch {} };
    const setMode = (mode) => { $$(".auth-tab", authPanel).forEach((tab) => { const active = tab.dataset.mode === mode; tab.classList.toggle("is-active", active); tab.setAttribute("aria-selected", String(active)); }); const signup = $("#signup-form", authPanel); const login = $("#login-form", authPanel); if (signup) signup.hidden = mode !== "signup"; if (login) login.hidden = mode !== "login"; };
    const showAuthError = (selector, message) => { const element = $(selector, authPanel); if (!element) return; element.textContent = message; element.hidden = false; toast(message); };
    const validateAuth = (authForm) => { const invalid = $$('input:not([type="hidden"]),select,textarea', authForm).find((field) => !field.checkValidity()); if (invalid) { invalid.reportValidity(); return false; } return true; };
    const fillField = (target, name, value) => { const input = target.querySelector(`[name="${name}"]`); if (input) input.value = value || ""; };
    const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    $$("[data-password-toggle]").forEach((toggle) => toggle.addEventListener("click", () => {
      const input = document.getElementById(toggle.dataset.passwordToggle);
      if (!input) return;
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      toggle.textContent = reveal ? "Hide" : "Show";
      toggle.setAttribute("aria-pressed", String(reveal));
      input.focus();
    }));

    let account = null; let delegateTotal = 1; let facultyTotal = 0; let registrations = []; let editingId = null;

    const formsRoot = $("#registration-forms", applicationPanel);
    const successPanel = $("#form-success", applicationPanel);
    const donePanel = $("#application-done", applicationPanel);
    const progressBar = $("#delegate-progress", applicationPanel);
    const submittedList = $("#submitted-list", applicationPanel);

    const committeeOptions = (config.committees || []).map((committee) => `<option value="${escapeHtml(committee.name)}">${escapeHtml(committee.code)} — ${escapeHtml(committee.name)}</option>`).join("");

    const schoolCounts = () => {
      const delegateCount = registrations.filter((reg) => !/faculty/i.test(reg.role)).length;
      const facultyCount = registrations.filter((reg) => /faculty/i.test(reg.role)).length;
      return { delegateCount, facultyCount, delegateLeft: Math.max(0, delegateTotal - delegateCount), facultyLeft: Math.max(0, facultyTotal - facultyCount) };
    };

    const buildSeatForm = (slot) => {
      const faculty = slot.kind === "faculty";
      const hasAccount = Boolean(account);
      const lockedSchool = account && account.school ? account.school : "";
      const lockedRole = faculty ? "Faculty Advisor" : "Delegate";
      const formEl = document.createElement("form");
      formEl.className = "registration-form multi-step-form seat-form";
      formEl.noValidate = true;
      formEl.innerHTML = `
<input class="honeypot" name="campmun_hp" tabindex="-1" autocomplete="off" aria-hidden="true" data-lpignore="true" data-1p-ignore data-form-type="other">
<section class="form-step is-active">
<h2>${escapeHtml(slot.label)}</h2>
<p class="form-intro">Each seat in your delegation needs one application.</p>
${hasAccount ? `<div class="seat-meta"><span>${faculty ? "Faculty Advisor" : "Delegate"}</span><b>${escapeHtml(lockedSchool)}</b></div>` : ""}
<div class="field"><label>Full name</label><input name="name" autocomplete="name" placeholder="${faculty ? "Faculty member's full name" : "Delegate's full name"}" required></div>
<div class="field"><label>Email address</label><input name="email" type="email" autocomplete="email" placeholder="delegate@example.com" required></div>
${hasAccount ? `<input type="hidden" name="school" value="${escapeHtml(lockedSchool)}"><input type="hidden" name="role" value="${lockedRole}">` : `<div class="field"><label>School</label><input name="school" value="${escapeHtml(account && account.school ? account.school : "")}" placeholder="School name" required></div>
<div class="field"><label>Registration type</label><select name="role">${faculty ? '<option value="Faculty Advisor" selected>Faculty Advisor</option>' : '<option value="Delegate" selected>Delegate</option><option>International Press</option>'}</select></div>`}
<div class="field field-full"><label>Committee preference</label><select name="committee" required><option value="" selected disabled>Select your first preference</option>${committeeOptions}</select></div>
<label class="consent"><input name="consent" type="checkbox" required><span>I consent to CampMUN using my information for application administration and communication.</span></label>
<div class="form-error" role="status" aria-live="polite" hidden></div>
<div class="step-actions"><button class="button button-primary submit-button" type="submit">${faculty ? "Register this faculty member <span>→</span>" : "Register this delegate <span>→</span>"}</button></div>
<p class="form-note">Each registered person needs a unique email address.</p>
</section>`;
      let humanInteracted = false;
      const honeypotEl = $(".honeypot", formEl);
      if (honeypotEl) { honeypotEl.value = ""; formEl.addEventListener("focusin", () => { humanInteracted = true; honeypotEl.value = ""; }); }
      const statusEl = $(".form-error", formEl);
      const submitBtn = $(".submit-button", formEl);
      formEl.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!statusEl) return;
        statusEl.hidden = true;
        const data = new FormData(formEl);
        const honeypotFill = clean(data.get("campmun_hp"));
        if (honeypotFill && !humanInteracted) { statusEl.textContent = "A spam check fired. Please try submitting again — your details were not sent."; statusEl.hidden = false; return; }
        if (honeypotFill) { if (honeypotEl) honeypotEl.value = ""; data.set("campmun_hp", ""); }
        const name = clean(data.get("name")), email = clean(data.get("email")), school = clean(data.get("school")), role = clean(data.get("role")), committee = clean(data.get("committee"));
        if (!name || !email || !school || !role || !committee) { statusEl.textContent = "Please complete every required field above to continue."; statusEl.hidden = false; return; }
        if (!/^\S+@\S+\.\S+$/.test(email)) { statusEl.textContent = "Please enter a valid email address."; statusEl.hidden = false; return; }
        if (data.get("consent") !== "on") { statusEl.textContent = "Please accept the privacy consent to continue."; statusEl.hidden = false; return; }
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = "Sending application…"; }
        try {
          const response = await fetch(api("/api/registrations"), { method: "POST", headers: { "Content-Type": "application/json", ...(account ? { Authorization: `Bearer ${getToken()}` } : {}) }, body: JSON.stringify({ name, email, school, role, committee, consent: true }) });
          const result = await readJson(response);
          if (!response.ok || !result.ok) throw new Error(result.message || "We could not send the application.");
          await loadState();
          const saved = registrations.find((reg) => reg.applicationId === result.applicationId);
          slot.done = saved || { applicationId: result.applicationId, name, email, school, role, committee };
          formEl.classList.add("is-submitted");
          formEl.innerHTML = `<div class="seat-note"><span>SUBMITTED</span><b>${escapeHtml(slot.label)}</b><p>Reference: <strong>${escapeHtml(result.applicationId)}</strong>. This application is now with the CampMUN Secretariat.</p><button class="button-ghost" type="button">Edit this application</button></div>`;
          const editButton = $(".button-ghost", formEl);
          if (editButton) editButton.addEventListener("click", () => editRegistration(slot.done));
          if (result.stored && result.stored.sheets === false && result.stored.mongodb !== true) toast("Your application was saved, but Google Sheet delivery failed. Contact the Secretariat with your reference number.");
          renderProgress(); renderSubmittedList();
          const counts = schoolCounts();
          if (counts.delegateLeft <= 0 && counts.facultyLeft <= 0) renderDone();
        } catch (error) {
          const message = error instanceof TypeError ? "Registration service is offline. Please start the CampMUN Node server and try again." : (error.message || "We could not send the application. Please try again.");
          statusEl.textContent = message; statusEl.hidden = false;
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = faculty ? "Register this faculty member <span>→</span>" : "Register this delegate <span>→</span>"; }
        }
      });
      return formEl;
    };

    const renderSeatForms = () => {
      if (!formsRoot) return;
      editingId = null;
      showView("form");
      formsRoot.innerHTML = "";
      const school = account && account.accountType === "school";
      if (!school) { const formEl = buildSeatForm({ kind: "individual", label: "Your application" }); if (account) { fillField(formEl, "name", account.name); fillField(formEl, "email", account.email); fillField(formEl, "school", account.school || ""); } formsRoot.append(formEl); renderProgress(); renderSubmittedList(); return; }
      const { delegateCount, facultyCount, delegateLeft, facultyLeft } = schoolCounts();
      for (let i = 1; i <= delegateLeft; i++) formsRoot.append(buildSeatForm({ kind: "delegate", label: `Delegate ${delegateCount + i} of ${delegateTotal}` }));
      for (let j = 1; j <= facultyLeft; j++) formsRoot.append(buildSeatForm({ kind: "faculty", label: `Faculty ${facultyCount + j} of ${facultyTotal}` }));
      renderProgress(); renderSubmittedList();
    };

    const showStatus = (message) => { const status = $("#form-error", applicationPanel); if (status) { status.textContent = message; status.hidden = false; } toast(message); };
    const clearStatus = () => { const status = $("#form-error", applicationPanel); if (status) { status.textContent = ""; status.hidden = true; } };
    const showView = (which) => { if (formsRoot) formsRoot.hidden = which !== "form"; if (successPanel) successPanel.hidden = which !== "success"; if (donePanel) donePanel.hidden = which !== "done"; };
    const settingsPanel = $("#account-settings", applicationPanel);
    const settingsForm = settingsPanel ? $("#settings-form", settingsPanel) : null;
    const settingsError = settingsPanel ? $("#settings-error", settingsPanel) : null;
    const fillSettings = () => {
      if (!settingsForm || !account) return;
      fillField(settingsForm, "firstName", account.firstName || "");
      fillField(settingsForm, "lastName", account.lastName || "");
      fillField(settingsForm, "email", account.email || "");
      const school = account.accountType === "school";
      $$(".settings-school-field", settingsForm).forEach((field) => field.hidden = !school);
      if (school) { fillField(settingsForm, "numDelegates", account.numDelegates || ""); fillField(settingsForm, "numFaculty", account.numFaculty || ""); }
      if (settingsError) settingsError.hidden = true;
    };
    const openSettings = () => {
      if (!settingsPanel) return;
      fillSettings();
      if (formsRoot) formsRoot.hidden = true;
      if (successPanel) successPanel.hidden = true;
      if (donePanel) donePanel.hidden = true;
      settingsPanel.hidden = false;
    };
    const closeSettings = () => { if (settingsPanel) settingsPanel.hidden = true; defaultView(); };

    const renderProgress = () => {
      if (!progressBar) return;
      if (account && account.accountType === "school") {
        progressBar.hidden = false;
        const facultyBar = $("#faculty-progress", applicationPanel);
        if (facultyBar) facultyBar.hidden = facultyTotal <= 0;
        const delegateCount = registrations.filter((reg) => !/faculty/i.test(reg.role)).length;
        const facultyCount = registrations.filter((reg) => /faculty/i.test(reg.role)).length;
        setText("#delegate-progress-text", `Delegates registered: ${delegateCount} of ${delegateTotal}`);
        const fill = $("#delegate-progress-fill", applicationPanel);
        if (fill) fill.style.width = `${Math.min(100, Math.round(delegateCount / Math.max(1, delegateTotal) * 100))}%`;
        if (facultyTotal > 0) {
          setText("#faculty-progress-text", `Faculty registered: ${facultyCount} of ${facultyTotal}`);
          const facultyFill = $("#faculty-progress-fill", applicationPanel);
          if (facultyFill) facultyFill.style.width = `${Math.min(100, Math.round(facultyCount / facultyTotal * 100))}%`;
        }
      } else if (progressBar) {
        progressBar.hidden = true;
        const facultyBar = $("#faculty-progress", applicationPanel);
        if (facultyBar) { facultyBar.hidden = true; setText("#faculty-progress-text", ""); }
      }
    };

    const renderCards = (list, container) => {
      if (!container) return;
      $$("article", container).forEach((card) => card.remove());
      (list || []).forEach((reg) => {
        const card = document.createElement("article"); card.className = "done-card";
        card.innerHTML = `<div class="done-card-id"><span>Reference</span><b>${escapeHtml(reg.applicationId)}</b></div><div class="done-card-details"><div><span>Name</span><b>${escapeHtml(reg.name)}</b></div><div><span>Email</span><b>${escapeHtml(reg.email)}</b></div><div><span>Registration type</span><b>${escapeHtml(reg.role)}</b></div><div><span>Committee</span><b>${escapeHtml(reg.committee)}</b></div><div class="verify-row"><span>Verification</span><b class="verify-badge is-pending" data-application="${escapeHtml(reg.applicationId)}">Checking…</b><small class="verify-comment"></small></div></div><button class="button-ghost done-card-edit" type="button">Edit</button>`;
        $(".done-card-edit", card).addEventListener("click", () => editRegistration(reg));
        container.append(card);
      });
    };
    const renderSubmittedList = () => { renderCards(registrations, submittedList); if (submittedList) submittedList.hidden = !registrations.length; renderVerification(); };

    /* Fill every empty verification badge. The programmer approves rows
       by typing TRUE in the Verified column (and optionally a Comment) in
       the Google Sheet — the backend reads those values back for us. */
    const renderVerification = () => {
      $$(".verify-badge[data-application]", applicationPanel).forEach((badge) => {
        const appId = badge.getAttribute("data-application");
        if (!appId) return;
        fetch(api(`/api/registrations/${encodeURIComponent(appId)}/verify`), { headers: { Authorization: `Bearer ${getToken()}` } })
          .then((response) => readJson(response))
          .then((data) => {
            if (!data || data.ok !== true) throw new Error();
            const verified = data.verified === true;
            const comment = String(data.comment || "").trim();
            badge.className = `verify-badge ${verified ? "is-verified" : "is-pending"}`;
            badge.textContent = verified ? "Verified ✓" : "Awaiting review";
            const commentEl = badge.parentElement ? $(".verify-comment", badge.parentElement) : null;
            if (commentEl) commentEl.textContent = comment;
          })
          .catch(() => {
            badge.className = "verify-badge is-unavailable";
            badge.textContent = "Verification unavailable";
          });
      });
    };

    const renderSuccess = (reg) => {
      showView("success");
      setText("#success-name", (reg.name || "").split(" ")[0] || "delegate");
      setText("#success-eyebrow", editingId ? "APPLICATION UPDATED" : "REGISTRATION RECEIVED");
      setText("#application-id", `Reference: ${reg.applicationId}`);
      setText("#success-copy", editingId ? "Your changes have been saved. Keep your reference number for correspondence." : "Your registration is now with the CampMUN Secretariat. Keep your reference number for correspondence.");
      const details = $("#success-details", applicationPanel);
      if (details) details.innerHTML = [...[["Name", reg.name], ["Email", reg.email], ["School", reg.school], ["Registration type", reg.role], ["Committee", reg.committee]].map(([label, value]) => `<div><span>${label}</span><b>${escapeHtml(value)}</b></div>`), `<div class="verify-row"><span>Verification</span><b class="verify-badge is-pending" data-application="${escapeHtml(reg.applicationId)}">Checking…</b><small class="verify-comment"></small></div>`].join("");
      const next = $("#success-next", applicationPanel);
      if (next) next.hidden = !(account && account.accountType === "school" && ((delegateTotal - registrations.filter((reg) => !/faculty/i.test(reg.role)).length > 0) || (facultyTotal - registrations.filter((reg) => /faculty/i.test(reg.role)).length > 0)));
      const edit = $("#success-edit", applicationPanel); if (edit) edit.hidden = false;
      renderProgress(); renderSubmittedList();
    };

    const renderDone = () => {
      showView("done");
      const eyebrow = $("#done-eyebrow", applicationPanel);
      const heading = $("#done-heading", applicationPanel);
      const copy = $("#done-copy", applicationPanel);
      if (account && account.accountType === "school") {
        const delegateSlotsLeft = delegateTotal - registrations.filter((reg) => !/faculty/i.test(reg.role)).length;
        const facultySlotsLeft = facultyTotal - registrations.filter((reg) => /faculty/i.test(reg.role)).length;
        const allFull = delegateSlotsLeft <= 0 && facultySlotsLeft <= 0;
        if (eyebrow) eyebrow.textContent = allFull ? "ALL DELEGATES & FACULTY REGISTERED" : "YOUR DELEGATION IS REGISTERED";
        if (heading) heading.innerHTML = allFull ? "Your delegation is <em>complete.</em>" : "Your delegation is <em>registered.</em>";
        if (copy) copy.textContent = allFull ? "Every seat has been submitted. Use the list below to review or edit any application." : "Every delegate seat has been submitted. You can still register a faculty member below if needed.";
      } else {
        if (eyebrow) eyebrow.textContent = "APPLICATION SUBMITTED";
        if (heading) heading.innerHTML = "Your application is <em>submitted.</em>";
        if (copy) copy.textContent = "Your application is with the Secretariat. Keep your reference number for correspondence.";
      }
      renderCards(registrations, $("#done-list", applicationPanel));
      renderProgress(); renderSubmittedList();
    };

    const defaultView = () => { if (account && account.accountType === "school") { if (registrations.filter((reg) => !/faculty/i.test(reg.role)).length >= delegateTotal && registrations.filter((reg) => /faculty/i.test(reg.role)).length >= facultyTotal) renderDone(); else newRegistrationForm(); } else if (account && registrations.length >= 1) renderDone(); else newRegistrationForm(); };

    const newRegistrationForm = () => renderSeatForms();

    const editRegistration = (reg) => {
      editingId = reg.applicationId;
      showView("form");
      if (!formsRoot) return;
      formsRoot.innerHTML = "";
      const formEl = document.createElement("form");
      formEl.className = "registration-form multi-step-form seat-form";
      formEl.noValidate = true;
      const faculty = /faculty/i.test(reg.role);
      const hasAccount = Boolean(account);
      formEl.innerHTML = `
<input class="honeypot" name="campmun_hp" tabindex="-1" autocomplete="off" aria-hidden="true" data-lpignore="true" data-1p-ignore data-form-type="other">
<section class="form-step is-active">
<h2>Edit ${escapeHtml((reg.name || "").split(" ")[0] || "delegate")}'s application</h2>
<p class="form-intro">Update the details below and save your changes.</p>
${hasAccount ? `<div class="seat-meta"><span>${escapeHtml(reg.role)}</span><b>${escapeHtml(account.school || reg.school)}</b></div>` : ""}
<div class="field"><label>Full name</label><input name="name" value="${escapeHtml(reg.name)}" autocomplete="name" required></div>
<div class="field"><label>Email address</label><input name="email" type="email" value="${escapeHtml(reg.email)}" autocomplete="email" required></div>
${hasAccount ? `<input type="hidden" name="school" value="${escapeHtml(account.school || reg.school)}"><input type="hidden" name="role" value="${escapeHtml(reg.role)}">` : `<div class="field"><label>School</label><input name="school" value="${escapeHtml(reg.school)}" placeholder="School name" required></div>
<div class="field"><label>Registration type</label><select name="role">${["Delegate", "International Press", "Faculty Advisor"].map((role) => `<option value="${role}"${reg.role === role ? " selected" : ""}>${role}</option>`).join("")}</select></div>`}
<div class="field field-full"><label>Committee preference</label><select name="committee" required><option value="" disabled>Select your first preference</option>${committeeOptions}</select></div>
<label class="consent"><input name="consent" type="checkbox"${reg.consent === true ? " checked" : ""}><span>I consent to CampMUN using my information for application administration and communication.</span></label>
<div class="form-error" role="status" aria-live="polite" hidden></div>
<div class="step-actions"><button class="button-ghost" type="button" id="registration-cancel">Cancel</button><button class="button button-primary submit-button" type="submit">Save changes <span>→</span></button></div>
<p class="form-note">Each registered person needs a unique email address.</p>
</section>`;
      const cancelEl = $("#registration-cancel", formEl);
      if (cancelEl) cancelEl.addEventListener("click", () => { editingId = null; defaultView(); });
      const committeeSelectEl = $(`[name="committee"]`, formEl);
      if (committeeSelectEl) committeeSelectEl.value = reg.committee;
      const statusEl = $(".form-error", formEl);
      const submitBtn = $(".submit-button", formEl);
      let humanInteracted = false;
      const honeypotEl = $(".honeypot", formEl);
      if (honeypotEl) { honeypotEl.value = ""; formEl.addEventListener("focusin", () => { humanInteracted = true; honeypotEl.value = ""; }); }
      formEl.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!statusEl) return;
        statusEl.hidden = true;
        const data = new FormData(formEl);
        const honeypotFill = clean(data.get("campmun_hp"));
        if (honeypotFill && !humanInteracted) { statusEl.textContent = "A spam check fired. Please try submitting again — your details were not sent."; statusEl.hidden = false; return; }
        if (honeypotFill) { if (honeypotEl) honeypotEl.value = ""; data.set("campmun_hp", ""); }
        const name = clean(data.get("name")), email = clean(data.get("email")), school = clean(data.get("school")), role = clean(data.get("role")), committee = clean(data.get("committee"));
        if (!name || !email || !school || !role || !committee) { statusEl.textContent = "Please complete every required field above to continue."; statusEl.hidden = false; return; }
        if (!/^\S+@\S+\.\S+$/.test(email)) { statusEl.textContent = "Please enter a valid email address."; statusEl.hidden = false; return; }
        if (data.get("consent") !== "on") { statusEl.textContent = "Please accept the privacy consent to continue."; statusEl.hidden = false; return; }
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = "Saving changes…"; }
        try {
          const response = await fetch(api(`/api/registrations/${encodeURIComponent(reg.applicationId)}`), { method: "PUT", headers: { "Content-Type": "application/json", ...(account ? { Authorization: `Bearer ${getToken()}` } : {}) }, body: JSON.stringify({ name, email, school, role, committee, consent: true }) });
          const result = await readJson(response);
          if (!response.ok || !result.ok) throw new Error(result.message || "We could not update the application.");
          await loadState();
          toast("Application updated.");
          renderSuccess(result.registration || { applicationId: reg.applicationId, name, email, school, role, committee });
          editingId = null;
        } catch (error) {
          const message = error instanceof TypeError ? "Registration service is offline. Please start the CampMUN Node server and try again." : (error.message || "We could not update the application. Please try again.");
          statusEl.textContent = message; statusEl.hidden = false;
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = "Save changes <span>→</span>"; }
        }
      });
      formsRoot.append(formEl);
      renderProgress(); renderSubmittedList();
    };

    const loadState = async () => {
      if (!account || !featureOn("auth")) { delegateTotal = 1; facultyTotal = 0; registrations = []; return; }
      try {
        const response = await fetch(api("/api/registrations/mine"), { headers: { Authorization: `Bearer ${getToken()}` } });
        const data = await readJson(response);
        if (response.ok && data.ok) { delegateTotal = data.delegateTotal || 1; facultyTotal = data.facultyTotal || 0; registrations = data.registrations || []; }
      } catch {}
    };

    const nextButton = $("#success-next", applicationPanel); if (nextButton) nextButton.addEventListener("click", () => { clearStatus(); newRegistrationForm(); });
    const editSuccess = $("#success-edit", applicationPanel); if (editSuccess) editSuccess.addEventListener("click", () => { const current = editingId ? registrations.find((reg) => reg.applicationId === editingId) : registrations[registrations.length - 1]; if (current) editRegistration(current); });
    const cancelEdit = $("#registration-cancel", applicationPanel); if (cancelEdit) cancelEdit.addEventListener("click", () => { clearStatus(); defaultView(); });

    const renderAccount = (user) => {
      account = user || null; editingId = null;
      if (settingsPanel) settingsPanel.hidden = true;
      if (!user) { registrations = []; delegateTotal = 1; facultyTotal = 0; }
      if (user) {
        authPanel.hidden = true; applicationPanel.hidden = false;
        setText("#applicant-name", user.name || ""); setText("#applicant-email", user.email || "");
        loadState().then(defaultView);
      } else if (featureOn("auth")) { authPanel.hidden = false; applicationPanel.hidden = true; }
      else { authPanel.hidden = true; applicationPanel.hidden = false; newRegistrationForm(); }
    };

    $$(".auth-tab", authPanel).forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
    $$(".auth-alt button", authPanel).forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
    $$('input[name="accountType"]', authPanel).forEach((radio) => radio.addEventListener("change", () => {
      $$(".auth-kind", authPanel).forEach((kind) => kind.classList.remove("is-selected"));
      const matched = $(`input[value="${radio.value}"]`, authPanel); if (matched) matched.closest(".auth-kind")?.classList.add("is-selected");
      const schoolFields = $("#signup-school-fields", authPanel);
      const individualFields = $("#signup-individual-fields", authPanel);
      if (radio.value === "school") { if (schoolFields) schoolFields.disabled = false; if (individualFields) individualFields.disabled = true; }
      else { if (schoolFields) schoolFields.disabled = true; if (individualFields) individualFields.disabled = false; }
    }));
    const signupForm = $("#signup-form", authPanel);
    if (signupForm) signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!validateAuth(signupForm)) return;
      const accountType = $('input[name="accountType"]:checked', authPanel).value;
      const active = accountType === "school" ? $("#signup-school-fields", authPanel) : $("#signup-individual-fields", authPanel);
      const read = (name) => { const element = active?.querySelector(`[name="${name}"]`); return element ? element.value.trim() : ""; };
      const payload = {
        accountType, firstName: read("firstName"), lastName: read("lastName"), email: read("email"), password: read("password"),
        school: read("school"), city: read("city"), country: read("country"), phone: read("phone"), consent: $("#signup-consent", authPanel).checked,
        ...(accountType === "school"
          ? { delegates: read("delegates"), faculty: read("faculty"), teacherName: read("teacherName"), teacherMobile: read("teacherMobile"), teacherEmail: read("teacherEmail") }
          : { grade: read("grade"), committeePreferences: read("committeePreferences"), whyIndividual: read("whyIndividual"), whyAccepted: read("whyAccepted"), experience: read("experience") })
      };
      const submit = $("#signup-submit", authPanel); submit.disabled = true; submit.innerHTML = "Creating account…";
      try {
        const response = await fetch(api("/api/auth/signup"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = await readJson(response);
        if (!response.ok || !result.ok) throw new Error(result.message || "We could not create your account.");
        setToken(result.token); renderAccount(result.user); toast("Account created. Welcome to CampMUN.");
      } catch (error) { showAuthError("#auth-error", error instanceof TypeError ? "Account service is offline. Please start the CampMUN Node server and try again." : (error.message || "We could not create your account.")); }
      finally { submit.disabled = false; submit.innerHTML = "Create account <span>→</span>"; }
    });
    const loginForm = $("#login-form", authPanel);
    if (loginForm) loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!validateAuth(loginForm)) return;
      const submit = $("#login-submit", authPanel); submit.disabled = true; submit.innerHTML = "Logging in…";
      try {
        const response = await fetch(api("/api/auth/login"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: $("#login-email", authPanel).value, password: $("#login-password", authPanel).value }) });
        const result = await readJson(response);
        if (!response.ok || !result.ok) throw new Error(result.message || "We could not log you in.");
        setToken(result.token); renderAccount(result.user); toast(`Welcome back, ${result.user.name.split(" ")[0]}.`);
      } catch (error) { showAuthError("#login-error", error instanceof TypeError ? "Account service is offline. Please start the CampMUN Node server and try again." : (error.message || "We could not log you in.")); }
      finally { submit.disabled = false; submit.innerHTML = "Log in <span>→</span>"; }
    });
    const settingsButton = $("#settings-button", applicationPanel);
    if (settingsButton) settingsButton.addEventListener("click", openSettings);
    const settingsBack = $("#settings-back", applicationPanel);
    if (settingsBack) settingsBack.addEventListener("click", closeSettings);
    if (settingsForm) settingsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!settingsError) return;
      settingsError.hidden = true;
      const data = new FormData(settingsForm);
      const honeypotFill = clean(data.get("campmun_hp"));
      if (honeypotFill) { settingsError.textContent = "A spam check fired. Please try again."; settingsError.hidden = false; return; }
      const firstName = clean(data.get("firstName")), lastName = clean(data.get("lastName")), email = clean(data.get("email"));
      const currentPassword = data.get("currentPassword") || "";
      const newPassword = data.get("newPassword") || "";
      if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || !currentPassword) { settingsError.textContent = "Please complete every field, including your current password."; settingsError.hidden = false; toast("Please complete every field."); return; }
      const payload = { firstName, lastName, email, currentPassword };
      if (newPassword) payload.newPassword = newPassword;
      if (account && account.accountType === "school") {
        payload.numDelegates = clean(data.get("numDelegates")) || undefined;
        payload.numFaculty = clean(data.get("numFaculty")) || undefined;
      }
      const submit = $("#settings-save", applicationPanel); if (submit) { submit.disabled = true; submit.innerHTML = "Saving…"; }
      try {
        const response = await fetch(api("/api/auth/account"), { method: "PUT", headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) }, body: JSON.stringify(payload) });
        const result = await readJson(response);
        if (!response.ok || !result.ok) throw new Error(result.message || "We could not update your account.");
        renderAccount(result.user);
        toast("Account details updated.");
        closeSettings();
      } catch (error) {
        settingsError.textContent = error instanceof TypeError ? "Account service is offline. Please start the CampMUN Node server and try again." : (error.message || "We could not update your account.");
        settingsError.hidden = false;
        toast(settingsError.textContent);
      } finally { if (submit) { submit.disabled = false; submit.innerHTML = "Save changes <span>→</span>"; } }
    });
    const logoutButton = $("#logout-button", applicationPanel);
    if (logoutButton) logoutButton.addEventListener("click", async () => {
      try { const token = getToken(); if (token) await fetch(api("/api/auth/logout"), { method: "POST", headers: { Authorization: `Bearer ${token}` } }); } catch {}
      clearToken(); renderAccount(null); toast("You have signed out.");
    });
    const restore = () => {
      const token = getToken();
      if (!token) { renderAccount(null); return; }
      fetch(api("/api/auth/me"), { headers: { Authorization: `Bearer ${token}` } }).then((response) => readJson(response)).then((result) => { if (result.ok && result.user) renderAccount(result.user); else { clearToken(); renderAccount(null); } }).catch(() => renderAccount(null));
    };
    restore();
  }

})();
