import { GraduationCap, Users, Video } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { getReunioes } from "@/lib/dados";

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ReunioesPage() {
  const registros = await getReunioes();

  const reunioes = registros.filter((r) => r.tipo === "reuniao");
  const treinamentos = registros.filter((r) => r.tipo === "treinamento");
  const comGravacao = registros.filter((r) => r.gravacaoUrl !== null);

  return (
    <>
      <CabecalhoPagina
        titulo="Reuniões e treinamentos"
        descricao="Histórico de encontros, atas e materiais de apoio"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          rotulo="Reuniões realizadas"
          valor={String(reunioes.length)}
          icone={<Users className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Treinamentos"
          valor={String(treinamentos.length)}
          icone={<GraduationCap className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Com gravação"
          valor={String(comGravacao.length)}
          icone={<Video className="size-4" aria-hidden />}
        />
      </div>

      <Card>
        <CardHeader
          titulo="Histórico"
          descricao="Do encontro mais recente para o mais antigo"
        />
        <CardBody>
          <ol className="space-y-5">
            {registros.map((registro) => {
              const Icone = registro.tipo === "treinamento" ? GraduationCap : Users;
              return (
                <li key={registro.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                      <Icone className="size-4" aria-hidden />
                    </span>
                    <span
                      aria-hidden
                      className="mt-1 w-px flex-1 bg-border last:hidden"
                    />
                  </div>
                  <article className="min-w-0 flex-1 pb-1">
                    <header className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium">{registro.titulo}</h3>
                      <Badge tom={registro.tipo === "treinamento" ? "marca" : "neutro"}>
                        {registro.tipo === "treinamento" ? "Treinamento" : "Reunião"}
                      </Badge>
                      {registro.gravacaoUrl ? (
                        <Badge tom="neutro">
                          <Video className="size-3" aria-hidden />
                          Gravação disponível
                        </Badge>
                      ) : null}
                    </header>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatarDataHora(registro.data)} · {registro.participantes}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">{registro.ata}</p>
                  </article>
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>
    </>
  );
}
