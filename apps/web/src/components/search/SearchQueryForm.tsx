type SearchQueryFormProps = {
  action: string;
  defaultValue: string;
  placeholder: string;
};

export function SearchQueryForm({ action, defaultValue, placeholder }: SearchQueryFormProps) {
  return (
    <form method="GET" action={action} className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoFocus
        className="border-border text-foreground focus:border-brand-500 focus:ring-brand-100 flex-1 rounded-[var(--radius-card)] border px-4 py-3 text-base transition-colors outline-none focus:ring-2"
      />
      <button type="submit" className="btn-primary rounded-[var(--radius-card)] px-6 py-3 text-sm">
        Search
      </button>
    </form>
  );
}
