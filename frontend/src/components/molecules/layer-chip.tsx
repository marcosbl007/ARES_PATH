type LayerChipProps = {
  label: string;
  color: string;
  active: boolean;
  onToggle: () => void;
};

export function LayerChip({ label, color, active, onToggle }: LayerChipProps) {
  return (
    <button
      className={`layer-chip${active ? " layer-chip--active" : ""}`}
      type="button"
      onClick={onToggle}
      aria-pressed={active}
    >
      <span className="layer-chip__swatch" style={{ backgroundColor: color }} />
      {label}
    </button>
  );
}
