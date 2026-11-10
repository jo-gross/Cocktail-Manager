import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { FaHeading, FaImage, FaInfoCircle, FaListUl, FaMinus, FaParagraph } from 'react-icons/fa';
import type { Block, BlockType } from '@lib/guest-menu/schema';
import { resolveLocalizedText } from '@lib/guest-menu/localizedText';
import type { CardDto } from '@lib/schemas/cards';

export const BLOCK_ICONS: Record<BlockType, ReactNode> = {
  header: <FaHeading />,
  section: <FaListUl />,
  text: <FaParagraph />,
  image: <FaImage />,
  divider: <FaMinus />,
  notice: <FaInfoCircle />,
};

function truncate(value: string, length = 48): string {
  const plain = value
    .replace(/[#*_>`[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > length ? `${plain.slice(0, length - 1)}…` : plain;
}

/** Short human label for the structure tree / inspector header. */
export function getBlockLabel(block: Block, t: TFunction<'guestMenu'>, locale: string, primaryLocale: string, cards: CardDto[]): string {
  const text = (value: Record<string, string> | null | undefined) => resolveLocalizedText(value, locale, primaryLocale);
  switch (block.type) {
    case 'header':
      return t('builder.blocks.header');
    case 'section': {
      const title = text(block.title);
      if (title) return truncate(title);
      if (block.source.kind === 'cardAllGroups') return t('builder.source.cardAllGroups');
      if (block.source.kind === 'cardGroup') {
        const groupId = block.source.groupId;
        const group = cards.flatMap((card) => card.groups).find((entry) => entry.id === groupId);
        return group?.name ?? t('builder.source.cardGroup');
      }
      return t('builder.blocks.section');
    }
    case 'text':
      return truncate(text(block.content)) || t('builder.blocks.text');
    case 'image':
      return truncate(text(block.alt ?? null)) || t('builder.blocks.image');
    case 'divider':
      return t('builder.blocks.divider');
    case 'notice':
      return block.preset === 'custom' ? truncate(text(block.text ?? null)) || t('builder.notice.custom') : t(`builder.notice.${block.preset}`);
  }
}
