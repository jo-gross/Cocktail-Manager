import React from 'react';
import { Card, CardBody } from '@components/ui';
import { CocktailCardFull } from '../../models/CocktailCardFull';

const MAX_VISIBLE_GROUPS = 4;
const MAX_VISIBLE_ITEMS = 8;

interface CardSnapshotProps {
  groups: CocktailCardFull['groups'];
}

function sortGroups(groups: CocktailCardFull['groups']) {
  return [...groups].sort((a, b) => a.groupNumber - b.groupNumber);
}

function ItemPlaceholders({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-xs text-base-content/50">Keine Cocktails</span>;
  }

  const visibleCount = Math.min(count, MAX_VISIBLE_ITEMS);
  const remaining = count - visibleCount;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {Array.from({ length: visibleCount }).map((_, index) => (
        <span key={`item-placeholder-${index}`} className="h-2 w-6 rounded bg-base-300/80" aria-hidden />
      ))}
      {remaining > 0 ? <span className="text-[0.65rem] text-base-content/60">+{remaining}</span> : null}
    </div>
  );
}

export default function CardSnapshot({ groups }: CardSnapshotProps) {
  if (!groups || groups.length === 0) {
    return <div className="rounded-xl bg-base-300/30 px-3 py-4 text-center text-sm text-base-content/60">Keine Gruppen</div>;
  }

  const sortedGroups = sortGroups(groups);
  const visibleGroups = sortedGroups.slice(0, MAX_VISIBLE_GROUPS);
  const hiddenGroupCount = sortedGroups.length - visibleGroups.length;

  return (
    <Card variant="inset" className="rounded-xl">
      <CardBody compact className="gap-2.5 p-3">
        {visibleGroups.map((group) => (
          <div key={group.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-semibold text-base-content">{group.name || 'Gruppe'}</span>
              {group.groupPrice != null ? <span className="shrink-0 text-[0.65rem] text-base-content/60">{group.groupPrice}€</span> : null}
            </div>
            <ItemPlaceholders count={group.items.length} />
          </div>
        ))}
        {hiddenGroupCount > 0 ? <div className="text-center text-xs text-base-content/60">+{hiddenGroupCount} Gruppen</div> : null}
      </CardBody>
    </Card>
  );
}
