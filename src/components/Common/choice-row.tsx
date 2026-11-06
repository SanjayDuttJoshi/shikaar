interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

interface ChoiceRowProps<T extends string> {
  label: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
}

export const ChoiceRow = <T extends string>({ label, value, options, onChange }: ChoiceRowProps<T>) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-xs font-semibold tracking-[0.2em] text-ash uppercase">{label}</span>
    <div className="grid grid-flow-col auto-cols-fr gap-1 rounded-md border border-white/10 bg-black/40 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded px-2 py-2 text-sm font-semibold tracking-wide transition-colors ${
            o.value === value ? "bg-blood/80 text-white shadow-[0_0_14px_rgba(179,20,15,0.5)]" : "text-ash hover:bg-white/5 hover:text-bone"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);
