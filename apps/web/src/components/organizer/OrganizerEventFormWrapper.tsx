'use client';

import { useActionState, type ComponentProps } from 'react';
import { EventFormFields } from './event-form-fields';

type BaseEventFormActionState =
  | { success: true }
  | { success: false; errors: Record<string, string[]> }
  | null;

type EventFormFieldsProps = ComponentProps<typeof EventFormFields>;

type Props = Omit<EventFormFieldsProps, 'action' | 'isPending' | 'errors'> & {
  action: (_prev: never, formData: FormData) => Promise<BaseEventFormActionState>;
};

export function OrganizerEventFormWrapper({ action, ...formProps }: Props) {
  const [state, formAction, isPending] = useActionState<BaseEventFormActionState, FormData>(
    action as (
      prev: BaseEventFormActionState,
      formData: FormData,
    ) => Promise<BaseEventFormActionState>,
    null,
  );

  const errors = state?.success === false ? state.errors : {};

  return (
    <EventFormFields action={formAction} isPending={isPending} errors={errors} {...formProps} />
  );
}
