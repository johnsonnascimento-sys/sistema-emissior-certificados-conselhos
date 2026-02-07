(function () {
  const CertApp = window.CertApp;
  const { JUIZES_DB } = CertApp.constants;

  function normalizeHeader(str) {
    return String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .trim();
  }

  function buscarValorInteligente(row, chavesPossiveis) {
    // Exact match first (fast path).
    for (const chave of chavesPossiveis) {
      if (row[chave] !== undefined) return String(row[chave]).trim();
    }

    const wanted = chavesPossiveis.map(normalizeHeader);
    const headers = Object.keys(row || {});
    for (const header of headers) {
      const headerNorm = normalizeHeader(header);
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

  function montarTexto(row, isPalestra, juizSelecionado) {
    const nome = buscarValorInteligente(row, ["NOME", "NOME COMPLETO", "MILITAR", "PARTICIPANTE"]);
    const rawGenero = buscarValorInteligente(row, ["JUIZ", "GENERO", "GÊNERO", "FUNÇÃO", "CARGO"]);
    const tipo = buscarValorInteligente(row, ["TIPO", "TIPO CONSELHO"]);
    const forca = buscarValorInteligente(row, ["FORCA", "FORÇA", "FORÇA ARMADA"]);
    const dadoRef = buscarValorInteligente(row, ["TRIMESTRE", "TRIMESTRE/PROCESSO", "PROCESSO"]);
    const data = buscarValorInteligente(row, ["DATA", "DIA"]);
    const horario = buscarValorInteligente(row, ["HORA", "HORARIO", "HORÁRIO"]);

    if (isPalestra && !horario) console.warn(`Sem horário: ${nome}`);

    const ano = extrairAno(data);

    let artigo = "a";
    const forcaLower = forca.toLowerCase();
    if (forcaLower.includes("exército") || forcaLower.includes("exercito")) artigo = "o";
    const nomeConselho = `Conselho ${tipo} de Justiça para ${artigo} ${forca}`;

    let complemento = "";
    if (tipo.toLowerCase() === "permanente") {
      const textoRef = dadoRef.toLowerCase().includes("trimestre") ? dadoRef : `${dadoRef} Trimestre`;
      complemento = `referente ao ${textoRef} de ${ano}`;
    } else {
      complemento = `referente à Ação Penal Militar nº ${dadoRef} deste Juízo`;
    }

    const clean = (t) => limparStringParaFonte(t);
    const infoJuiz = JUIZES_DB[juizSelecionado];

    if (isPalestra) {
      return [
        {
          text: clean(
            `No dia ${data || "??"}, das ${horario || "??"}, participou de Palestra realizada ${infoJuiz.prep} ${infoJuiz.nome}, ${infoJuiz.cargo}, para os membros do ${nomeConselho}, ${complemento}, que teve como tema `,
          ),
          bold: false,
        },
        {
          text: clean("“Os Aspectos Procedimentais e de Funcionalidade da Justiça Militar da União”."),
          bold: true,
        },
      ];
    }

    let atuouComo = "Atuou como Juiz Militar";
    const generoLower = rawGenero.toLowerCase();
    if (generoLower.includes("juíza") || generoLower.includes("juiza")) {
      atuouComo = "Atuou como Juíza Militar";
    }

    const sufixo = tipo.toLowerCase() === "permanente"
      ? `no ${complemento.replace("referente ao ", "")}`
      : `na ${complemento.replace("referente à ", "")}`;

    return [{ text: clean(`${atuouComo} do ${nomeConselho}, da 2ª Auditoria da 2ª Circunscrição Judiciária Militar, ${sufixo}.`), bold: false }];
  }

  CertApp.text = {
    buscarValorInteligente,
    limparStringParaFonte,
    limparParaNomeArquivo,
    extrairAno,
    montarTexto,
  };
})();
