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

export interface Colaborador {
  id: string;
  nome: string;
  dataNascimento: string;
  ativo: boolean;
}

export interface PlanoConta {
  id: string;
  codigo: string;
  nome: string;
  tipo: "receita" | "deducao" | "custo" | "despesa" | "investimento" | "nao_operacional";
  grupoDre: GrupoDre;
}

export interface ContaBancaria {
  id: string;
  nome: string;
  banco: string | null;
  tipo: "corrente" | "poupanca" | "caixa" | "aplicacao";
  saldoInicial: number;
  ativo: boolean;
}

export interface Lancamento {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  contraparte: string | null;
  documento: string | null;
  planoContaId: string | null;
  origem: "manual" | "importacao" | "integracao";
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
  dataPagamento: string | null;
  status: StatusTitulo;
  planoContaId: string | null;
  origem: "manual" | "importacao" | "integracao";
  /** Conta recorrente mensal (aluguel, energia, etc.). */
  fixa: boolean;
  /** Agrupa as parcelas geradas no mesmo cadastro de conta fixa. */
  grupoFixaId: string | null;
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
  segmento: Segmento;
  personalizado: boolean;
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

export interface HistoricoPlanoAcao {
  id: string;
  planoAcaoId: string | null;
  tipo: "criada" | "alterada" | "progresso" | "comentario" | "excluida";
  descricao: string;
  autorNome: string;
  criadoEm: string;
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
  empresaId?: string;
  tipo: "reuniao" | "treinamento";
  titulo: string;
  data: string;
  participantes: string;
  ata: string;
  gravacaoUrl: string | null;
  empresaNome?: string;
}

export interface Alerta {
  id: string;
  severidade: "info" | "atencao" | "critico";
  titulo: string;
  descricao: string;
}

// ---------------------------------------------------------------------------
// Assinaturas
// ---------------------------------------------------------------------------

export type CicloCobranca = "mensal" | "anual";

export type StatusAssinatura =
  | "trial"
  | "ativa"
  | "inadimplente"
  | "bloqueada"
  | "cancelada";

export type StatusFatura = "aberta" | "paga" | "cancelada";
export type StatusFaturaEfetivo = StatusFatura | "vencida";

export type MetodoPagamento =
  | "pix"
  | "boleto"
  | "cartao"
  | "transferencia"
  | "outro";

export interface Plano {
  id: string;
  nome: string;
  descricao: string;
  precoMensal: number;
  /** Preço anual cheio (12x). null = plano não oferece ciclo anual. */
  precoAnual: number | null;
  trialDias: number;
  /** Recursos exibidos na vitrine do cliente. */
  recursos: string[];
  /** null = ilimitado. */
  limiteUsuarios: number | null;
  limiteEmpresas: number | null;
  publico: boolean;
  ativo: boolean;
  ordem: number;
}

export interface Assinatura {
  id: string;
  empresaId: string;
  planoId: string;
  ciclo: CicloCobranca;
  status: StatusAssinatura;
  diaVencimento: number;
  carenciaDias: number;
  inicio: string;
  trialFim: string | null;
  bloqueioManual: boolean;
  canceladaEm: string | null;
}

export interface Fatura {
  id: string;
  assinaturaId: string;
  empresaId: string;
  competencia: string;
  emissao: string;
  vencimento: string;
  valor: number;
  valorPago: number;
  status: StatusFatura;
  pagoEm: string | null;
  metodoPagamento: MetodoPagamento | null;
  referenciaExterna: string | null;
  observacao: string | null;
}

/**
 * Estado calculado da assinatura de uma empresa. É o que o guarda de acesso e a
 * tela de assinatura consomem — deriva de assinatura + faturas, nunca é gravado.
 */
export interface EstadoAssinatura {
  empresaId: string;
  status: StatusAssinatura;
  /** Acesso ao sistema deve ser bloqueado agora. */
  bloqueada: boolean;
  /** Existe fatura vencida em aberto, mas ainda dentro da carência. */
  emCarencia: boolean;
  /** Dias de atraso da fatura vencida mais antiga (0 se nenhuma). */
  diasAtraso: number;
  /** Dias restantes até o bloqueio (null quando não há atraso ou já bloqueada). */
  diasParaBloqueio: number | null;
  /** Fatura em aberto mais próxima do vencimento, se houver. */
  faturaEmAberto: Fatura | null;
  totalEmAberto: number;
}

/** Uma empresa (tenant) com o resumo da sua assinatura, para o painel admin. */
export interface TenantAssinatura {
  empresa: Empresa;
  plano: Plano;
  assinatura: Assinatura;
  estado: EstadoAssinatura;
  faturas: Fatura[];
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
