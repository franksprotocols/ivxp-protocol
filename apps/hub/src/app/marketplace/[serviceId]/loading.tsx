export default function ServiceDetailLoading() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="animate-pulse space-y-8">
        <div className="space-y-4">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-10 w-2/3 rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded bg-muted" />
            <div className="h-6 w-16 rounded bg-muted" />
          </div>
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-48 rounded-lg bg-muted" />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-40 rounded-lg bg-muted" />
              <div className="h-40 rounded-lg bg-muted" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="h-12 rounded-lg bg-muted" />
            <div className="h-32 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </main>
  );
}
