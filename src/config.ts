// Configuração lida do ambiente. Nenhum segredo fica no código.

function obrigatoria(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`Variável de ambiente ${nome} não definida.`);
  return v;
}
const opcional = (nome: string, padrao = "") => process.env[nome] || padrao;

export const config = {
  porta: Number(opcional("PORT", "3000")),
  urlPublica: opcional("URL_PUBLICA").replace(/\/$/, ""),
  databaseUrl: obrigatoria("DATABASE_URL"),
  adminToken: obrigatoria("ADMIN_TOKEN"),
  webhookSegredo: obrigatoria("WEBHOOK_SEGREDO"),

  anthropicKey: obrigatoria("ANTHROPIC_API_KEY"),
  modelo: opcional("PALOMA_MODELO", "claude-opus-5-5"),
  modeloRapido: opcional("PALOMA_MODELO_RAPIDO", "claude-haiku-5-5"),

  uazapiUrl: obrigatoria("UAZAPI_URL").replace(/\/$/, ""),
  uazapiAdminToken: opcional("UAZAPI_ADMIN_TOKEN"),
  uazapiInstanciaToken: opcional("UAZAPI_INSTANCIA_TOKEN"),

  elevenKey: opcional("ELEVENLABS_API_KEY"),
  elevenVoz: opcional("ELEVENLABS_VOICE_ID"),
  elevenModelo: opcional("ELEVENLABS_MODELO", "eleven_multilingual_v2"),

  hinova: {
    tokenApi: obrigatoria("HINOVA_TOKEN_API"),
    usuario: obrigatoria("HINOVA_USUARIO"),
    senha: obrigatoria("HINOVA_SENHA"),
  },
  powercrmToken: obrigatoria("POWERCRM_TOKEN"),

  // Telefone (só dígitos, com 55) de quem administra a Paloma; vira admin no primeiro start
  adminTelefone: opcional("ADMIN_TELEFONE"),
  fuso: "America/Maceio",
};
