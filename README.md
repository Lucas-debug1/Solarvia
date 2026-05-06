
Projeto completo com:
- Landing page pública para captação de leads
- CRM privado para o dono visualizar e gerenciar leads
- Backend Node.js com autenticação JWT e Supabase


projeto-solarvia/
├── backend/           ← API Node.js (porta 3000)
│   ├── server.js      ← Servidor principal
│   ├── gerar-hash.js  ← Script para gerar senha do CRM
│   ├── .env.example   ← Modelo de variáveis de ambiente
│   └── package.json
│
├── landing/           ← Site público (Solarvia)
│   ├── index.html
│   ├── script.js
│   ├── styles.css
│   └── imagens/       ← Coloque logo.png aqui
│
└── crm/               ← Painel privado (só o dono)
    ├── login.html     ← Tela de login
    ├── index.html     ← Painel principal
    ├── script.js
    ├── login.js
    └── style.css
```
