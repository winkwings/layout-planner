/* =====================================================================
 * TODO-PORTAL  STORAGE STUB  (temporary, clearly marked)
 * =====================================================================
 * The original planner saved everything in localStorage. The planner code
 * now calls SofaPlannerStorage.getItem / setItem instead. This stub:
 *
 *  1. LOADING: gives the planner the layout that the SERVER sent with the
 *     page (json_script "sp-initial-layout"). The server is the source of
 *     truth.
 *  2. OLD BEHAVIOUR KEPT: every planner change is still written to the
 *     browser as an UNSAVED DRAFT, so a page refresh does not lose work.
 *     The draft key includes the user id and layout id, so drafts do not
 *     mix between users or layouts. A draft is only restored if it was
 *     based on the SAME server version; otherwise it is thrown away.
 *     (Draft rules are an open question: see OPEN_QUESTIONS.md.)
 *  3. SAVING: the "Save layout" button sends the layout to the server save
 *     route (POST, JSON, CSRF token, version number). Success is only
 *     shown after the server confirms. Nothing saves automatically.
 *
 * Other keys (sofa name list, panel open/closed) pass straight through to
 * localStorage, exactly as before.
 * ===================================================================== */
(function () {
  "use strict";

  var PLAN_KEY = "sofaPlanner.v1";        // planner's main state key (unchanged)
  var NAME_KEY = "sofaPlanner.names.v1";  // planner's sofa-name list key (unchanged)

  var root = document.getElementById("sp-editor");
  var form = document.getElementById("sp-saveform");
  var nameInput = document.getElementById("sp-layout-name");
  var saveBtn = document.getElementById("sp-save");
  var statusEl = document.getElementById("sp-status");

  // Page settings written by the server into data-* attributes.
  var cfg = {
    saveUrl: root.dataset.saveUrl,
    version: parseInt(root.dataset.version, 10) || 0,
    openedAs: parseInt(root.dataset.openedAs, 10),
    layoutId: root.dataset.layoutId || "new",
    modelName: root.dataset.sofaModelName || ""
  };

  var initialEl = document.getElementById("sp-initial-layout");
  var serverPlan = initialEl ? JSON.parse(initialEl.textContent) : null;
  var lastSavedJson = serverPlan ? JSON.stringify(serverPlan) : null;
  var latestPlan = serverPlan;
  var saving = false;

  // ---------- small helpers ----------
  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function lsRemove(k) { try { localStorage.removeItem(k); } catch (_) {} }
  function draftKey() { return "sofaPlanner.draft.u" + cfg.openedAs + "." + cfg.layoutId; }

  function setStatus(text, state) {
    statusEl.textContent = text;
    statusEl.setAttribute("data-state", state || "info"); // styled by editor-page.css
  }

  function readDraft() {
    try {
      var d = JSON.parse(lsGet(draftKey()) || "null");
      return d && typeof d === "object" && d.plan ? d : null;
    } catch (_) { return null; }
  }

  function isDirty() {
    return latestPlan !== null && JSON.stringify(latestPlan) !== lastSavedJson;
  }

  function markDirtyState() {
    if (isDirty()) setStatus("Unsaved changes (kept in this browser only).", "warn");
  }

  // ---------- storage API used by sofa-planner.js ----------
  function getItem(key) {
    if (key === PLAN_KEY) {
      var draft = readDraft();
      if (draft && draft.basedOn === cfg.version) {
        latestPlan = draft.plan;
        markDirtyState();
        return JSON.stringify(draft.plan);
      }
      if (draft) {
        // The server copy changed since this draft was made. Do not mix them.
        lsRemove(draftKey());
        setStatus("Old unsaved browser changes were discarded because the layout changed on the server.", "warn");
      }
      return serverPlan ? JSON.stringify(serverPlan) : null;
    }
    if (key === NAME_KEY && cfg.modelName) {
      // Show the saved sofa model name in the planner's name picker.
      var d = null;
      try { d = JSON.parse(lsGet(key) || "null"); } catch (_) {}
      if (!d || typeof d !== "object") d = {};
      if (Array.isArray(d.names) && d.names.length && d.names.indexOf(cfg.modelName) === -1) {
        d.names = d.names.concat([cfg.modelName]);
      }
      d.selected = cfg.modelName;
      return JSON.stringify(d);
    }
    return lsGet(key);
  }

  function setItem(key, value) {
    if (key === PLAN_KEY) {
      latestPlan = JSON.parse(value);
      lsSet(draftKey(), JSON.stringify({ basedOn: cfg.version, plan: latestPlan }));
      markDirtyState();
      return;
    }
    lsSet(key, value);
  }

  // ---------- server save ----------
  function csrfToken() {
    var el = root.querySelector("input[name=csrfmiddlewaretoken]");
    return el ? el.value : "";
  }

  function currentModelName() {
    var el = document.getElementById("nameCurrent");
    return el ? el.textContent.trim() : "";
  }

  function layoutDataToSend() {
    // Empty new layout: the planner has not written any state yet.
    return latestPlan || { pieces: [], room: {}, unit: "cm" };
  }

  function firstFieldError(fields) {
    if (!fields) return "";
    var keys = Object.keys(fields);
    return keys.length ? " (" + keys[0] + ": " + fields[keys[0]] + ")" : "";
  }

  function finish() {
    saving = false;
    saveBtn.disabled = false;
    saveBtn.removeAttribute("aria-busy");
  }

  function saveToServer() {
    if (saving) return; // ignore repeated clicks while a save is running
    if (!nameInput.value.trim()) {
      setStatus("Please enter a layout name.", "error");
      nameInput.focus();
      return;
    }
    saving = true;
    saveBtn.disabled = true;
    saveBtn.setAttribute("aria-busy", "true");
    setStatus("Saving…", "pending");

    var body = {
      name: nameInput.value,
      sofa_model_name: currentModelName(),
      layout_data: layoutDataToSend(),
      opened_as: cfg.openedAs
    };
    if (cfg.layoutId !== "new") body.version = cfg.version;
    var sentJson = JSON.stringify(body.layout_data);

    fetch(cfg.saveUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) {
          handleResponse(res.status, data, sentJson);
        });
      })
      .catch(function () {
        // Network failure: never pretend it worked.
        setStatus("Network error. Your layout was NOT saved. Please try again.", "error");
      })
      .then(finish);
  }

  function handleResponse(status, data, sentJson) {
    if ((status === 200 || status === 201) && data && data.ok) {
      var oldDraftKey = draftKey();
      cfg.version = data.version;
      cfg.layoutId = String(data.id);
      cfg.saveUrl = data.save_url;
      lastSavedJson = sentJson;
      if (oldDraftKey !== draftKey()) lsRemove(oldDraftKey); // "new" draft is now a real layout
      lsSet(draftKey(), JSON.stringify({ basedOn: cfg.version, plan: JSON.parse(sentJson) }));
      if (window.location.pathname !== data.edit_url) history.replaceState(null, "", data.edit_url);
      setStatus("Saved. Version " + data.version + ".", "success");
      markDirtyState(); // edits made while saving are still unsaved
      return;
    }
    var code = data && data.error;
    if (code === "version_conflict") {
      setStatus("Not saved: this layout was changed somewhere else (now version " +
        data.current_version + "). Copy anything you need, then reload the page.", "error");
    } else if (code === "identity_changed") {
      setStatus("Not saved: you are signed in as a different user now. Reload the page.", "error");
    } else if (status === 401) {
      setStatus("Not saved: your session has ended. Please sign in again.", "error");
    } else if (status === 403) {
      // Also covers a failed CSRF check (Django answers with an HTML 403 page).
      setStatus("Not saved: permission or security check failed. Reload the page and try again.", "error");
    } else if (status === 400) {
      setStatus("Not saved: " + ((data && data.message) || "invalid input.") + firstFieldError(data && data.fields), "error");
    } else if (status === 404) {
      setStatus("Not saved: this layout no longer exists or you cannot open it.", "error");
    } else {
      setStatus("Not saved: server error. Please try again later.", "error");
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    saveToServer();
  });

  window.SofaPlannerStorage = { getItem: getItem, setItem: setItem, saveToServer: saveToServer };
})();
