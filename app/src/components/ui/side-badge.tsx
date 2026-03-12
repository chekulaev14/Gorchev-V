interface Props {
  side?: string;
  className?: string;
}

const sideConfig: Record<string, { label: string; className: string }> = {
  LEFT: { label: "Л", className: "bg-blue-100 text-blue-700 border-blue-200" },
  RIGHT: { label: "П", className: "bg-orange-100 text-orange-700 border-orange-200" },
};

export function SideBadge({ side, className = "" }: Props) {
  if (!side || side === "NONE") return null;
  const config = sideConfig[side];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center justify-center text-[9px] font-semibold leading-none px-1 py-0.5 rounded border shrink-0 ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}
