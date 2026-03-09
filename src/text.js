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
      .replace(/\u00BA/g, "\u00B0")
      .replace(/\u00A0/g, " ")
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

  function buildParticipanteNomeExibicao(row) {
    const nome = buscarValorInteligente(row, ["NOME", "NOME COMPLETO", "MILITAR", "PARTICIPANTE"]);
    const posto = buscarValorInteligente(row, ["POSTO", "POSTO_ABBR"]);
    return `${posto ? posto + " " : ""}${nome}`.trim();
  }

  function resolvePalestraDataHorario(row, isPermanente, permEnabled, palestraOv, lotePalestra) {
    let data = buscarValorInteligente(row, ["DATA", "DIA"]);
    let horario = buscarValorInteligente(row, ["HORA", "HORARIO", "HORÁRIO"]);

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

    return {
      data: String(data || "").trim(),
      horario: String(horario || "").trim(),
    };
  }

  function interpolateTemplate(template, context) {
    return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const value = context && Object.prototype.hasOwnProperty.call(context, key) ? context[key] : "";
      return limparStringParaFonte(value);
    });
  }

  function templateToTokens(template, context) {
    const lines = limparStringParaFonte(interpolateTemplate(template, context)).split(/\r?\n/);
    const tokens = [];

    lines.forEach((line, idx) => {
      const cleanLine = String(line || "").trim();
      if (cleanLine) tokens.push({ text: cleanLine, bold: false });
      if (idx < lines.length - 1) tokens.push({ break: true });
    });

    return tokens;
  }

  function buildTextoContext(row, isPalestra, juizSelecionado, overrides) {
    const rawGenero = buscarValorInteligente(row, ["JUIZ", "GENERO", "GÊNERO", "FUNÇÃO", "CARGO"]);
    let tipo = buscarValorInteligente(row, ["TIPO", "TIPO CONSELHO"]);
    let forca = buscarValorInteligente(row, ["FORCA", "FORÇA", "FORÇA ARMADA"]);
    const dadoRefRow = buscarValorInteligente(row, ["TRIMESTRE", "TRIMESTRE/PROCESSO", "PROCESSO"]);
    const dataPlanilhaRow = buscarValorInteligente(row, ["DATA", "DIA"]);

    const lote = overrides && overrides.lote ? overrides.lote : null;
    const loteModo = lote && lote.modo ? normalizeAsciiLower(lote.modo) : "";
    const loteTipo = lote && lote.tipo ? String(lote.tipo).trim() : "";
    const loteRef = lote && lote.ref ? String(lote.ref).trim() : "";
    const lotePalestra = lote && lote.palestra ? lote.palestra : null;
    const loteForca = lote && lote.forca ? String(lote.forca).trim() : "";
    const evento = overrides && overrides.evento ? overrides.evento : null;
    const isEventoCivil = !!(evento && evento.civil);
    const eventoNome = evento && evento.nome ? String(evento.nome).trim() : "";

    if (loteModo.includes("especial") && loteForca) {
      forca = loteForca;
    } else if (!forca && loteForca) {
      forca = loteForca;
    }

    if (!tipo && loteTipo) tipo = loteTipo;
    const dadoRef = dadoRefRow || loteRef;

    const tipoLower = normalizeAsciiLower(tipo);
    const permEnabled = !!(overrides && overrides.permanente && overrides.permanente.enabled);
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

    const nomeConselho = isEventoCivil ? "" : `Conselho ${tipo} de Justiça para ${artigo} ${forca}`;

    let complemento = "";
    if (isEventoCivil) {
      complemento = eventoNome || dadoRef || "";
    } else if (isPermanente) {
      const textoRef = normalizeAsciiLower(trimestreLabel).includes("trimestre") ? trimestreLabel : `${trimestreLabel} Trimestre`;
      complemento = `referente ao ${textoRef} de ${ano}`;
    } else {
      complemento = `referente à Ação Penal Militar nº ${dadoRef} deste Juízo`;
    }

    let atuouComo = "Atuou como Juiz Militar";
    const generoLower = normalizeAsciiLower(rawGenero);
    if (generoLower.includes("juiza")) atuouComo = "Atuou como Juíza Militar";

    const sufixoAtuacao = isPermanente
      ? `no ${complemento.replace("referente ao ", "")}`
      : `na ${complemento.replace("referente à ", "")}`;

    const infoJuiz = JUIZES_DB[juizSelecionado] || {};
    const agendaPalestra = resolvePalestraDataHorario(row, isPermanente, permEnabled, palestraOv, lotePalestra);

    return {
      ano,
      artigo_forca: forca ? artigo : "",
      atuou_como: atuouComo,
      complemento,
      data_palestra: agendaPalestra.data,
      evento_nome: eventoNome,
      forca,
      horario_palestra: agendaPalestra.horario,
      isEventoCivil,
      isPalestra,
      isPermanente,
      juiz_cargo: infoJuiz.cargo || "",
      juiz_nome: infoJuiz.nome || "",
      juiz_prep: infoJuiz.prep || "",
      nome_conselho: nomeConselho,
      participante_nome: buscarValorInteligente(row, ["NOME", "NOME COMPLETO", "MILITAR", "PARTICIPANTE"]),
      participante_nome_exibicao: buildParticipanteNomeExibicao(row),
      posto: buscarValorInteligente(row, ["POSTO", "POSTO_ABBR"]),
      processo: dadoRef,
      referencia: dadoRef,
      sufixo_atuacao: sufixoAtuacao,
      tipo_conselho: tipo,
      trimestre: trimestreLabel,
    };
  }

  function montarTexto(row, isPalestra, juizSelecionado, overrides) {
    const context = buildTextoContext(row, isPalestra, juizSelecionado, overrides);
    const textos = overrides && overrides.textos ? overrides.textos : null;
    const textoPersonalizado = textos ? String(isPalestra ? textos.palestra || "" : textos.conselho || "").trim() : "";
    const clean = (t) => limparStringParaFonte(t);

    if (textoPersonalizado) return templateToTokens(textoPersonalizado, context);

    if (isPalestra) {
      if (!context.horario_palestra) console.warn(`Sem horário: ${context.participante_nome}`);

      if (context.isEventoCivil) {
        return [
          {
            text: clean(
              `No dia ${context.data_palestra || "??"}, das ${context.horario_palestra || "??"}, participou da palestra ministrada ${context.juiz_prep} ${context.juiz_nome}, ${context.juiz_cargo}${context.evento_nome ? `, no evento ${context.evento_nome}` : ""}.`,
            ),
            bold: false,
          },
        ];
      }

      return [
        {
          text: clean(
            `No dia ${context.data_palestra || "??"}, das ${context.horario_palestra || "??"}, participou de Palestra realizada ${context.juiz_prep} ${context.juiz_nome}, ${context.juiz_cargo}, para os membros do ${context.nome_conselho}, ${context.complemento}, que teve como tema `,
          ),
          bold: false,
        },
        {
          text: clean("“Aspectos Procedimentais e de Funcionalidade da Justiça Militar da União”."),
          bold: true,
        },
      ];
    }

    return [
      {
        text: clean(
          `${context.atuou_como} do ${context.nome_conselho}, da 2ª Auditoria da 2ª Circunscrição Judiciária Militar, ${context.sufixo_atuacao}.`,
        ),
        bold: false,
      },
    ];
  }

  CertApp.text = {
    buscarValorInteligente,
    buildTextoContext,
    canonicalForceKey,
    extrairAno,
    forceKeyToLabel,
    limparParaNomeArquivo,
    limparStringParaFonte,
    montarTexto,
    normalizeAsciiLower,
    normalizeAsciiUpper,
    pickForceKeyFromOverrides,
  };
})();
