import { FormBio } from "@/components/admin/form-bio";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { getBioPerfil } from "@/lib/bio";

// Reflete sempre o que está no banco (a mesma leitura da página pública).
export const dynamic = "force-dynamic";

export default async function AdminBioPage() {
  const perfil = await getBioPerfil();

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Link na bio"
        descricao="Edite a página pública /bio: foto, textos, serviços e links do Instagram."
      />
      <div className="max-w-3xl">
        <FormBio perfil={perfil} />
      </div>
    </div>
  );
}
