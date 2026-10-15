export type Papel = "consultor" | "cadastro" | "gerencia" | "diretoria" | "admin";

export type Usuario = {
  id: string;
  nome: string;
  apelido: string | null;
  telefone: string;
  papel: Papel;
  codigo_voluntario: number | null;
  powercrm_email: string | null;
  codigo_regional: number | null;
  preferencias: Record<string, any>;
};

const NIVEL: Record<Papel, number> = { consultor: 1, cadastro: 2, gerencia: 3, diretoria: 4, admin: 5 };

export const pode = (u: Usuario, minimo: Papel) => NIVEL[u.papel] >= NIVEL[minimo];

export const DESCRICAO_PAPEL: Record<Papel, string> = {
  consultor: "consultor(a): vê e age só sobre os próprios associados, placas e cotações",
  cadastro: "setor de cadastro: vê tudo da operação e pode cadastrar e alterar no SGA e no Power CRM",
  gerencia: "gerência: tudo do cadastro, mais indicadores, relatórios e consulta livre à base",
  diretoria: "diretoria: acesso total, inclusive financeiro (MGF)",
  admin: "administrador(a) da Paloma: acesso total e gestão de quem fala com ela",
};

/** Rotas do SGA que só a diretoria usa (financeiro). */
export const rotaSgaRestritaDiretoria = (rota: string) => /mgf-/i.test(rota);

export class SemPermissao extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SemPermissao";
  }
}
