const bcrypt = require("bcryptjs");
const MINHA_SENHA = "minhasenha123";
bcrypt.hash(MINHA_SENHA, 10).then((hash) => {
  console.log("\nHash gerado com sucesso!\n");
  console.log("Cole isso no seu .env:\n");
  console.log(`ADMIN_HASH=${hash}\n`);
});
