/**
 * Une case du pied de calendrier : un libellé, un chiffre, et au besoin sa
 * seconde lecture. Partagée par la vue mensuelle et la vue annuelle — les deux
 * pieds de page se lisent comme un seul objet, ils ne doivent pas diverger.
 */
export function Total({
  label,
  value,
  sub,
  hint,
  testId,
}: {
  label: string;
  value: string;
  /** Seconde lecture du même chiffre — le net sous le brut. */
  sub?: React.ReactNode;
  hint?: string;
  testId?: string;
}) {
  return (
    <div className="px-4 py-3">
      <p className="metric-label">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold" data-testid={testId}>
        {value}
      </p>
      {sub ? <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p> : null}
      {hint ? <p className="text-subtle-foreground mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}
