(function () {
  const CertApp = window.CertApp;

  const { defaultZipFilename } = CertApp.constants;
  const {
    buscarValorInteligente,
    limparParaNomeArquivo,
    montarTexto,
    normalizeAsciiLower,
    pickForceKeyFromOverrides,
    forceKeyToLabel,
  } = CertApp.text;
  const { desenharNomeComEspaco, desenharTextoJustificado } = CertApp.draw;

  async function fetchArrayBuffer(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
    return res.arrayBuffer();
  }

  function setStatus(text) {
    document.getElementById("status").innerText = text || "";
  }

  function setButtonBusy(btn, text) {
    btn.disabled = true;
    btn.innerText = text;
  }

  function setButtonIdle(btn) {
    btn.disabled = false;
    btn.innerText = "PROCESSAR LOTE";
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

    const all = `${seq}${year}${seg}${tr}${org}${dd}`;
    return BigInt(all) % 97n === 1n;
  }

  function validateLoteRefCnj(elRef) {
    if (!elRef) return true;
    const raw = String(elRef.value || "").trim();
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
          if (typeof elRef.reportValidity === "function") elRef.reportValidity();
        } finally {
          elRef.setCustomValidity("");
        }
        return false;
      }
      if (!isValidCnjProcess(digits)) {
        const msg = "Número de Processo Inválido.";
        showInlineError(elRef, msg);
        try {
          elRef.setCustomValidity(msg);
          if (typeof elRef.reportValidity === "function") elRef.reportValidity();
        } finally {
          elRef.setCustomValidity("");
        }
        return false;
      }
    }

    return true;
  }

  function forceKeyFromLabel(forcaLabel) {
    const s = normalizeAsciiLower(forcaLabel);
    if (s.includes("exerc")) return "exercito";
    if (s.includes("mar")) return "marinha";
    if (s.includes("aer")) return "aeronautica";
    return "";
  }

  function requireValidInput(el, fallbackMessage) {
    if (!el) return false;
    if (typeof el.checkValidity === "function" && !el.checkValidity()) {
      setStatus(fallbackMessage || "Preencha o campo corretamente.");
      showInlineError(el, fallbackMessage || "Preencha o campo corretamente.");
      if (typeof el.reportValidity === "function") el.reportValidity();
      else alert(fallbackMessage || "Preencha o campo corretamente.");
      try {
        el.focus();
      } catch {
        // ignore
      }
      return false;
    }
    clearInlineError(el);
    return true;
  }

  function requireFilled(el, message) {
    if (!el) return false;
    const v = String(el.value || "").trim();
    if (v) {
      clearInlineError(el);
      return true;
    }

    setStatus(message || "Preencha o campo.");
    showInlineError(el, message || "Preencha o campo.");

    // Force native validation bubble even when the element isn't marked required.
    if (typeof el.setCustomValidity === "function") {
      try {
        el.setCustomValidity(message || "Preencha o campo.");
        if (typeof el.reportValidity === "function") el.reportValidity();
      } finally {
        el.setCustomValidity("");
      }
    } else {
      alert(message || "Preencha o campo.");
    }

    try {
      el.focus();
    } catch {
      // ignore
    }
    return false;
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

  function requireEndAfterStart(elStart, elEnd, message) {
    if (!elStart || !elEnd) return false;
    const startM = timeToMinutes(elStart.value);
    const endM = timeToMinutes(elEnd.value);
    if (!Number.isFinite(startM) || !Number.isFinite(endM)) return true; // other validators cover empties/malformed
    if (endM > startM) {
      clearInlineError(elEnd);
      return true;
    }

    const msg = message || "O horário de fim deve ser maior que o horário de início.";
    setStatus(msg);
    showInlineError(elEnd, msg);
    if (typeof elEnd.setCustomValidity === "function") {
      try {
        elEnd.setCustomValidity(msg);
        if (typeof elEnd.reportValidity === "function") elEnd.reportValidity();
      } finally {
        elEnd.setCustomValidity("");
      }
    } else {
      alert(msg);
    }
    try {
      elEnd.focus();
    } catch {
      // ignore
    }
    return false;
  }

  function validateAgendaEspecial() {
    const elData = document.getElementById("lotePalestraData");
    const elIni = document.getElementById("lotePalestraIni");
    const elFim = document.getElementById("lotePalestraFim");

    if (!requireFilled(elData, "Informe a data da palestra (Especial).")) return false;
    if (!requireFilled(elIni, "Informe o horário de início da palestra (Especial).")) return false;
    if (!requireFilled(elFim, "Informe o horário de fim da palestra (Especial).")) return false;

    // Keep HTML validation too (in case of malformed values/patterns).
    if (!requireValidInput(elData, "Informe a data da palestra (Especial).")) return false;
    if (!requireValidInput(elIni, "Informe o horário de início da palestra (Especial).")) return false;
    if (!requireValidInput(elFim, "Informe o horário de fim da palestra (Especial).")) return false;
    if (!requireEndAfterStart(elIni, elFim, "A hora de fim deve ser maior que a hora de início.")) return false;
    return true;
  }

  function validateAgendaPermanenteForUsedForces(rows) {
    const used = new Set();
    for (const r of rows || []) {
      const key = forceKeyFromLabel((r && r.FORCA) || "");
      if (key) used.add(key);
    }

    const map = {
      exercito: { label: "Exército", data: "permPalestraExercitoData", ini: "permPalestraExercitoIni", fim: "permPalestraExercitoFim" },
      marinha: { label: "Marinha", data: "permPalestraMarinhaData", ini: "permPalestraMarinhaIni", fim: "permPalestraMarinhaFim" },
      aeronautica: {
        label: "Aeronáutica",
        data: "permPalestraAeronauticaData",
        ini: "permPalestraAeronauticaIni",
        fim: "permPalestraAeronauticaFim",
      },
    };

    for (const key of used) {
      const cfg = map[key];
      if (!cfg) continue;
      const elData = document.getElementById(cfg.data);
      const elIni = document.getElementById(cfg.ini);
      const elFim = document.getElementById(cfg.fim);
      if (!requireFilled(elData, `Informe a data da palestra para ${cfg.label} (Permanente).`)) return false;
      if (!requireFilled(elIni, `Informe o horário de início da palestra para ${cfg.label} (Permanente).`)) return false;
      if (!requireFilled(elFim, `Informe o horário de fim da palestra para ${cfg.label} (Permanente).`)) return false;

      if (!requireValidInput(elData, `Informe a data da palestra para ${cfg.label} (Permanente).`)) return false;
      if (!requireValidInput(elIni, `Informe o horário de início da palestra para ${cfg.label} (Permanente).`)) return false;
      if (!requireValidInput(elFim, `Informe o horário de fim da palestra para ${cfg.label} (Permanente).`)) return false;
      if (!requireEndAfterStart(elIni, elFim, "A hora de fim deve ser maior que a hora de início.")) return false;
    }

    return true;
  }

  function sanitizeFilenameToken(s) {
    return String(s || "")
      .trim()
      .replace(/[\/\\:*?"<>|]/g, "")
      .replace(/\s+/g, "_");
  }

  function computeZipFilename(dados, overrides) {
    let zipFilename = defaultZipFilename;
    if (!dados || dados.length === 0) return zipFilename;

    const firstRow = dados[0];
    const tipo = buscarValorInteligente(firstRow, ["TIPO"]) || "";
    const ref = buscarValorInteligente(firstRow, ["TRIMESTRE", "PROCESSO", "TRIMESTRE/PROCESSO"]) || "";
    const forca = buscarValorInteligente(firstRow, ["FORCA", "FORÇA"]) || "";
    const data = buscarValorInteligente(firstRow, ["DATA"]) || "";
    const lote = overrides && overrides.lote ? overrides.lote : null;
    const loteTipo = lote && lote.tipo ? String(lote.tipo).trim() : "";
    const loteRef = lote && lote.ref ? String(lote.ref).trim() : "";
    const lotePalestra = lote && lote.palestra ? lote.palestra : null;
    const loteForca = lote && lote.forca ? String(lote.forca).trim() : "";

    const tipoEff = tipo || loteTipo;
    const tipoLower = normalizeAsciiLower(tipoEff);

    const refEff = ref || loteRef;
    const dataEff = data || (lotePalestra && lotePalestra.date ? String(lotePalestra.date).trim() : "");

    const permEnabled = !!(overrides && overrides.permanente && overrides.permanente.enabled);
    const isPermanente = tipoLower.includes("permanente") || (permEnabled && !tipoLower && !normalizeAsciiLower(loteTipo));

    const inferredForceKey = !forca && isPermanente && permEnabled ? pickForceKeyFromOverrides(overrides) : "";
    const forcaEff = loteForca || forca || (inferredForceKey ? forceKeyToLabel(inferredForceKey) : "");

    if (isPermanente) {
      if (permEnabled) {
        const tri = sanitizeFilenameToken((overrides.permanente && overrides.permanente.trimestre) || "Trimestre");
        const ano = sanitizeFilenameToken((overrides.permanente && overrides.permanente.ano) || "");
        zipFilename = `Certificados_${tri}_Trimestre_${ano || "ANO"}.zip`;
        return zipFilename;
      }

      const ano = CertApp.text.extrairAno(dataEff);
      const refLimpo = sanitizeFilenameToken(refEff);
      zipFilename = `Certificados_${refLimpo}_Trimestre_${ano}.zip`;
      return zipFilename;
    }

    let siglaForca = "JMU";
    const forcaLower = normalizeAsciiLower(forcaEff);
    if (forcaLower.includes("ex")) siglaForca = "Ex";
    else if (forcaLower.includes("mar")) siglaForca = "Mar";
    else if (forcaLower.includes("aer")) siglaForca = "Aer";

    const processoLimpo = String(refEff || "").replace(/[\/\\:*?"<>|]/g, "_");
    zipFilename = `Certificados_CEJ-${siglaForca}_${processoLimpo}.zip`;
    return zipFilename;
  }

  async function gerarLote(dados, bgBytes, fNameB, fRegB, fBoldB, juizSelecionado, overrides) {
    const zip = new JSZip();
    const permEnabled = !!(overrides && overrides.permanente && overrides.permanente.enabled);
    const inferredForceKey = permEnabled ? pickForceKeyFromOverrides(overrides) : "";
    const loteForca = overrides && overrides.lote && overrides.lote.forca ? String(overrides.lote.forca).trim() : "";

    const posYName = parseFloat(document.getElementById("posY").value);
    const sizeName = parseFloat(document.getElementById("nameSize").value);
    const posYBody = parseFloat(document.getElementById("posYBody").value);
    const sizeBody = parseFloat(document.getElementById("bodySize").value);
    const maxW = parseFloat(document.getElementById("maxWidth").value);

    const zipFilename = computeZipFilename(dados, overrides);
    setStatus("Iniciando geração...");

    for (let i = 0; i < dados.length; i++) {
      const row = dados[i];
      const nomeRow = buscarValorInteligente(row, ["NOME", "NOME COMPLETO", "MILITAR", "PARTICIPANTE"]);
      if (!nomeRow) continue;

      const postoAbbr = buscarValorInteligente(row, ["POSTO", "POSTO_ABBR"]);
      const nomeExibicao = `${postoAbbr ? postoAbbr + " " : ""}${nomeRow}`;

      setStatus(`Processando: ${nomeRow}`);

      const tiposCert = ["Conselho", "Palestra"];
      for (const tipoCert of tiposCert) {
        const pdfDoc = await PDFLib.PDFDocument.create();
        pdfDoc.registerFontkit(window.fontkit);
        const page = pdfDoc.addPage([842, 595]);

        let imgEmbed;
        try {
          imgEmbed = await pdfDoc.embedPng(bgBytes);
        } catch {
          imgEmbed = await pdfDoc.embedJpg(bgBytes);
        }
        page.drawImage(imgEmbed, { x: 0, y: 0, width: 842, height: 595 });

        const fontName = await pdfDoc.embedFont(fNameB);
        const fontReg = await pdfDoc.embedFont(fRegB);
        const fontBold = await pdfDoc.embedFont(fBoldB);

        desenharNomeComEspaco(page, nomeExibicao.toUpperCase(), fontName, sizeName, posYName);

        const tokens = montarTexto(row, tipoCert === "Palestra", juizSelecionado, overrides);
        desenharTextoJustificado(page, tokens, fontReg, fontBold, posYBody, sizeBody, maxW);

        const pdfBytes = await pdfDoc.save();
        const tipoFromRow = buscarValorInteligente(row, ["TIPO"]) || "";
        const loteTipo = overrides && overrides.lote && overrides.lote.tipo ? String(overrides.lote.tipo).trim() : "";
        const tipoRaw = (permEnabled && !tipoFromRow && !normalizeAsciiLower(loteTipo) ? "Permanente" : tipoFromRow) || loteTipo || "Geral";

        const forcaFromRow = buscarValorInteligente(row, ["FORCA", "FORÇA"]) || "";
        const forcaRaw = loteForca || forcaFromRow || (inferredForceKey ? forceKeyToLabel(inferredForceKey) : "JMU");

        const tipoLower = normalizeAsciiLower(tipoRaw);
        const isPermanenteRow = tipoLower.includes("permanente") || (permEnabled && !tipoLower && !normalizeAsciiLower(loteTipo));

        // In "Conselho Permanente", group output by Force folders only (Exército/Marinha/Aeronáutica).
        const forcaFolder = forcaRaw ? limparParaNomeArquivo(forcaRaw) : "SEM_FORCA";
        const folderName = isPermanenteRow ? forcaFolder : `${forcaFolder}_${limparParaNomeArquivo(tipoRaw)}`;
        const fileName = `${limparParaNomeArquivo(nomeRow)}_${tipoCert}.pdf`;

        zip.folder(folderName).file(fileName, pdfBytes);
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    return { content, zipFilename };
  }

  async function iniciarProcessamento() {
    const btn = document.getElementById("btnGerar");
    const bgFile = document.getElementById("bgFile").files[0];
    const juizSelecionado = document.getElementById("selectJuiz").value;

    const overrides = CertApp.config.getOverrides();

    document.getElementById("resultArea").classList.add("hidden");
    setStatus("");

    const modo = overrides && overrides.lote && overrides.lote.modo ? String(overrides.lote.modo).toLowerCase() : "";
    const isEspecial = modo.includes("especial");
    const isPermanente = modo.includes("permanente");

    if (isEspecial) {
      const elRef = document.getElementById("loteRef");
      if (!requireValidInput(elRef, 'Informe o "Processo / Referência" no formato solicitado.')) return;
      if (!validateLoteRefCnj(elRef)) return;
      if (!validateAgendaEspecial()) return;
    }

    const manualRows = CertApp.participants ? CertApp.participants.toRows(CertApp.participants.load(isEspecial ? "especial" : isPermanente ? "permanente" : "")) : [];
    if (manualRows.length === 0) {
      alert("Adicione participantes para gerar os certificados.");
      return;
    }

    if (isPermanente) {
      if (!validateAgendaPermanenteForUsedForces(manualRows)) return;
    }

    setButtonBusy(btn, "Lendo participantes...");

    try {
      const [fName, fReg, fBold] = await Promise.all([
        CertApp.fontDb.getFont("fontName"),
        CertApp.fontDb.getFont("fontReg"),
        CertApp.fontDb.getFont("fontBold"),
      ]);

      let bgBytes;
      if (bgFile) {
        bgBytes = await bgFile.arrayBuffer();
      } else {
        setStatus("Carregando fundo padrão...");
        bgBytes = await fetchArrayBuffer(CertApp.constants.defaultBackground);
      }

      const loteForca = overrides && overrides.lote && overrides.lote.forca ? String(overrides.lote.forca).trim() : "";
      const dados = loteForca ? manualRows.map((r) => ({ ...(r || {}), FORCA: loteForca })) : manualRows;

      setButtonBusy(btn, "Gerando PDFs...");
      const { content, zipFilename } = await gerarLote(dados, bgBytes, fName, fReg, fBold, juizSelecionado, overrides);

      setButtonIdle(btn);

      document.getElementById("resultArea").classList.remove("hidden");
      document.getElementById("nomeArquivoGerado").innerText = `Arquivo pronto: ${zipFilename}`;

      const downloadFn = () => saveAs(content, zipFilename);
      document.getElementById("btnDownload").onclick = downloadFn;

      downloadFn();
      setStatus("Concluído!");
    } catch (e) {
      console.error(e);
      setButtonIdle(btn);
      alert("Erro: " + (e && e.message ? e.message : String(e)));
    }
  }

  CertApp.process = {
    iniciarProcessamento,
  };
})();
