import type { ReactNode } from 'react';

type AdminTableWrapProps = {
  children: ReactNode;
  className?: string;
};

export function AdminTableWrap({ children, className }: AdminTableWrapProps) {
  return (
    <div
      className={
        className
          ? `border-border overflow-x-auto rounded-[var(--radius-card)] border ${className}`
          : 'border-border overflow-x-auto rounded-[var(--radius-card)] border'
      }
    >
      {children}
    </div>
  );
}

type AdminTableProps = {
  children: ReactNode;
};

export function AdminTable({ children }: AdminTableProps) {
  return <table className="w-full text-sm">{children}</table>;
}

type AdminTableHeadProps = {
  children: ReactNode;
};

export function AdminTableHead({ children }: AdminTableHeadProps) {
  return <thead className="border-border bg-muted-bg border-b text-left">{children}</thead>;
}

type AdminThProps = {
  children: ReactNode;
  className?: string;
};

export function AdminTh({ children, className }: AdminThProps) {
  return (
    <th
      className={
        className
          ? `text-muted px-4 py-2 text-left text-xs font-medium uppercase tracking-wide ${className}`
          : 'text-muted px-4 py-2 text-left text-xs font-medium uppercase tracking-wide'
      }
    >
      {children}
    </th>
  );
}
