
// 👇 Troque pela URL do backend em produção
const API_URL = "https://SEU-BACKEND.railway.app";
// Se já estiver logado, vai direto pro painel
if (localStorage.getItem("crm_token")) {
  window.location.href = "index.html";
}
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
    const res  = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Credenciais inválidas.");
    localStorage.setItem("crm_token", data.token);
    window.location.href = "index.html";
  } catch (err) {
    errEl.textContent   = "" + err.message;
    errEl.style.display = "block";
    btn.disabled        = false;
    btn.textContent     = "Entrar no painel";
  }
}
