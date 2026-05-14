# ✅ Checklist de Segurança — Solarvia

## ⚠️ ANTES DE QUALQUER COISA — Faça isso AGORA

### 1. Trocar a chave do Supabase (foi exposta no Git!)
1. Acesse https://supabase.com → seu projeto
2. Vá em **Settings → API**
3. Clique em **"Reveal"** na chave anon, depois em **"Roll"** para gerar uma nova
4. Copie a nova chave e cole no seu `.env`

### 2. Criar o .gitignore (NUNCA suba o .env!)
Coloque o arquivo `.gitignore` dentro da pasta `backend/`.
Ele já está incluído neste pacote. Verifique que contém:
```
.env
node_modules/
```

### 3. Instalar a nova dependência
```bash
cd backend
npm install
```
O `express-rate-limit` foi adicionado ao `package.json`.

---

## 🚀 Deploy — Passo a passo

### Backend no Railway
1. Acesse https://railway.app e faça login com o GitHub
2. Clique em **"New Project" → "Deploy from GitHub repo"**
3. Selecione o repositório e a pasta `backend/`
4. Vá em **"Variables"** e adicione todas as variáveis do `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_KEY` (a nova, após o passo 1!)
   - `JWT_SECRET`
   - `ADMIN_HASH`
   - `LANDING_URL` (URL da sua landing após deploy)
   - `CRM_URL` (URL do seu CRM após deploy)
5. O Railway vai dar uma URL tipo: `https://solarvia-backend.railway.app`
6. **Copie essa URL** — você vai precisar nos próximos passos

### Landing page no Netlify/Vercel
1. Abra `landing/script.js`
2. Troque:
   ```js
   const API_URL = "https://SEU-BACKEND.railway.app";
   ```
   Pela URL real do Railway
3. Suba a pasta `landing/` no Netlify ou Vercel

### CRM no Netlify/Vercel
1. Abra `crm/script.js` e `crm/login.js`
2. Troque nos dois arquivos:
   ```js
   const API_URL = "https://SEU-BACKEND.railway.app";
   ```
   Pela URL real do Railway
3. Suba a pasta `crm/` no Netlify ou Vercel (como projeto separado)

### reCAPTCHA
1. Acesse https://www.google.com/recaptcha/admin
2. Clique em **"+"** para novo site
3. Escolha **reCAPTCHA v2 → "Não sou um robô"**
4. Adicione o domínio da sua landing page
5. Copie a **Site Key** e substitua no `landing/index.html`:
   ```html
   data-sitekey="SUA_SITE_KEY_AQUI"
   ```

---

## 🔒 O que foi corrigido neste pacote

| Problema                        | Correção aplicada                          |
|---------------------------------|--------------------------------------------|
| CORS aberto `*`                 | Agora só aceita as origens configuradas    |
| Sem rate limiting no login      | Máx 10 tentativas a cada 15 minutos        |
| Sem rate limiting nos leads     | Máx 20 requisições por minuto              |
| Sem validação de email/telefone | Validação no backend antes de salvar       |
| Erros internos expostos         | Mensagens genéricas para o cliente         |
| `console.log` com IDs           | Removido do código de produção             |
| Body sem limite de tamanho      | Limitado a 10kb                            |
| `.gitignore` inexistente        | Criado — `.env` e `node_modules` ignorados |
