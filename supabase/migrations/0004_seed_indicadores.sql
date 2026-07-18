-- =============================================================================
-- Biblioteca de indicadores (empresa_id null = template disponivel para todos).
-- Ao cadastrar uma empresa, a consultoria copia os templates do segmento dela.
-- =============================================================================

-- unique(empresa_id, codigo) nao cobre os templates: no Postgres cada NULL e
-- distinto, entao o codigo poderia repetir. Indice parcial resolve.
create unique index if not exists indicadores_template_codigo_key
  on public.indicadores (codigo) where empresa_id is null;

insert into public.indicadores (empresa_id, codigo, nome, descricao, segmento, unidade, direcao_meta) values
  -- Geral
  (null, 'margem_lucro',      'Margem de lucro',        'Resultado liquido sobre a receita', 'geral', 'percentual', 'maior_melhor'),
  (null, 'capital_giro',      'Capital de giro',        'Ativo circulante menos passivo circulante', 'geral', 'moeda', 'maior_melhor'),
  (null, 'liquidez_corrente', 'Liquidez corrente',      'Ativo circulante dividido pelo passivo circulante', 'geral', 'numero', 'maior_melhor'),
  (null, 'endividamento',     'Endividamento',          'Passivo total sobre ativo total', 'geral', 'percentual', 'menor_melhor'),
  (null, 'folha_faturamento', 'Folha sobre faturamento','Custo de pessoal dividido pela receita', 'geral', 'percentual', 'menor_melhor'),
  (null, 'ponto_equilibrio',  'Ponto de equilibrio',    'Faturamento minimo para cobrir os custos', 'geral', 'moeda', 'menor_melhor'),
  (null, 'prazo_recebimento', 'Prazo medio de recebimento', 'Dias medios entre venda e recebimento', 'geral', 'dias', 'menor_melhor'),
  (null, 'inadimplencia',     'Inadimplencia',          'Titulos vencidos sobre total a receber', 'geral', 'percentual', 'menor_melhor'),

  -- Hotelaria
  (null, 'taxa_ocupacao',     'Taxa de ocupacao',       'UHs ocupadas sobre UHs disponiveis', 'hotelaria', 'percentual', 'maior_melhor'),
  (null, 'diaria_media',      'Diaria media (ADR)',     'Receita de hospedagem por UH ocupada', 'hotelaria', 'moeda', 'maior_melhor'),
  (null, 'revpar',            'RevPAR',                 'Receita por UH disponivel', 'hotelaria', 'moeda', 'maior_melhor'),
  (null, 'cmv_hotelaria',     'CMV',                    'Custo da mercadoria vendida sobre a receita de A&B', 'hotelaria', 'percentual', 'menor_melhor'),
  (null, 'trevpar',           'TRevPAR',                'Receita total por UH disponivel', 'hotelaria', 'moeda', 'maior_melhor'),

  -- Comercio
  (null, 'giro_estoque',      'Giro de estoque',        'Vezes que o estoque se renova no periodo', 'comercio', 'numero', 'maior_melhor'),
  (null, 'ticket_medio',      'Ticket medio',           'Receita dividida pelo numero de vendas', 'comercio', 'moeda', 'maior_melhor'),
  (null, 'margem_produto',    'Margem por produto',     'Margem de contribuicao media dos produtos', 'comercio', 'percentual', 'maior_melhor'),
  (null, 'cobertura_estoque', 'Cobertura de estoque',   'Dias de venda cobertos pelo estoque atual', 'comercio', 'dias', 'maior_melhor'),

  -- Servicos
  (null, 'ocupacao_equipe',   'Ocupacao da equipe',     'Horas faturaveis sobre horas disponiveis', 'servicos', 'percentual', 'maior_melhor'),
  (null, 'churn',             'Churn de clientes',      'Clientes perdidos sobre base inicial', 'servicos', 'percentual', 'menor_melhor'),

  -- Alimentacao
  (null, 'cmv_alimentacao',   'CMV',                    'Custo dos insumos sobre a receita', 'alimentacao', 'percentual', 'menor_melhor'),
  (null, 'ticket_medio_couvert','Ticket medio por pessoa','Receita dividida pelo numero de clientes', 'alimentacao', 'moeda', 'maior_melhor')
on conflict do nothing;
