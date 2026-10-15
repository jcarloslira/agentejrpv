# Mapeamento das APIs — SGA (Hinova) e Power CRM

Levantado em 15/10/2026 a partir das documentações oficiais:

- SGA: `https://api.hinova.com.br/api/sga/v2/doc/` (apidoc, 136 rotas)
- Power CRM: `https://power-crm.readme.io/reference` (OpenAPI 3, 25 rotas)

Este documento diz **o que a agente consegue fazer em cada sistema**, onde estão os limites e
como contorná-los. As rotas de leitura do SGA marcadas com ✅ já funcionam em produção no projeto
`JRPV-DATA.BI` (`supabase/functions/jrpv-sync/hinova.ts`).

---

## 1. Hinova SGA v2

**Base:** `https://api.hinova.com.br/api/sga/v2`

**Autenticação (2 etapas):**
1. `POST /usuario/autenticar` com `Authorization: Bearer <TOKEN_API>` e corpo `{usuario, senha}`
2. A resposta traz `token_usuario`, que vai como `Bearer` em todas as outras chamadas.

O token da API é criado em **Área do cliente → APIs → Gerenciar APIs**, e **cada rota precisa
estar marcada nesse token**. Para a agente, as rotas de escrita listadas abaixo precisam ser liberadas.

**Pegadinhas já confirmadas contra a API real** (não estão na doc):
- Datas em `dd/mm/aaaa`; ISO dá 406.
- HTTP 406 serve tanto para erro de parâmetro quanto para "nenhum registro encontrado".
- `inicio_paginacao` conta registros em `/listar/veiculo` e páginas em `/listar/boleto-associado/periodo`.
- `numero_paginas` não é confiável; parar só em página incompleta.
- Janelas máximas: boletos 31 dias, eventos 30, `alteracao-*` 7 dias.

### 1.1 O que a agente consegue FAZER no SGA (escrita)

| Área | Ação | Rota |
|---|---|---|
| Associado | Cadastrar associado | `POST /associado/cadastrar` |
| Associado | Alterar dados | `POST /alterar/associado` |
| Associado | Mudar situação (ativar, inativar…) | `GET /associado/alterar-situacao-para/:codigo_situacao/:codigo_associado` |
| Associado | Gerar link de cadastro de cartão | `GET /associado/gerar-url-cadastro-cartao/:id_associado/:cpf` |
| Associado | Cadastrar indicação externa | `POST /indicacao-externa/cadastrar` |
| Veículo | Cadastrar veículo | `POST /veiculo/cadastrar` |
| Veículo | Alterar veículo | `POST /alterar/veiculo` |
| Veículo | Mudar situação | `GET /veiculo/alterar-situacao-para/:codigo_situacao/:codigo_veiculo` |
| Veículo | **Enviar foto** | `POST /veiculo/foto/cadastrar` |
| Veículo | Cadastrar agregado (condutor) | `POST /cadastrar/agregado` |
| Veículo | Vincular / remover produto | `POST /veiculo/vincular/produto`, `POST /veiculo/produto/remover`, `POST /veiculo/vincular-remover/produto` |
| Veículo | Produto adicional | `POST /veiculo/incluir/produto-adicional`, `GET /produto-adicional/remover/:codigo_veiculo/:codigo_produto_adicional` |
| Veículo | Vincular implemento | `POST /vincular/implemento` |
| Vistoria | **Cadastrar vistoria** | `POST /cadastrar/vistoria` |
| Boleto | Gerar boleto | `POST /boleto/cadastrar` |
| Boleto | **Alterar vencimento** | `POST /alterar/vencimento-boleto` |
| Atendimento | **Registrar atendimento no histórico do associado** | `POST /cadastrar/historico-atendimento-associado` |
| Beneficiário | Cadastrar / alterar / virar associado | `POST /beneficiario/cadastrar`, `POST /alterar/beneficiario`, `GET /alterar/beneficiario-para-associado/:codigo_ou_cpf` |
| Benefício | Alterar / vincular / remover | `POST /alterar/beneficio`, `POST /beneficiario/vincular-beneficio`, `POST /vincular-remover/beneficio` |
| Voluntário (consultor) | Cadastrar / vincular ou remover de cooperativa | `POST /voluntario/cadastrar`, `POST /voluntario/cadastrar-cooperativa/`, `POST /voluntario/excluir-cooperativa/` |
| Financeiro (MGF) | Lançamento: cadastrar / alterar / excluir | `POST /mgf-lancamento/cadastrar`, `POST /mgf-lancamento/alterar`, `GET /mgf-lancamento/excluir/:codigo_lancamento` |
| Cadastros base | Cooperativa, regional, fornecedor | `POST /cooperativa/cadastrar`, `POST /regional/cadastrar/`, `POST /fornecedor/cadastrar` |

> ⚠️ **Limite importante: a API NÃO tem rota para abrir nem alterar EVENTO (sinistro).**
> Eventos são somente leitura (abertos, finalizados, por veículo, sem alteração há N dias,
> veículos em oficina). Abrir um evento continua sendo feito no SGA pela tela. A agente pode
> coletar tudo pelo WhatsApp (B.O., fotos, CNH, relato), montar o dossiê, registrar o atendimento
> no histórico do associado e avisar o setor responsável. Se precisarmos abrir o evento sozinha,
> o caminho é automação de navegador no SGA, o que é frágil e deve ser a última opção.

### 1.2 O que a agente consegue CONSULTAR no SGA

| Área | Consultas |
|---|---|
| Associado | buscar por CPF ou código ✅, listar ✅, alterações ✅, aniversariantes do dia, cartões cadastrados, novos contratos, total ativos/inativos, validar CPF + senha (login do associado) |
| Veículo | buscar por placa ou chassi, **situação financeira do veículo**, situação do veículo, listar ✅, alterações ✅, produtos e implementos vinculados, **rateio médio**, modelos/marcas/cores/combustível/categorias/tipos |
| Boleto | buscar por nosso número, listar, por período ✅, por associado/veículo, alterações ✅, situações, tipos, contas |
| Evento | abertos, finalizados, por veículo/placa, **parados sem alteração há N dias**, situações, veículos por oficina/fornecedor ✅ |
| Atendimento | histórico do associado por CPF, departamentos, status, tipos |
| Produto / Cota | produtos e cotas disponíveis por regional + cooperativa + tipo de veículo + FIPE + cilindrada (**dá para simular o que se aplica a um veículo**) |
| Voluntário | buscar, listar ✅, alterações, **placas por voluntário**, indicações, situação de adesão, por data de cadastro |
| Financeiro (MGF) | contas a pagar e a receber, saldo de caixa e de conta, lançamentos, operações |
| Vistoria | tipos, tipos de foto, estado de pneu, vistoriadores |
| Tabelas | regionais ✅, cooperativas ✅, situações ✅, estado civil, profissão, parentesco, vencimentos, formas de pagamento, alienação, depreciação, mídia |

---

## 2. Power CRM

**Base:** `https://api.powercrm.com.br`
**Autenticação:** `Authorization: Bearer <token>`. O token é gerado em **Minha empresa → Integrações → Power API → Adicionar**.

### 2.1 Rotas

| Grupo | Método e rota | O que faz |
|---|---|---|
| Cotação | `POST /api/quotation/add` | **Cria cotação/lead** (só `name` é obrigatório; aceita placa, chassi, telefone, e-mail, CPF, cidade, cooperativa, modelo/ano, origem, lead source, consultor `slsmnId`, powerlink, desconto, veículo de trabalho) |
| Cotação | `POST /api/quotation/update` | **Altera cotação**: dados pessoais completos (nome, CPF, RG, CNH, nascimento, endereço, telefones), veículo (placa, chassi, renavam, motor, cor, combustível, câmbio, km, ano), plano escolhido (`tppId`), valor protegido, dia de vencimento, desconto, consultor, observações do contrato |
| Cotação | `GET /api/quotation/{quotationCode}` | Consulta cotação |
| Cotação | `GET /api/quotation/plansQuotation?quotationCode=` | Planos e valores da cotação (V2) |
| Cotação | `GET /api/quotation/quotationFipeApi?quotationCode=` | Dados FIPE da cotação |
| Cotação | `POST /api/quotation/card/move?quotationCode=&cardColumn=` | **Move o card no funil** |
| Cotação | `POST /api/quotation/add-tag` | Etiqueta a cotação (`quotationCode`, `tagId`) |
| Cotação | `POST /api/quotation/send-observation?quotationCode=&observation=` | Registra observação |
| Cotação | `POST /api/quotation/send-attachment?quotationCode=` | **Anexa arquivo** (binário: foto, PDF, documento) |
| Cotação | `POST /api/quotation/open-inspection` | **Abre vistoria** (`quotationCode`, `observation`) |
| Cotação | `POST /api/quotation/send-photo?inspectionId=` | **Envia foto da vistoria** (binário) |
| Cotação | `POST /api/quotation/quotationConfirmCashReceivedApi?cardId=` | Confirma pagamento da taxa de adesão |
| Cotação | `POST /api/quotation/quotationTrackerConfirmCashReceivedApi?cardId=` | Confirma pagamento do rastreador |
| Tabelas | `GET /api/quotation/cb?type=`, `/bmy?cb=`, `/cmby?cb=&cy=`, `/stt`, `/ct?st=` | Marcas, anos, modelos, estados, cidades (para montar cotação certa) |
| Atividade | `POST /api/quotation/add-activity` | **Agenda tarefa** (`quotationCode`, `description`, `scheduled` aaaa-mm-dd, `type` ex.: 2 = telefone) |
| Negociação | `GET /api/negotiation/{negotiationCode}` | Consulta negociação |
| Consultor | `POST /api/consultant/powerlink` | PowerLink do consultor por e-mail ou telefone (**é como a agente identifica o consultor que está falando com ela**) |
| Afiliado | `POST /api/quotation/addAffiliate`, `addAffiliateSGA`, `fetchAffiliate` | Cadastra afiliado e consulta extrato de afiliado por período |
| Relatório | `POST /api/report/db` | **Exporta a base** por período (`from`, `to`, tipo de data: criação/atualização). É o que permite a agente "saber de tudo" do CRM. |

### 2.2 Webhooks v2 (tempo real)

O Power envia POST para uma URL nossa quando algo acontece (cerca de 30 eventos, como cotação
criada, cotação aceita e card movido). É assim que a agente fica sabendo das coisas sem perguntar.
Precisa de URL HTTPS pública que responda 2xx. **Erro na resposta desativa o webhook**, então o
receptor responde 200 na hora e processa depois, em fila.

### 2.3 Limites do Power CRM

- **Não há rota para listar cotações com filtro** (por consultor, etapa…). O caminho é
  `/api/report/db` + webhooks, espelhando tudo no nosso banco. A agente consulta o espelho.
- Os IDs de etapa do funil (`cardColumn`), as tags (`tagId`) e as origens não têm rota de
  listagem. Precisamos levantar uma vez no painel e cadastrar numa tabela de configuração.
- Não existe rota de leitura de atividades nem de mensagens.

---

## 3. Ponte SGA ↔ Power CRM

- Fluxo comercial: Power CRM (lead → cotação → vistoria → aceite) → `addAffiliateSGA` / cadastro
  no SGA (associado + veículo + produtos + vistoria + boleto).
- A agente pode **conferir se a cotação aceita virou associado no SGA** (por CPF/placa) e cobrar
  o setor de cadastro quando travar.
- Identidade do consultor: telefone do WhatsApp → `POST /api/consultant/powerlink` (Power) e
  `voluntário` (SGA, por CPF). Os dois códigos ficam no perfil dele no nosso banco e definem o
  que ele enxerga.

---

## 4. O que falta liberar

| Item | Onde |
|---|---|
| Token SGA com as rotas de escrita da seção 1.1 marcadas | SGA → Área do cliente → APIs → Gerenciar APIs |
| Token Power API | Power CRM → Minha empresa → Integrações → Power API |
| Lista das etapas do funil, tags e origens (IDs) | Painel do Power CRM |
| Webhook v2 apontando para a URL da agente | Power CRM → Integrações (depois do deploy) |
| Rede deste ambiente de desenvolvimento liberada para `api.hinova.com.br`, `api.powercrm.com.br`, `power-crm.readme.io` | Configuração do ambiente do Claude Code |
