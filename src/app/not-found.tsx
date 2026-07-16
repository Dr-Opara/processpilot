export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cobalt">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          This page doesn&apos;t exist.
        </h1>
        <p className="mt-2 text-muted">
          The page you&apos;re looking for may have moved or isn&apos;t
          published yet.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-surface transition-colors hover:bg-cobalt"
        >
          Back to home
        </a>
      </div>
    </div>
  );
}
