(function () {
  const CertApp = window.CertApp;

  CertApp.constants = {
    JUIZES_DB: {
      vera: {
        prep: "pela",
        nome: "Dr.ª Vera Lúcia da Silva Conceição",
        cargo: "Juíza Federal da 2ª Auditoria da 2ª CJM",
      },
      vitor: {
        prep: "pelo",
        nome: "Dr. Vitor de Luca",
        cargo: "Juiz Federal Substituto da 2ª Auditoria da 2ª CJM",
      },
    },

    fontsDb: {
      name: "JMU_Fonts_DB_V2",
      store: "fontes",
      keys: ["fontName", "fontReg", "fontBold"],
      seed: {
        fontName: "./assets/FranklinGothic.ttf",
        fontReg: "./assets/CaviarDreams.ttf",
        fontBold: "./assets/CaviarDreams_Bold.ttf",
      },
    },

    defaultBackground: "./assets/certificado-em-branco.png",
    defaultZipFilename: "Certificados_JMU.zip",
  };
})();

