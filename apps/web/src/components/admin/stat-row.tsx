export function AdminStatRow({
  label,
  primaryValue,
  secondaryValue,
}: {
  label: string;
  primaryValue: number;
  secondaryValue: number;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm">{label}</span>
      <div className="flex gap-8 text-sm">
        <span className="w-14 text-right font-semibold">{primaryValue}</span>
        <span className="text-muted w-14 text-right">{secondaryValue}</span>
      </div>
    </div>
  );
}
