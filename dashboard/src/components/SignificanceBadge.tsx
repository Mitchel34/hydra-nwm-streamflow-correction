interface SignificanceBadgeProps {
  pValue: number | null | undefined;
  className?: string;
}

export default function SignificanceBadge({ pValue, className = '' }: SignificanceBadgeProps) {
  if (pValue == null || isNaN(pValue)) {
    return <span className={`text-[#6f8da0] text-xs ${className}`}>n/a</span>;
  }

  let label: string;
  let color: string;

  if (pValue < 0.001) {
    label = '***';
    color = 'text-hydra-corrected';
  } else if (pValue < 0.01) {
    label = '**';
    color = 'text-hydra-corrected';
  } else if (pValue < 0.05) {
    label = '*';
    color = 'text-hydra-corrected/80';
  } else {
    label = 'n.s.';
    color = 'text-[#6f8da0]';
  }

  return (
    <span
      className={`text-xs font-mono ${color} ${className}`}
      title={`DM p = ${pValue < 0.001 ? pValue.toExponential(2) : pValue.toFixed(4)}`}
    >
      {label}
    </span>
  );
}
