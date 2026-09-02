"use client";

import { useEffect, useState } from "react";
import { Cake, CloudSun, MapPin } from "lucide-react";

import { Kpi } from "@/components/ui/kpi";

type Clima = {
  temperatura: number;
  descricao: string;
};

const CODIGOS_CLIMA: Record<number, string> = {
  0: "Céu limpo",
  1: "Principalmente limpo",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Neblina",
  48: "Neblina",
  51: "Garoa fraca",
  53: "Garoa",
  55: "Garoa forte",
  61: "Chuva fraca",
  63: "Chuva",
  65: "Chuva forte",
  71: "Neve fraca",
  73: "Neve",
  75: "Neve forte",
  80: "Pancadas de chuva",
  81: "Pancadas de chuva",
  82: "Pancadas fortes",
  95: "Tempestade",
  96: "Tempestade com granizo",
  99: "Tempestade com granizo",
};

function formatarDataHora(agora: Date) {
  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(agora);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(agora);
  return { data, hora };
}

async function buscarClima(cidade: string, uf?: string): Promise<Clima | null> {
  const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geoUrl.searchParams.set("name", cidade);
  geoUrl.searchParams.set("count", "5");
  geoUrl.searchParams.set("language", "pt");
  geoUrl.searchParams.set("format", "json");
  geoUrl.searchParams.set("countryCode", "BR");

  const geoRes = await fetch(geoUrl.toString());
  if (!geoRes.ok) return null;
  const geo = (await geoRes.json()) as {
    results?: { latitude: number; longitude: number; admin1?: string; name: string }[];
  };
  if (!geo.results?.length) return null;

  const ufUpper = uf?.toUpperCase();
  const local =
    geo.results.find((r) => !ufUpper || r.admin1?.toUpperCase().includes(ufUpper)) ??
    geo.results[0];

  const climaUrl = new URL("https://api.open-meteo.com/v1/forecast");
  climaUrl.searchParams.set("latitude", String(local.latitude));
  climaUrl.searchParams.set("longitude", String(local.longitude));
  climaUrl.searchParams.set("current", "temperature_2m,weather_code");
  climaUrl.searchParams.set("timezone", "America/Sao_Paulo");

  const climaRes = await fetch(climaUrl.toString());
  if (!climaRes.ok) return null;
  const clima = (await climaRes.json()) as {
    current?: { temperature_2m: number; weather_code: number };
  };
  if (!clima.current) return null;

  return {
    temperatura: Math.round(clima.current.temperature_2m),
    descricao: CODIGOS_CLIMA[clima.current.weather_code] ?? "Clima indisponível",
  };
}

/** Relógio ao vivo + clima da cidade da empresa (Open-Meteo, sem chave). */
export function RelogioEClima({
  cidade,
  uf,
}: {
  cidade: string | null;
  uf: string | null;
}) {
  const [agora, setAgora] = useState(() => new Date());
  const [clima, setClima] = useState<Clima | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!cidade) return;
    let cancelado = false;
    buscarClima(cidade, uf ?? undefined)
      .then((resultado) => {
        if (!cancelado) setClima(resultado);
      })
      .catch(() => {
        if (!cancelado) setClima(null);
      });
    return () => {
      cancelado = true;
    };
  }, [cidade, uf]);

  const { data, hora } = formatarDataHora(agora);
  const local =
    cidade && uf ? `${cidade}/${uf}` : cidade ? cidade : "Cidade não cadastrada";

  const notaClima = clima
    ? `${clima.temperatura}°C · ${clima.descricao}`
    : cidade
      ? "Carregando clima…"
      : "Cadastre a cidade da matriz em Empresa → Estrutura.";

  return (
    <Kpi
      rotulo="Data, hora e clima"
      valor={hora}
      icone={<CloudSun className="size-4" aria-hidden />}
      nota={
        <span className="block space-y-1">
          <span className="capitalize">{data}</span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {local}
          </span>
          <span>{notaClima}</span>
        </span>
      }
    />
  );
}

export function ListaAniversariantes({ nomes }: { nomes: string[] }) {
  return (
    <Kpi
      rotulo="Aniversariantes do dia"
      valor={String(nomes.length)}
      tom={nomes.length > 0 ? "atencao" : "neutro"}
      icone={<Cake className="size-4" aria-hidden />}
      nota={
        nomes.length === 0 ? (
          "Nenhum colaborador faz aniversário hoje."
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {nomes.map((nome) => (
              <span
                key={nome}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs text-foreground"
              >
                {nome}
              </span>
            ))}
          </span>
        )
      }
    />
  );
}
