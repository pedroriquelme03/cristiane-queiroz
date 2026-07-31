-- Templates iniciais para empresas do segmento industrial.
insert into public.indicadores
  (empresa_id, codigo, nome, descricao, segmento, unidade, direcao_meta)
values
  (null, 'eficiencia_producao', 'Eficiência de produção', 'Produção realizada sobre a capacidade planejada', 'industria', 'percentual', 'maior_melhor'),
  (null, 'oee', 'OEE', 'Disponibilidade, desempenho e qualidade dos equipamentos', 'industria', 'percentual', 'maior_melhor'),
  (null, 'indice_refugo', 'Índice de refugo', 'Itens descartados sobre o total produzido', 'industria', 'percentual', 'menor_melhor'),
  (null, 'custo_unitario_producao', 'Custo unitário de produção', 'Custo industrial dividido pelas unidades produzidas', 'industria', 'moeda', 'menor_melhor')
on conflict do nothing;
