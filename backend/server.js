require("dotenv").config();
const express          = require("express");
const jwt              = require("jsonwebtoken");
const bcrypt           = require("bcryptjs");
const rateLimit        = require("express-rate-limit");
const cookieParser     = require("cookie-parser");
const helmet           = require("helmet");
const hpp              = require("hpp");
const { createClient } = require("@supabase/supabase-js");
const app  = express();
const PORT = process.env.PORT || 3000;
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));
//CORS
const ORIGENS_PERMITIDAS = [
  process.env.LANDING_URL,
  process.env.CRM_URL,
  "http://localhost:5500",
  "http://localhost:5501",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
].filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || ORIGENS_PERMITIDAS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(cookieParser());
app.use(hpp());
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Muitas requisições." },
});
app.use(apiLimiter);
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: "Muitas tentativas. Tente novamente em 5 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
const leadsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Muitas requisições. Tente novamente em breve." },
});
const UUID_REGEX   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BIGINT_REGEX = /^\d+$/;
function validarId(id)      { return UUID_REGEX.test(id) || BIGINT_REGEX.test(id); } //validação
function validarEmail(email){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validarTelefone(tel){ return tel.replace(/\D/g, "").length >= 10; }
function sanitizar(str) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, 200);
}
function log(tipo, msg, extra = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), tipo, msg, ...extra }));
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
  } catch { return false; }
}
function authGuard(req, res, next) {
  const origin  = req.headers.origin;
  const referer = req.headers.referer || "";
  const origemValida = !origin
    || ORIGENS_PERMITIDAS.includes(origin)
    || ORIGENS_PERMITIDAS.some(o => o && referer.startsWith(o));
  if (!origemValida) {
    log("CSRF_BLOCK", "Origem bloqueada", { origin, referer }); //AuthGuard+CSRF 
    return res.status(403).json({ error: "Origem não autorizada." });
  }
  const token = req.cookies?.crm_token;
  if (!token) return res.status(401).json({ error: "Não autenticado." });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.clearCookie("crm_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
    });
    res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
  }
}
app.get("/", (req, res) => res.json({ status: "API Solarvia ok" })); //ROTAS PuB
app.post("/auth/login", loginLimiter, async (req, res) => { //Login
  const { senha } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (!senha || typeof senha !== "string" || senha.length > 200) {
    return res.status(400).json({ error: "Senha obrigatória." });
  }
  const [ok1, ok2] = await Promise.all([ // Verifica as duas senhas em paralelo
    bcrypt.compare(senha, process.env.ADMIN_HASH),
    bcrypt.compare(senha, process.env.ADMIN_HASH_2 || ""),
  ]);
  if (!ok1 && !ok2) {
    log("LOGIN_FAIL", "Tentativa de login inválida", { ip });
    return res.status(401).json({ error: "Credenciais inválidas." });
  }
  log("LOGIN_OK", "Login bem-sucedido", { ip });
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
  const nome     = sanitizar(req.body.nome);
  const email    = sanitizar(req.body.email);
  const telefone = sanitizar(req.body.telefone);
  const captcha  = req.body.captcha;
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
    log("CAPTCHA_FAIL", "reCAPTCHA inválido", { email });
    return res.status(400).json({ error: "Verificação anti-bot falhou. Tente novamente." });
  }
  const { error } = await supabase
    .from("leads")
    .insert([{ nome, email, telefone, status: "novo" }]);
  if (error) {
    log("SUPABASE_ERROR", "Erro ao inserir lead", { error: error.message });
    return res.status(500).json({ error: "Erro ao salvar lead." });
  }
  log("LEAD_OK", "Novo lead salvo", { email });
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
  if (!id || !validarId(id)) return res.status(400).json({ error: "ID inválido." });
  const statusValidos = ["novo", "andamento", "convertido", "perdido"];
  if (!statusValidos.includes(status)) return res.status(400).json({ error: "Status inválido." });
  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) return res.status(500).json({ error: "Erro ao atualizar status." });
  res.json({ message: "Status atualizado!" });
});
app.delete("/leads/:id", authGuard, async (req, res) => {
  const { id } = req.params;
  if (!id || !validarId(id)) return res.status(400).json({ error: "ID inválido." });
  const { error } = await supabase.from("leads").delete().eq("id", id).select();
  if (error) return res.status(500).json({ error: "Erro ao remover lead." });
  log("LEAD_DELETE", "Lead removido", { id });
  res.json({ message: "Lead removido!" });
});
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});
app.listen(PORT, () => {
  log("SERVER_START", `Servidor Solarvia rodando na porta ${PORT}`);
});

//querovêdaerro
