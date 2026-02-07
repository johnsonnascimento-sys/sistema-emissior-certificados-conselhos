(function () {
  const CertApp = window.CertApp;

  async function init() {
    window.addEventListener("unhandledrejection", (e) => {
      console.error("unhandledrejection", e.reason);
    });
    window.addEventListener("error", (e) => {
      console.error("error", e.error || e.message);
    });

    try {
      await CertApp.fontDb.init();
    } catch (e) {
      console.error(e);
      alert("Falha ao inicializar banco de fontes: " + (e && e.message ? e.message : String(e)));
    }

    document.getElementById("btnGerar").addEventListener("click", () => CertApp.process.iniciarProcessamento());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
