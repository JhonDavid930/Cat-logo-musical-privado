type Props = {
  value: number | null;
  label: string;
  tone?: "declared" | "verified";
};

export default function ProgressMeter({
  value,
  label,
  tone = "declared",
}: Props) {
  const known = value !== null;
  const bounded = known ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <div
      className={`archive-meter ${tone} ${known ? "" : "unknown"}`}
      role={known ? "progressbar" : "img"}
      aria-label={
        known ? label : `${label}: sin registros aplicables confirmados`
      }
      aria-valuemin={known ? 0 : undefined}
      aria-valuemax={known ? 100 : undefined}
      aria-valuenow={known ? bounded : undefined}
      aria-valuetext={known ? `${bounded} por ciento` : undefined}
    >
      <div className="meter-rule" aria-hidden="true">
        <span
          className="meter-fill"
          style={{ transform: `scaleX(${bounded / 100})` }}
        />
        {[0, 25, 50, 75, 100].map((mark) => (
          <i key={mark} className="meter-tick" style={{ left: `${mark}%` }} />
        ))}
        {known && bounded > 0 && (
          <span className="meter-end" style={{ left: `${bounded}%` }} />
        )}
      </div>
    </div>
  );
}
