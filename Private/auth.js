(function () {
  const setup = location.pathname === "/setup";
  const token = new URLSearchParams(location.search).get("token") || "";
  if (setup) history.replaceState(null, "", "/setup");
  const form = document.getElementById("authForm");
  const button = document.getElementById("authSubmit");
  const error = document.getElementById("authError");
  if (setup) {
    document.getElementById("loginTitle").textContent = "Создание личного кабинета";
    document.getElementById("confirmLabel").hidden = false;
    form.elements.password.autocomplete = "new-password";
    form.elements.password.minLength = 12;
    form.elements.confirmation.required = true;
    button.textContent = "Создать кабинет";
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    if (setup && form.elements.password.value !== form.elements.confirmation.value) {
      error.textContent = "Пароли не совпадают."; return;
    }
    button.disabled = true;
    try {
      const response = await fetch(setup ? "/api/setup" : "/api/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.elements.username.value, password: form.elements.password.value, token }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Не удалось войти.");
      location.replace("/");
    } catch (issue) { error.textContent = issue.message || "Нет связи с кабинетом."; }
    finally { button.disabled = false; }
  });
})();
