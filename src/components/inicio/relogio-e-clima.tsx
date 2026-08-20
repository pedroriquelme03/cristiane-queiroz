"use client";

import { useEffect, useState } from "react";
import { Cake, CloudSun, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

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
  className,
}: {
  cidade: string | null;
  uf: string | null;
  className?: string;
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

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      <p className="capitalize">{data}</p>
      <p className="tabular text-3xl font-semibold tracking-tight text-foreground">{hora}</p>
      <p className="inline-flex items-center gap-1.5">
        <MapPin className="size-3.5" aria-hidden />
        {local}
      </p>
      {clima ? (
        <p className="inline-flex items-center gap-1.5 text-foreground">
          <CloudSun className="size-4 text-brand" aria-hidden />
          {clima.temperatura}°C · {clima.descricao}
        </p>
      ) : cidade ? (
        <p className="text-xs">Carregando clima…</p>
      ) : (
        <p className="text-xs">Cadastre a cidade da matriz em Empresa → Estrutura.</p>
      )}
    </div>
  );
}

export function ListaAniversariantes({
  nomes,
}: {
  nomes: string[];
}) {
  if (nomes.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Nenhum colaborador faz aniversário hoje.
      </p>
    );
  }

  return (
    <ul className="mx-auto flex max-w-lg flex-wrap items-center justify-center gap-2">
      {nomes.map((nome) => (
        <li
          key={nome}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm"
        >
          <Cake className="size-3.5 text-brand" aria-hidden />
          {nome}
        </li>
      ))}
    </ul>
  );
}
