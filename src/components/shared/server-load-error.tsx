type ServerLoadErrorProps = {
  title?: string;
  message?: string;
};

export function ServerLoadError({
  title = "Could not load this page",
  message = "Please refresh the page. If the issue continues, check the server logs for the original error.",
}: ServerLoadErrorProps) {
  return (
    <div className="mx-auto flex min-h-[45vh] max-w-2xl items-center justify-center p-6">
      <div className="w-full rounded-2xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-destructive">Load error</p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
