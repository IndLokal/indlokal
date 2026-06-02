'use client';

import { useEffect, useRef, useState } from 'react';

type ConfirmSubmitButtonProps = {
  triggerLabel: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  triggerClassName?: string;
  tone?: 'danger' | 'primary' | 'neutral';
  disabled?: boolean;
};

const CONFIRM_TONE_CLASS: Record<NonNullable<ConfirmSubmitButtonProps['tone']>, string> = {
  danger: 'border border-red-700 bg-red-600 text-white hover:bg-red-700',
  primary: 'border border-blue-700 bg-blue-600 text-white hover:bg-blue-700',
  neutral: 'border border-slate-900 bg-slate-800 text-white hover:bg-slate-900',
};

export function ConfirmSubmitButton({
  triggerLabel,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  triggerClassName,
  tone = 'danger',
  disabled = false,
}: ConfirmSubmitButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', onEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  const onConfirm = () => {
    const form = triggerRef.current?.closest('form');
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={triggerClassName ?? 'btn-secondary px-3 py-1.5 text-sm'}
      >
        {triggerLabel}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[130] overflow-y-auto">
          <div className="relative flex min-h-full items-end justify-center p-3 sm:items-center sm:p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/45"
              aria-label="Close confirmation dialog"
              onClick={() => setIsOpen(false)}
            />

            <div
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-card)] border border-slate-200 bg-white shadow-xl"
            >
              <div className="max-h-[70dvh] overflow-y-auto p-5">
                <h3 className="text-foreground text-base font-semibold">{title}</h3>
                {description ? <p className="text-muted mt-2 text-sm">{description}</p> : null}
              </div>

              <div className="border-border bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="btn-secondary w-full px-3 py-2 text-sm sm:w-auto"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className={`w-full rounded-[var(--radius-button)] px-3 py-2 text-sm font-semibold shadow-sm sm:w-auto ${CONFIRM_TONE_CLASS[tone]}`}
                  >
                    {confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
