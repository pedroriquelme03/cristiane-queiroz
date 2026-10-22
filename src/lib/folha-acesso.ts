/** Nível de acesso aos dados individuais da folha (sem dependência de servidor). */
export type NivelAcessoFolha = "completo" | "individual" | "agregado";

export const ROTULO_NIVEL_FOLHA: Record<NivelAcessoFolha, string> = {
  completo: "Completo (com CPF)",
  individual: "Individual (sem CPF)",
  agregado: "Somente totais",
};
