(function () {
  const CertApp = window.CertApp;

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeLowerAscii(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function inferJuizFromNome(nomeRaw) {
    const raw = String(nomeRaw || "").trim();
    const first = raw.split(/\s+/).filter(Boolean)[0] || "";
    const n = normalizeLowerAscii(first).replace(/[^a-z]/g, "");
    if (!n) return { label: "", confidence: "" };

    // Conservative lists: only "strong" hits auto-correct.
    const STRONG_F = new Set([
      "ana",
      "beatriz",
      "camila",
      "carla",
      "fernanda",
      "julia",
      "juliana",
      "leticia",
      "lucia",
      "maria",
      "patricia",
      "priscila",
      "renata",
      "vera",
    ]);
    const STRONG_M = new Set([
      "antonio",
      "carlos",
      "francisco",
      "joao",
      "jose",
      "luiz",
      "luis",
      "marcos",
      "mario",
      "paulo",
      "pedro",
      "vitor",
      "victor",
    ]);

    if (STRONG_F.has(n)) return { label: "Juíza", confidence: "strong" };
    if (STRONG_M.has(n)) return { label: "Juiz", confidence: "strong" };

    // Weak heuristics: ask before changing.
    const MALE_A_EXCEPTIONS = new Set(["luca", "josua", "joshua"]);
    if (n.endsWith("a") && !MALE_A_EXCEPTIONS.has(n)) return { label: "Juíza", confidence: "weak" };
    if (n.endsWith("o")) return { label: "Juiz", confidence: "weak" };

    return { label: "", confidence: "" };
  }

  function isNomeEndingAorO(nomeRaw) {
    const raw = String(nomeRaw || "").trim();
    const first = raw.split(/\s+/).filter(Boolean)[0] || "";
    const n = normalizeLowerAscii(first).replace(/[^a-z]/g, "");
    if (!n) return false;
    return n.endsWith("a") || n.endsWith("o");
  }

  function maybeSuggestJuizForNome({ nome, juiz, setSelectValue }) {
    const cur = String(juiz || "").trim();
    const sug = inferJuizFromNome(nome);
    if (!sug.label) {
      // If the first name doesn't follow the simple "ends with a/o" rule, ask the user to confirm.
      if (!isNomeEndingAorO(nome)) {
        const ok = confirm(
          `Você selecionou "${cur}".\nO nome "${nome}" não segue a regra simples (terminar com "a" ou "o").\n\nClique em OK para confirmar "${cur}".\nClique em Cancelar para ajustar manualmente.`,
        );
        return { juiz: cur, changed: false, abort: !ok };
      }
      return { juiz: cur, changed: false, abort: false };
    }
    if (cur === sug.label) return { juiz: cur, changed: false };

    if (sug.confidence === "strong") {
      // Preview the automatic change, then ask the user if they want to keep it.
      if (typeof setSelectValue === "function") setSelectValue(sug.label);
      const ok = confirm(
        `O sistema alterou automaticamente para "${sug.label}" com base no nome "${nome}".\n\nClique em OK para manter "${sug.label}".\nClique em Cancelar para voltar para "${cur}".`,
      );
      if (!ok && typeof setSelectValue === "function") setSelectValue(cur);
      return { juiz: ok ? sug.label : cur, changed: ok, abort: false };
    }

    // Weak heuristic: ask if the user's chosen option is correct.
    const ok = confirm(
      `Você selecionou "${cur}".\nO nome "${nome}" parece indicar "${sug.label}".\n\nClique em OK para manter "${cur}".\nClique em Cancelar para trocar para "${sug.label}".`,
    );
    if (!ok && typeof setSelectValue === "function") setSelectValue(sug.label);
    return { juiz: ok ? cur : sug.label, changed: !ok, abort: false };
  }

  // Formats digits as: 0000000-00.0000.0.00.0000 (CNJ-like)
  function formatProcessNumber(digits) {
    const d = String(digits || "").replace(/\D/g, "").slice(0, 20);
    const seg = [
      d.slice(0, 7),
      d.slice(7, 9),
      d.slice(9, 13),
      d.slice(13, 14),
      d.slice(14, 16),
      d.slice(16, 20),
    ];

    let out = "";
    if (seg[0]) out += seg[0];
    if (seg[1]) out += "-" + seg[1];
    if (seg[2]) out += "." + seg[2];
    if (seg[3]) out += "." + seg[3];
    if (seg[4]) out += "." + seg[4];
    if (seg[5]) out += "." + seg[5];
    return out;
  }

  // Supports "proc1 / proc2" (optional second process).
  function formatProcessRef(raw) {
    const s = String(raw || "");
    const parts = s.split("/");
    const left = formatProcessNumber(parts[0] || "");
    const right = parts.length > 1 ? formatProcessNumber(parts.slice(1).join("/") || "") : "";

    const hasSlash = s.includes("/");
    if (hasSlash) return `${left}${left || right ? " / " : "/"}${right}`;
    return left;
  }

  function computeCnjCheckDigits(digits20) {
    const d = String(digits20 || "").replace(/\D/g, "");
    if (d.length !== 20) return "";

    const seq = d.slice(0, 7);
    const year = d.slice(9, 13);
    const seg = d.slice(13, 14);
    const tr = d.slice(14, 16);
    const org = d.slice(16, 20);

    const base = `${seq}${year}${seg}${tr}${org}00`;
    const mod = BigInt(base) % 97n;
    const dd = 98n - mod;
    const n = Number(dd);
    if (!Number.isFinite(n) || n < 0) return "";
    return String(n).padStart(2, "0");
  }

  function isValidCnjProcess(digits20) {
    const d = String(digits20 || "").replace(/\D/g, "");
    if (d.length !== 20) return false;

    const seq = d.slice(0, 7);
    const dd = d.slice(7, 9);
    const year = d.slice(9, 13);
    const seg = d.slice(13, 14);
    const tr = d.slice(14, 16);
    const org = d.slice(16, 20);

    const expected = computeCnjCheckDigits(d);
    if (!expected || expected !== dd) return false;

    // Official check: (seq+year+seg+tr+org+dd) mod 97 == 1
    const all = `${seq}${year}${seg}${tr}${org}${dd}`;
    return BigInt(all) % 97n === 1n;
  }

  function validateLoteRefCnj(elRef) {
    if (!elRef) return true;

    const raw = String(elRef.value || "").trim();
    clearInlineError(elRef);
    try {
      elRef.setCustomValidity("");
    } catch {
      // ignore
    }

    if (!raw) return true;

    const parts = raw
      .split("/")
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    for (let i = 0; i < parts.length; i++) {
      const digits = parts[i].replace(/\D/g, "");
      if (digits.length !== 20) {
        const msg = parts.length > 1 ? `Complete o ${i === 0 ? "1º" : "2º"} número do processo.` : "Complete o número do processo.";
        showInlineError(elRef, msg);
        try {
          elRef.setCustomValidity(msg);
        } catch {
          // ignore
        }
        return false;
      }
      if (!isValidCnjProcess(digits)) {
        const msg = "Número de Processo Inválido.";
        showInlineError(elRef, msg);
        try {
          elRef.setCustomValidity(msg);
        } catch {
          // ignore
        }
        return false;
      }
    }

    return true;
  }

  function applyMaskedValue(inputEl, formatFn) {
    if (!inputEl) return;
    const raw = String(inputEl.value || "");
    const caret = typeof inputEl.selectionStart === "number" ? inputEl.selectionStart : raw.length;
    const digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length;

    const formatted = formatFn(raw);
    if (formatted === raw) return;
    inputEl.value = formatted;

    // Restore caret based on how many digits were before the caret.
    if (typeof inputEl.setSelectionRange === "function") {
      let pos = formatted.length;
      if (digitsBefore > 0) {
        let seen = 0;
        for (let i = 0; i < formatted.length; i++) {
          if (/\d/.test(formatted[i])) seen++;
          if (seen >= digitsBefore) {
            pos = i + 1;
            break;
          }
        }
      } else {
        pos = 0;
      }
      try {
        inputEl.setSelectionRange(pos, pos);
      } catch {
        // ignore
      }
    }
  }

  function getOrCreateInlineErrorEl(inputEl) {
    if (!inputEl || !inputEl.parentElement) return null;
    const parent = inputEl.parentElement;
    const existing = parent.querySelector("[data-certapp-inline-error]");
    if (existing) return existing;
    const div = document.createElement("div");
    div.setAttribute("data-certapp-inline-error", "1");
    div.className = "mt-1 text-[11px] text-red-700";
    parent.appendChild(div);
    return div;
  }

  function showInlineError(inputEl, message) {
    const msg = String(message || "").trim();
    if (!inputEl) return;
    const err = getOrCreateInlineErrorEl(inputEl);
    if (err) err.innerText = msg;
    try {
      inputEl.setAttribute("aria-invalid", "true");
    } catch {
      // ignore
    }
  }

  function clearInlineError(inputEl) {
    if (!inputEl) return;
    const err = getOrCreateInlineErrorEl(inputEl);
    if (err) err.innerText = "";
    try {
      inputEl.removeAttribute("aria-invalid");
    } catch {
      // ignore
    }
  }

  function timeToMinutes(v) {
    const s = String(v || "").trim();
    const m = /^(\d{2}):(\d{2})$/.exec(s);
    if (!m) return NaN;
    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return NaN;
    return hh * 60 + mm;
  }

  function validateEndAfterStart(startEl, endEl) {
    if (!startEl || !endEl) return true;
    const startV = String(startEl.value || "").trim();
    const endV = String(endEl.value || "").trim();
    if (!startV || !endV) {
      clearInlineError(endEl);
      return true;
    }

    const startM = timeToMinutes(startV);
    const endM = timeToMinutes(endV);
    if (!Number.isFinite(startM) || !Number.isFinite(endM)) {
      clearInlineError(endEl);
      return true;
    }

    if (endM > startM) {
      clearInlineError(endEl);
      return true;
    }

    showInlineError(endEl, "A hora de fim deve ser maior que a hora de início.");
    return false;
  }

  function confirmIfSuspiciousDuration(startEl, endEl) {
    if (!startEl || !endEl) return true;

    const startV = String(startEl.value || "").trim();
    const endV = String(endEl.value || "").trim();
    if (!startV || !endV) return true;

    const startM = timeToMinutes(startV);
    const endM = timeToMinutes(endV);
    if (!Number.isFinite(startM) || !Number.isFinite(endM)) return true;

    const diff = endM - startM;
    if (diff <= 0) return true; // handled elsewhere

    const key = `${startV}|${endV}`;
    if (endEl.dataset && endEl.dataset.certappDurationOk === key) return true;

    if (diff <= 10 || diff >= 45) {
      const ok = confirm(
        `A duração da palestra ficou em ${diff} minutos (${startV} às ${endV}).\n\nO tempo de palestra está realmente correto?`,
      );
      if (ok) {
        if (endEl.dataset) endEl.dataset.certappDurationOk = key;
        clearInlineError(endEl);
        return true;
      }

      if (endEl.dataset) delete endEl.dataset.certappDurationOk;
      showInlineError(endEl, `Verifique o tempo de palestra: ${diff} min.`);
      return false;
    }

    if (endEl.dataset) delete endEl.dataset.certappDurationOk;
    return true;
  }

  function bindTimePair(startId, endId) {
    const startEl = el(startId);
    const endEl = el(endId);
    if (!startEl || !endEl) return;
    const keyNow = () => `${String(startEl.value || "").trim()}|${String(endEl.value || "").trim()}`;

    const onInput = () => {
      // If the user changes any time value, reset the last confirmation.
      if (endEl.dataset && endEl.dataset.certappDurationOk && endEl.dataset.certappDurationOk !== keyNow()) {
        delete endEl.dataset.certappDurationOk;
      }
      validateEndAfterStart(startEl, endEl);
    };

    const onChange = () => {
      if (!validateEndAfterStart(startEl, endEl)) {
        if (endEl.dataset) delete endEl.dataset.certappDurationOk;
        return;
      }
      confirmIfSuspiciousDuration(startEl, endEl);
    };

    startEl.addEventListener("input", onInput);
    endEl.addEventListener("input", onInput);
    startEl.addEventListener("change", onChange);
    endEl.addEventListener("change", onChange);
    onInput();
  }

  const POSTOS = {
    Marinha: [
      { label: "Almirante de Esquadra", abbr: "Alte Esq" },
      { label: "Vice-Almirante", abbr: "V Alte" },
      { label: "Contra-Almirante", abbr: "C Alte" },
      { label: "Capitão de Mar e Guerra", abbr: "CMG" },
      { label: "Capitão de Fragata", abbr: "CF" },
      { label: "Capitão de Corveta", abbr: "CC" },
      { label: "Capitão-Tenente", abbr: "CT" },
      { label: "Primeiro-Tenente", abbr: "1º Ten" },
      { label: "Segundo-Tenente", abbr: "2º Ten" },
    ],
    "Aeronáutica": [
      { label: "Tenente-Brigadeiro", abbr: "Ten Brig" },
      { label: "Major-Brigadeiro", abbr: "Maj Brig" },
      { label: "Brigadeiro", abbr: "Brig" },
      { label: "Coronel", abbr: "Cel" },
      { label: "Tenente-Coronel", abbr: "TC" },
      { label: "Major", abbr: "Maj" },
      { label: "Capitão", abbr: "Cap" },
      { label: "1º Tenente", abbr: "1º Ten" },
      { label: "2º Tenente", abbr: "2º Ten" },
    ],
    "Exército": [
      { label: "General de Exército", abbr: "Gen Ex" },
      { label: "General de Divisão", abbr: "Gen Div" },
      { label: "General de Brigada", abbr: "Gen Bda" },
      { label: "Coronel", abbr: "Cel" },
      { label: "Tenente-Coronel", abbr: "TC" },
      { label: "Major", abbr: "Maj" },
      { label: "Capitão", abbr: "Cap" },
      { label: "1º Tenente", abbr: "1º Ten" },
      { label: "2º Tenente", abbr: "2º Ten" },
    ],
  };

  function postosForForca(forca) {
    const f = String(forca || "").trim();
    if (POSTOS[f]) return POSTOS[f];
    return [];
  }

  function isValidPostoAbbr(forca, abbr) {
    const a = String(abbr || "").trim();
    if (!a) return false;
    return postosForForca(forca).some((p) => p.abbr === a);
  }

  function fillPostoSelect(selectEl, forca, currentAbbr) {
    if (!selectEl) return;
    const list = postosForForca(forca);
    const cur = String(currentAbbr || "").trim();
    const opts = [`<option value="">Selecione...</option>`].concat(
      list.map((p) => `<option value="${escapeHtml(p.abbr)}" ${p.abbr === cur ? "selected" : ""}>${escapeHtml(p.label)}</option>`),
    );
    selectEl.innerHTML = opts.join("");
  }

  function getModo() {
    const v = String((el("loteModo") && el("loteModo").value) || "").trim();
    return normalizeLowerAscii(v) || "especial";
  }

  function getLockedForce() {
    const modo = getModo();
    if (!modo.includes("especial")) return "";
    return String((el("espForca") && el("espForca").value) || "").trim();
  }

  function setTab(which) {
    const isLote = which === "lote";
    const pageLote = el("pageLote");
    const pageEdit = el("pageEdit");
    const tabLote = el("tabLote");
    const tabEdit = el("tabEdit");
    const btnReset = el("btnResetFonts");

    if (pageLote) pageLote.classList.toggle("hidden", !isLote);
    if (pageEdit) pageEdit.classList.toggle("hidden", isLote);

    if (tabLote) {
      tabLote.classList.toggle("bg-slate-900", isLote);
      tabLote.classList.toggle("text-white", isLote);
      tabLote.classList.toggle("bg-white", !isLote);
      tabLote.classList.toggle("text-slate-800", !isLote);
    }
    if (tabEdit) {
      tabEdit.classList.toggle("bg-slate-900", !isLote);
      tabEdit.classList.toggle("text-white", !isLote);
      tabEdit.classList.toggle("bg-white", isLote);
      tabEdit.classList.toggle("text-slate-800", isLote);
    }
    if (btnReset) btnReset.classList.toggle("hidden", isLote);

    try {
      localStorage.setItem("CertApp_Tab_V1", which);
    } catch {
      // ignore
    }
  }

  let editingIdx = -1;
  let lastModo = "";

  function renderParticipants(list) {
    const pList = el("pList");
    const pCount = el("pCount");
    if (!pList || !pCount) return;

    const items = Array.isArray(list) ? list : [];
    const lockedForce = getLockedForce();

    pCount.innerText = String(items.length);

    if (items.length === 0) {
      pList.innerHTML = `<div class="p-3 text-xs text-emerald-900/70">Nenhum participante ainda.</div>`;
      return;
    }

    pList.innerHTML = items
      .map((x, idx) => {
        const nome = escapeHtml((x && x.nome) || "");
        const forcaRaw = lockedForce || ((x && x.forca) || "");
        const forca = escapeHtml(forcaRaw);
        const postoAbbrRaw = String((x && x.posto) || "").trim();
        const postoAbbr = escapeHtml(postoAbbrRaw);
        const juiz = escapeHtml((x && x.juiz) || "");
        const prefix = forca
          ? `<span class="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-mono mr-2">${forca}</span>`
          : "";
        const postoBadge = postoAbbr
          ? `<span class="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-900 text-[10px] font-mono mr-2">${postoAbbr}</span>`
          : "";

        if (idx === editingIdx) {
          const forceDisabled = lockedForce ? "disabled" : "";
          const listPostos = postosForForca(forcaRaw);
          const postoOptions = [`<option value="">Selecione...</option>`]
            .concat(
              listPostos.map(
                (p) => `<option value="${escapeHtml(p.abbr)}" ${p.abbr === postoAbbrRaw ? "selected" : ""}>${escapeHtml(p.label)}</option>`,
              ),
            )
            .join("");
          return `
            <div class="p-3" data-p-row="${idx}">
              <div class="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                <div class="md:col-span-1">
                  <label class="block text-[10px] font-bold uppercase text-slate-700">Força</label>
                  <select data-edit-forca class="w-full p-2 border border-slate-300 rounded bg-white text-gray-700" ${forceDisabled}>
                    <option value="Exército" ${forcaRaw === "Exército" ? "selected" : ""}>Exército</option>
                    <option value="Marinha" ${forcaRaw === "Marinha" ? "selected" : ""}>Marinha</option>
                    <option value="Aeronáutica" ${forcaRaw === "Aeronáutica" ? "selected" : ""}>Aeronáutica</option>
                  </select>
                </div>
                <div class="md:col-span-1">
                  <label class="block text-[10px] font-bold uppercase text-slate-700">Posto</label>
                  <select data-edit-posto class="w-full p-2 border border-slate-300 rounded bg-white text-gray-700">${postoOptions}</select>
                </div>
                <div class="md:col-span-2">
                  <label class="block text-[10px] font-bold uppercase text-slate-700">Nome</label>
                  <input data-edit-nome type="text" class="border rounded p-2 w-full" value="${nome}" />
                </div>
                <div class="md:col-span-1">
                  <label class="block text-[10px] font-bold uppercase text-slate-700">Juiz/Juíza</label>
                  <select data-edit-juiz class="w-full p-2 border border-slate-300 rounded bg-white text-gray-700">
                    <option value="Juiz" ${juiz === "Juiz" ? "selected" : ""}>Juiz</option>
                    <option value="Juíza" ${juiz === "Juíza" ? "selected" : ""}>Juíza</option>
                  </select>
                </div>
                <div class="md:col-span-1 flex gap-2">
                  <button data-p-save class="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-3 rounded text-xs">Salvar</button>
                  <button data-p-cancel class="bg-white hover:bg-slate-100 text-slate-800 font-bold py-2 px-3 rounded border border-slate-300 text-xs">Cancelar</button>
                </div>
              </div>
              ${lockedForce ? `<div class="mt-2 text-[11px] text-slate-600">Força travada pelo Conselho Especial: <span class="font-mono">${escapeHtml(lockedForce)}</span></div>` : ""}
            </div>
          `;
        }

        return `
          <div class="p-3 flex items-center justify-between gap-3" data-p-row="${idx}">
            <div class="min-w-0">
              <div class="font-bold text-sm text-slate-900 truncate">${prefix}${postoBadge}${nome}</div>
              <div class="text-[11px] text-slate-600 font-mono">${(lockedForce || (x && x.forca)) ? "" : "SEM_FORCA • "}${juiz || "SEM_JUIZ"}</div>
            </div>
            <div class="flex items-center gap-3">
              <button data-p-edit="${idx}" class="text-xs text-slate-700 underline hover:text-slate-900">Editar</button>
              <button data-p-del="${idx}" class="text-xs text-red-600 underline hover:text-red-800">Remover</button>
            </div>
          </div>
        `;
      })
      .join("");

    pList.querySelectorAll("[data-p-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.getAttribute("data-p-del"), 10);
        const cur = CertApp.participants.load(getModo());
        if (!Number.isFinite(i) || i < 0 || i >= cur.length) return;
        cur.splice(i, 1);
        CertApp.participants.save(cur, getModo());
        if (editingIdx === i) editingIdx = -1;
        renderParticipants(cur);
      });
    });

    pList.querySelectorAll("[data-p-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.getAttribute("data-p-edit"), 10);
        if (!Number.isFinite(i)) return;
        editingIdx = i;
        renderParticipants(CertApp.participants.load(getModo()));
      });
    });

    pList.querySelectorAll("[data-p-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingIdx = -1;
        renderParticipants(CertApp.participants.load(getModo()));
      });
    });

    // When editing, changing "Força" must refresh the dependent "Posto" list.
    pList.querySelectorAll("[data-edit-forca]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const row = sel.closest("[data-p-row]");
        if (!row) return;
        const forca = String(sel.value || "").trim();
        const postoSel = row.querySelector("[data-edit-posto]");
        if (!postoSel) return;
        const curPosto = String(postoSel.value || "").trim();
        fillPostoSelect(postoSel, forca, isValidPostoAbbr(forca, curPosto) ? curPosto : "");
      });
    });

    pList.querySelectorAll("[data-p-save]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest("[data-p-row]");
        if (!row) return;
        const i = parseInt(row.getAttribute("data-p-row"), 10);
        const cur = CertApp.participants.load(getModo());
        if (!Number.isFinite(i) || i < 0 || i >= cur.length) return;

        const nome = String((row.querySelector("[data-edit-nome]") || {}).value || "").trim();
        const juiz = String((row.querySelector("[data-edit-juiz]") || {}).value || "").trim();
        const lockedForce = getLockedForce();
        // In Special mode, the visible force is locked for output, but we preserve the original stored force
        // so switching back to Permanente doesn't overwrite participants.
        const currentStoredForce = String(((cur[i] || {}).forca) || "").trim();
        const forca = lockedForce ? (currentStoredForce || lockedForce) : String((row.querySelector("[data-edit-forca]") || {}).value || "").trim();
        const posto = String((row.querySelector("[data-edit-posto]") || {}).value || "").trim();

        if (!nome) {
          alert("Informe o nome.");
          const inp = row.querySelector("[data-edit-nome]");
          if (inp) inp.focus();
          return;
        }
        if (!posto) {
          alert("Selecione o posto.");
          const inp = row.querySelector("[data-edit-posto]");
          if (inp) inp.focus();
          return;
        }

        const selJuiz = row.querySelector("[data-edit-juiz]");
        const fix = maybeSuggestJuizForNome({
          nome,
          juiz,
          setSelectValue: (v) => {
            if (selJuiz) selJuiz.value = v;
          },
        });
        if (fix.abort) return;
        const juizEff = fix.juiz;

        cur[i] = { ...(cur[i] || {}), nome, forca, posto, juiz: juizEff };
        CertApp.participants.save(cur, getModo());
        editingIdx = -1;
        renderParticipants(cur);
      });
    });
  }

  function updateModoUI() {
    const modo = getModo();
    const perm = el("dgPermanente");
    const esp = el("dgEspecial");
    if (perm) perm.classList.toggle("hidden", !modo.includes("permanente"));
    if (esp) esp.classList.toggle("hidden", !modo.includes("especial"));

    if (modo !== lastModo) {
      editingIdx = -1;
      lastModo = modo;
    }

    const elRef = el("loteRef");
    if (elRef) {
      const isEspecial = modo.includes("especial");
      elRef.required = isEspecial;
      const hasValue = !!String(elRef.value || "").trim();
      const invalid = hasValue ? !elRef.checkValidity() : isEspecial;
      elRef.classList.toggle("border-red-400", invalid);
    }

    // Lock participant force in Special mode.
    const lockedForce = getLockedForce();
    const pForca = el("pForca");
    if (pForca) {
      pForca.disabled = !!lockedForce;
      if (lockedForce) pForca.value = lockedForce;
    }
    const pPosto = el("pPosto");
    if (pPosto) {
      const forcaEff = lockedForce || String((pForca && pForca.value) || "").trim();
      const curPosto = String((pPosto && pPosto.value) || "").trim();
      fillPostoSelect(pPosto, forcaEff, isValidPostoAbbr(forcaEff, curPosto) ? curPosto : "");
    }

    if (CertApp.participants) renderParticipants(CertApp.participants.load(modo));
  }

  async function init() {
    window.addEventListener("unhandledrejection", (e) => {
      console.error("unhandledrejection", e.reason);
    });
    window.addEventListener("error", (e) => {
      console.error("error", e.error || e.message);
    });

    // Default year for Conselho Permanente config.
    const permAno = el("permAno");
    if (permAno && !permAno.value) permAno.value = String(new Date().getFullYear());

    // Restore tab
    let tab = "lote";
    try {
      tab = localStorage.getItem("CertApp_Tab_V1") || "lote";
    } catch {
      tab = "lote";
    }
    if (tab !== "edit" && tab !== "lote") tab = "lote";
    setTab(tab);

    if (el("tabLote")) el("tabLote").addEventListener("click", () => setTab("lote"));
    if (el("tabEdit")) el("tabEdit").addEventListener("click", () => setTab("edit"));

    // Mode UI
    if (el("loteModo")) el("loteModo").addEventListener("change", () => updateModoUI());
    if (el("espForca")) el("espForca").addEventListener("change", () => updateModoUI());
    if (el("loteRef")) el("loteRef").addEventListener("input", () => updateModoUI());
    if (el("loteRef")) {
      el("loteRef").addEventListener("input", () => applyMaskedValue(el("loteRef"), formatProcessRef));
      el("loteRef").addEventListener("input", () => validateLoteRefCnj(el("loteRef")));
      el("loteRef").addEventListener("change", () => validateLoteRefCnj(el("loteRef")));
      // Normalize any prefilled/pasted value on load.
      applyMaskedValue(el("loteRef"), formatProcessRef);
      validateLoteRefCnj(el("loteRef"));
    }
    updateModoUI();

    // Live validation for time ranges (end must be > start).
    bindTimePair("lotePalestraIni", "lotePalestraFim");
    bindTimePair("permPalestraExercitoIni", "permPalestraExercitoFim");
    bindTimePair("permPalestraMarinhaIni", "permPalestraMarinhaFim");
    bindTimePair("permPalestraAeronauticaIni", "permPalestraAeronauticaFim");

    // Participants UI
    if (CertApp.participants) {
      renderParticipants(CertApp.participants.load(getModo()));

      const btnAdd = el("btnAddParticipante");
      const btnClear = el("btnLimparParticipantes");

      if (btnAdd) {
        btnAdd.addEventListener("click", () => {
          const nome = String((el("pNome") && el("pNome").value) || "").trim();
          const lockedForce = getLockedForce();
          const forca = lockedForce || String((el("pForca") && el("pForca").value) || "").trim();
          const posto = String((el("pPosto") && el("pPosto").value) || "").trim();
          let juiz = String((el("pJuiz") && el("pJuiz").value) || "").trim();
          if (!nome) {
            alert("Informe o nome.");
            return;
          }
          if (!posto) {
            alert("Selecione o posto.");
            const p = el("pPosto");
            if (p) p.focus();
            return;
          }

          const pJuizSel = el("pJuiz");
          const fix = maybeSuggestJuizForNome({
            nome,
            juiz,
            setSelectValue: (v) => {
              if (pJuizSel) pJuizSel.value = v;
            },
          });
          if (fix.abort) return;
          juiz = fix.juiz;

          const cur = CertApp.participants.load(getModo());
          cur.push({ nome, forca, posto, juiz });
          CertApp.participants.save(cur, getModo());
          if (el("pNome")) el("pNome").value = "";
          renderParticipants(cur);
        });
      }

      if (btnClear) {
        btnClear.addEventListener("click", () => {
          const typed = String(prompt('Para limpar a lista, digite \"limpar\".') || "");
          if (normalizeLowerAscii(typed) !== "limpar") return;
          CertApp.participants.save([], getModo());
          editingIdx = -1;
          renderParticipants([]);
        });
      }
    }

    try {
      await CertApp.fontDb.init();
    } catch (e) {
      console.error(e);
      alert("Falha ao inicializar banco de fontes: " + (e && e.message ? e.message : String(e)));
    }

    if (el("btnGerar")) el("btnGerar").addEventListener("click", () => CertApp.process.iniciarProcessamento());

    // Initial Posto menu
    if (el("pForca") && el("pPosto")) {
      el("pForca").addEventListener("change", () => updateModoUI());
      updateModoUI();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
