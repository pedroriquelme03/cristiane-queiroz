# Plataforma CQ Consultoria Financeira

Sistema de gestão empresarial da Consultoria Cristiane Queiroz: diagnóstico,
indicadores, financeiro, orçamento e acompanhamento da evolução dos clientes em
um único ambiente.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Recharts · next-themes ·
Supabase (Postgres + Auth + Storage).

## Estado atual

A interface está completa e navegável, rodando sobre um **dataset de
demonstração** — uma pousada em Foz do Iguaçu com 12 meses fechados de
movimento. O banco ainda não foi provisionado.

| Tela | Estado |
|---|---|
| Dashboard executivo | Pronta |
| Empresa (dados gerais, estrutura) | Pronta |
| Financeiro (fluxo, a pagar, a receber, DRE, orçamento) | Pronta |
| Indicadores | Pronta |
| Plano de ação | Pronta |
| Diagnóstico empresarial | Pronta |
| Maturidade empresarial | Pronta |
| Documentos | Listagem pronta; download depende do Storage |
| Reuniões e treinamentos | Pronta |
| Login e perfis de acesso | Schema e middleware prontos, tela pendente |
| Importação de planilha | Pendente |

## Como rodar

```bash
npm install
npm run dev
```

Sem variáveis de ambiente o app sobe com os dados de demonstração e sem login.

## Ligando ao Supabase

1. Criar o projeto no Supabase e copiar `.env.example` para `.env.local`.
2. Aplicar as migrations de `supabase/migrations/` na ordem:
   - `0001_schema.sql` — tabelas, view de títulos e trigger de criação de perfil
   - `0002_rls.sql` — Row Level Security (admin / consultor / cliente)
   - `0003_funcoes.sql` — agregações: KPIs, fluxo diário, projeção, DRE
   - `0004_seed_indicadores.sql` — biblioteca de indicadores por segmento
3. Gerar os tipos:
   ```bash
   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
   ```
4. Reescrever o corpo das funções de [src/lib/dados.ts](src/lib/dados.ts)
   chamando as RPCs equivalentes. **As telas não mudam** — esse arquivo é a
   única fronteira entre a interface e a fonte de dados.
5. Remover o atalho no topo de
   [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts), que hoje
   deixa passar sem sessão quando não há chaves configuradas.

## Organização

```
src/
  app/                 rotas (uma pasta por tela)
  components/
    layout/            barra lateral, barra do topo, abas
    ui/                card, badge, kpi, progresso
    graficos/          recharts + paleta validada
    financeiro/        tabela de títulos
  lib/
    dados.ts           fronteira com a fonte de dados
    types.ts           modelo de domínio (espelha o schema)
    format.ts          moeda, percentual, datas em pt-BR
    mock/gerador.ts    dataset de demonstração (determinístico)
supabase/migrations/   schema, RLS e funções de agregação
```

## Decisões que valem lembrar

- **Mês fechado.** A competência padrão é o último mês encerrado. No mês
  corrente boa parte dos custos ainda não foi lançada (folha, impostos e CMV
  caem depois do dia 20), o que inflaria a margem e zeraria linhas da DRE.
- **Nunca dois eixos Y.** Movimento diário e saldo acumulado têm escalas muito
  diferentes e ficam em gráficos separados, não em eixo duplo.
- **Paleta dos gráficos validada** contra as superfícies clara e escura (banda
  de luminosidade, croma, separação para daltonismo e contraste). No par
  entrada/saída, a posição da barra acima ou abaixo do zero é a folga que a cor
  sozinha não dá.
- **"Vencido" nunca é armazenado** — é derivado de status em aberto somado a
  vencimento no passado, na view `titulos_view` e em `statusEfetivo()`.
- **Tema claro/escuro/sistema** via next-themes, com a classe `.dark` no
  `<html>`. Não existe `@media (prefers-color-scheme)` no CSS de propósito:
  teria dois donos do mesmo estado e a escolha manual perderia para o SO. Toda
  a interface é temada por variáveis CSS, inclusive as séries dos gráficos.
