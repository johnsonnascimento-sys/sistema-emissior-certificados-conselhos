(function () {
  const CertApp = window.CertApp;

  function getBool(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
  }

  function getStr(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function getTime(id) {
    const v = getStr(id);
    // native <input type="time"> returns HH:MM
    return v;
  }

  function getDateIso(id) {
    const v = getStr(id);
    // native <input type="date"> returns YYYY-MM-DD
    return v;
  }

  function getChecked(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
  }

  CertApp.config = {
    getOverrides() {
      const modo = getStr("loteModo") || "especial";
      const modoLower = String(modo || "").toLowerCase();
      const isPermanente = modoLower.includes("permanente");
      const isEspecial = modoLower.includes("especial");
      const eventoCivil = getChecked("eventoCivil");

      const forca = isEspecial && !eventoCivil ? getStr("espForca") : "";

      const trimestre = getStr("permTrimestre") || "";
      const ano = getStr("permAno") || "";

      return {
        lote: {
          modo,
          tipo: isPermanente ? "Permanente" : isEspecial ? "Especial" : "",
          forca,
          ref: getStr("loteRef") || "",
          palestra: {
            date: getDateIso("lotePalestraData"),
            start: getTime("lotePalestraIni"),
            end: getTime("lotePalestraFim"),
          },
        },
        permanente: {
          enabled: isPermanente,
          trimestre,
          ano,
        },
        palestraByForce: {
          exercito: {
            date: getDateIso("permPalestraExercitoData"),
            start: getTime("permPalestraExercitoIni"),
            end: getTime("permPalestraExercitoFim"),
          },
          marinha: {
            date: getDateIso("permPalestraMarinhaData"),
            start: getTime("permPalestraMarinhaIni"),
            end: getTime("permPalestraMarinhaFim"),
          },
          aeronautica: {
            date: getDateIso("permPalestraAeronauticaData"),
            start: getTime("permPalestraAeronauticaIni"),
            end: getTime("permPalestraAeronauticaFim"),
          },
        },
        textos: {
          conselho: getStr("customTextoConselho"),
          palestra: getStr("customTextoPalestra"),
        },
        emissao: {
          conselho: getChecked("emitirConselho"),
          palestra: getChecked("emitirPalestra"),
        },
        evento: {
          civil: eventoCivil,
          nome: getStr("eventoNome"),
        },
      };
    },
  };
})();
