(function () {
  const CertApp = window.CertApp;

  CertApp.excel = {
    readFirstSheetToJson(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo Excel."));
        reader.onload = () => {
          try {
            const workbook = XLSX.read(reader.result, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet);
            resolve({ sheetName, json });
          } catch (e) {
            reject(e);
          }
        };
        reader.readAsArrayBuffer(file);
      });
    },
  };
})();

