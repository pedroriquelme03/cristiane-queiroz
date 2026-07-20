import { Badge } from "@/components/ui/badge";
import {
  ROTULO_STATUS,
  ROTULO_STATUS_FATURA,
  TOM_STATUS,
  TOM_STATUS_FATURA,
  statusFaturaEfetivo,
} from "@/lib/assinatura";
import type { Fatura, StatusAssinatura } from "@/lib/types";

export function BadgeStatusAssinatura({ status }: { status: StatusAssinatura }) {
  return <Badge tom={TOM_STATUS[status]}>{ROTULO_STATUS[status]}</Badge>;
}

export function BadgeStatusFatura({ fatura }: { fatura: Fatura }) {
  const efetivo = statusFaturaEfetivo(fatura);
  return <Badge tom={TOM_STATUS_FATURA[efetivo]}>{ROTULO_STATUS_FATURA[efetivo]}</Badge>;
}
