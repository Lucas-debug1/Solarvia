const API_URL = "https://solarvia-production.up.railway.app";
async function verificarSessao() {
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      credentials: "include",
    });
    if (res.ok) {
      window.location.href = "index.html";
    }
  } catch {
  }
}
verificarSessao();
async function fazerLogin() {
  const senha = document.getElementById("input-senha").value;
  const btn   = document.getElementById("btn-entrar");
  const errEl = document.getElementById("login-error");
  if (!senha) {
    errEl.textContent   = "Digite a senha.";
    errEl.style.display = "block";
    return;
  }
  btn.disabled    = true;
  btn.textContent = "Verificando...";
  errEl.style.display = "none";
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Credenciais inválidas.");
    window.location.href = "index.html";
  } catch (err) {
    errEl.textContent   = "X" + err.message;
    errEl.style.display = "block";
    btn.disabled        = false;
    btn.textContent     = "Entrar no painel";
  }
}