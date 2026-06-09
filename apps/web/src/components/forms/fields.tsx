import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FormField({
  label,
  htmlFor,
  hint,
  required,
  className = '',
  children,
}: FormFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="text-muted mb-1 block text-xs font-medium">
        {label}
        {required ? ' *' : ''}
      </label>
      {hint && <p className="text-muted mb-2 text-xs">{hint}</p>}
      {children}
    </div>
  );
}

type TextInputProps = ComponentPropsWithoutRef<'input'>;

export function TextInput({ className = '', ...props }: TextInputProps) {
  return <input {...props} className={`input-base ${className}`.trim()} />;
}

type TextAreaProps = ComponentPropsWithoutRef<'textarea'>;

export function TextArea({ className = '', ...props }: TextAreaProps) {
  return <textarea {...props} className={`input-base ${className}`.trim()} />;
}

type SelectInputProps = ComponentPropsWithoutRef<'select'>;

export function SelectInput({ className = '', ...props }: SelectInputProps) {
  return <select {...props} className={`input-base ${className}`.trim()} />;
}
