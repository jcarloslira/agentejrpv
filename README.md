# Paloma — assistente de IA da JRPV

A Paloma é a consultora sênior virtual da JRPV Brasil Proteção Veicular. Ela atende pelo WhatsApp
os consultores, o setor de cadastro, a gerência e a diretoria. Consulta e age no **SGA (Hinova)**
e no **Power CRM**, recebe fotos e documentos, ouve e responde áudio (ElevenLabs), lembra das
pessoas e das regras da casa, e respeita o nível de acesso de cada um.

## Como funciona

```
WhatsApp (uazapi) ──webhook──▶ servidor Node (Render)
                                 ├─ identifica quem fala (paloma.usuarios) → papel
                                 ├─ áudio → transcrição (ElevenLabs) · foto/PDF → Claude vê
                                 ├─ Claude (claude-opus-5-5) + ferramentas do papel
                                 │    SGA v2 · Power API · memória · base espelhada
                                 └─ resposta em texto ou áudio (ElevenLabs + fonética)
Supabase (projeto do JRPV-DATA.BI)
   schema paloma (só dela) · leitura das tabelas jrpv_* (espelho do SGA)
```

- **Isolamento:** a Paloma conecta com o usuário de banco `paloma_app`, que escreve só no schema
  `paloma` e só **lê** as tabelas `jrpv_*`. Nada do BI ou dos outros projetos é alterado.
- **Ações com confirmação:** tudo que grava no SGA ou no Power CRM vira uma ação pendente
  (`paloma.acoes`). A Paloma mostra o resumo e só executa depois do "pode", numa mensagem
  seguinte. O servidor bloqueia confirmar no mesmo turno. Fica tudo registrado.
- **Memória:** regras e procedimentos da JRPV (ensinados pela gerência/diretoria) e memória de
  cada pessoa (`paloma.memorias`, busca em português).
- **Power CRM espelhado:** a cada 15 min a Paloma puxa o relatório da base (`/api/report/db`), e
  o webhook v2 atualiza na hora.

## Papéis

| Papel | O que a Paloma libera |
|---|---|
| consultor | Consultas e ações só sobre a própria carteira (placas do seu código de voluntário no SGA e cotações do seu e-mail no Power CRM): criar e atualizar cotação, mover etapa (exceto concluir), anexar, abrir vistoria, registrar atendimento, agendar atividade |
| cadastro | Tudo, para todos; acesso a qualquer rota do SGA e do Power CRM (as que gravam pedem confirmação); fotos no SGA; vencimento de boleto |
| gerencia | Tudo do cadastro + indicadores, consulta SQL livre (somente leitura) na base, gestão da equipe |
| diretoria | Tudo + financeiro (MGF) |
| admin | Tudo |

## Colocar no ar

1. **Banco** (já feito): schema `paloma` e usuário `paloma_app` criados no Supabase
   (`sql/001_paloma.sql`).
2. **Render** → New → Blueprint → este repositório (usa `render.yaml`, plano Starter, sempre
   ligado). Preencha as variáveis (modelo em `.env.example`).
   - `DATABASE_URL`: Supabase → Connect → *Session pooler*; troque o usuário por
     `paloma_app.ddsvxbdmrmktwfgrtbfq` e a senha pela do `paloma_app`.
   - `URL_PUBLICA`: a URL que o Render der (ex.: `https://paloma-jrpv.onrender.com`).
   - `ADMIN_TELEFONE`: seu WhatsApp (55 + DDD + número). Você vira admin.
3. **WhatsApp**: abra no navegador
   `https://SUA-URL/admin/whatsapp/qr` com o cabeçalho `x-admin-token`, ou rode
   `curl -H "x-admin-token: ..." https://SUA-URL/admin/whatsapp/conectar`. O servidor cria a
   instância na uazapi, aponta o webhook e mostra o QR Code; escaneie com o celular do número da
   Paloma. Se preferir conectar pelo painel da uazapi, coloque o token da instância em
   `UAZAPI_INSTANCIA_TOKEN` e chame `/admin/whatsapp/conectar` só para apontar o webhook.
4. **Voz**: `GET /admin/voz/vozes` lista as vozes da conta ElevenLabs; escolha uma voz feminina
   brasileira e coloque o id em `ELEVENLABS_VOICE_ID`.
5. **Power CRM**: em Integrações → Webhooks v2, aponte para
   `https://SUA-URL/webhook/powercrm/<WEBHOOK_SEGREDO>`.
6. **Equipe**: mande "oi" para a Paloma do seu número e peça para ela cadastrar as pessoas
   ("cadastra o Rokleiton como consultor, telefone ..., voluntário 123, e-mail ...").

## Desenvolvimento

```bash
npm install
npm run check   # typecheck
npm test        # testes (fonética, webhook, catálogo)
cp .env.example .env && npm run dev
```

## Documentação

- [Mapeamento das APIs](docs/MAPEAMENTO_APIS.md): o que dá para fazer em cada sistema e os limites.
- [SGA: referência completa](docs/api/SGA.md) (136 rotas, gerado da doc oficial)
- [Power CRM: OpenAPI consolidado](docs/api/powercrm-openapi.json) (25 rotas)
