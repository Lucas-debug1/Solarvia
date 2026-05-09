require("dotenv").config();
const express          = require("express");
const jwt              = require("jsonwebtoken");
const bcrypt           = require("bcryptjs");
const rateLimit        = require("express-rate-limit");
const cookieParser     = require("cookie-parser");
const { createClient } = require("@supabase/supabase-js");
const app  = express();
const PORT = process.env.PORT || 3000;
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
app.use((req, res, next) => {
  const origensPermitidas = [
    process.env.LANDING_URL,
    process.env.CRM_URL,
    "http://localhost:5500",
    "http://localhost:5501",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:5501",
  ].filter(Boolean);
  const origin = req.headers.origin;
  if (!origin || origensPermitidas.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: "Muitas tentativas. Tente novamente em 5 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});
const leadsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Muitas requisições. Tente novamente em breve." },
});
function authGuard(req, res, next) {
  const token = req.cookies?.crm_token;
  if (!token) {
    return res.status(401).json({ error: "Não autenticado." });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.clearCookie("crm_token");
    res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
  }
}
function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validarTelefone(tel) {
  return tel.replace(/\D/g, "").length >= 10;
}
function sanitizar(str) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, 200);
}
async function verificarRecaptcha(token) {
  if (!token) return false;
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${process.env.RECAPTCHA_SECRET}&response=${token}`,
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}
app.get("/", (req, res) => res.json({ status: "API Solarvia ok" }));
app.post("/auth/login", loginLimiter, async (req, res) => {
  const { senha } = req.body;
  if (!senha || typeof senha !== "string") {
    return res.status(400).json({ error: "Senha obrigatória." });
  }
  const senhaCorreta = await bcrypt.compare(senha, process.env.ADMIN_HASH);
  if (!senhaCorreta) {
    return res.status(401).json({ error: "Credenciais inválidas." });
  }
  const token = jwt.sign(
    { role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
  res.cookie("crm_token", token, {
    httpOnly: true,                         
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",                        
    maxAge: 8 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});
app.post("/auth/logout", (req, res) => {
  res.clearCookie("crm_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
  });
  res.json({ ok: true });
});
app.get("/auth/me", authGuard, (req, res) => {
  res.json({ ok: true, role: req.user.role });
});
app.post("/leads", leadsLimiter, async (req, res) => {
  const nome      = sanitizar(req.body.nome);
  const email     = sanitizar(req.body.email);
  const telefone  = sanitizar(req.body.telefone);
  const captcha   = req.body.captcha;
  if (!nome || !email || !telefone) {
    return res.status(400).json({ error: "Campos obrigatórios: nome, email, telefone." });
  }
  if (!validarEmail(email)) {
    return res.status(400).json({ error: "Email inválido." });
  }
  if (!validarTelefone(telefone)) {
    return res.status(400).json({ error: "Telefone inválido (mínimo 10 dígitos)." });
  }
  const captchaValido = await verificarRecaptcha(captcha);
  if (!captchaValido) {
    return res.status(400).json({ error: "Verificação anti-bot falhou. Tente novamente." });
  }
  const { error } = await supabase
    .from("leads")
    .insert([{ nome, email, telefone, status: "novo" }]);
  if (error) return res.status(500).json({ error: "Erro ao salvar lead." });
  res.json({ message: "Lead salvo com sucesso!" });
});
app.get("/leads", authGuard, async (req, res) => {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) return res.status(500).json({ error: "Erro ao buscar leads." });
  res.json(data);
});
app.put("/leads/:id", authGuard, async (req, res) => {
  const { id }     = req.params;
  const { status } = req.body;
  const statusValidos = ["novo", "andamento", "convertido", "perdido"];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ error: "Status inválido." });
  }
  if (!id || id === "null") {
    return res.status(400).json({ error: "ID inválido." });
  }
  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", id);
  if (error) return res.status(500).json({ error: "Erro ao atualizar status." });
  res.json({ message: "Status atualizado!" });
});
app.delete("/leads/:id", authGuard, async (req, res) => {
  const { id } = req.params;
  if (!id || id === "null") {
    return res.status(400).json({ error: "ID inválido." });
  }
  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .select();
  if (error) return res.status(500).json({ error: "Erro ao remover lead." });
  res.json({ message: "Lead removido!" });
});
app.listen(PORT, () => {
  console.log(`\nServidor Solarvia rodando na porta ${PORT}\n`);
});
