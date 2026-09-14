"use client";
import DocumentCard from "./document-card";
import FullBackupPanel from "./full-backup-panel";
import GenreField from "./genre-field";
import { genreSummary } from "@/lib/genres";
import { changedReleaseCodeIssue } from "@/lib/release-codes";
import { registrationLabel } from "@/lib/registration-label";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Disc3,
  FileText,
  Library,
  LockKeyhole,
  LogOut,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import {
  catalogSchema,
  kindLabels,
  needsAttention,
  progress,
  registrationsFor,
  relatedIds,
  searchEntities,
  type Catalog,
  type Entity,
} from "@/lib/catalog";
import EntityDetail from "./entity-detail";
import ProgressMeter from "./progress-meter";
import {
  buildSongGroups,
  registrationsForSongGroup,
  type SongGroup,
} from "@/lib/song-groups";

type View = "overview" | "library" | "pending" | "files" | "backup";
type KindFilter = Entity["kind"] | "songs";
export type SaveCatalog = (next: Catalog) => Promise<boolean>;
export default function CatalogApp({
  initial,
  localPreview,
}: {
  initial: Catalog;
  localPreview: boolean;
}) {
  const [catalog, setCatalog] = useState(initial),
    [view, setView] = useState<View>("overview"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [kind, setKind] = useState<KindFilter>("songs"),
    [statusFilter, setStatusFilter] = useState("all"),
    [agency, setAgency] = useState("all"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [light, setLight] = useState(false),
    [creating, setCreating] = useState(false);
  useEffect(() => {
    const select = () =>
      setSelected(new URLSearchParams(window.location.search).get("song"));
    select();
    window.addEventListener("popstate", select);
    return () => window.removeEventListener("popstate", select);
  }, []);
  useEffect(() => {
    setLight(localStorage.getItem("da-theme") === "light");
  }, []);
  const save: SaveCatalog = async (next) => {
    setBusy(true);
    setMessage("");
    try {
      const parsed = catalogSchema.safeParse(next);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const codeIssue = changedReleaseCodeIssue(parsed.data, catalog);
      if (codeIssue) throw new Error(codeIssue);
      const response = await fetch("/api/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setCatalog(catalogSchema.parse(body));
      setMessage("Cambios guardados.");
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const open = (id: string | null) => {
    setSelected(id);
    window.history.pushState(
      {},
      "",
      id ? `?song=${id}` : window.location.pathname,
    );
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const navigate = (next: View) => {
    open(null);
    setView(next);
    setQuery("");
  };
  const stats = progress(catalog.registrations),
    works = catalog.entities.filter((e) => e.kind === "work"),
    pendingWorks = works.filter((e) =>
      registrationsFor(catalog, e.id).some(needsAttention),
    );
  const agencies = [
    ...new Set(catalog.registrations.map(registrationLabel)),
  ].sort();
  const songGroups = buildSongGroups(catalog);
  const matchedEntityIds = new Set(
    searchEntities(catalog, query).map((entity) => entity.id),
  );
  const matches: Array<Entity | SongGroup> = (
    kind === "songs"
      ? songGroups.filter((group) =>
          group.entities.some((entity) => matchedEntityIds.has(entity.id)),
        )
      : catalog.entities.filter(
          (entity) => entity.kind === kind && matchedEntityIds.has(entity.id),
        )
  ).filter((item) => {
    const registrations = (
      "primary" in item
        ? registrationsForSongGroup(catalog, item)
        : registrationsFor(catalog, item.id)
    ).filter(
      (registration) =>
        agency === "all" || registrationLabel(registration) === agency,
    );
    return (
      (agency === "all" || registrations.length > 0) &&
      (statusFilter === "all" ||
        (statusFilter === "attention"
          ? registrations.some(needsAttention)
          : registrations.some(
              (registration) => registration.status === statusFilter,
            )))
    );
  });
  const actionableMatches = matches.filter((item) => {
    const registrations =
      "primary" in item
        ? registrationsForSongGroup(catalog, item)
        : registrationsFor(catalog, item.id);
    return view !== "pending" || registrations.some(needsAttention);
  });
  const visibleMatches =
    view === "overview" ? actionableMatches.slice(0, 8) : actionableMatches;
  const active = catalog.entities.find((e) => e.id === selected);
  const filteredDocuments = catalog.documents.filter((d) =>
    `${d.name} ${catalog.entities.find((e) => e.id === d.entityId)?.title ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const theme = () => {
    setLight(!light);
    localStorage.setItem("da-theme", light ? "dark" : "light");
  };
  return (
    <div className={`app ${light ? "light" : ""}`}>
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <aside className="sidebar">
        <a href="/" className="wordmark" aria-label="David Appleton, inicio">
          David
          <br />
          <em>Appleton.</em>
          <span>ARCHIVO PRIVADO</span>
        </a>
        <nav aria-label="Navegación principal">
          {(
            [
              { id: "overview", label: "Mi espacio", icon: Disc3 },
              { id: "library", label: "Mi música", icon: Library },
              { id: "pending", label: "Qué falta", icon: ShieldCheck },
              { id: "files", label: "Mis archivos", icon: FileText },
            ] as const
          ).map((item, index) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={view === item.id && !selected ? "active" : ""}
              aria-current={view === item.id && !selected ? "page" : undefined}
            >
              <item.icon size={18} aria-hidden />
              <span>{item.label}</span>
              <small>0{index + 1}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>
            <LockKeyhole size={14} aria-hidden /> Solo para ti
          </p>
          <button className="subtle" onClick={() => navigate("backup")}>
            <ArrowDownToLine size={16} />
            Copias de seguridad
          </button>
          <button className="subtle" onClick={theme}>
            {light ? <Moon size={16} /> : <Sun size={16} />}{" "}
            {light ? "Modo oscuro" : "Modo claro"}
          </button>
          {!localPreview && (
            <button
              className="subtle"
              onClick={async () => {
                await fetch("/api/auth", { method: "DELETE" });
                window.location.reload();
              }}
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            DAVID APPLETON <span className="topbar-divider">/</span> TU MÚSICA,
            EN ORDEN
          </span>
          <span className="private-label">
            <span className="dot" />
            {localPreview ? "Vista local privada" : "Archivo privado"}
          </span>
        </header>
        <main
          id="main"
          tabIndex={-1}
          onChangeCapture={(event) => {
            if (
              message === "Cambios guardados." &&
              (event.target as HTMLElement).closest("form")
            )
              setMessage("");
          }}
        >
          {message && (
            <div className="notice" role="status">
              <span>{message}</span>
              <button aria-label="Cerrar aviso" onClick={() => setMessage("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {!selected && ["overview", "library", "pending"].includes(view) && (
            <div className="search-box global-search">
              <Search size={20} aria-hidden />
              <label className="sr-only" htmlFor="search">
                Buscar en mi música
              </label>
              <input
                id="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (view === "overview") setView("library");
                }}
                placeholder="Busca una canción, un código o un autor…"
              />
              {query && (
                <button
                  aria-label="Borrar búsqueda"
                  onClick={() => setQuery("")}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}
          {selected && !active ? (
            <section className="empty">
              <h1>Esta ficha no existe</h1>
              <button onClick={() => open(null)}>Volver a mi música</button>
            </section>
          ) : active ? (
            <>
              <button className="back" onClick={() => open(null)}>
                <ArrowLeft size={16} />
                Volver a mi música
              </button>
              <EntityDetail
                onCatalogChange={setCatalog}
                key={active.id}
                entity={active}
                catalog={catalog}
                save={save}
                busy={busy}
                open={open}
              />
            </>
          ) : (
            <>
              {view === "overview" ? (
                <>
                  <section className="hero">
                    <div>
                      <p className="eyebrow">UN ARCHIVO. TODA TU HISTORIA.</p>
                      <h1>
                        Tu música.
                        <br />
                        <em>Tu legado.</em>
                      </h1>
                      <p className="hero-copy">
                        Cada canción, cada versión y cada derecho.
                        <br />
                        Un lugar para cuidar lo que has creado.
                      </p>
                      <button
                        className="primary"
                        onClick={() => {
                          setView("library");
                          setCreating(true);
                        }}
                      >
                        Añadir una canción
                        <Plus size={17} />
                      </button>
                    </div>
                    <div className="record-art" aria-hidden="true">
                      <svg viewBox="0 0 400 400">
                        <defs>
                          <radialGradient id="record">
                            <stop offset="0" stopColor="#7d7063" />
                            <stop offset=".25" stopColor="#343d36" />
                            <stop offset="1" stopColor="#182421" />
                          </radialGradient>
                        </defs>
                        <circle cx="200" cy="200" r="193" fill="url(#record)" />
                        {Array.from({ length: 23 }, (_, i) => (
                          <circle
                            key={i}
                            cx="200"
                            cy="200"
                            r={78 + i * 5}
                            fill="none"
                            stroke="#b9b2a0"
                            strokeOpacity={i % 3 === 0 ? ".20" : ".08"}
                          />
                        ))}
                        <circle cx="200" cy="200" r="65" fill="#d5bba4" />
                        <text
                          x="200"
                          y="193"
                          textAnchor="middle"
                          fill="#24312b"
                          fontSize="22"
                          fontFamily="Georgia"
                        >
                          DA
                        </text>
                        <text
                          x="200"
                          y="218"
                          textAnchor="middle"
                          fill="#24312b"
                          fontSize="7"
                          letterSpacing="2"
                        >
                          PRIVATE ARCHIVE
                        </text>
                        <circle cx="200" cy="200" r="3" fill="#24312b" />
                      </svg>
                      <span>THE DAVID APPLETON COLLECTION</span>
                    </div>
                  </section>
                  <section className="stats" aria-label="Resumen del catálogo">
                    <div>
                      <span className="stat-number">
                        {String(songGroups.length).padStart(2, "0")}
                      </span>
                      <span>Canciones en tu catálogo</span>
                      <small>
                        {catalog.entities.length} fichas técnicas ·{" "}
                        {works.length} composiciones ·{" "}
                        {
                          catalog.entities.filter(
                            (entity) => entity.kind === "release",
                          ).length
                        }{" "}
                        lanzamientos ·{" "}
                        {
                          catalog.entities.filter(
                            (entity) => entity.kind === "video",
                          ).length
                        }{" "}
                        vídeos
                      </small>
                    </div>
                    <div>
                      <span className="stat-number">
                        {String(
                          catalog.entities.filter((e) => e.kind === "recording")
                            .length,
                        ).padStart(2, "0")}
                      </span>
                      <span>Grabaciones y versiones</span>
                      <small>Relacionadas con su composición</small>
                    </div>
                    <div>
                      <span className="stat-number">
                        {stats.declaredPercent ?? "—"}
                        <small>%</small>
                      </span>
                      <span>Registros declarados</span>
                      <ProgressMeter
                        value={stats.declaredPercent}
                        label="Avance general de registros declarados"
                      />
                      <small>
                        {stats.declared} de {stats.total} aplicables
                      </small>
                    </div>
                    <div>
                      <span className="stat-number accent">
                        {stats.verifiedPercent ?? "—"}
                        <small>%</small>
                      </span>
                      <span>Con evidencia revisada</span>
                      <ProgressMeter
                        value={stats.verifiedPercent}
                        label="Avance general con evidencia revisada"
                        tone="verified"
                      />
                      <small>
                        {stats.unknown} aplicabilidades sin comprobar
                      </small>
                    </div>
                  </section>
                  <section className="attention-strip">
                    <div>
                      <p className="eyebrow">EL SIGUIENTE PASO</p>
                      <h2>
                        {pendingWorks.length
                          ? `${pendingWorks.length} obras necesitan una mirada.`
                          : "Todo empieza por una canción."}
                      </h2>
                      <p>
                        {pendingWorks.length
                          ? "Revisa los registros pendientes y reúne sus justificantes."
                          : "Añade una composición para empezar a organizar tu archivo."}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        navigate(pendingWorks.length ? "pending" : "library")
                      }
                    >
                      Ver qué falta
                      <ArrowRight size={17} />
                    </button>
                  </section>
                </>
              ) : (
                <header className="page-heading">
                  <p className="eyebrow">TU ARCHIVO PERSONAL</p>
                  <h1>
                    {view === "library"
                      ? "Mi música."
                      : view === "pending"
                        ? "Un paso más."
                        : view === "files"
                          ? "Cada archivo, en su sitio."
                          : "Siempre tuyo."}
                  </h1>
                  <p>
                    {view === "library"
                      ? "La canción es el centro. Sus versiones viven junto a ella."
                      : view === "pending"
                        ? "Todo lo que falta por registrar, comprobar o documentar."
                        : view === "files"
                          ? "Letras, audio y documentos, junto a la música a la que pertenecen."
                          : "Guarda y recupera una copia completa de los datos de tu catálogo."}
                  </p>
                </header>
              )}
              {(view === "overview" ||
                view === "library" ||
                view === "pending") && (
                <section className="library-section">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">
                        {view === "pending"
                          ? "PRÓXIMAS ACCIONES"
                          : "LA COLECCIÓN"}
                      </p>
                      <h2>
                        {view === "pending"
                          ? "Qué falta"
                          : "Encuentra tu música"}
                      </h2>
                    </div>
                    <button
                      className="subtle"
                      onClick={() => setCreating(!creating)}
                    >
                      <Plus size={18} />
                      {creating ? "Cerrar" : "Nueva ficha"}
                    </button>
                  </div>
                  {creating && (
                    <form
                      className="inline-form"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        const entity: Entity = {
                          id: crypto.randomUUID(),
                          title: String(data.get("title")),
                          kind: String(data.get("kind")) as Entity["kind"],
                          code: "",
                          genre: String(data.get("genre") || ""),
                          year: "",
                          language: "",
                          lyrics: "",
                          notes: "",
                          url: "",
                          sourceUrls: [],
                          publication: "unchecked",
                        };
                        const next = {
                          ...catalog,
                          entities: [...catalog.entities, entity],
                        };
                        if (entity.kind === "work")
                          for (const agency of [
                            "PRO",
                            "MLC",
                            "Songtrust",
                            "Propiedad intelectual",
                          ])
                            next.registrations = [
                              ...next.registrations,
                              {
                                id: crypto.randomUUID(),
                                entityId: entity.id,
                                agency,
                                status: "unchecked",
                                applicable: "unknown",
                                evidenceUrl: "",
                                verifiedAt: "",
                                notes: "",
                                sourceValues: [],
                              },
                            ];
                        if (await save(next)) {
                          setCreating(false);
                          open(entity.id);
                        }
                      }}
                    >
                      <label>
                        Nombre de la ficha
                        <input
                          name="title"
                          required
                          maxLength={250}
                          placeholder="Título de tu canción"
                          autoFocus
                        />
                      </label>
                      <label>
                        Tipo
                        <select name="kind" defaultValue="work">
                          {Object.entries(kindLabels).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <GenreField
                        existing={catalog.entities.map((item) => item.genre)}
                      />
                      <button className="primary" disabled={busy}>
                        Crear ficha
                        <ArrowRight size={16} />
                      </button>
                    </form>
                  )}
                  <div className="filters">
                    <label>
                      Mostrar
                      <select
                        value={kind}
                        onChange={(e) => setKind(e.target.value as KindFilter)}
                      >
                        <option value="songs">
                          Canciones ({songGroups.length})
                        </option>
                        <option value="work">
                          Composiciones ({works.length})
                        </option>
                        <option value="recording">
                          Grabaciones (
                          {
                            catalog.entities.filter(
                              (entity) => entity.kind === "recording",
                            ).length
                          }
                          )
                        </option>
                        <option value="video">
                          Vídeos (
                          {
                            catalog.entities.filter(
                              (entity) => entity.kind === "video",
                            ).length
                          }
                          )
                        </option>
                        <option value="release">
                          Lanzamientos (
                          {
                            catalog.entities.filter(
                              (entity) => entity.kind === "release",
                            ).length
                          }
                          )
                        </option>
                      </select>
                    </label>
                    <label>
                      Estado
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value="all">Todos los estados</option>
                        <option value="attention">Necesita revisión</option>
                        <option value="pending">Pendiente</option>
                        <option value="in_progress">En trámite</option>
                        <option value="unchecked">Sin comprobar</option>
                        <option value="registered">Registrado</option>
                        <option value="not_applicable">No aplica</option>
                      </select>
                    </label>
                    <label>
                      Entidad
                      <select
                        value={agency}
                        onChange={(e) => setAgency(e.target.value)}
                      >
                        <option value="all">Todas las entidades</option>
                        {agencies.map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="catalog-list">
                    {visibleMatches.map((item, index) => {
                      const group = "primary" in item ? item : undefined,
                        entity = group?.primary ?? (item as Entity),
                        registrations = group
                          ? registrationsForSongGroup(catalog, group)
                          : registrationsFor(catalog, entity.id),
                        count = registrations.filter(needsAttention).length,
                        related = relatedIds(catalog, entity.id),
                        recordings = group
                          ? group.entities.filter(
                              (candidate) => candidate.kind === "recording",
                            )
                          : catalog.entities.filter(
                              (candidate) =>
                                candidate.kind === "recording" &&
                                related.has(candidate.id),
                            );
                      const compositions = group
                        ? group.entities.filter(
                            (candidate) => candidate.kind === "work",
                          ).length
                        : 0;
                      return (
                        <button
                          className="song-row"
                          key={entity.id}
                          onClick={() => open(entity.id)}
                        >
                          <span className="track-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="song-title">
                            <strong>{group?.title ?? entity.title}</strong>
                            <small>
                              {group
                                ? [
                                    compositions
                                      ? `${compositions} ${compositions === 1 ? "composición" : "composiciones"}`
                                      : "",
                                    recordings.length
                                      ? `${recordings.length} ${recordings.length === 1 ? "grabación" : "grabaciones"}`
                                      : "",
                                    group.isrcs.length
                                      ? `${group.isrcs.length} ${group.isrcs.length === 1 ? "ISRC" : "ISRC"}`
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") || "Canción"
                                : kindLabels[entity.kind]}
                              {genreSummary(catalog, entity.id)
                                ? ` · ${genreSummary(catalog, entity.id)}`
                                : ""}
                              {!group && entity.kind === "work"
                                ? ` · ${recordings.length} ${recordings.length === 1 ? "grabación" : "grabaciones"}`
                                : ""}
                            </small>
                          </span>
                          <span
                            className={`status-tag ${count ? "pending" : "neutral"}`}
                          >
                            {count
                              ? `${count} por revisar`
                              : registrations.length
                                ? "Al día"
                                : "Sin comprobar"}
                          </span>
                          <ArrowRight
                            size={18}
                            className="row-arrow"
                            aria-hidden
                          />
                        </button>
                      );
                    })}
                    {!actionableMatches.length && (
                      <div className="empty">
                        <h3>No hay coincidencias.</h3>
                        <p>Prueba otro título o quita los filtros.</p>
                        <button
                          onClick={() => {
                            setQuery("");
                            setAgency("all");
                            setStatusFilter("all");
                          }}
                        >
                          Limpiar filtros
                        </button>
                      </div>
                    )}
                  </div>
                  {view === "overview" && actionableMatches.length > 8 && (
                    <div className="catalog-preview-footer">
                      <span>8 de {actionableMatches.length} canciones</span>
                      <button onClick={() => navigate("library")}>
                        Ver toda mi música
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </section>
              )}
              {(view === "overview" || view === "pending") && (
                <section className="agency-section">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">DERECHOS Y REGISTROS</p>
                      <h2>Tu avance, entidad por entidad.</h2>
                    </div>
                  </div>
                  <p className="muted">
                    Declarado es lo anotado en tu catálogo. Verificado requiere
                    revisar un justificante. Los códigos no demuestran que el
                    registro esté completado.
                  </p>
                  <div className="agency-grid">
                    {agencies.map((a) => {
                      const p = progress(
                        catalog.registrations.filter(
                          (r) => registrationLabel(r) === a,
                        ),
                      );
                      return (
                        <button
                          key={a}
                          className="agency-card"
                          onClick={() => {
                            setView("pending");
                            setAgency(a);
                            setStatusFilter("all");
                            setKind(
                              [
                                "SoundExchange",
                                "Luminate",
                                "Mediabase",
                              ].includes(a)
                                ? "recording"
                                : "work",
                            );
                            window.scrollTo({ top: 0 });
                          }}
                        >
                          <span>{a}</span>
                          <strong>
                            {p.declaredPercent === null
                              ? "—"
                              : p.declaredPercent + "%"}
                          </strong>
                          <ProgressMeter
                            value={p.declaredPercent}
                            label={`${a}: registros declarados`}
                          />
                          <div className="meter-caption">
                            <span>Evidencia revisada</span>
                            <span>
                              {p.verifiedPercent === null
                                ? "—"
                                : `${p.verifiedPercent}%`}
                            </span>
                          </div>
                          <ProgressMeter
                            value={p.verifiedPercent}
                            label={`${a}: evidencia revisada`}
                            tone="verified"
                          />
                          <small>
                            {p.declared}/{p.total} declarados · {p.verified}{" "}
                            verificados
                          </small>
                          {p.unknown > 0 && (
                            <small>{p.unknown} sin confirmar si aplica</small>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
              {view === "files" && (
                <>
                  <div className="search-box">
                    <Search size={20} />
                    <label className="sr-only" htmlFor="files-search">
                      Buscar archivos
                    </label>
                    <input
                      id="files-search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Busca un archivo o una canción…"
                    />
                  </div>
                  {filteredDocuments.length ? (
                    <div className="file-grid">
                      {filteredDocuments.map((d) => (
                        <DocumentCard
                          key={d.id}
                          document={d}
                          context={
                            catalog.entities.find((e) => e.id === d.entityId)
                              ?.title
                          }
                          open={() => open(d.entityId)}
                        />
                      ))}
                    </div>
                  ) : (
                    <section className="empty">
                      <FileText size={28} />
                      <h2>
                        {query
                          ? "No hay archivos con ese nombre."
                          : "Tus archivos empiezan aquí."}
                      </h2>
                      <p>
                        Abre una canción y añade sus documentos, audios, vídeos
                        o notas.
                      </p>
                      <button
                        className="primary"
                        onClick={() => navigate("library")}
                      >
                        Elegir una canción
                        <ArrowRight size={16} />
                      </button>
                    </section>
                  )}
                </>
              )}
              {view === "backup" && (
                <section className="backup-grid">
                  <FullBackupPanel onCatalogChange={setCatalog} />
                  <article className="panel">
                    <ArrowDownToLine size={24} />
                    <h2>Descargar mi catálogo</h2>
                    <p>
                      Una copia JSON con todas las fichas, relaciones, letras,
                      autores y estados. Los enlaces a archivos están incluidos;
                      el contenido de esos archivos se guarda por separado.
                    </p>
                    <button
                      className="primary"
                      onClick={() => {
                        const url = URL.createObjectURL(
                          new Blob([JSON.stringify(catalog, null, 2)], {
                            type: "application/json",
                          }),
                        );
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `david-appleton-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Descargar copia
                      <ArrowDownToLine size={16} />
                    </button>
                  </article>
                  <article className="panel">
                    <h2>Recuperar una copia</h2>
                    <p>
                      Restaura un archivo exportado por esta aplicación.
                      Sustituye los datos actuales. Descarga antes una copia de
                      lo que tienes.
                    </p>
                    <label>
                      Seleccionar copia JSON
                      <input
                        type="file"
                        accept="application/json,.json"
                        disabled={busy}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          try {
                            if (file.size > 10_000_000)
                              throw new Error("La copia supera los 10 MB.");
                            const next = catalogSchema.parse(
                              JSON.parse(await file.text()),
                            );
                            if (
                              window.confirm(
                                `Se sustituirá tu catálogo por ${next.entities.filter((e) => e.kind === "work").length} obras y sus relaciones. ¿Restaurar esta copia?`,
                              )
                            )
                              await save({
                                ...next,
                                revision: catalog.revision,
                              });
                          } catch {
                            setMessage(
                              "No se ha restaurado: el archivo no es una copia válida del catálogo.",
                            );
                          }
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </article>
                </section>
              )}
              <details className="source-note">
                <summary>Sobre los datos de este archivo</summary>
                <p>{catalog.sourceSummary}</p>
                <p>
                  Importado:{" "}
                  {catalog.importedAt
                    ? new Date(catalog.importedAt).toLocaleDateString("es-ES")
                    : "Sin importación"}
                  . Las fuentes de Notion permanecen sin modificar. La identidad
                  visual es una propuesta provisional.
                </p>
              </details>
            </>
          )}
        </main>
        <footer>
          <span>DAVID APPLETON</span>
          <span>Hecho para cuidar tu música.</span>
        </footer>
      </div>
    </div>
  );
}
