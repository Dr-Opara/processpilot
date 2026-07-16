export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cobalt">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          This route is not available yet.
        </h1>
        <p className="mt-2 text-muted">
          Return home to continue exploring the ProcessPilot foundation.
        </p>
      </div>
    </div>
  );
}
