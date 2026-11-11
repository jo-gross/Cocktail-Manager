import React, { useId, useState } from 'react';
import { Card, cn, Tab, Tabs } from '@components/ui';

export interface TabbedCardTab {
  id: string;
  label: React.ReactNode;
  content: React.ReactNode;
}

interface TabbedCardProps {
  tabs: TabbedCardTab[];
  /** Anchor for the section navigation. */
  id?: string;
  className?: string;
}

/**
 * Card with tabs – bundles secondary views (preview, summaries) in a form's side column so the whole
 * column fits the viewport and can stay sticky. Inactive panels stay mounted (no refetch on switch);
 * the panel scrolls when the card is height-limited.
 */
export function TabbedCard({ tabs, id, className }: TabbedCardProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const baseId = useId();

  return (
    <Card id={id} className={cn('flex min-h-0 flex-col', className)}>
      <div className="shrink-0 px-2 pt-1">
        <Tabs variant="bordered" fullWidth>
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              id={`${baseId}-tab-${tab.id}`}
              aria-controls={`${baseId}-panel-${tab.id}`}
              active={tab.id === activeId}
              onClick={() => setActiveId(tab.id)}
              className="min-h-11"
            >
              {tab.label}
            </Tab>
          ))}
        </Tabs>
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== activeId}
          className="min-h-0 overflow-y-auto p-4 md:p-5"
        >
          {tab.content}
        </div>
      ))}
    </Card>
  );
}
