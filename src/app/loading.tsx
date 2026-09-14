export default function Loading() {
  return (
    <main className="loading" aria-busy="true">
      <p className="eyebrow">DAVID APPLETON</p>
      <h1>Abriendo tu archivo…</h1>
      <div className="skeleton" />
    </main>
  );
}
