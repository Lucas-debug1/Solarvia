const API_URL = "https://solarvia-production.up.railway.app";
function scrollToForm() {
  document.getElementById("form").scrollIntoView({ behavior: "smooth" });
}
const form      = document.getElementById("leadForm");
const btnSubmit = document.getElementById("btn-submit");
const feedback  = document.getElementById("form-feedback");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const captcha = grecaptcha.getResponse();
  if (!captcha) {
    setFeedback("Por favor confirme o reCAPTCHA.", "erro");
    return;
  }
  const nome     = form.nome.value.trim();
  const email    = form.email.value.trim();
  const telefone = form.telefone.value.trim();
  btnSubmit.disabled    = true;
  btnSubmit.textContent = "Enviando...";
  setFeedback("", "");
  try {
    const res = await fetch(`${API_URL}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, telefone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao enviar.");
    setFeedback("Solicitação enviada! Entraremos em contato em breve.", "sucesso");
    form.reset();
    grecaptcha.reset();
  } catch (err) {
    setFeedback("" + err.message, "erro");
  } finally {
    btnSubmit.disabled    = false;
    btnSubmit.textContent = "Quero minha simulação";
  }
});
function setFeedback(msg, tipo) {
  feedback.textContent = msg;
  feedback.className   = "form-feedback " + tipo;
}
