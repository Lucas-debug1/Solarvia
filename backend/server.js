require("dotenv").config();
const express          = require("express");
const jwt              = require("jsonwebtoken");
const bcrypt           = require("bcryptjs");
const rateLimit        = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Supabase ──────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ── CORS manual (mais confiável em produção) ──────
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
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // Responde preflight imediatamente sem passar pelas rotas
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "10kb" }));

// ── Rate limiting — login: máx 10 tentativas/5min ─
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: "Muitas tentativas. Tente novamente em 5 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Rate limiting — leads: máx 20/min ────────────
const leadsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Muitas requisições. Tente novamente em breve." },
});

// ════════════════════════════════════════════════
// MIDDLEWARE — Verificar JWT
// ════════════════════════════════════════════════
function authGuard(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido." });
  }
  const token = header.split(" ")[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

// ════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════
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

// ════════════════════════════════════════════════
// ROTAS PÚBLICAS
// ════════════════════════════════════════════════

app.get("/", (req, res) => res.json({ status: "API Solarvia ok 🚀" }));

// ── Login ─────────────────────────────────────────
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

  res.json({ token });
});

// ── Receber lead da landing page ──────────────────
app.post("/leads", leadsLimiter, async (req, res) => {
  const nome     = sanitizar(req.body.nome);
  const email    = sanitizar(req.body.email);
  const telefone = sanitizar(req.body.telefone);

  if (!nome || !email || !telefone) {
    return res.status(400).json({ error: "Campos obrigatórios: nome, email, telefone." });
  }

  if (!validarEmail(email)) {
    return res.status(400).json({ error: "Email inválido." });
  }

  if (!validarTelefone(telefone)) {
    return res.status(400).json({ error: "Telefone inválido (mínimo 10 dígitos)." });
  }

  const { error } = await supabase
    .from("leads")
    .insert([{ nome, email, telefone, status: "novo" }]);

  if (error) return res.status(500).json({ error: "Erro ao salvar lead." });

  res.json({ message: "Lead salvo com sucesso!" });
});

// ════════════════════════════════════════════════
// ROTAS PROTEGIDAS (JWT obrigatório)
// ════════════════════════════════════════════════

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

// ════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor Solarvia rodando na porta ${PORT}\n`);
});
