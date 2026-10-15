# Hinova SGA API v2 — referência completa

Gerado de `https://api.hinova.com.br/api/sga/v2/doc/api_data.json`. Base: `https://api.hinova.com.br/api/sga/v2`. Campos com `*` são obrigatórios.

## Associado

### POST `/alterar/associado` — Alterar
- `codigo_associado*` (Number): Código do associado a ser alterado. Opcional caso esteja enviando o CPF do associado
- `nome` (String): Nome do associado.
- `cpf` (String): CPF ou CNPJ válido do associado. Marcara: 999.999.999-99, 99.999.999/9999-99 ou somente números. Opcional caso esteja enviando o codigo_associado. Para alterar o CPF do associado é preciso enviar o código do associado também.
- `rg` (String): Registro geral do associado.
- `data_nascimento` (String): Data de nascimento do associado. Mascara: 99/99/9999.
- `telefone` (String): Número de telefone do associado. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999.
- `celular` (String): Número de celular do associado. . Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999.
- `email` (String): e-Mail do associado. .
- `logradouro` (String): Logradouro residêncial do associado.
- `numero` (String): Número residêncial do associado.
- `complemento` (String): Complemento residêncial do associado.
- `bairro` (String): Bairro residêncial do associado.
- `cidade` (String): Cidade residêncial do associado.
- `estado` (String): Estado residêncial do associado. Informar DESCRIÇÃO ou SIGLA.
- `cep` (String): Cep residêncial do associado. Mascara: 99999-999 ou 99.999-999 ou somente números.
- `codigo_profissao` (Number): Código profissão.
- `codigo_regional` (Number): Código regional.
- `codigo_cooperativa` (Number): Código da cooperativa.
- `codigo_conta` (Number): Código do banco. Obrigatório caso tenha mais de uma conta bancária cadastrada para a regional.
- `dia_vencimento` (Number): Dia do mês no qual o boleto irá vencer.
- `codigo_externo` (Number): Código externo do associado.
- `sexo` (String): Sexo do associado.
- `boleto_fisico` (String): Boleto físico. Mascara: Y ou N
- `data_vencimento_habilitacao` (String): Data de Vencimento da habilitação do associado. . Mascara: 99/99/9999
- `data_primeira_habilitacao` (String): Data de emissão da primeira habilitação do associado. . Mascara: 99/99/9999
- `categoria_cnh` (String): Categoria da CNH do associado.
- `codigo_como_conheceu` (Number): Código da mídia pela qual o associado conheceu a associação.
- `cartao` (Array): Array contendo os atributos do cartão do associado. Contém os atributos: codigo_cartao(código do cartão do associado), hash(hash do cartão), numero_final_cartao(últimos 3 dígitos do cartão)

### GET `/associado/alterar-situacao-para/:codigo_situacao/:codigo_associado` — Alterar situação
Altera a Situação do associado de acordo com o código do associado
- `codigo_situacao*` (Number): Define qual a nova Situação do associado
- `codigo_associado*` (Number): Código do associado o qual se deseja mudar a situação

### GET `/associado/buscar-por-cpf-senha/:cpf/:senha` — Buscar Por CPF-CNPJ e Senha
Busca associado pelo CPF/CNPJ e pela senha

### GET `/associado/buscar/:cpfOuCodigo/:buscar_por` — Buscar
Busca associado pelo CPF ou pelo código
- `cpfOuCodigo*` (String): CPF ou código do associado a ser pesquisado
- `buscar_por*` (String): Define se o parâmetro cpfOuCodigo é o CPF ou o código do associado

### POST `/associado/cadastrar` — Cadastrar
- `nome*` (String): Nome do associado.
- `cpf*` (String): CPF ou CNPJ válido do associado. Marcara: 999.999.999-99, 99.999.999/9999-99 ou somente números
- `rg*` (String): Registro geral do associado
- `data_nascimento*` (String): Data de nascimento do associado. Mascara: dd/mm/yyyy
- `ddd*` (String): DDD do telefone fixo do associado
- `telefone*` (String): Número de telefone do associado. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999
- `logradouro*` (String): Logradouro residêncial do associado
- `numero*` (String): Número residêncial do associado
- `bairro*` (String): Bairro residêncial do associado
- `cidade*` (String): Cidade residêncial do associado
- `estado*` (String): Estado residêncial do associado. Informar DESCRIÇÃO ou SIGLA
- `cep*` (String): Cep residêncial do associado. Mascara: 99999-999 ou 99.999-999 ou somente números
- `codigo_conta*` (Number): Código do banco. Obrigatório caso tenha mais de uma conta bancária cadastrada para a regional
- `mes_referente*` (String): Mês referente
- `sexo*` (String): Sexo do associado. Valores aceitos M ou F.
- `complemento` (String): Complemento residêncial do associado
- `orgao_expedidor_rg` (String): Órgão expedidor do RG.
- `data_expedicao_rg` (String): Data da expedição do RG. . Mascara: dd/mm/yyyy
- `ddd_celular` (String): DDD do celular do associado.
- `ddd_comercial` (String): DDD do telefone comercial do associado.
- `telefone_comercial` (String): Telefone comercial do associado.
- `Celular` (String): Número de celular do associado. . Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999
- `email` (String): e-Mail do associado.
- `email_auxiliar` (String): e-mail auxiliar do associado.
- `codigo_profissao` (Number): Código profissão.
- `codigo_regional` (Number): Código regional.
- `codigo_cooperativa` (Number): Código da cooperativa.
- `dia_vencimento` (Number): Dia do mês no qual o boleto irá vencer.
- `codigo_externo` (Number): Código externo do associado.
- `data_vencimento_habilitacao` (String): Data de Vencimento da habilitação do associado. Mascara: dd/mm/yyyy
- `data_primeira_habilitacao` (String): Data de emissão da primeira habilitação do associado. Mascara: dd/mm/yyyy
- `categoria_cnh` (String): Categoria da CNH do associado.
- `numero_cnh` (String): Número da CNH do associado.
- `data_contrato` (String): Data do contrato do associado.
- `valor_fixo` (Number): Valor fixo mensal
- `codigo_voluntario` (Number): Código do voluntário responsável pela adesão.
- `qtde_parcela_carne` (Number): Quantidade de parcelas do carnê.
- `codigo_como_conheceu` (Number): Código da mídia pela qual o associado conheceu a associação.
- `observacao` (String): Observação do associado.
- `beneficios` (Array): Array contendo os códigos dos benefícios a serem vinculados ao associado.
- `cartao` (Array): Array contendo os dados do cartão de crédito do associado.

### POST `/indicacao-externa/cadastrar` — Cadastrar Indicação Externa
Cadastra uma indicação externa
- `nome*` (String): Nome da indicação.
- `cpf` (String): CPF da indicação.
- `ddd_telefone` (String): DDD do telefone.
- `telefone` (String): Telefone.
- `codigo_associado_indicador` (Number): Código do associado que fez a indicação.
- `codigo_veiculo_indicador` (Number): Código do veículo do associado que fez a indicação.

### GET `/associado/gerar-url-cadastro-cartao/:id_associado/:cpf` — Gerar URL Cadastro Cartão
Gera URL que é utilizada para realizar o cadastramento de cartão de crédito para cobranças recorrentes

### POST `/listar/alteracao-associados/` — Listar Alterações de Associados
Lista as alterações de associados em um intervalo de até 7 dias
- `data_inicial*` (String): Data inicial da pesquisa. Formato dd/mm/yyyy
- `data_final*` (String): Data final da pesquisa. Formato dd/mm/yyyy
- `ultima_alteracao*` (String): Define se será exibida apenas a última alteração de cada associado . Formato "Y" ou "N". Opcional
- `campos*` (Array): Array contendo o nome dos campos do associado que devem ser retornados

### GET `/associado/aniversariante` — Listar Aniversariante Dia
Lista todos os associados/beneficiários aniversariantes do dia

### POST `/listar/associado/` — Listar
Lista os associados de acordo com a situação especificada
- `codigo_situacao*` (Number): Define qual a situação dos associados a serem listados. O codigo_situacao é obrigatório
- `inicio_paginacao*` (Number): Define qual o início da paginação. Se não for enviado, o início da paginação será 0.
- `fim_paginacao*` (Number): Define a quantidade de registros exibidos por página. Se não for enviado, a quantidade de registros por página será de 5000.

### GET `/associado/cartao/listar/:codigoOuCpf` — Buscar Cartões associado
Lista os cartões de crédito de um determinado associado pelo CPF ou código do associado

### GET `/listar/estadocivil/:situacao` — Listar Estados Civis
Lista os estado civis disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação dos estado civis a serem retornados, se a situação for "todos", serão retornados todos os estado civis não excluídos, independente de estarem ativos ou inativos

### GET `/indicacao-externa/listar/:situacao` — Listar Indicação Ext.
Lista as indicações externas cadastradas no sistema
- `situacao*` (String): Define se as indicações a serem retornadas devem estar ativas, inativas ou seleciona todas independente da situação dela.

### GET `/midia/listar/:situacao` — Listar Mídia
Lista as mídias(como conheceu) cadastradas no sistema
- `situacao*` (String): Define se as mídias a serem retornadas devem estar ativas, inativas ou seleciona todas independente da situação dela.

### GET `/listar/parentesco/:situacao` — Listar Parentescos
Lista os parentescos disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação dos parentescos a serem retornados, se a situação for "todos", serão retornados todos os parentescos não excluídos, independente de estarem ativos ou inativos

### GET `/listar/profissao/:situacao` — Listar Profissões
Lista as profissões disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação das profissões a serem retornadas, se a situação for "todos", serão retornadas todas as profissões não excluídas, independente de estarem ativas ou inativas

### GET `/associado/novos-contratos/listar` — Listar a quantidade de contratos
Lista a quantidade de contrato realizados no dia atual

### GET `/listar/situacao/:situacao` — Listar Situação
Lista as situações cadastrada no sistema (Ativo, Pendente, Excluído, etc). Estas situações são utilizadas para ASSOCIADO, VEICULO e BENEFICIÁRIO
- `situacao*` (String): Define se as situações a serem retornadas devem estar ativas, inativas ou seleciona todas independente da situação dela.

### GET `/listar/vencimento/:situacao` — Listar Vencimentos
Lista os vencimentos disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação dos vencimentos a serem retornados, se a situação for "todos", serão retornados todos os vencimentos não excluídos, independente de estarem ativos ou inativos

### GET `/associado-ativo-inativo/listar` — Quant. Associado Ativo/Inativo
Retorna a quantidade de associados ativos e inativos no sistema

## Atendimento

### GET `/buscar/historico-atendimento-associado/:cpf` — Busca Hist. Associado
Busca todos os atendimentos de um determinado associado

### POST `/cadastrar/historico-atendimento-associado` — Cadastrar Hist. Associado
- `codigo_associado*` (Number): Código do associado atendido. Opcional caso esteja enviando o cpf
- `cpf` (String): CPF do associado atendido. Marcara: 999.999.999-99, 99.999.999/9999-99 ou somente números. Opcional caso esteja mandando o codigo_associado
- `codigo_status_atendimento*` (Number): Código do status no qual se encontra o atendimento
- `codigo_tipo_atendimento*` (Number): Código do tipo do atendimento
- `codigo_departamento*` (Number): Código do departamento do atendimento
- `titulo*` (String): Título do atendimento
- `descricao*` (String): Descrição do atendimento
- `codigo_terceiro` (Number): Código do terceiro atendido. Opcional
- `placa` (String): Placa do veículo do atendido.
- `valor_atendimento` (String): Valor de atendimento.
- `codigo_fornecedor` (String): Código do fornecedor.

### GET `/listar/departamento/:situacao` — LIstar departamento
Lista os departamentos que estão na situação enviada

### GET `/listar/status-atendimento/:situacao` — Listar status
Lista os status de atendimento que estão na situação enviada

### GET `/listar/tipo-atendimento/:situacao` — Listar tipo
Lista os tipos de atendimento que estão na situação enviada

## Autenticacao

### POST `/usuario/autenticar` — Autenticar Usuário
Método essencial para utilização dos demais endpoints da APIv2. Retorna um token autenticado, que permite acesso as demais requisições. Atenção: O token que é gerado por este endpoint não expira , portanto não é necessário fazer uma nova autenticação antes de cada requisição aos demais métodos.
- `usuario*` (String): Usuário ATIVO do sistema SGA
- `senha*` (String): Senha de acesso do sistema SGA

## Beneficiario

### POST `/alterar/beneficiario` — Alterar
- `codigo_beneficiario*` (Number): Código do beneficiário a ser alterado. Opcional caso esteja enviando o CPF do beneficiário
- `cpf*` (String): CPF ou CNPJ válido do beneficiário. Marcara: 999.999.999-99, 99.999.999/9999-99 ou somente números. Opcional caso esteja enviando o código do beneficiário. Para alterar o CPF do beneficiário é preciso enviar o código do beneficiário
- `nome` (String): Nome do beneficiário.
- `rg` (String): Registro geral do beneficiário.
- `data_nascimento` (Date): Data de nascimento do beneficiário. Mascara: dd/mm/yyyy.
- `codigo_parentesco` (Number): Código do parentesco do beneficiário.
- `telefone` (String): Número de telefone do beneficiário. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999.
- `celular` (String): Número de celular do beneficiário. . Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999
- `email` (String): e-Mail do beneficiário.
- `logradouro` (String): Logradouro residêncial do beneficiário.
- `numero` (String): Número residêncial do beneficiário.
- `complemento` (String): Complemento residêncial do beneficiário.
- `bairro` (String): Bairro residêncial do beneficiário.
- `cidade` (String): Cidade residêncial do beneficiário.
- `estado` (String): Estado residêncial do beneficiário. Informar DESCRIÇÃO ou SIGLA .
- `cep` (String): Cep residêncial do beneficiário. Mascara: 99999-999 ou 99.999-999 ou somente números.
- `codigo_profissao` (Number): Código profissão.
- `codigo_cooperativa` (Number): Código da cooperativa.
- `codigo_conta` (Number): Código do banco.
- `dia_vencimento` (Number): Dia do mês no qual o boleto irá vencer.
- `codigo_associado` (Number): Código do associado ao qual o beneficiário está vinculado.
- `codigo_externo` (Number): Código externo do beneficiário.
- `sexo` (String): Sexo do beneficiário.
- `categoria_cnh` (String): Categoria da CNH do beneficiário.

### GET `/alterar/beneficiario-para-associado/:codigo_ou_cpf` — Alterar para associado
Transforma um beneficiário em um associado, mantendo todos os dados do beneficiário já cadastrados
- `codigo_ou_cpf*` (String): Código ou CPF do beneficiário a ser transformado em associado

### POST `/beneficiario/cadastrar` — Cadastrar
- `nome*` (String): Nome do beneficiário
- `cpf*` (String): CPF ou CNPJ válido do beneficiário. Mascara: 999.999.999-99, 99.999.999/9999-99 ou somente números
- `rg*` (String): Registro geral do beneficiário
- `data_nascimento*` (Date): Data de nascimento do beneficiário. Mascara: 99/99/9999
- `telefone*` (String): Número de telefone do beneficiário. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999
- `logradouro*` (String): Logradouro residêncial do beneficiário
- `numero*` (String): Número residêncial do beneficiário
- `complemento*` (String): Complemento residêncial do beneficiário
- `bairro*` (String): Bairro residêncial do beneficiário
- `cidade*` (String): Cidade residêncial do beneficiário
- `estado*` (String): Estado residêncial do beneficiário. Informar DESCRIÇÃO ou SIGLA
- `cep*` (String): Cep residêncial do beneficiário. Mascara: 99999-999 ou 99.999-999 ou somente números
- `codigo_conta*` (Number): Código do banco. Obrigatório caso tenha mais de uma conta bancária cadastrada para a regional
- `codigo_associado*` (Number): Código do associado ao qual o beneficiário está vinculado. Obrigatório
- `codigo_parentesco` (Number): Código do parentesco do beneficiário.
- `celular` (String): Número de celular do beneficiário. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999
- `email` (String): e-Mail do beneficiário.
- `codigo_profissao` (Number): Código profissão.
- `codigo_cooperativa` (Number): Código da cooperativa.
- `dia_vencimento` (Number): Dia do mês no qual o boleto irá vencer.
- `codigo_externo` (Number): Código externo do beneficiário.
- `sexo` (String): Sexo do beneficiário.
- `categoria_cnh` (String): Categoria da CNH do beneficiário.
- `qtde_parcela_carne` (Number): Quantidade de parcelas do carnê.
- `valor_fixo` (Number): Valor Fixo.
- `gerar_cobranca` (String): Especifica se deve ser gerada cobrança para o beneficiário sendo cadastrado. Deve ser enviada no formato "Y"(sim) ou "N"(não)
- `beneficios` (Array): Array contendo os códigos dos benefícios a serem vinculados ao beneficiário.

### GET `/listar/vencimento/:situacao` — Listar vencimento
Lista os vencimentos disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação dos vencimentos a serem retornados, se a situação for "todos", serão retornados todos os vencimentos não excluídos, independente de estarem ativos ou inativos

### POST `/listar/beneficiario` — Listar
Lista os beneficiários de acordo com a situação especificada
- `codigo_situacao*` (String): Define qual a situação dos beneficiários a serem listados. O codigo_situacao é obrigatório
- `inicio_paginacao*` (Number): Define qual o início da paginação. Se não for enviado, o início da paginação será 0.
- `fim_paginacao*` (Number): Define a quantidade de registros exibidos por página. Se não for enviado, a quantidade de registros por página será de 5000.

### GET `/listar/beneficio-beneficiario/:codigo_beneficiario` — Listar Benefícios Vinculados
Lista os benefícios vinculados a um certo beneficiário
- `codigo_beneficiario*` (Number): Código do beneficiário a ser consultado

### GET `/listar/conta/:situacao` — Listar contas bancárias
Lista as contas as quais o usuário tem permissão de acesso
- `situacao*` (String): Define qual a situação das contas a serem retornadas, se a situação for "todos", serão retornadas todas as contas, independente de estarem ativas ou inativas

### GET `/listar/estadocivil/:situacao` — Listar Estado Civil
Lista os estados civis disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação dos estado civis a serem retornados, se a situação for "todos", serão retornados todos os estado civis não excluídos, independente de estarem ativos ou inativos

### GET `/listar/parentesco/:situacao` — Listar parentesco
Lista os parentescos disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação dos parentescos a serem retornados, se a situação for "todos", serão retornados todos os parentescos não excluídos, independente de estarem ativos ou inativos

### GET `/listar/profissao/:situacao` — Listar profissao
Lista as profissões disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação das profissões a serem retornadas, se a situação for "todos", serão retornadas todas as profissões não excluídas, independente de estarem ativas ou inativas

### GET `/listar/situacao/:situacao` — Listar situacao
Lista as situações cadastrada no sistema (Ativo, Pendente, Excluído, etc). Estas situações são utilizadas para ASSOCIADO, VEICULO e BENEFICIÁRIO
- `situacao*` (String): Define se as situações a serem retornadas devem estar ativas, inativas ou seleciona todas independente da situação dela.

## Beneficio

### POST `/alterar/beneficio` — Alterar
Altera informações de um benefício específico
- `codigo_beneficio*` (Number): Código do benefício a ser alterado
- `codigo_classificacao_beneficio` (Number): Código da categoria a qual o benefício deve pertencer.
- `idade_beneficiario_inicial` (Number): Idade mínima que o beneficiário deve ter para poder adquirir este benefício.
- `idade_beneficiario_final` (Number): Idade máxima que o beneficiário deve ter para poder adquirir este benefício.
- `descricao` (String): Descrição do benefício.

### GET `/listar/beneficio-por-situacao/:situacao` — Listar
Lista benefícios de acordo com a situação
- `situacao*` (Number): Situação do benefício

### GET `/listar/classificacao-beneficio/:situacao` — Listar Classificação
Lista as classificações de benefício de acordo com a situação enviada
- `situacao*` (Number): Situação do da classificação

### POST `/beneficiario/vincular-beneficio` — Vincular
Vincular uma lista de benefícios ao beneficiário de acordo com o array de benefícios
- `codigo_beneficiario*` (Number): Código do beneficiário retornado pelo método de inserção ou consulta beneficiário
- `beneficios*` (Array): Array contendo os códigos do(s) benefício(s)

### POST `/vincular-remover/beneficio` — Vincular ou remover benefício
Vincula ou exclui benefícios a um beneficiário
- `codigo_beneficiario*` (Number): Código do beneficiário
- `beneficios_adicionar*` (Array): Array contendo os códigos dos benefícios a serem inseridos
- `beneficios_remover*` (Array): Array contendo os códigos dos benefícios a serem removidos

## Boleto

### POST `/alterar/vencimento-boleto` — Alterar Vencimento
Altera a data de vencimento de um determinado boleto, respeitando as permissões de manutenção de boleto do usuário.
- `nosso_numero*` (Number): Nosso numero do boleto a ser alterado.
- `nova_data_vencimento*` (String): Nova data de vencimento. Mascara dd/mm/yyyy

### GET `/buscar/boleto/:nosso_numero` — Buscar
Busca boleto pelo parâmetro nosso_numero
- `nosso_numero*` (Number): Nosso número do boleto a ser pesquisado

### GET `/listar/situacao-boleto/:situacao` — Listar Situação
Busca as situações de boletos disponíveis
- `situacao*` (Number): A situação das situações de boleto a serem retornadas. Pode ser: ativo, inativo, todos

### POST `/boleto/cadastrar` — Cadastrar
- `codigo_associado*` (Number): Código do associado ao qual o boleto pertence
- `codigo_tipo_boleto*` (Number): Código do tipo do boleto
- `codigo_regional*` (Number): Código da regional a qual o associado pertence
- `codigo_conta*` (Number): Código do banco. Obrigatório caso tenha mais de uma conta bancária cadastrada para a regional
- `codigo_situacao*` (Number): Código da situação do boleto
- `mes_referente*` (String): Mês referente do boleto
- `link_boleto*` (Bool): Retorna o link do boleto
- `array_parcela*` (Array): Array contendo os índices: valor (valor da parcela) vencimento (data de vencimento do boleto)
- `referencia*` (Array): Array contendo os índices: modulo (módulo referente do boleto, ele pode ser: beneficiário, veiculo ou cliente) codigo_modulo (código do módulo, se o módulo for "beneficiário", o código_modulo será o código do beneficiário, se for "veiculo" será o código do veículo e se for "cliente" será o código do
- `email` (String): e-Mail do associado.
- `numero_banco` (Number): Número do banco do boleto.
- `data_emissao` (String): Data de emissão do boleto.
- `linha_digitavel` (String): Linha digitável do boleto, caso já tenha sido gerando em outro sistema.
- `codigo_barras` (String): Código de barras do boleto, caso já tenha sido gerando em outro sistema.
- `codigo_tipo_cobranca_recorrente` (Number): Código do tipo de cobrança recorrente. Utilize o método {Listar Tipo Cobrança Recorrente} para ver a listagem de códigos
- `dados_baixa` (Array): Array contendo o índice: data_pagamento - Máscara dd/mm/yyyy

### POST `/listar/boleto` — Listar
Lista boletos emitidos,
- `codigo_situacao*` (Number): Código da situação do boleto. É obrigatório
- `data_emissao_inicial` (String): Filtra pela data de emissão, será o início das datas a serem filtradas
- `data_emissao_final` (String): Filtra pela data de emissão, será o fim das datas a serem filtradas
- `data_vencimento_inicial` (String): Filtra pela data de vencimento, será o início das datas a serem filtradas
- `data_vencimento_final` (String): Filtra pela data de vencimento, será o início das datas a serem filtradas
- `data_vencimento_original_inicial` (String): Filtra pela data de vencimento original, será o início das datas a serem filtradas
- `data_vencimento_original_final` (String): Filtra pela data de vencimento original, será o início das datas a serem filtradas
- `data_pagamento_inicial` (String): Filtra pela data de pagamento, será o início das datas a serem filtradas
- `data_pagamento_final` (String): Filtra pela data de pagamento será o início das datas a serem filtradas
- `mes_referente` (String): Filtra pelo mês/ano referente do boleto a ser listado
- `codigo_associado` (Num): Filtra pelo código do associado ao qual o boleto está vinculado
- `codigo_boleto` (Num): Filtra pelo código do boleto a ser listado

### POST `/listar/boleto-associado/periodo` — Listar por período
Lista todos os boletos em um determinado intervalo de tempo, sendo obrigatório enviar ao menos um par de data inicial e final. O limite do intervalo de tempo é de, no máximo, 31 dias
- `data_vencimento_inicial` (String): Data inicial do vencimento dos boletos a serem retornados.
- `data_vencimento_final` (String): Data final do vencimento dos boletos a serem retornados.
- `data_vencimento_original_inicial` (String): Data inicial do vencimento original dos boletos a serem retornados.
- `data_vencimento_original_final` (String): Data final do vencimento original dos boletos a serem retornados.
- `data_pagamento_inicial` (String): Data inicial do pagamento dos boletos a serem retornados.
- `data_pagamento_final` (String): Data final do pagamento dos boletos a serem retornados.
- `data_emissao_inicial` (String): Data inicial da emissão dos boletos a serem retornados.
- `data_emissao_final` (String): Data final da emissão dos boletos a serem retornados.
- `codigo_tipo_boleto` (Number): Código do tipo do boleto.
- `codigo_situacao_boleto` (Number): Código da situação do boleto.
- `quantidade_por_pagina` (Number): Quantidade de registros a serem exibidos por página. Caso não seja enviado, a quantidade será definida como 3000
- `inicio_paginacao` (Number): Define que qual item a lista deve começar. Caso não seja enviado, a lista irá começar pelo primeiro item do retorno
- `codigo_banco` (Number): Código do banco dos boletos a serem retornados.
- `mes_referente` (String): Mês referente dos boletos a serem retornados. Formato mm/yyyy

### POST `/listar/boleto/periodo` — Listar Boleto Associado Beneficiario
Lista boletos emitidos de associados ou beneficiários.
- `codigo_associado` (Number): Filtra pelo código do associado ao qual o boleto está vinculado
- `cpf_associado` (Number): Filtra pelo cpf do associado ao qual o boleto está vinculado
- `codigo_beneficiario` (Number): Filtra pelo código do beneficiário ao qual o boleto está vinculado
- `cpf_beneficiario` (Number): Filtra pelo cpf do beneficiário ao qual o boleto está vinculado
- `codigo_situacao_boleto` (Number): Código da situação do boleto.
- `data_emissao_inicial` (String): Filtra pela data de emissão, será o início das datas a serem filtradas
- `data_emissao_final` (String): Filtra pela data de emissão, será o fim das datas a serem filtradas
- `data_vencimento_inicial` (String): Filtra pela data de vencimento, será o início das datas a serem filtradas
- `data_vencimento_final` (String): Filtra pela data de vencimento, será o início das datas a serem filtradas
- `data_vencimento_original_inicial` (String): Filtra pela data de vencimento original, será o início das datas a serem filtradas
- `data_vencimento_original_final` (String): Filtra pela data de vencimento original, será o início das datas a serem filtradas
- `data_pagamento_inicial` (String): Filtra pela data de pagamento, será o início das datas a serem filtradas
- `data_pagamento_final` (String): Filtra pela data de pagamento será o início das datas a serem filtradas
- `quantidade_por_pagina` (Number): Limita a quantidade de registros do retorno
- `inicio_paginacao` (Number): Indica a páginação desejada dos resultado

### POST `/listar/boleto-associado-veiculo` — Listar por associado/veículo
Lista todos os boletos de um associado ou veículo em um determinado intervalo de tempo, sendo obrigatório enviar o código ou cpf do associado ou o código ou placa do veículo e ao menos um par de data inicial e final. O limite do intervalo de tempo é de, no máximo, 90 dias
- `codigo_associado*` (Number): Código do associado ao qual os boletos estão vinculados
- `codigo_veiculo*` (Number): Código do veículo ao qual os boletos estão vinculados
- `cpf_associado*` (String): CPF do associado ao qual os boletos estão vinculados
- `placa*` (String): Placa do veículo ao qual os boletos estão vinculados
- `codigo_situacao_boleto` (Number): Código da situação dos boletos a serem retornados
- `data_vencimento_inicial` (String): Data inicial do vencimento dos boletos a serem retornados.
- `data_vencimento_final` (String): Data final do vencimento dos boletos a serem retornados.
- `data_vencimento_original_inicial` (String): Data inicial do vencimento original dos boletos a serem retornados.
- `data_vencimento_original_final` (String): Data final do vencimento original dos boletos a serem retornados.
- `data_pagamento_inicial` (String): Data inicial do pagamento dos boletos a serem retornados.
- `data_pagamento_final` (String): Data final do pagamento dos boletos a serem retornados.
- `data_emissao_inicial` (String): Data inicial da emissão dos boletos a serem retornados.
- `data_emissao_final` (String): Data final da emissão dos boletos a serem retornados.

### GET `/listar/conta/:situacao` — Listar Contas Bancárias
Lista as contas as quais o usuário tem permissão de acesso
- `situacao*` (String): Define qual a situação das contas a serem retornadas, se a situação for "todos", serão retornadas todas as contas, independente de estarem ativas ou inativas

### GET `/listar/tipo-boleto/:situacao` — Listar tipo
Lista os tipos de boletos cadastrados na base
- `situacao*` (String): Define qual a situação dos tipos de boleto a serem retornados, se a situação for "todos", serão retornados todos os tipos não excluídos, independente de estarem ativos ou inativos

### GET `/tipo-envio-boleto/listar/:situacao` — Listar tipo do envio do boleto
Lista os tipos de envio de boletos cadastrados na base
- `situacao*` (String): Define qual a situação dos tipos de envio de boleto a serem retornados, se a situação for "todos", serão retornados todos os tipos não excluídos, independente de estarem ativos ou inativos

### GET `/tipo-cobranca-recorrente/listar/:situacao` — Listar Tipo Cobr. Recorrente
Lista os tipos de cobranças disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação dos tipos a serem retornadas, se a situação for "todos", serão retornados todos os tipos não excluídos, independente de estarem ativos ou inativos

## Cooperativa

### GET `/cooperativa/buscar/:codigo_cooperativa` — Buscar
Busca a cooperativa pelo código, respeitando as permissões de cooperativa do usuário.
- `codigo_cooperativa*` (String): Código da cooperativa a ser pesquisada.

### POST `/cooperativa/cadastrar` — Cadastrar
- `nome*` (String): Nome da cooperativa
- `cpf*` (String): CPF ou CNPJ válido da cooperativa. Mascara: 999.999.999-99, 99.999.999/9999-99 ou somente números
- `email*` (String): e-Mail da cooperativa.
- `telefone*` (String): Número de telefone da cooperativa. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999
- `contato` (String): Nome do contato responsável pela cooperativa
- `logradouro` (String): Logradouro residêncial da cooperativa
- `numero` (String): Número residêncial da cooperativa
- `complemento` (String): Complemento residêncial da cooperativa
- `bairro` (String): Bairro residêncial da cooperativa
- `cidade` (String): Cidade residêncial da cooperativa
- `estado` (String): Estado residêncial da cooperativa. Informar DESCRIÇÃO ou SIGLA
- `cep` (String): Cep residêncial da cooperativa. Mascara: 99999-999 ou 99.999-999 ou somente números

### GET `/listar/cooperativa/:situacao` — Listar
Lista as cooperativas disponíveis de acordo com a situação desejada e com a permissão do usuário, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação das cooperativas a serem retornadas, se a situação for "todos", serão retornadas todas as cooperativas não excluídas, independente de estarem ativas ou inativas

## Cota

### GET `/cota/buscar/:codigo_cota` — Buscar
Busca a cota pelo código, respeitando as permissões do usuário.
- `codigo_cota*` (Number): Código da cota à ser pesquisado.

### GET `/listar/cota/:codigo_regional/:codigo_cooperativa/:codigo_tipo_veiculo/:valor_fipe/:cilindrada` — Listar
Lista cotas de acordo com regional, cooperativa, tipo veículo, valor Fipe ou cilindrada
- `codigo_regional*` (Number): Código da regional na qual as cotas estão vinculadas
- `codigo_cooperativa*` (Number): Código da cooperativa na qual as cotas estão vinculadas
- `codigo_tipo_veiculo*` (Number): Código do tipo veículo
- `valor_fipe*` (String): Valor protegido do veículo. Deve ser enviado com valor decimal Ex.: 100,00. Pode ser enviado 0 caso o veículo seja baseado em cilindrada.
- `cilindrada*` (String): Cilindrada do veículo. Pode ser enviado 0 quando o veículo é baseado em valor fipe

## Evento

### GET `/evento-sem-alteracao/listar/:quantidade_dias/:codigo_situacao` — Listar Eventos Sem Alteração
Lista os eventos que estão a x dias sem alteração na situação deles
- `quantidade_dias*` (String): Quantidade de dias considerados para buscar eventos que estão sem atualização
- `codigo_situacao*` (String): Código da situação dos eventos a serem buscados

### POST `/evento-aberto/listar` — Listar Eventos Abertos
Lista a quantidade de eventos abertos em um determinado período de tempo
- `data_inicial*` (String): Data inicial da pesquisa. Formato dd/mm/yyyy
- `data_final*` (Number): Data final da pesquisa. Formato dd/mm/yyyy]

### POST `/evento-finalizado/listar` — Listar Eventos Finalizados
Lista a quantidade de eventos finalizados em um determinado período de tempo
- `data_inicial*` (String): Data inicial da pesquisa. Formato dd/mm/yyyy
- `data_final*` (Number): Data final da pesquisa. Formato dd/mm/yyyy]

### GET `/listar/evento-veiculo/:placa_ou_codigo` — Listar por veículo
Lista os eventos de um determinado veículo
- `placa_ou_codigo*` (String): PLaca ou código do veículo a ser consultado

### GET `/situacao-evento/listar/:situacao` — Listar Situações Evento
Lista as situações de evento disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação das situações de evento a serem retornadas, se a situação for "todos", serão retornadas todas as situações de evento, independente de estarem ativas ou inativas

### GET `/veiculo-reparo-oficina/listar` — Veículos por Oficina/Fornecedor
Retorna a quantidade de Veículos por Oficina/Fornecedor

## Fornecedor

### GET `/fornecedor/buscar/:cpf_cnpj` — Buscar
Busca um fornecedor pelo CPF ou CNPJ dele.
- `cpf_cnpj*` (String): CPF ou CNPJ do fornecedor a ser pesquisado.

### POST `/fornecedor/cadastrar` — Cadastrar
Cadastra um fornecedor na base de dados.
- `cpf*` (String): CPF ou CNPJ válido do fornecedor. Mascara: 999.999.999-99, 99.999.999/9999-99 ou somente números
- `nome*` (String): Nome do fornecedor
- `telefone*` (String): Número de telefone da cooperativa. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999
- `nome_fantasia` (String): Nome fantasia do fornecedor
- `logradouro` (String): Logradouro do fornecedor
- `numero` (String): Número do fornecedor
- `complemento` (String): Complemento do fornecedor
- `bairro` (String): Bairro do fornecedor
- `cidade` (String): Cidade do fornecedor
- `estado` (String): Estado do fornecedor. Informar DESCRIÇÃO ou SIGLA
- `cep` (String): Cep do fornecedor. Mascara: 99999-999 ou 99.999-999 ou somente números
- `email` (String): e-Mail do fornecedor.

## MGF

### POST `/mgf-lancamento/alterar` — Alterar Lançamento
Altera um lançamento no MGF
- `codigo_lancamento*` (Number): Código do lançamento a ser alterado.
- `codigo_evento` (Number): Código do evento vinculado ao lançamento. Caso seja enviado o código do associado ou veículo para alterar, este campo é obrigatório
- `codigo_associado` (Number): Código do associado vinculado ao lançamento. Caso seja enviado o código do associado ou veículo para alterar, este campo é obrigatório
- `codigo_veiculo` (Number): Código do associado vinculado ao lançamento. Caso seja enviado o código do associado ou veículo para alterar, este campo é obrigatório
- `codigo_fornecedor` (Number): Código da sub-operação do lançamento.
- `numero_nota_fiscal` (String): Número da nota fiscal relacionada ao lançamento.
- `controle_interno` (String): Altera o número de controle interno do lançamento.
- `alterar_parcelas` (Array): Array contendo os índices: parcela (qual parcela do lançamento está se referindo) codigo_situacao_parcela valor_parcela (valor da parcela. Formato "99,99". Opcional) valor_pagamento (valor pago da parcela. Formato "99,99". Opcional) data_vencimento (data de vencimento da parcela. Formato "dd/mm/yyyy

### GET `/mgf-conta-pagar/buscar/:codigo_ou_nota` — Buscar Conta Pagar
Busca uma conta a pagar pelo número da nota ou código do lançamento.
- `codigo_ou_nota*` (String): Código do lançamento ou número da nota fiscal a ser consultado

### GET `/mgf-conta-receber/buscar/:codigo_ou_nota` — Buscar Conta Receber
Busca uma conta a receber pelo número da nota ou código do lançamento.
- `codigo_ou_nota*` (String): Código do lançamento ou número da nota fiscal a ser consultado

### GET `/mgf-saldo-caixa/buscar/:codigo_caixa` — Buscar Saldo Caixa
Retorna o saldo de um determinado caixa.
- `codigo_caixa*` (String): Código do caixa a ser pesquisado o saldo.

### GET `/mgf-saldo-conta/buscar/:codigo_conta` — Buscar Saldo Conta
Retorna o saldo de uma determinada conta bancária.
- `codigo_conta*` (String): Código da conta a ser pesquisado o saldo.

### POST `/mgf-lancamento/cadastrar` — Cadastrar Lançamento
Cadastra um lançamento no MGF
- `data_nota_fiscal*` (String): Data da Nota Fiscal. Formato dd/mm/yyyy
- `numero_nota_fiscal` (Number): Número da Nota FIscal.
- `valor_nota_fiscal*` (Number): Valor da Nota Fiscal.
- `codigo_operacao*` (Number): Código da operação do lançamento.
- `codigo_suboperacao*` (Number): Código da sub-operações do lançamento.
- `data_pagamento` (String): Data do pagamento do Lançamento. Formato dd/mm/yyyy
- `codigo_banco` (Number): Código do banco do lançamento. Necessário enviar código banco ou código caixa local
- `codigo_caixa_local` (Number): Código do caixa local do lançamento. Necessário enviar código banco ou código caixa local
- `parcelas*` (Array): Array contendo os índices: codigo_situacao_parcela valor_parcela (valor da parcela. Formato "99,99") data_vencimento (data de vencimento da parcela. Formato "dd/mm/yyyy")

### GET `/mgf-lancamento/excluir/:codigo_lancamento` — Excluir Lançamento
Exclui um lançamento do MGF.
- `codigo_lancamento*` (Number): Código do lançamento a ser excluído.

### GET `/mgf-suboperacao/listar/:situacao` — Listar Sub-operação
Lista as sub-operações disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação das sub-operações a serem retornadas, se a situação for "todos", serão retornadas todas as sub-operações, independente de estarem ativas ou inativas

### GET `/listar/conta/:situacao` — Listar conta bancária
Retorna contas bancárias de acordo com as permissões do usuário.
- `situacao*` (String): Ativo, inativo, todos. Define qual a situação das contas bancárias a serem retornados, se a situação for "todos", serão retornados todas as contas bancárias não excluídos, independente de estarem ativos ou inativos

### POST `/mgf-lancamento/listar` — Listar Lançamento
Lista lançamentos do MGF
- `data_vencimento_inicial*` (String): Data da vencimento original. Formato dd/mm/yyyy
- `data_vencimento_final*` (String): Data da vencimento final. Formato dd/mm/yyyy
- `codigo_operacao` (Number): Código da operação do lançamento.

### GET `/mgf-caixa/listar/:situacao` — 
Lista os caixas de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação dos caixas a serem retornados, se a situação for "todos", serão retornados todos os caixas, independente de estarem ativos ou inativos

### GET `/mgf-operacao/listar` — Listar Operações MGF
Lista as Operações do MGF

## Produto

### GET `/produto/buscar/:codigo_produto` — Buscar
Busca o produto pelo código, respeitando as permissões do usuário.
- `codigo_produto*` (Number): Código do produto à ser pesquisado.

### POST `/veiculo/incluir/produto-adicional` — Cadastrar Prod. Adicional
Cadastra um produto adicional a um veículo
- `codigo_veiculo*` (String): Código do veículo ao qual o produto adicional será vinculado
- `descricao*` (String): Descrição do produto adicional
- `valor*` (Number): Valor do produto adicional
- `formato*` (String): Formato do produto adicional. Pode ser "R$" ou "%"
- `codigo_classificacao*` (String): Código da classificação do produto adicional. Opcional
- `mes_referente*` (String): Mês referente inicial da cobrança do produto adicional. Formato "mm/yyyy"
- `mes_referente_final*` (String): Mês referente final da cobrança do produto adicional. Formato "mm/yyyy"

### GET `/listar/produto/:codigo_regional/:codigo_cooperativa/:codigo_tipo_veiculo/:valor_fipe/:cilindrada` — Listar
Lista produtos filtrando por regional, cooperativa, tipo veículo, valor Fipe ou cilindrada e respeitando as permissões de cooperativa e regional do usuário
- `codigo_regional*` (Number): Código da regional na qual os produtos estão vinculados
- `codigo_cooperativa*` (Number): Código da cooperativa na qual os produtos estão vinculados
- `codigo_tipo_veiculo*` (Number): Código do tipo veículo
- `valor_fipe*` (String): Valor protegido do veículo. Deve ser enviado com valor decimal Ex.: 100,00. Pode ser enviado 0 caso o veículo seja baseado em cilindrada.
- `cilindrada*` (String): Cilindrada do veículo. Pode ser enviado 0 quando o veículo é baseado em valor fipe

### GET `/listar/produto-por-situacao/:situacao` — Listar Por Situação
Lista todos os produtos que estão dentro da situação enviada respeitando as permissões de cooperativa e regional do usuário. Este método não usa os filtros específicos: Regional, Cooperativa, Tipo veículo, Valor Fipe e Cilindrada. Estes filtros são utilizados no método listar/produto
- `situacao*` (Number): Situação do produto

### GET `/listar/classificacao-produto/:situacao` — Listar Classificação
Lista as classificações de produtos de acordo com a situação. A situação pode ser "ativo", "inativo" ou "todos"
- `situacao*` (Number): Classificação do produto

### GET `/listar/grupo-produto/:situacao` — Listar grupo
Lista todos os grupos de produto de acordo com o parâmetro "situacao"
- `situacao*` (Number): Define qual a situação dos grupos a serem retornados, se a situação for "todos", serão retornados todos os grupos não excluídos, independente de estarem ativos ou inativos

### GET `/grupoproduto/listar` — Listar Grupo Produto
Lista os grupos de produtos cadastrados no sistema

### POST `/veiculo/listar-produto-adicional` — Listar Prod. Adicional
Lista os produtos adicionais vinculados a um veículo
- `codigo_veiculo*` (Number): Código do veículo
- `data_cadastro_inicial*` (String): Data de cadastro inicial do produto adicional. Formato "dd/mm/yyyy"
- `data_cadastro_final*` (String): Data de cadastro final produto adicional. Formato "dd/mm/yyyy"

### GET `/produto-vinculado-veiculo/listar/:codigoOuPlaca` — Listar Produtos Veículo
Lista todos os produtos de um determinado veículo
- `codigoOuPlaca*` (Number): Código ou placa do veículo a ser consultado

### POST `/veiculo/vincular-remover/produto` — Vincular ou remover produto
Vincula ou exclui produtos a um veículo
- `codigo_veiculo*` (Number): Código do veículo
- `produtos_adicionar*` (Array): Array contendo os códigos dos produtos a serem inseridos
- `produtos_remover*` (Array): Array contendo os códigos dos produtos a serem removidos

## Regional

### POST `/regional/cadastrar/` — Cadastrar
- `nome*` (String): Nome da regional
- `nome_fantasia*` (String): Nome fantasia da regional
- `cnpj*` (String): CNPJ válido da regional. Mascara: 99.999.999/9999-99 ou somente números
- `logradouro*` (String): Logradouro residêncial da regional
- `numero*` (String): Número residêncial da regional
- `complemento*` (String): Complemento residêncial da regional
- `bairro*` (String): Bairro residêncial da regional
- `cidade*` (String): Cidade residêncial da regional
- `estado*` (String): Estado residêncial da regional. Informar DESCRIÇÃO ou SIGLA
- `cep*` (String): Cep residêncial da regional. Mascara: 99999-999 ou 99.999-999 ou somente números
- `telefone*` (String): Número de telefone da regional. Mascara: 99999999999, 99 999999999, 99 99999-9999, (99) 99999-9999
- `email*` (String): e-Mail da regional.
- `website` (String): Website da regional.

### GET `/listar/regional/:situacao` — Listar
Lista as regionais disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação das regionais a serem retornadas, se a situação for "todos", serão retornadas todas as regionais não excluídas, independente de estarem ativas ou inativas

## Veiculo

### POST `/alterar/veiculo` — Alterar
- `codigo_veiculo*` (Number): Código do veículo que será alterado. É o único campo obrigatório
- `codigo_associado` (Number): Código do associado para vinculo ao veículo.
- `codigo_cooperativa` (Number): Código da cooperativa. Será selecionado de acordo com a permissão do usuário.
- `codigo_voluntario` (Number): Código do voluntário. Será selecionado de acordo com a cooperativa.
- `ano_fabricacao` (Number): Ano fabricação do veículo. Mascara: 9999.
- `ano_modelo` (Number): Ano modelo do veículo. Mascara: 9999.
- `modelo` (String): Modelo do veículo.
- `placa` (String): Placa do veículo. Caso o veículo seja ZERO KM não necessário enviar ou enviar vazio.
- `chassi` (String): Chassi do veículo.
- `renavam` (String): Renavam do veículo.
- `numero_motor` (String): Número motor do veículo.
- `kilometragem` (Number): Kilometagem do veículo.
- `cilindrada` (Number): Cilindrada do veículo. Utilizado quando o item é motocicleta.
- `quantidade_portas` (Number): Quantidade de portas do veículo.
- `cambio` (String): Tipo do câmbio do veículo. Ele pode ser: A(automático), M(manual) ou 0(não informado).
- `codigo_fipe` (String): Código fipe do veículo. Com este código será localizado MARCA, MODELO e demais itens ligados ao item. Mascara: 999999-9, 999999.9, 9999999.
- `codigo_cota` (Number): Código da cota de participação do veículo. Será selecionado baseado no valor fipe, tipo do veículo, regional e cooperativa.
- `codigo_conta` (Number): Código da cota bancária.
- `dia_vencimento` (Number): Dia de vencimento desejável pelo associado.
- `codigo_alienacao` (Number): Código da alienação fiduciária.
- `codigo_combustivel` (Number): Código do combustível do veículo.
- `codigo_cor` (Number): Código da cor do veículo.
- `codigo_tipo_veiculo` (Number): Código do tipo de veículo
- `codigo_categoria_veiculo` (Number): Código da categoria veículo.
- `logradouro` (String): Logradouro correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios.
- `numero` (String): Número correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios.
- `complemento` (String): Complemento correspondência.
- `bairro` (String): Bairro correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios.
- `cidade` (String): Cidade correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios.
- `estado` (String): Estado correspondência. Informar DESCRIÇÃO ou SIGLA. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios.
- `codigo_indicacao_externa` (Number): Código da indicação externa do veículo.
- `cep` (String): Cep correspondência. Mascara: 99999-999 ou 99.999-999 ou somente números. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios.
- `numero_nota` (Number): Número da nota fiscal do veículo.
- `data_emissao_nota` (String): Data da emissão da nota fiscal do veículo.
- `valor_fipe_protegido` (Number): Valor protegido do veículo escolhido pelo associado
- `porcentagem_fipe_protegido` (Number): Porcentagem protegido do veículo escolhido pelo associado
- `observacao` (String): Observação.
- `valor_repasse` (String): Valor do repasse do veículo
- `forma_pagamento_repasse` (String): Forma de pagamento do repasse. Formato R$ ou %
- `codigo_modelo` (Number): Código do modelo do veículo
- `gerar_cobranca_taxa_adm` (String): Gerar cobrança taxa administrativa. Formato "Y" ou "N".
- `gerar_cobranca_rateio` (String): Gerar cobrança do rateio. Formato "Y" ou "N"
- `codigo_classificacao` (Number): Código da classificação.
- `valor_fipe` (Number): Valor fipe do veículo.
- `codigo_tipo_envio_boleto` (Number): Código do tipo do envio do boleto.
- `data_contrato` (String): Data Do contrato do veículo.

### GET `/veiculo/alterar-situacao-para/:codigo_situacao/:codigo_veiculo` — Alterar situação
Altera a Situação do Veículo de acordo com o código do veículo
- `codigo_situacao*` (String): Define qual a nova Situação do veículo
- `codigo_veiculo*` (string): Código do Veículo o qual se deseja mudar a situação

### GET `/veiculo/buscar/:placaOuChassi` — Buscar
Lista os dados do veículo associado à placa ou chassi que foi passado como parâmetro de pesquisa
- `placaOuChassi*` (String): Placa ou Chassi do veículo a ser pesquisado pelo método de busca por placa ou chassi

### POST `/buscar/rateio-medio` — Buscar rateio
Calcula o rateio médio para veículos de uma determinada cota, baseando-se no valor fipe, tipo veículo e regional.
- `valor_fipe*` (Number): Valor fipe do veículo
- `codigo_regional*` (Number): Código da regional do veículo
- `codigo_tipo_veiculo*` (Number): Código do tipo do veículo
- `quantidade_meses_media` (Number): Quantidade de meses que serão usados para calcular a média do rateio. Caso não seja enviado a média será calculada baseada nos últimos 3 meses

### GET `/buscar/situacao-financeira-veiculo/:codigo_ou_placa` — Buscar situação Financeira
Busca a situação financeira do veículo
- `codigo_ou_placa*` (String): Código ou placa do veículo a ser consultado

### POST `/veiculo/cadastrar` — Cadastrar
- `codigo_associado*` (Number): Código do associado para vinculo ao veículo
- `ano_fabricacao*` (Number): Ano fabricação do veículo. Mascara: 9999
- `ano_modelo*` (Number): Ano modelo do veículo. Mascara: 9999
- `codigo_tipo_veiculo*` (Number): Código do tipo de veículo.
- `kilometragem*` (Number): Kilometagem do veículo.
- `chassi*` (String): Chassi do veículo.
- `numero_motor*` (String): Número motor do veículo.
- `codigo_fipe*` (String): Código fipe do veículo. Com este código será localizado MARCA, MODELO e demais itens ligados ao item. Mascara: 999999-9, 999999.9, 9999999
- `codigo_cooperativa` (Number): Código da cooperativa. Será selecionado de acordo com a permissão do usuário
- `dia_vencimento*` (Number): Dia de vencimento desejável pelo associado.
- `codigo_voluntario*` (Number): Código do voluntário.
- `codigo_externo` (Number): Código externo do veículo.
- `codigo_modelo` (Number): Modelo do veículo
- `placa` (String): Placa do veículo. Caso o veículo seja ZERO KM não necessário enviar ou enviar vazio
- `renavam` (String): Renavam do veículo.
- `cilindrada` (Number): Cilindrada do veículo. Utilizado quando o item é motocicleta.
- `quantidade_portas` (Number): Quantidade de portas do veículo.
- `cambio` (String): Tipo do câmbio do veículo. Ele pode ser: A(automático), M(manual) ou 0(não informado).
- `codigo_cota` (Number): Código da cota de participação do veículo. Será selecionado baseado no valor fipe, tipo do veículo, regional e cooperativa
- `codigo_conta` (Number): Código da cota bancária.
- `codigo_alienacao` (Number): Código da alienação fiduciária.
- `codigo_combustivel` (Number): Código do combustível do veículo.
- `codigo_cor` (Number): Código da cor do veículo.
- `codigo_categoria_veiculo` (Number): Código da categoria veículo.
- `logradouro` (String): Logradouro correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios
- `numero` (String): Número correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios
- `complemento` (String): Complemento correspondência
- `bairro` (String): Bairro correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios
- `cidade` (String): Cidade correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios
- `estado` (String): Estado correspondência. Informar DESCRIÇÃO ou SIGLA. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios
- `cep` (String): Cep correspondência. Mascara: 99999-999 ou 99.999-999 ou somente números. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios
- `numero_nota` (Number): Número da nota fiscal do veículo.
- `data_emissao_nota` (String): Data da emissão da nota fiscal do veículo.
- `data_contrato` (String): Data Do contrato do veículo.
- `valor_adesao` (String): Valor da adesão.
- `codigo_veiculo_indicador` (Number): Código do veículo que indicou o veículo sendo cadastrado. Caso seja enviado, o veículo indicador receberá 1 ponto
- `codigo_forma_pagamento_adesao` (Number): Código da forma de pagamento da adesão.
- `codigo_depreciacao` (Number): Código da depreciação.
- `valor_fipe_protegido` (Number): Valor protegido do veículo.
- `valor_fixo` (Number): Valor fixo do veículo.
- `porcentagem_fipe_protegido` (Number): Porcentagem do valor FIPE protegido do veículo.
- `participacao` (Number): Valor da participação do veículo.
- `codigo_tipo_envio_boleto` (Number): Código do tipo do envio do boleto.
- `quantidade_passageiros` (Number): Quantidade de passageiros que o veículo suporta.
- `codigo_indicacao_externa` (Number): Código da indicação externa do veículo.
- `observacao` (String): Observação.
- `valor_repasse` (String): Valor do repasse do veículo
- `forma_pagamento_repasse` (String): Forma de pagamento do repasse. Formato R$ ou %
- `exibir_extrato_rateio` (String): Exibir extrato do rateio. Formato "Y" ou "N"
- `gerar_cobranca_rateio` (String): Gerar cobrança do rateio. Formato "Y" ou "N"
- `formato_cobranca` (String): Formato de cobrança do veículo. Mascara: B ou C.
- `qtd_parcela` (String): Quantidade de parcelas.
- `produtos` (Array): Array contendo os códigos dos produtos a serem vinculados ao veículo. Obs.: Se houver algum produto compulsório que se encaixe n perfil do veículo, ele irá ser vinculado automaticamente
- `implementos` (Array): Array contendo os códigos, valores e somar fipe dos implementos a serem vinculados ao veículo.
- `valor_fipe` (Number): Valor fipe do veículo.

### POST `/veiculo/foto/cadastrar` — Cadastrar foto
Adiciona fotos. A foto pode ser enviada como uma URL ou um arquivo binário. Limite de 50 fotos por requição.
- `codigo_veiculo*` (Number): Código do veículo ao qual a foto deve ser vinculada.Opcional
- `codigo_beneficiario*` (Number): Código do beneficiário ao qual a foto deve ser vinculada. Opcional
- `codigo_evento*` (Number): Código do evento ao qual a foto deve ser vinculada. Opcional. Caso se esteja enviando um código de evento é obrigatório mandar um código de veículo que esteja incluso no evento
- `foto*` (Array): Array contendo os índices: nome_arquivo (nome como o arquivo será salvo) codigo_tipo (código do tipo da foto que está sendo inserida) binario (arquivo binário da imagem) link (URL da imagem) Observação: Limite de 50 fotos por requisiçao; Observe que na primeira posição do vetor "foto", do exemplo de

### POST `/cadastrar/agregado` — Cadastrar Agregado
- `codigo_veiculo_vinculado*` (Number): Código do veículo ao qual o agregado será vinculado.
- `ano_fabricacao*` (Number): Ano fabricação do veículo. Mascara: 9999
- `ano_modelo*` (Number): Ano modelo do veículo. Mascara: 9999
- `chassi*` (String): Chassi do veículo
- `numero_motor*` (String): Número motor do veículo
- `codigo_tipo_veiculo*` (Number): Código do tipo de veículo
- `codigo_voluntario` (Number): Código do voluntário. Será selecionado de acordo com a cooperativa
- `codigo_externo` (Number): Código externo do veículo.
- `codigo_modelo` (String): Código do modelo do veículo. caso esteja enviando o código FIPE
- `placa` (String): Placa do veículo. Caso o veículo seja ZERO KM não necessário enviar ou enviar vazio
- `renavam` (String): Renavam do veículo.
- `kilometragem` (Number): Kilometagem do veículo.
- `cilindrada` (Number): Cilindrada do veículo. Utilizado quando o item é motocicleta.
- `cambio` (String): Tipo do câmbio do veículo. Ele pode ser: A(automático), M(manual) ou 0(não informado).
- `codigo_fipe` (String): Código fipe do veículo. caso envie o codigo_modelo. Com este código será localizado MARCA, MODELO e demais itens ligados ao item. Mascara: 999999-9, 999999.9, 9999999
- `codigo_cota` (Number): Código da cota de participação do veículo. Será selecionado baseado no valor fipe, tipo do veículo, regional e cooperativa
- `dia_vencimento` (Number): Dia de vencimento desejável pelo associado.
- `codigo_alienacao` (Number): Código da alienação fiduciária.
- `codigo_combustivel` (Number): Código do combustível do veículo.
- `codigo_cor` (Number): Código da cor do veículo.
- `codigo_categoria_veiculo` (Number): Código da categoria veículo.
- `logradouro` (String): Logradouro correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios
- `numero` (String): Número correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios
- `complemento` (String): Complemento correspondência.
- `bairro` (String): Bairro correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios
- `cidade` (String): Cidade correspondência. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios
- `estado` (String): Estado correspondência. Informar DESCRIÇÃO ou SIGLA. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios
- `cep` (String): Cep correspondência. Mascara: 99999-999 ou 99.999-999 ou somente números. Caso um dos campos que compõe o endereço seja enviando os demais se tornam obrigatórios
- `numero_nota` (Number): Número da nota fiscal do veículo.
- `data_emissao_nota` (String): Data da emissao da nota fiscal do veículo.
- `data_contrato` (String): Data Do contrato do veículo.
- `valor_adesao` (String): Valor da adesão.
- `codigo_veiculo_indicador` (Number): Código do veículo que indicou o veículo sendo cadastrado. Caso seja enviado, o veículo indicador receberá 1 ponto
- `codigo_forma_pagamento_adesao` (Number): Código da forma de pagamento da adesão.
- `codigo_depreciacao` (Number): Código da depreciação.
- `valor_fipe_protegido` (Number): Valor protegido do veículo.

### GET `/listar/alienacao/:situacao` — Listar Alienação
Lista as alienações cadastradas no sistema.
- `situacao*` (String): Define qual a situação das alienações a serem retornadas(ativo ou inativo), se a situação for "todos", serão retornadas todas as alienações, independente de estarem ativas ou inativas

### POST `/listar/alteracao-veiculos` — Listar Alterações de Veículos
Lista as alterações de veículos em um intervalo de até 7 dias
- `data_inicial*` (String): Data inicial da pesquisa. Formato dd/mm/yyyy
- `data_final*` (String): Data final da pesquisa. Formato dd/mm/yyyy
- `ultima_alteracao` (String): Define se será exibida apenas a última alteração de cada veículo. Formato "Y" ou "N". Opcional
- `campos*` (Array): Array contendo o nome dos campos do veículo que devem ser retornados

### GET `/listar/categoria-veiculo/:codigo_tipo/:situacao` — Listar categoria
Lista as categorias disponíveis de acordo com o tipo do veículo e a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Deve ser passado também o código do tipo do veículo Obs: A situação e o tipo são obrigatórios
- `codigo_tipo*` (String): Define o tipo do veículo, como cada categoria está atrelada a um tipo de veículo, só serão retornadas categorias que estejam associadas ao tipo de veículo definido
- `situacao*` (String): Define qual a situação das categorias a serem retornadas, se a situação for "todos", serão retornadas as categorias ativas e inativas

### GET `/listar/combustivel/:situacao` — Listar combustível
Lista os combustíveis disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação dos combustíveis a serem retornados, se a situação for "todos", serão retornados todos os combustíveis, independente de estarem ativos ou inativos

### GET `/listar/conta/:situacao` — Listar conta bancária
Lista as contas as quais o usuário tem permissão de acesso
- `situacao*` (String): Define qual a situação das contas a serem retornadas, se a situação for "todos", serão retornadas todas as contas, independente de estarem ativas ou inativas

### GET `/listar/cor/:situacao` — Listar cor
Lista as cores disponíveis de acordo com a situação desejada, esta situação pode ser: Ativo, Inativo ou Todos. Obs: A situação é obrigatória
- `situacao*` (String): Define qual a situação das cores a serem retornadas, se a situação for "todos", serão retornadas todas as cores, independente de estarem ativas ou inativas

### GET `/listar/depreciacao/:situacao` — Listar Depreciação
Lista as depreciações disponíveis de acordo com a situação desejada, esta situação é obrigatória e pode ser: Ativo, Inativo ou Todos
- `situacao*` (String): Define qual a situação das depreciações a serem retornadas, se a situação for "todos", serão retornadas as depreciações ativas e inativas

### GET `/listar/situacao/:situacao` — Listar situação
Lista as situações cadastrada no sistema (Ativo, Pendente, Excluído, etc). Estas situações são utilizadas para ASSOCIADO, VEICULO e BENEFICIÁRIO
- `situacao*` (String): Define se as situações a serem retornadas devem estar ativas, inativas ou seleciona todas independente da situação dela.

### GET `/buscar/situacao-veiculo/:placaOuChassi` — Buscar situação veículo
Busca a situação do veículo desejado
- `placaOuChassi*` (String): Placa ou chassi do veículo a ser consultado

### GET `/tipo-adesao/listar/:situacao` — Listar Tipo Adesão
Lista os Tipos de Adesões cadastrados no sistema
- `situacao*` (String): Define se os tipos de adesão a serem retornados devem estar ativos, inativos ou seleciona todas independente da situação dela. Este parâmetro pode ser "ativo", "inativo" ou "todos"

### GET `/listar/tipo-veiculo/:situacao` — Listar tipo
Lista os tipos de veículo disponíveis de acordo com a permissão do usuário e a situação desejada, esta situação é obrigatória e pode ser: Ativo, Inativo ou Todos
- `situacao*` (String): Define qual a situação dos tipos a serem retornados, se a situação for "todos", serão retornados os tipos ativos e inativos

### POST `/listar/veiculo` — Listar
Lista os veículos de acordo com a situação especificada
- `codigo_situacao*` (String): Define qual a situação dos veículos a serem listados. O codigo_situacao é obrigatório
- `data_contrato` (String): Define qual a data do contrato dos veículos a serem listados.
- `inicio_paginacao*` (Number): Define qual o início da paginação. Se não for enviado, o início da paginação será 0.
- `quantidade_por_pagina*` (Number): Define a quantidade de registros exibidos por página. Se não for enviado, a quantidade de registros por página será de 5000.

### GET `/veiculo/listar-veiculo-produto/:codigo_situacao` — Lista prod. vinculado
Lista os veículos que estão na situação especificada e os produtos vinculados a cada veículo
- `codigo_situacao*` (String): Define a situação dos veículos a serem retornados

### GET `/listar/forma-pagamento/:situacao` — Listar Forma Pag.
Lista as formas de pagamento cadastradas no sistema.
- `situacao*` (String): Define qual a situação das formas de pagamento a serem retornadas(ativo ou inativo), se a situação for "todos", serão retornadas todas as formas de pagamento, independente de estarem ativas ou inativas

### GET `/implemento-vinculado/listar/:codigoOuPlaca` — Listar Implementos Vinculados
Lista os implementos vinculados a um veículo
- `codigoOuPlaca*` (String): Código ou placa do veículo a ser consultado

### GET `/listar/implemento/:situacao` — Listar Implementos
Lista implementos cadastrados
- `situacao*` (String): Situação dos implementos a serem retornados. Pode ser "ativo", "inativo", "todos"

### GET `/listar/marca/:situacao` — Listar marca
Lista as marcas disponíveis de acordo com a situação desejada
- `situacao*` (String): Define qual a situação das marcas a serem retornadas, se a situação for "todos", serão retornadas as marcas ativas e inativas

### POST `/veiculo/produto/remover` — Remover produto
Remove uma lista de produtos do veículo de acordo com o array de produtos
- `codigo_veiculo*` (Number): Código do veículo retornado pelo método de inserção ou consulta veículo
- `lista_codigo_produto*` (Array): Código dos produtos a serem removidos. Caso o veiculo não possua algum produto da lista enviada, o mesmo será ignorado aplicando a remoção apenas nos produtos vinculados ao veículo

### GET `/produto-adicional/remover/:codigo_veiculo/:codigo_produto_adicional` — Remover Prod. Adicional
Remove determinado produto adicional de um veículo
- `codigo_veiculo*` (String): Código do veículo do qual deseja-se remover o produto adicional
- `codigo_produto_adicional*` (String): Código do produto adicional que deseja-se remover

### POST `/vincular/implemento` — Vincular implemento
Vincula um implemento a um certo veículo
- `codigo_veiculo*` (Number): Código do veículo
- `codigo_implemento*` (Number): Código do implemento a ser vinculado
- `valor_fipe` (Number): Valor FIPE do implemento.
- `porcentagem` (Number): Porcentagem cobrada do implemento.
- `somar_fipe` (String): Define se deseja ou não somar ao valor FIPE do veículo. Deve ser no formato "Y"(sim) ou "N"(não)

### POST `/veiculo/vincular/produto` — Vincular produto
Vincular uma lista de produtos ao veículo de acordo com o array de produtos
- `codigo_veiculo*` (Number): Código do veículo retornado pelo método de inserção ou consulta veículo
- `lista_codigo_produto*` (Array): Código dos produtos a serem inseridos

### POST `/modelo/listar` — Listar Modelos
Lista Veículos Cadastrados no SGA
- `situacao*` (String): Situação dos modelos a serem retornados. Este parâmetro pode ser "ativo", "inativo" ou "todos". Obrigatório
- `inicio_paginacao*` (Number): Define de qual item a lista deve começar. Caso não seja enviado, a lista irá começar pelo primeiro item do retorno. Opcional
- `quantidade_por_pagina*` (Number): Quantidade de registros a serem exibidos por página. Caso não seja enviado, a quantidade será definida como 200. Opcional

## Vistoria

### POST `/cadastrar/vistoria` — Cadastrar vistoria
Cadastra uma vistoria vinculada a um associado
- `codigo_associado*` (Number): Código do associado para quem a vistoria foi feita
- `codigo_vistoriador*` (Number): Código do vistoriador que realizou a vistoria
- `codigo_tipo_vistoria*` (Number): Código do tipo da vistoria.
- `data_vistoria*` (String): Data em que foi realizada a vistoria
- `codigo_veiculo` (Number): Código do veículo vistoriado.
- `codigo_estado_pneu` (Number): Código do estado do pneu.
- `valor_vistoria` (Number): Valor da vistoria.
- `observacao` (String): Obervação da vistoria.
- `longitude` (String): Longitude da localização da vistoria.
- `latitude` (String): Latitude do local da vistoria.

### GET `/listar/estado-pneu/:situacao` — Listar tipo pneu
Lista os estados de pneu de acordo com o parâmetro "situação"
- `situacao*` (String): Define qual a situação dos estados de pneu a serem retornados, se a situação for "todos", serão retornados todos os estados de pneu não excluídos, independente de estarem ativos ou inativos

### GET `/listar/tipo-foto/:situacao` — Listar tipo foto
Lista os tipos de foto de acordo com o parâmetro "situação"
- `situacao*` (String): Define qual a situação dos tipos de fotos a serem retornados, se a situação for "todos", serão retornados todos os tipos de fotos não excluídos, independente de estarem ativos ou inativos

### GET `/listar/tipo-vistoria/:situacao` — Listar Tipo Vistoria.
Lista os tipos de vistoria de acordo com o parâmetro "situação"
- `situacao*` (String): Define qual a situação dos tipos de vistoria a serem retornados, se a situação for "todos", serão retornados todos os tipos de vistoria não excluídos, independente de estarem ativos ou inativos

### GET `/listar/vistoriador/:situacao` — Listar Vistoriador
Lista os vistoriadores de acordo com o parâmetro "situação"
- `situacao*` (String): Define qual a situação dos vistoriadores a serem retornados, se a situação for "todos", serão retornados todos os vistoriadores não excluídos, independente de estarem ativos ou inativos

## Voluntario

### GET `/buscar/voluntario/:cpdOuCodigo` — Buscar
Busca um voluntário pelo CPF ou código, respeitando as permissões de cooperativa do usuário.
- `cpfOuCodigo*` (String): CPF ou código do voluntário a ser pesquisado.

### POST `/voluntario/cadastrar` — Cadastrar
Cadastra um novo voluntário, se o CPF do voluntário for igual a um existente na base, esse voluntário será alterado com os dados enviados na requisição. Quando um voluntário é alterado pelo método de cadastrar voluntário, não é possível alterar as cooperativas às quais ele está atrelado, Para alterar as cooperativas será preciso utilizar um método específico para isso.
- `nome*` (String): Nome do voluntário
- `cpf*` (String): CPF do voluntário
- `celular*` (String): Telefone celular do voluntário
- `telefone_comercial*` (String): Telefone comercial do voluntário
- `formato_pagamento*` (String): Formato de pagamento do voluntário(R ou %)
- `valor_pagamento*` (Number): Valor do pagamento do voluntário
- `cooperativas*` (Array): Array contendo o código das cooperativas que o voluntário estará atrelado
- `codigo_classificacao` (Number): Código da classificação do voluntário.
- `logradouro` (String): Logradouro do voluntário.
- `numero` (Number): Número da residência do voluntário.
- `complemento` (String): complemento da residência do voluntário.
- `bairro` (String): Bairro do voluntário.
- `cidade` (String): Cidade do voluntário.
- `estado` (String): Estado do voluntário.
- `cep` (String): CEP do voluntário.
- `email` (String): E-mail do voluntário.
- `obs` (String): Observações.

### POST `/voluntario/cadastrar-cooperativa/` — Vincular à cooperativa
Adiciona cooperativas ao voluntário
- `codigo_voluntario*` (Number): Código do voluntário ao qual se deseja adicionar as cooperativas
- `array_cooperativas*` (Array): Array contendo o código das cooperativas que serão adicionadas ao voluntário

### POST `/voluntario/excluir-cooperativa/` — Remover de cooperativa
Exclui cooperativas atreladas a um voluntário
- `codigo_voluntario*` (Number): Código do voluntário ao qual se deseja adicionar as cooperativas
- `array_cooperativas*` (Array): Array contendo o código das cooperativas que serão excluídas do voluntário

### POST `/listar/alteracao-voluntario/` — Listar Alterações de Voluntários
Lista as alterações de voluntários em um intervalo de até 7 dias
- `data_inicial*` (String): Data inicial da pesquisa. Formato dd/mm/yyyy
- `data_final*` (Number): Data final da pesquisa. Formato dd/mm/yyyy
- `ultima_alteracao*` (String): Define se será exibida apenas a última alteração de cada voluntario . Formato "Y" ou "N". Opcional
- `campos*` (Array): Array contendo o nome dos campos do voluntario que devem ser retornados

### POST `/listar/indicacao/` — Listar indicações
Lista todas as indicações vinculadas a um voluntario, podendo ser filtrado por data de inclusão
- `codigo_voluntario*` (Number): Código do voluntário que se deseja consultar
- `data_indicacao_inicial` (String): Data de inclusão inicial da pesquisa das indicações.
- `data_indicacao_final` (String): Data de inclusão final da pesquisa das indicações. Obrigatória caso seja enviada a data_indicacao_inicial

### GET `/listar/situacao-adesao-voluntario/:codigo_voluntario` — Listar situação adesão
Lista as adesões feitas por um determinado voluntário
- `codigo_voluntario*` (String): Código do voluntário a ser consultado

### GET `/listar/voluntario/:situacao` — Listar
Lista os voluntários que estão vinculados a cooperativas nas quais o usuário tem permissão. No array "cooperativas", cada índice dele representa o código da cooperativa, e o valor representa o nome da cooperativa
- `situacao*` (String): Define qual a situação dos voluntários a serem retornados, se a situação for "todos", serão retornados todos os voluntários não excluídos, independente de estarem ativos ou inativos

### POST `/listar/voluntario-por-data-cadastro` — Listar voluntário por data cadastro
Lista os voluntários cadastrados num determinado período de datas
- `filtrar_data*` (String): Caso não queira enviar as datas, enviar este parâmetro como "N", assim serão retornados os voluntários independente da data de cadastro deles
- `data_cadastro_inicial*` (String): Data inicial do cadastro do voluntário
- `data_cadastro_final*` (String): Data final do cadastro do voluntário

### POST `/listar/placas-por-voluntario/` — Listar placas
Lista todas as placas vinculadas a um voluntario, podendo ser filtrado por data e participação do fechamento
- `codigo_voluntario*` (Number): Código do voluntário que se deseja consultar
- `participa_fechamento*` (String): Define se irão ser retornados apenas veículos que participam do fechamento ou não. Os valores válidos para este parâmetro são: "Y"(participa fechamento) ou "N"(não participam fechamento). Caso esse parâmetro não seja enviado, serão retornados veículos que participam e que não participam do fechament
- `tipo_retorno*` (String): Define as informações do retorno do método, se for analítico, irá retornar uma lista com as informações de cada veículo vinculado ao voluntário, caso seja sintético irá retornar apenas a quantidade de veículos vinculados ao voluntário. Os valores válidos para este parâmetro são: "sintetico" ou "anal
- `data_cadastro_inicial` (String): Data de cadastro inicial da pesquisa dos veículos. Opcional
- `data_cadastro_final` (String): Data de cadastro inicial da pesquisa dos veículos. Obrigatória caso seja enviada a data_cadastro_inicial
- `data_contrato_inicial` (String): Data de contrato inicial da pesquisa dos veículos. Opcional
- `data_contrato_final` (String): Data de contrato inicial da pesquisa dos veículos. Obrigatória caso seja enviada a data_contrato_inicial
