"use client";
import { useState } from "react";
import { LockKeyhole, ArrowRight } from "lucide-react";
export default function Login({ configured }: { configured: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <p className="eyebrow">EL ARCHIVO PRIVADO DE</p>
      <h1>
        David
        <br />
        <em>Appleton.</em>
      </h1>
      <div className="login-card">
        <LockKeyhole aria-hidden size={20} />
        <h2>Un espacio para tu música.</h2>
        {configured ? (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                const response = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    password: new FormData(event.currentTarget).get("password"),
                  }),
                });
                const body = await response.json();
                if (!response.ok) throw new Error(body.error);
                window.location.reload();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No se pudo conectar.",
                );
                setBusy(false);
              }
            }}
          >
            <label>
              Contraseña
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Entrando…" : "Entrar en mi archivo"}
              <ArrowRight size={17} />
            </button>
            <p role="alert">{error}</p>
          </form>
        ) : (
          <p>
            El archivo está cerrado. Falta configurar el acceso privado en este
            equipo.
          </p>
        )}
      </div>
      <p className="muted">
        Composiciones. Grabaciones. Todo lo que te pertenece.
      </p>
    </main>
  );
}
