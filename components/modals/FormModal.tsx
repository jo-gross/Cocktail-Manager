import React, { useState } from 'react';
import { HeaderActionsSlotContext } from '@components/layout/HeaderActionsSlot';

interface FormModalProps<_T> {
  form: React.JSX.Element;
  title: string;
}

/** Hosts an entity form in the global modal; the form's save button appears next to the title. */
export default function FormModal<T>(props: FormModalProps<T>) {
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);
  return (
    <HeaderActionsSlotContext.Provider value={{ slot: actionsSlot }}>
      <div className="flex w-[min(64rem,calc(100vw-3rem))] flex-col gap-4">
        <div className="flex items-center gap-3 pr-10">
          <h2 className="min-w-0 flex-1 text-2xl font-bold">{props.title}</h2>
          <div ref={setActionsSlot} className="flex items-center gap-2 empty:hidden" />
        </div>
        {props.form}
      </div>
    </HeaderActionsSlotContext.Provider>
  );
}
