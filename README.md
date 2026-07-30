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
| Dashboard executivo | Pronta; agora aceita contexto de empresa/cliente para visão administrativa |
| Visão do cliente | Pronta; admin seleciona cliente e visualiza dashboard/dados no contexto dele |
| Empresa — dados gerais | Pronta; integrada à estrutura multiempresa |
| Empresa — estrutura | Pronta; exibe unidades, filiais, áreas e cargos por empresa |
| Financeiro — fluxo, contas, DRE e orçamento | Pronta |
| Indicadores | Pronta |
| Plano de ação | Pronta |
| Diagnóstico empresarial | Pronta |
| Maturidade empresarial | Pronta |
| Documentos | Listagem pronta; download ainda depende do Storage |
| Reuniões e treinamentos | Pronta |
| Login e perfis de acesso | Tela e ações prontas; autenticação real iniciada via Supabase/Auth |
| Importação de planilha | Assistente completo; grava quando houver banco conectado |
| Lançamento manual | Formulários completos; gravam quando houver banco conectado |
| Assinatura do cliente | Plano, faturas, pagamento PIX de demonstração e troca de plano |
| Bloqueio por inadimplência | Ativo; trava o tenant após carência, deixando acesso apenas à assinatura |
| Super admin — resumo | Pronta; visão geral de MRR, clientes ativos, atrasos e bloqueios |
| Super admin — usuários/empresas | Pronta; CRUD de empresas/clientes e gestão de acessos |
| Super admin — estrutura da empresa | Pronta; admin gerencia unidades, áreas e cargos por cliente |
| Super admin — planos | Pronta; CRUD de planos exibidos na vitrine do cliente |
| Super admin — assinaturas | Pronta; carteira de tenants com pagamento, troca de plano e bloqueio |
| Multiempresa / vínculos | Estrutura criada; vínculos empresa–membros adicionados nas migrations |
| Banco Supabase | Schema avançado com migrations até estrutura multiempresa; depende de provisionamento/aplicação no projeto real |

## Como rodar

```bash
npm install
npm run dev
npm run verifica   # parsers, validação e lógica de bloqueio de assinatura
```

A sessão de demonstração é o **super admin** da consultoria (papel `admin`),
por isso o painel de administração aparece na barra lateral. Para ver a
plataforma na pele do cliente — inclusive o bloqueio por atraso — troque
`role`/`empresaId` em [src/lib/sessao.ts](src/lib/sessao.ts) (ex.: `role:
"cliente"`, `empresaId: "emp-005"`, um tenant bloqueado).

Sem variáveis de ambiente o app sobe com os dados de demonstração e sem login.

## Ligando ao Supabase

1. Criar o projeto no Supabase e copiar `.env.example` para `.env.local`.
2. Aplicar as migrations de `supabase/migrations/` na ordem:
   - `0001_schema.sql` — tabelas, view de títulos e trigger de criação de perfil
   - `0002_rls.sql` — Row Level Security (admin / consultor / cliente)
   - `0003_funcoes.sql` — agregações: KPIs, fluxo diário, projeção, DRE
   - `0004_seed_indicadores.sql` — biblioteca de indicadores por segmento
   - `0005_assinaturas.sql` — planos, assinaturas, faturas, `empresa_bloqueada()`
3. Gerar os tipos:
   ```bash
   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
   ```
4. Reescrever o corpo das funções de [src/lib/dados.ts](src/lib/dados.ts)
   chamando as RPCs equivalentes. **As telas não mudam** — esse arquivo é a
   única fronteira entre a interface e a fonte de dados.
5. Remover o atalho no topo de
   [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts), que hoje
   deixa passar sem sessão quando não há chaves configuradas, e implementar ali
   o reforço server-side do bloqueio (`rpc('empresa_bloqueada')`) marcado com
   TODO — o guarda no cliente já cobre a experiência, o middleware impede burlar
   por navegação direta.
6. Ligar o gateway de pagamento (Mercado Pago/Asaas/Stripe) nos pontos marcados
   com `TODO(gateway)` em [src/app/(app)/assinatura/acoes.ts](src/app/(app)/assinatura/acoes.ts):
   emitir a cobrança e dar baixa na fatura pelo webhook.

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
  vencimento no passado, na view `titulos_view` e em `statusEfetivo()`. O mesmo
  vale para o bloqueio da assinatura: `calcularEstado()` e `empresa_bloqueada()`
  derivam de assinatura + faturas, nunca de um campo gravado.
- **Super admin é o papel `admin`**, não um papel novo: o schema já o define como
  "controle total da plataforma". Ele nunca é bloqueado por inadimplência —
  precisa gerenciar as assinaturas dos outros.
- **Bloqueio em duas camadas.** O guarda no cliente
  ([guarda-assinatura.tsx](src/components/assinatura/guarda-assinatura.tsx)) é a
  experiência; o reforço no middleware (server-side) é o que impede burlar por
  URL direta. Só a rota `/assinatura` passa quando bloqueado.
- **Server actions devolvem os valores enviados.** O React limpa formulários
  não controlados depois que a action roda; sem devolver os valores, um erro
  de validação apagaria tudo que o usuário digitou. A senha nunca volta.
- **O `xlsx` vem do CDN da SheetJS**, não do npm: a versão publicada no npm
  (0.18.5) tem duas vulnerabilidades altas sem correção, e o parser processa
  arquivo enviado pelo usuário.
- **Tema claro/escuro/sistema** via next-themes, com a classe `.dark` no
  `<html>`. Não existe `@media (prefers-color-scheme)` no CSS de propósito:
  teria dois donos do mesmo estado e a escolha manual perderia para o SO. Toda
  a interface é temada por variáveis CSS, inclusive as séries dos gráficos.
