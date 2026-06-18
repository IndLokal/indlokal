import type { ReactNode } from 'react';

type LoginShellProps = {
  title: string;
  description: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
};

export function LoginShell({
  title,
  description,
  children,
  aside,
  footer,
  maxWidthClassName = 'max-w-md',
}: LoginShellProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className={`w-full ${maxWidthClassName}`}>
        <div className="card-base px-8 py-10 text-center">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted mt-2 text-sm">{description}</p>

          {aside ? <div className="mt-6 text-left">{aside}</div> : null}

          {children}
        </div>

        {footer ? <div className="mt-6 text-center text-sm">{footer}</div> : null}
      </div>
    </div>
  );
}
