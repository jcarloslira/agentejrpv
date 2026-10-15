// Variáveis falsas só para os testes carregarem os módulos (nada aqui chama serviço real).
for (const k of ["DATABASE_URL", "ADMIN_TOKEN", "WEBHOOK_SEGREDO", "ANTHROPIC_API_KEY", "UAZAPI_URL", "HINOVA_TOKEN_API", "HINOVA_USUARIO", "HINOVA_SENHA", "POWERCRM_TOKEN"])
  process.env[k] ||= k === "DATABASE_URL" ? "postgres://x@localhost/x" : k === "UAZAPI_URL" ? "https://x" : "x";
export {};
