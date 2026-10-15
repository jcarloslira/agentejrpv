# Agente JRPV

Assistente de IA da JRPV Brasil Proteção Veicular, que funciona pelo WhatsApp e está integrada ao
**SGA (Hinova)** e ao **Power CRM**. Dá suporte a consultores, ao setor de cadastro, à gerência
e à diretoria: responde dúvidas, consulta tudo nos sistemas, executa ações, recebe documentos e
fotos, fala por áudio (ElevenLabs) e lembra das pessoas e dos casos.

## Arquitetura (proposta)

```
WhatsApp (instância uazapi dedicada)
   │ texto, áudio, foto, PDF
   ▼
Serviço do agente (Node/TypeScript, sempre ligado)
   ├─ identifica quem fala → papel → ferramentas liberadas
   ├─ Claude (raciocínio + uso de ferramentas em vários passos)
   ├─ áudio → transcrição · imagem/PDF → leitura (CNH, CRLV, B.O., fotos)
   └─ resposta em texto ou voz (ElevenLabs + normalização fonética)
   ▼
Ferramentas JRPV (também expostas como servidor MCP)
   SGA v2 · Power CRM · base de conhecimento · memória
   ▼
Supabase (mesmo projeto do JRPV-DATA.BI)
   espelho SGA (jrpv_*) · espelho Power CRM · memórias (pgvector)
   · arquivos · usuários e papéis · auditoria de ações
```

## Papéis

| Papel | Pode |
|---|---|
| consultor | Consultar e agir só sobre os próprios associados, placas e cotações; criar e atualizar cotação; anexar documentos; tirar dúvidas |
| cadastro | Tudo do consultor, para todos; cadastrar e alterar associado e veículo, vistoria, produtos, boletos |
| gerencia | Tudo do cadastro, mais indicadores, inadimplência, eventos e desempenho por consultor e regional |
| diretoria | Tudo, incluindo financeiro (MGF) e configuração da agente |

Toda ação que grava algo em SGA ou Power CRM pede confirmação e fica registrada na auditoria.

## Documentação

- [Mapeamento das APIs](docs/MAPEAMENTO_APIS.md): o que dá para fazer em cada sistema, limites e o que falta liberar.

## Fases

1. Base: persona, WhatsApp, papéis, consultas ao SGA (reaproveitando o espelho do JRPV-DATA.BI)
2. Power CRM: espelho via `/api/report/db` + webhooks v2
3. Ações com confirmação e auditoria
4. Voz (ElevenLabs), documentos e fotos
5. Servidor MCP publicado (mcp.ai)
