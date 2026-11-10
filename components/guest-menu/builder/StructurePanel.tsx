/** "Struktur" tab: block tree with drag reorder, add/duplicate/delete and per-output visibility. */
import { useTranslation } from 'react-i18next';
import { FaCopy, FaExclamationTriangle, FaPlus, FaTrash } from 'react-icons/fa';
import { Button, cn, Dropdown, DropdownContent, Menu, MenuItem } from '@components/ui';
import { ADDABLE_BLOCK_TYPES, createBlock, duplicateBlock, isBlockIncomplete, isOutputVisible } from '@lib/guest-menu/builder';
import type { BlockType } from '@lib/guest-menu/schema';
import { useBuilder } from './BuilderContext';
import { BLOCK_ICONS, getBlockLabel } from './blockLabels';
import { OutputVisibilityToggles, PanelSection } from './controls';
import { DragHandle, SortableList } from './SortableList';

export function StructurePanel() {
  const { t } = useTranslation('guestMenu');
  const { document, update, selection, select, locale, primaryLocale, data, output, canEdit } = useBuilder();

  const addBlock = (type: BlockType) => {
    const block = createBlock(type, locale);
    const selectedIndex = selection ? document.blocks.findIndex((entry) => entry.id === selection.blockId) : -1;
    update((doc) => {
      const blocks = [...doc.blocks];
      blocks.splice(selectedIndex >= 0 ? selectedIndex + 1 : blocks.length, 0, block);
      return { ...doc, blocks };
    });
    select({ blockId: block.id });
  };

  return (
    <PanelSection
      title={t('builder.structure.title')}
      actions={
        canEdit ? (
          <Dropdown align="end">
            <Button type="button" size="xs" variant="primary">
              <FaPlus /> {t('builder.structure.add')}
            </Button>
            <DropdownContent className="w-56">
              <Menu size="sm">
                {ADDABLE_BLOCK_TYPES.map((type) => (
                  <MenuItem key={type}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-base-200"
                      onClick={(event) => {
                        event.currentTarget.blur();
                        addBlock(type);
                      }}
                    >
                      {BLOCK_ICONS[type]}
                      <span className="flex flex-col items-start">
                        <span>{t(`builder.blocks.${type}`)}</span>
                        <span className="text-xs text-base-content/60">{t(`builder.blocks.${type}Hint`)}</span>
                      </span>
                    </button>
                  </MenuItem>
                ))}
              </Menu>
            </DropdownContent>
          </Dropdown>
        ) : undefined
      }
    >
      {document.blocks.length === 0 && <p className="py-4 text-center text-sm text-base-content/60">{t('builder.structure.empty')}</p>}
      <SortableList
        items={document.blocks}
        getId={(block) => block.id}
        disabled={!canEdit}
        onReorder={(blocks) => update((doc) => ({ ...doc, blocks }))}
        renderItem={(block, handle) => {
          const selected = selection?.blockId === block.id;
          const hiddenHere = !isOutputVisible(block, output);
          return (
            <div
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              onClick={() => select({ blockId: block.id })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  select({ blockId: block.id });
                }
              }}
              className={cn(
                'group flex items-center gap-1 rounded-lg border px-1 py-1 text-sm transition-colors',
                selected ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-100 hover:bg-base-200',
                hiddenHere && 'opacity-60',
              )}
            >
              <DragHandle {...handle} label={t('builder.structure.drag')} />
              <span className="text-base-content/60">{BLOCK_ICONS[block.type]}</span>
              <span className="min-w-0 flex-1 truncate">{getBlockLabel(block, t, locale, primaryLocale, data.cards)}</span>
              {isBlockIncomplete(block) && (
                <span className="text-warning" title={t('builder.structure.incomplete')}>
                  <FaExclamationTriangle />
                </span>
              )}
              <OutputVisibilityToggles block={block} compact />
              {canEdit && (
                <span className="flex opacity-60 group-hover:opacity-100">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded hover:bg-base-300"
                    title={t('duplicate')}
                    aria-label={t('duplicate')}
                    onClick={(event) => {
                      event.stopPropagation();
                      const copy = duplicateBlock(block);
                      update((doc) => {
                        const blocks = [...doc.blocks];
                        blocks.splice(blocks.findIndex((entry) => entry.id === block.id) + 1, 0, copy);
                        return { ...doc, blocks };
                      });
                      select({ blockId: copy.id });
                    }}
                  >
                    <FaCopy />
                  </button>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded text-error hover:bg-error/10"
                    title={t('delete')}
                    aria-label={t('delete')}
                    onClick={(event) => {
                      event.stopPropagation();
                      update((doc) => ({ ...doc, blocks: doc.blocks.filter((entry) => entry.id !== block.id) }));
                      if (selected) select(null);
                    }}
                  >
                    <FaTrash />
                  </button>
                </span>
              )}
            </div>
          );
        }}
      />
    </PanelSection>
  );
}
