export function ProductPreviewFrame() {
  return (
    <div
      className="rounded-[2rem] border border-border bg-surface p-4 shadow-soft"
      aria-label="Product preview"
    >
      <div className="rounded-[1.5rem] border border-border bg-[linear-gradient(145deg,#ffffff,#f7f5f0)] p-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <p className="text-sm font-semibold text-ink">Operations board</p>
            <p className="text-sm text-muted">Shared context for repeatable work</p>
          </div>
          <div className="rounded-full bg-signal/10 px-3 py-1 text-sm font-medium text-signal">
            Live
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-paper p-4">
            <p className="text-sm font-semibold text-ink">Approval queue</p>
            <p className="mt-2 text-sm text-muted">4 pending handoffs</p>
          </div>
          <div className="rounded-2xl border border-border bg-paper p-4">
            <p className="text-sm font-semibold text-ink">Playbooks</p>
            <p className="mt-2 text-sm text-muted">6 ready-to-run templates</p>
          </div>
        </div>
      </div>
    </div>
  );
}
