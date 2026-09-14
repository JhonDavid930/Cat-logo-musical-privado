"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading">
      <h1>No se pudo abrir el archivo</h1>
      <p>Tu catálogo permanece guardado. Prueba de nuevo.</p>
      <button onClick={reset}>Volver a intentar</button>
    </main>
  );
}
