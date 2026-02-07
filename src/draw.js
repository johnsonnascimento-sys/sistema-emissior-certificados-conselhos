(function () {
  const CertApp = window.CertApp;
  const { limparStringParaFonte } = CertApp.text;

  function calcularLarguraNome(words, fontName, sizeName) {
    let totalWidth = 0;
    const manualSpace = sizeName * 0.25;
    words.forEach((w, i) => {
      totalWidth += fontName.widthOfTextAtSize(w, sizeName);
      if (i < words.length - 1) totalWidth += manualSpace;
    });
    return totalWidth;
  }

  function desenharNomeComEspaco(page, nome, fontName, maxNameSize, startY) {
    const nomeSafe = limparStringParaFonte(nome);
    const words = nomeSafe.split(" ").filter(Boolean);

    let currentSize = maxNameSize;
    const MAX_WIDTH_ALLOWED = 750;

    let totalWidth = calcularLarguraNome(words, fontName, currentSize);
    if (totalWidth > MAX_WIDTH_ALLOWED) {
      const ratio = (MAX_WIDTH_ALLOWED / totalWidth) * 0.95;
      currentSize *= ratio;
      totalWidth = calcularLarguraNome(words, fontName, currentSize);
    }

    const manualSpace = currentSize * 0.25;
    const { width: pageWidth } = page.getSize();
    let currentX = (pageWidth - totalWidth) / 2;

    words.forEach((w) => {
      const wLen = fontName.widthOfTextAtSize(w, currentSize);
      page.drawText(w, {
        x: currentX,
        y: startY,
        font: fontName,
        size: currentSize,
        color: PDFLib.rgb(0, 0, 0),
      });
      currentX += wLen + manualSpace;
    });
  }

  function desenharTextoJustificado(page, tokens, fontReg, fontBold, startY, size, maxW) {
    const lines = [];
    let currentLine = [];
    let currentLen = 0;

    const allWords = [];
    tokens.forEach((tok) => {
      const words = String(tok.text || "").split(" ").filter(Boolean);
      const font = tok.bold ? fontBold : fontReg;
      words.forEach((w) => allWords.push({ text: w, font, width: font.widthOfTextAtSize(w, size) }));
    });

    const spaceWidth = fontReg.widthOfTextAtSize(" ", size);

    for (let i = 0; i < allWords.length; i++) {
      const word = allWords[i];
      if (currentLen + word.width + currentLine.length * spaceWidth < maxW) {
        currentLine.push(word);
        currentLen += word.width;
      } else {
        lines.push({ words: currentLine, textLen: currentLen });
        currentLine = [word];
        currentLen = word.width;
      }
    }
    if (currentLine.length > 0) lines.push({ words: currentLine, textLen: currentLen, isLast: true });

    let y = startY;
    const lineHeight = size * 1.5;
    const { width: pageWidth } = page.getSize();
    const blockStartX = (pageWidth - maxW) / 2;

    lines.forEach((line) => {
      const startX = blockStartX;
      const extraSpace = maxW - line.textLen;
      const gaps = line.words.length - 1;

      if (line.isLast || gaps === 0) {
        let x = startX;
        line.words.forEach((w) => {
          page.drawText(w.text, { x, y, size, font: w.font, color: PDFLib.rgb(0, 0, 0) });
          x += w.width + spaceWidth;
        });
      } else {
        const spacePerGap = extraSpace / gaps;
        let x = startX;
        line.words.forEach((w, idx) => {
          page.drawText(w.text, { x, y, size, font: w.font, color: PDFLib.rgb(0, 0, 0) });
          if (idx < gaps) x += w.width + spacePerGap;
        });
      }

      y -= lineHeight;
    });
  }

  CertApp.draw = {
    desenharNomeComEspaco,
    desenharTextoJustificado,
  };
})();

