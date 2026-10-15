(function () {
  let proposals = [], revision = 0, csrf = "", recovery = null;
  const request = async (url, method = "GET", body) => {
    const response = await fetch(url, {
      method, cache: "no-store", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Не удалось связаться с кабинетом.");
    return payload;
  };
  const refresh = async () => {
    const archive = await request("/api/archive");
    proposals = archive.proposals; revision = archive.revision;
  };
  const ready = (async () => {
    const session = await request("/api/session");
    csrf = session.csrf;
    await refresh();
    const account = document.createElement("div");
    account.className = "cabinetAccount";
    const name = document.createElement("span");
    name.textContent = session.username;
    const logout = document.createElement("button");
    logout.type = "button"; logout.textContent = "Выйти";
    logout.addEventListener("click", async () => {
      if (!confirm("Выйти из кабинета? Несохранённые изменения не попадут в архив.")) return;
      try { await request("/api/logout", "POST"); location.replace("/login"); }
      catch (error) { alert(error.message); }
    });
    account.append(name, logout);
    document.querySelector(".topbar .actions")?.append(account);
    const hint = document.querySelector(".proposalArchiveHint");
    if (hint) hint.textContent = "Ваши КП хранятся в закрытом кабинете. Ранее сохранённые проекты можно перенести через импорт JSON.";
  })();
  window.LINE_ENERGY_PRIVATE_ARCHIVE = {
    ready, refresh,
    read: () => structuredClone(proposals),
    exportItems: () => structuredClone(recovery || proposals),
    async write(items) {
      recovery = structuredClone(items);
      const result = await request("/api/archive", "PUT", { revision, proposals: items });
      proposals = structuredClone(items); revision = result.revision; recovery = null;
    },
    async nextNumber() { return (await request("/api/proposal-number", "POST")).number; },
  };
})();
