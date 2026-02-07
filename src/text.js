(function () {
  const CertApp = window.CertApp;
  const { JUIZES_DB } = CertApp.constants;

  function normalizeAsciiUpper(str) {
    return String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .trim();
  }

  function normalizeAsciiLower(str) {
    return normalizeAsciiUpper(str).toLowerCase();
  }

  function buscarValorInteligente(row, chavesPossiveis) {
    for (const chave of chavesPossiveis) {
      if (row[chave] !== undefined) return String(row[chave]).trim();
    }

    const wanted = chavesPossiveis.map(normalizeAsciiUpper);
    const headers = Object.keys(row || {});
    for (const header of headers) {
      const headerNorm = normalizeAsciiUpper(header);
      if (wanted.includes(headerNorm)) return String(row[header]).trim();
      for (const w of wanted) {
        if (headerNorm.includes(w)) return String(row[header]).trim();
      }
    }

    return "";
  }

  function limparStringParaFonte(str) {
    if (!str) return "";
    return String(str)
      .replace(/\u00BA/g, "\u00B0") // º -> °
      .replace(/\u00A0/g, " ") // nbsp -> space
      .trim();
  }

  function limparParaNomeArquivo(str) {
    if (!str) return "arquivo";
    return String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");
  }

  function extrairAno(dataStr) {
    const s = String(dataStr || "").trim();

    if (s.includes("/")) {
      const partes = s.split("/");
      if (partes.length === 3 && partes[2]) return partes[2];
    }

    const match = s.match(/\b\d{4}\b/);
    if (match) return match[0];

    return String(new Date().getFullYear());
  }

  function canonicalForceKey(forcaStr) {
    const f = normalizeAsciiUpper(forcaStr);
    if (f.includes("EXERCITO")) return "exercito";
    if (f.includes("MARINHA")) return "marinha";
    if (f.includes("AERONAUTICA")) return "aeronautica";
    return "";
  }
  function forceKeyToLabel(forceKey) {
    if (forceKey === "exercito") return "Exército";
    if (forceKey === "marinha") return "Marinha";
    if (forceKey === "aeronautica") return "Aeronáutica";
    return "";
  }

  function hasAnyPalestraOverride(ov) {
    if (!ov) return false;
    return !!(String(ov.date || "").trim() || String(ov.start || "").trim() || String(ov.end || "").trim());
  }

  // When the spreadsheet does not carry FORCA, we can still pick one agenda "por forca"
  // if (and only if) the user filled exactly one of the force blocks.
  function pickForceKeyFromOverrides(overrides) {
    const byForce = overrides && overrides.palestraByForce;
    if (!byForce) return "";

    const keys = ["exercito", "marinha", "aeronautica"];
    const filled = keys.filter((k) => hasAnyPalestraOverride(byForce[k]));
    if (filled.length === 1) return filled[0];
    return "";
  }

  function formatIsoDateToBr(iso) {
    const s = String(iso || "").trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s;
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function buildHorario(start, end) {
    const s = String(start || "").trim();
    const e = String(end || "").trim();
    if (s && e) return `${s} às ${e}`;
    if (s) return s;
    if (e) return e;
    return "";
  }

  function montarTexto(row, isPalestra, juizSelecionado, overrides) {
    const rawGenero = buscarValorInteligente(row, ["JUIZ", "GENERO", "GÊNERO", "FUNÇÃO", "CARGO"]);
    let tipo = buscarValorInteligente(row, ["TIPO", "TIPO CONSELHO"]);
    let forca = buscarValorInteligente(row, ["FORCA", "FORÇA", "FORÇA ARMADA"]);
    const dadoRefRow = buscarValorInteligente(row, ["TRIMESTRE", "TRIMESTRE/PROCESSO", "PROCESSO"]);
    const dataPlanilhaRow = buscarValorInteligente(row, ["DATA", "DIA"]);
    const horarioPlanilhaRow = buscarValorInteligente(row, ["HORA", "HORARIO", "HORÁRIO"]);

    const lote = overrides && overrides.lote ? overrides.lote : null;
    const loteModo = lote && lote.modo ? normalizeAsciiLower(lote.modo) : "";
    const loteTipo = lote && lote.tipo ? String(lote.tipo).trim() : "";
    const loteRef = lote && lote.ref ? String(lote.ref).trim() : "";
    const lotePalestra = lote && lote.palestra ? lote.palestra : null;
    const loteForca = lote && lote.forca ? String(lote.forca).trim() : "";

    // Special mode locks force for the whole batch.
    if (loteModo.includes("especial") && loteForca) {
      forca = loteForca;
    } else if (!forca && loteForca) {
      forca = loteForca;
    }

    if (!tipo && loteTipo) tipo = loteTipo;
    const dadoRef = dadoRefRow || loteRef;

    const tipoLower = normalizeAsciiLower(tipo);

    const permEnabled = !!(overrides && overrides.permanente && overrides.permanente.enabled);

    // If the user enabled "Conselho Permanente" overrides but removed the TIPO column,
    // assume the batch is Permanente (ex: CPJ).
    const isPermanente = tipoLower.includes("permanente") || (permEnabled && !tipoLower && !normalizeAsciiLower(loteTipo));
    if (isPermanente && permEnabled && !tipo) tipo = "Permanente";

    let forceKey = canonicalForceKey(forca);
    if (!forceKey && isPermanente && permEnabled) {
      forceKey = pickForceKeyFromOverrides(overrides);
      if (!forca && forceKey) forca = forceKeyToLabel(forceKey);
    }

    const palestraOv = overrides && overrides.palestraByForce && forceKey ? overrides.palestraByForce[forceKey] : null;


    let ano = extrairAno(dataPlanilhaRow);
    let trimestreLabel = dadoRef;

    if (isPermanente && permEnabled) {
      const anoOv = String((overrides.permanente && overrides.permanente.ano) || "").trim();
      if (anoOv) ano = anoOv;

      const triOv = String((overrides.permanente && overrides.permanente.trimestre) || "").trim();
      if (triOv) trimestreLabel = triOv;
    }

    let artigo = "a";
    if (normalizeAsciiLower(forca).includes("exercito")) artigo = "o";
    const nomeConselho = `Conselho ${tipo} de Justiça para ${artigo} ${forca}`;

    let complemento = "";
    if (isPermanente) {
      const textoRef = normalizeAsciiLower(trimestreLabel).includes("trimestre") ? trimestreLabel : `${trimestreLabel} Trimestre`;
      complemento = `referente ao ${textoRef} de ${ano}`;
    } else {
      complemento = `referente à Ação Penal Militar nº ${dadoRef} deste Juízo`;
    }

    const clean = (t) => limparStringParaFonte(t);
    const infoJuiz = JUIZES_DB[juizSelecionado];

    if (isPalestra) {
      let data = dataPlanilhaRow;
      let horario = horarioPlanilhaRow;

      if (isPermanente && permEnabled && palestraOv) {
        if (palestraOv.date) data = formatIsoDateToBr(palestraOv.date);
        const h = buildHorario(palestraOv.start, palestraOv.end);
        if (h) horario = h;
      } else if ((!data || !horario) && lotePalestra) {
        if (!data && lotePalestra.date) data = formatIsoDateToBr(lotePalestra.date);
        if (!horario) {
          const h = buildHorario(lotePalestra.start, lotePalestra.end);
          if (h) horario = h;
        }
      }

      if (!horario) console.warn(`Sem horário: ${buscarValorInteligente(row, ["NOME", "NOME COMPLETO", "MILITAR", "PARTICIPANTE"])}`);

        return [
          {
            text: clean(
              `No dia ${data || "??"}, das ${horario || "??"}, participou de Palestra realizada ${infoJuiz.prep} ${infoJuiz.nome}, ${infoJuiz.cargo}, para os membros do ${nomeConselho}, ${complemento}, que teve como tema `,
            ),
            bold: false,
          },
          {
            text: clean("“Aspectos Procedimentais e de Funcionalidade da Justiça Militar da União”."),
            bold: true,
          },
        ];
      }

    let atuouComo = "Atuou como Juiz Militar";
    const generoLower = normalizeAsciiLower(rawGenero);
    if (generoLower.includes("juiza")) {
      atuouComo = "Atuou como Juíza Militar";
    }

    const sufixo = isPermanente
      ? `no ${complemento.replace("referente ao ", "")}`
      : `na ${complemento.replace("referente à ", "")}`;

    return [
      {
        text: clean(
          `${atuouComo} do ${nomeConselho}, da 2ª Auditoria da 2ª Circunscrição Judiciária Militar, ${sufixo}.`,
        ),
        bold: false,
      },
    ];
  }

  CertApp.text = {
    buscarValorInteligente,
    limparStringParaFonte,
    limparParaNomeArquivo,
    extrairAno,
    montarTexto,
    canonicalForceKey,
    forceKeyToLabel,
    pickForceKeyFromOverrides,
    normalizeAsciiLower,
    normalizeAsciiUpper,
  };
})();
