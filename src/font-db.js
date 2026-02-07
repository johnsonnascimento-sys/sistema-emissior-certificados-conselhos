(function () {
  const CertApp = window.CertApp;
  const { fontsDb } = CertApp.constants;

  async function fetchArrayBuffer(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
    return res.arrayBuffer();
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("Este navegador não suporta IndexedDB."));
        return;
      }

      const request = indexedDB.open(fontsDb.name, 1);
      request.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(fontsDb.store);
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = () => reject(request.error || new Error("Falha ao abrir IndexedDB."));
    });
  }

  function storeTx(db, mode) {
    return db.transaction(fontsDb.store, mode).objectStore(fontsDb.store);
  }

  function statusIdForKey(key) {
    // Matches existing ids in index.html
    if (key === "fontName") return "statusName";
    if (key === "fontReg") return "statusReg";
    if (key === "fontBold") return "statusBold";
    return null;
  }

  function labelForKey(key) {
    if (key === "fontName") return "Franklin Med (Título)";
    if (key === "fontReg") return "Caviar Reg (Texto)";
    if (key === "fontBold") return "Caviar Bold (Negrito)";
    return key;
  }

  function setStatusOk(key) {
    const id = statusIdForKey(key);
    if (!id) return;
    const el = document.getElementById(id);
    el.classList.remove("text-gray-400");
    el.classList.add("text-green-700");
    el.innerHTML = `<span class="w-2 h-2 rounded-full bg-green-500"></span> ${labelForKey(key)} OK`;
  }

  function setStatusMissing(key) {
    const id = statusIdForKey(key);
    if (!id) return;
    const el = document.getElementById(id);
    el.classList.remove("text-green-700");
    el.classList.add("text-gray-400");
    el.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-400"></span> ${labelForKey(key)}`;
  }

  CertApp.fontDb = {
    db: null,

    async init() {
      this.db = await openDb();

      document.getElementById("btnResetFonts").addEventListener("click", async () => {
        if (!confirm("Apagar fontes?")) return;
        await this.clear();
        location.reload();
      });

      const inputs = document.querySelectorAll("#fontInputs input[type=file][data-font-key]");
      inputs.forEach((input) => {
        input.addEventListener("change", async () => {
          const key = input.getAttribute("data-font-key");
          const f = input.files && input.files[0];
          if (!key || !f) return;

          try {
            await this.saveFont(key, f);
            await this.verifyAndUpdateUi();
            alert("Fonte salva.");
          } catch (e) {
            console.error(e);
            alert("Erro ao salvar a fonte: " + (e && e.message ? e.message : String(e)));
          } finally {
            input.value = "";
          }
        });
      });

      // Best-effort: seed default fonts from assets when hosted (Vercel/GitHub Pages).
      // If fetch fails (e.g. file://), UI falls back to manual upload.
      try {
        await this.seedDefaultsIfMissing();
      } catch (e) {
        console.warn("seedDefaultsIfMissing failed", e);
      }

      await this.verifyAndUpdateUi();
    },

    async seedDefaultsIfMissing() {
      const missing = [];
      for (const key of fontsDb.keys) {
        // eslint-disable-next-line no-await-in-loop
        const has = await this.hasFont(key);
        if (!has) missing.push(key);
      }
      if (missing.length === 0) return;

      for (const key of missing) {
        const url = fontsDb.seed && fontsDb.seed[key];
        if (!url) continue;
        // eslint-disable-next-line no-await-in-loop
        const bytes = await fetchArrayBuffer(url);
        // eslint-disable-next-line no-await-in-loop
        await this.putBytes(key, bytes);
      }
    },

    verifyAndUpdateUi() {
      const inputsArea = document.getElementById("fontInputs");
      inputsArea.classList.add("hidden");

      const tx = storeTx(this.db, "readonly");

      return Promise.all(
        fontsDb.keys.map(
          (key) =>
            new Promise((resolve) => {
              const req = tx.get(key);
              req.onsuccess = () => {
                if (req.result) {
                  setStatusOk(key);
                } else {
                  setStatusMissing(key);
                  inputsArea.classList.remove("hidden");
                }
                resolve();
              };
              req.onerror = () => {
                setStatusMissing(key);
                inputsArea.classList.remove("hidden");
                resolve();
              };
            }),
        ),
      );
    },

    saveFont(key, file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          this.putBytes(key, reader.result).then(resolve, reject);
        };
        reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo de fonte."));
        reader.readAsArrayBuffer(file);
      });
    },

    putBytes(key, bytes) {
      return new Promise((resolve, reject) => {
        const tx = storeTx(this.db, "readwrite");
        const req = tx.put(bytes, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error("Falha ao salvar fonte."));
      });
    },

    hasFont(key) {
      return new Promise((resolve) => {
        const tx = storeTx(this.db, "readonly");
        const req = tx.get(key);
        req.onsuccess = () => resolve(!!req.result);
        req.onerror = () => resolve(false);
      });
    },

    clear() {
      return new Promise((resolve, reject) => {
        const tx = storeTx(this.db, "readwrite");
        const req = tx.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error("Falha ao limpar fontes."));
      });
    },

    getFont(key) {
      return new Promise((resolve, reject) => {
        const tx = storeTx(this.db, "readonly");
        const req = tx.get(key);
        req.onsuccess = () => {
          if (!req.result) {
            reject(new Error(`Fonte ${key} faltando.`));
            return;
          }
          resolve(req.result);
        };
        req.onerror = () => reject(req.error || new Error("Falha ao ler fonte."));
      });
    },
  };
})();
