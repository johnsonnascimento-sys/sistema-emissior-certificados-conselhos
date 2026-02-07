(function () {
  const CertApp = window.CertApp;

  const STORAGE_KEY_LEGACY = "CertApp_Participants_V1";
  const STORAGE_KEY_PERM = "CertApp_Participants_Permanente_V1";
  const STORAGE_KEY_ESP = "CertApp_Participants_Especial_V1";

  function normalizeMode(modo) {
    const s = String(modo || "").trim().toLowerCase();
    if (s.includes("perman")) return "permanente";
    if (s.includes("espec")) return "especial";
    return "";
  }

  function keyForMode(modo) {
    const m = normalizeMode(modo);
    if (m === "permanente") return STORAGE_KEY_PERM;
    if (m === "especial") return STORAGE_KEY_ESP;
    return STORAGE_KEY_LEGACY;
  }

  function sanitizeList(data) {
    const arr = Array.isArray(data) ? data : [];
    return arr
      .map((x) => ({
        nome: String((x && x.nome) || "").trim(),
        forca: String((x && x.forca) || "").trim(),
        posto: String((x && (x.posto || x.postoAbbr)) || "").trim(), // abbreviation
        juiz: String((x && x.juiz) || "").trim(), // "Juiz" | "Juiza"
      }))
      .filter((x) => x.nome);
  }

  function load(modo) {
    const key = keyForMode(modo);
    try {
      const raw = localStorage.getItem(key);
      if (raw) return sanitizeList(JSON.parse(raw));

      // One-time fallback: if the mode-specific key is empty but legacy exists,
      // show legacy data for that mode until the user saves (then it becomes separated).
      if (key !== STORAGE_KEY_LEGACY) {
        const legacyRaw = localStorage.getItem(STORAGE_KEY_LEGACY);
        if (legacyRaw) return sanitizeList(JSON.parse(legacyRaw));
      }
      return [];
    } catch {
      return [];
    }
  }

  function save(list, modo) {
    const key = keyForMode(modo);
    localStorage.setItem(key, JSON.stringify(list || []));
  }

  function toRows(list) {
    const src = Array.isArray(list) ? list : [];
    return src
      .filter((x) => x && String(x.nome || "").trim())
      .map((x) => ({
        NOME: String(x.nome || "").trim(),
        FORCA: String(x.forca || "").trim(),
        POSTO: String(x.posto || "").trim(),
        JUIZ: String(x.juiz || "").trim(),
      }));
  }

  function fromXlsxJson(json) {
    const rows = Array.isArray(json) ? json : [];
    const out = [];
    for (const r of rows) {
      const nome =
        (CertApp.text && CertApp.text.buscarValorInteligente && CertApp.text.buscarValorInteligente(r, ["NOME", "NOME COMPLETO", "PARTICIPANTE", "MILITAR"])) ||
        "";
      if (!nome) continue;

      const forca =
        (CertApp.text && CertApp.text.buscarValorInteligente && CertApp.text.buscarValorInteligente(r, ["FORCA", "FORÇA", "FORÇA ARMADA"])) ||
        "";
      const juiz =
        (CertApp.text && CertApp.text.buscarValorInteligente && CertApp.text.buscarValorInteligente(r, ["JUIZ", "GENERO", "GÊNERO", "FUNÇÃO", "CARGO"])) ||
        "";

      out.push({
        nome: String(nome).trim(),
        forca: String(forca).trim(),
        juiz: String(juiz).trim(),
      });
    }
    return out;
  }

  CertApp.participants = {
    load,
    save,
    toRows,
    fromXlsxJson,
    normalizeMode,
  };
})();
