(function () {
  const CertApp = window.CertApp;

  const { defaultZipFilename } = CertApp.constants;
  const { buscarValorInteligente, extrairAno, limparParaNomeArquivo, montarTexto } = CertApp.text;
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
    btn.innerText = "PROCESSAR LOTE (XLSX)";
  }

  function computeZipFilename(dados) {
    let zipFilename = defaultZipFilename;
    if (!dados || dados.length === 0) return zipFilename;

    const firstRow = dados[0];
    const tipo = buscarValorInteligente(firstRow, ["TIPO"]) || "Geral";
    const ref = buscarValorInteligente(firstRow, ["TRIMESTRE", "PROCESSO", "TRIMESTRE/PROCESSO"]) || "";
    const forca = buscarValorInteligente(firstRow, ["FORCA", "FORÇA"]) || "";
    const data = buscarValorInteligente(firstRow, ["DATA"]) || "";
    const ano = extrairAno(data);

    if (tipo.toLowerCase().includes("permanente")) {
      const refLimpo = ref.replace(/[\/\\:*?"<>|]/g, "");
      zipFilename = `Certificados_${refLimpo}_Trimestre_${ano}.zip`;
      return zipFilename;
    }

    let siglaForca = "JMU";
    const forcaLower = forca.toLowerCase();
    if (forcaLower.includes("ex")) siglaForca = "Ex";
    else if (forcaLower.includes("mar")) siglaForca = "Mar";
    else if (forcaLower.includes("aer")) siglaForca = "Aer";

    const processoLimpo = ref.replace(/[\/\\:*?"<>|]/g, "_");
    zipFilename = `Certificados_CEJ-${siglaForca}_${processoLimpo}.zip`;
    return zipFilename;
  }

  async function gerarLote(dados, bgBytes, fNameB, fRegB, fBoldB, juizSelecionado) {
    const zip = new JSZip();

    const posYName = parseFloat(document.getElementById("posY").value);
    const sizeName = parseFloat(document.getElementById("nameSize").value);
    const posYBody = parseFloat(document.getElementById("posYBody").value);
    const sizeBody = parseFloat(document.getElementById("bodySize").value);
    const maxW = parseFloat(document.getElementById("maxWidth").value);

    const zipFilename = computeZipFilename(dados);
    setStatus("Iniciando geração...");

    for (let i = 0; i < dados.length; i++) {
      const row = dados[i];
      const nomeRow = buscarValorInteligente(row, ["NOME", "NOME COMPLETO", "MILITAR", "PARTICIPANTE"]);
      if (!nomeRow) continue;

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

        desenharNomeComEspaco(page, nomeRow.toUpperCase(), fontName, sizeName, posYName);

        const tokens = montarTexto(row, tipoCert === "Palestra", juizSelecionado);
        desenharTextoJustificado(page, tokens, fontReg, fontBold, posYBody, sizeBody, maxW);

        const pdfBytes = await pdfDoc.save();
        const tipoRaw = buscarValorInteligente(row, ["TIPO"]) || "Geral";
        const forcaRaw = buscarValorInteligente(row, ["FORCA", "FORÇA"]) || "JMU";

        const folderName = `${limparParaNomeArquivo(forcaRaw)}_${limparParaNomeArquivo(tipoRaw)}`;
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
    const xlsxFile = document.getElementById("xlsxFile").files[0];
    const colunasDiv = document.getElementById("colunasDetectadas");
    const juizSelecionado = document.getElementById("selectJuiz").value;

    document.getElementById("resultArea").classList.add("hidden");
    setStatus("");

    if (!bgFile || !xlsxFile) {
      if (!xlsxFile) {
        alert("Carregue o Excel.");
        return;
      }
    }

    setButtonBusy(btn, "Lendo Excel...");

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

      const { json } = await CertApp.excel.readFirstSheetToJson(xlsxFile);
      if (json.length > 0) {
        const cols = Object.keys(json[0]);
        colunasDiv.innerHTML = `<strong>Colunas lidas:</strong> ${cols.join(", ")}`;
        colunasDiv.classList.remove("hidden");
      }

      setButtonBusy(btn, "Gerando PDFs...");
      const { content, zipFilename } = await gerarLote(json, bgBytes, fName, fReg, fBold, juizSelecionado);

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
