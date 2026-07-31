import Image from "next/image";

import { cn } from "@/lib/utils";

export function MarcaCristianeQueiroz({
  className,
  completa = false,
  priority = false,
}: {
  className?: string;
  completa?: boolean;
  priority?: boolean;
}) {
  const dimensoes = completa
    ? { width: 1859, height: 1081 }
    : { width: 2930, height: 1140 };
  const nomeBase = completa
    ? "/marca/cristiane-queiroz"
    : "/marca/cristiane-queiroz-horizontal";

  return (
    <span
      role="img"
      aria-label="Cristiane Queiroz Consultoria Financeira"
      className={cn("block", className)}
    >
      <Image
        src={`${nomeBase}-escura.png`}
        alt=""
        {...dimensoes}
        priority={priority}
        sizes="(max-width: 640px) 260px, 320px"
        className="h-auto w-full dark:hidden"
      />
      <Image
        src={`${nomeBase}-branca.png`}
        alt=""
        {...dimensoes}
        priority={priority}
        sizes="(max-width: 640px) 260px, 320px"
        className="hidden h-auto w-full dark:block"
      />
    </span>
  );
}
