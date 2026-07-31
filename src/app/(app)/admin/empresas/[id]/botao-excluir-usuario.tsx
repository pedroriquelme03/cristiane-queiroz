"use client";

export function BotaoExcluirUsuario({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Excluir este usuário e seu acesso? Esta ação não pode ser desfeita.")) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
      >
        Excluir usuário
      </button>
    </form>
  );
}
