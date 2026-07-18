/**
 * Modelo de dominio da plataforma. Espelha o schema em supabase/migrations,
 * para que a troca dos dados de exemplo pelo Supabase nao mude as telas.
 */

export type Segmento =
  | "geral"
  | "hotelaria"
  | "comercio"
  | "servicos"
  | "industria"
  | "alimentacao";

export type RegimeTributario = "simples" | "presumido" | "real" | "mei";

export type Papel = "admin" | "consultor" | "cliente";

export type AreaDiagnostico =
  | "financeiro"
  | "compras"
  | "estoque"
  | "comercial"
  | "rh"
  | "processos"
  | "tecnologia"
  | "gestao";

export type GrupoDre =
  | "receita_bruta"
  | "deducoes"
  | "custo_variavel"
  | "despesa_pessoal"
  | "despesa_administrativa"
  | "despesa_comercial"
  | "despesa_financeira"
  | "investimento"
  | "nao_operacional"
  | "outros";

export interface Empresa {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  segmento: Segmento;
  regimeTributario: RegimeTributario;
  dataAbertura: string;
  qtdFuncionarios: number;
  unidades: Unidade[];
}

export interface Unidade {
  id: string;
  nome: string;
  tipo: "matriz" | "filial" | "cd" | "loja";
  cidade: string;
  uf: string;
}

export interface PlanoConta {
  id: string;
  codigo: string;
  nome: string;
  tipo: "receita" | "deducao" | "custo" | "despesa" | "investimento" | "nao_operacional";
  grupoDre: GrupoDre;
}

export interface Lancamento {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  contraparte: string | null;
  planoContaId: string | null;
}

export type StatusTitulo = "aberto" | "parcial" | "pago" | "cancelado";

export interface Titulo {
  id: string;
  tipo: "pagar" | "receber";
  contraparte: string;
  documento: string | null;
  emissao: string;
  vencimento: string;
  valor: number;
  valorPago: number;
  status: StatusTitulo;
  planoContaId: string | null;
}

export interface Orcamento {
  planoContaId: string;
  competencia: string;
  valorPrevisto: number;
}

export interface Indicador {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  unidade: "percentual" | "moeda" | "numero" | "dias";
  direcaoMeta: "maior_melhor" | "menor_melhor";
  valores: { competencia: string; valor: number; meta: number | null }[];
}

export type StatusAcao = "nao_iniciado" | "em_andamento" | "concluido" | "cancelado";

export interface PlanoAcao {
  id: string;
  problema: string;
  acao: string;
  area: AreaDiagnostico;
  responsavel: string;
  prazo: string;
  prioridade: "baixa" | "media" | "alta" | "critica";
  status: StatusAcao;
  percentual: number;
  impactoEstimado: number | null;
}

export interface Diagnostico {
  competencia: string;
  observacoes: string;
  itens: { categoria: AreaDiagnostico; nota: number; observacao: string }[];
}

export interface AvaliacaoMaturidade {
  competencia: string;
  pontuacaoGeral: number;
  itens: { categoria: AreaDiagnostico; pontuacao: number }[];
}

export interface Documento {
  id: string;
  nome: string;
  categoria:
    | "contrato"
    | "relatorio"
    | "demonstrativo"
    | "planilha"
    | "procedimento"
    | "apresentacao"
    | "outros";
  tamanhoBytes: number;
  criadoEm: string;
  enviadoPor: string;
}

export interface Reuniao {
  id: string;
  tipo: "reuniao" | "treinamento";
  titulo: string;
  data: string;
  participantes: string;
  ata: string;
  gravacaoUrl: string | null;
}

export interface Alerta {
  id: string;
  severidade: "info" | "atencao" | "critico";
  titulo: string;
  descricao: string;
}

/** Retorno de dashboard_kpis() */
export interface DashboardKpis {
  competencia: string;
  saldoCaixa: number;
  faturamentoMes: number;
  despesasMes: number;
  resultadoMes: number;
  margemMes: number | null;
  contasPagar: number;
  contasPagarVencidas: number;
  contasReceber: number;
  inadimplencia: number;
}

export interface PontoFluxo {
  data: string;
  entradas: number;
  saidas: number;
  saldoAcumulado: number;
}

export interface PontoProjecao {
  data: string;
  aReceber: number;
  aPagar: number;
  saldoProjetado: number;
}

export interface LinhaDre {
  planoContaId: string;
  codigo: string;
  conta: string;
  grupoDre: GrupoDre;
  tipo: PlanoConta["tipo"];
  realizado: number;
  previsto: number;
}
