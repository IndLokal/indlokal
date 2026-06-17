type FieldErrorProps = {
  errors?: string[];
  className?: string;
};

export function FormFieldError({ errors, className }: FieldErrorProps) {
  if (!errors || errors.length === 0) return null;
  return <p className={className ?? 'mt-1 text-sm text-red-600'}>{errors[0]}</p>;
}

type GlobalErrorProps = {
  errors?: string[];
  className?: string;
};

export function FormGlobalError({ errors, className }: GlobalErrorProps) {
  if (!errors || errors.length === 0) return null;
  return (
    <div
      className={
        className ??
        'rounded-[var(--radius-button)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700'
      }
    >
      {errors[0]}
    </div>
  );
}
