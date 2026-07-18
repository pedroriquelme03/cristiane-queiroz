import { cn } from "@/lib/utils";

export function Progresso({
  valor,
  tom = "marca",
  className,
}: {
  /** 0 a 100 */
  valor: number;
  tom?: "marca" | "positivo" | "atencao" | "negativo";
  className?: string;
}) {
  const cores = {
    marca: "bg-brand",
    positivo: "bg-positive",
    atencao: "bg-warning",
    negativo: "bg-negative",
  };

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-muted", className)}
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all", cores[tom])}
        style={{ width: `${Math.min(100, Math.max(0, valor))}%` }}
      />
    </div>
  );
}
