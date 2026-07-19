import { Download, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getDocumentos } from "@/lib/dados";
import { competenciaExtenso, tamanhoArquivo } from "@/lib/format";
import type { Documento } from "@/lib/types";

const ROTULO_CATEGORIA: Record<Documento["categoria"], string> = {
  contrato: "Contratos",
  relatorio: "Relatórios",
  demonstrativo: "Demonstrativos",
  planilha: "Planilhas",
  procedimento: "Procedimentos",
  apresentacao: "Apresentações",
  outros: "Outros",
};

const ORDEM: Documento["categoria"][] = [
  "contrato", "relatorio", "demonstrativo", "planilha",
  "procedimento", "apresentacao", "outros",
];

export default async function DocumentosPage() {
  const documentos = await getDocumentos();

  const porCategoria = ORDEM.map((categoria) => ({
    categoria,
    itens: documentos.filter((d) => d.categoria === categoria),
  })).filter((grupo) => grupo.itens.length > 0);

  return (
    <>
      <CabecalhoPagina
        titulo="Documentos"
        descricao={`${documentos.length} arquivos centralizados`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {porCategoria.map((grupo) => (
          <Card key={grupo.categoria}>
            <CardHeader
              titulo={ROTULO_CATEGORIA[grupo.categoria]}
              descricao={`${grupo.itens.length} ${grupo.itens.length === 1 ? "arquivo" : "arquivos"}`}
            />
            <CardBody className="space-y-2">
              {grupo.itens.map((documento) => (
                <article
                  key={documento.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground">
                    <FileText className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{documento.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {competenciaExtenso(documento.criadoEm)} ·{" "}
                      {tamanhoArquivo(documento.tamanhoBytes)} · {documento.enviadoPor}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                    aria-label={`Baixar ${documento.nome}`}
                  >
                    <Download className="size-4" aria-hidden />
                  </button>
                </article>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <p className="text-sm text-muted-foreground">
            O download ainda não está ligado — os arquivos passarão a vir do
            Supabase Storage quando o projeto for provisionado.{" "}
            <Badge tom="atencao">Pendente</Badge>
          </p>
        </CardBody>
      </Card>
    </>
  );
}
