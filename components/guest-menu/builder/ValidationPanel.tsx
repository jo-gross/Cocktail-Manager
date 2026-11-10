/** Hints/warnings for the current draft (based on the document + the current preview). */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import { cn } from '@components/ui';
import { checkThemeContrast, getTranslationProgress, isBlockIncomplete, isOutputVisible } from '@lib/guest-menu/builder';
import type { PublicMenuItemDto } from '@lib/guest-menu/schema';
import type { GuestMenuPublishIssue } from '@lib/network/guestMenus';
import { useBuilder } from './BuilderContext';
import { getBlockLabel } from './blockLabels';
import { useLanguageName } from './controls';

export interface BuilderWarning {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  blockId?: string;
  itemId?: string;
}

function names(items: { name: string }[], max = 4): string {
  const list = items.slice(0, max).map((item) => item.name);
  return items.length > max ? `${list.join(', ')} …` : list.join(', ');
}

export function useBuilderWarnings(publishIssues: GuestMenuPublishIssue[]): BuilderWarning[] {
  const { t } = useTranslation('guestMenu');
  const { document, preview, data, locales, primaryLocale, menu, output, locale } = useBuilder();
  const languageName = useLanguageName();

  return useMemo(() => {
    const warnings: BuilderWarning[] = [];

    for (const issue of publishIssues) {
      warnings.push({
        id: `publish-${issue.output}-${issue.slot}-${issue.line}-${issue.message}`,
        severity: 'error',
        message: t('errors.templateErrorLine', { output: t(`outputs.${issue.output}`), slot: issue.slot, line: issue.line ?? '–', message: issue.message }),
      });
    }

    for (const block of document.blocks) {
      if (isBlockIncomplete(block)) {
        warnings.push({
          id: `incomplete-${block.id}`,
          severity: 'error',
          blockId: block.id,
          message: t('builder.validation.incomplete', { block: getBlockLabel(block, t, locale, primaryLocale, data.cards) }),
        });
      }
    }

    if (menu.sourceMode === 'FIXED_CARD' && !menu.sourceCardId)
      warnings.push({ id: 'no-card', severity: 'warning', message: t('builder.validation.noSourceCard') });

    const failedContrast = checkThemeContrast(document.theme.tokens.colors).filter((check) => !check.ok);
    for (const check of failedContrast) {
      warnings.push({
        id: `contrast-${check.id}`,
        severity: 'warning',
        message: t('builder.validation.contrast', {
          pair: t(`builder.design.contrast.${check.id}`),
          ratio: check.ratio?.toFixed(1) ?? '–',
          minimum: check.minimum,
        }),
      });
    }

    for (const target of locales) {
      if (target === primaryLocale) continue;
      const progress = getTranslationProgress(document, target);
      if (progress.missing.length > 0) {
        warnings.push({
          id: `translation-${target}`,
          severity: 'info',
          blockId: progress.missing.find((entry) => entry.blockId)?.blockId ?? undefined,
          message: t('builder.validation.missingTranslations', { count: progress.missing.length, language: languageName(target) }),
        });
      }
    }

    if (preview && preview.dto.output === output) {
      const sections = preview.dto.blocks.filter((block) => block.type === 'section');
      const items: (PublicMenuItemDto & { blockId: string })[] = sections.flatMap((section) =>
        section.type === 'section' ? section.items.map((item) => ({ ...item, blockId: section.sourceBlockId })) : [],
      );

      for (const block of document.blocks) {
        if (block.type !== 'section' || !isOutputVisible(block, output) || isBlockIncomplete(block)) continue;
        if (!sections.some((section) => section.type === 'section' && section.sourceBlockId === block.id)) {
          warnings.push({
            id: `empty-${block.id}`,
            severity: 'warning',
            blockId: block.id,
            message: t('builder.validation.emptySection', { block: getBlockLabel(block, t, locale, primaryLocale, data.cards) }),
          });
        }
      }

      if (data.cards.length > 0) {
        const onCards = new Set(data.cards.flatMap((card) => card.groups.flatMap((group) => group.items.map((item) => item.cocktail.id))));
        const notOnCard = items.filter((item) => !onCards.has(item.id));
        if (notOnCard.length > 0) {
          warnings.push({
            id: 'not-on-card',
            severity: 'warning',
            blockId: notOnCard[0].blockId,
            itemId: notOnCard[0].id,
            message: t('builder.validation.notOnCard', { count: notOnCard.length, names: names(notOnCard) }),
          });
        }
      }

      const missingImages = items.filter((item) => item.imageUrl === null);
      if (missingImages.length > 0) {
        warnings.push({
          id: 'missing-images',
          severity: 'info',
          blockId: missingImages[0].blockId,
          itemId: missingImages[0].id,
          message: t('builder.validation.missingImages', { count: missingImages.length, names: names(missingImages) }),
        });
      }
      const missingDescriptions = items.filter((item) => item.description === null);
      if (missingDescriptions.length > 0) {
        warnings.push({
          id: 'missing-descriptions',
          severity: 'info',
          blockId: missingDescriptions[0].blockId,
          itemId: missingDescriptions[0].id,
          message: t('builder.validation.missingDescriptions', { count: missingDescriptions.length, names: names(missingDescriptions) }),
        });
      }
      const incompleteInfo = items.filter((item) => item.guestInfoComplete === false && item.allergens !== undefined);
      if (incompleteInfo.length > 0) {
        warnings.push({
          id: 'guest-info',
          severity: 'info',
          blockId: incompleteInfo[0].blockId,
          itemId: incompleteInfo[0].id,
          message: t('builder.validation.incompleteGuestInfo', { count: incompleteInfo.length, names: names(incompleteInfo) }),
        });
      }
      for (const error of preview.rendered.errors) {
        warnings.push({
          id: `render-${error.slot}-${error.line}-${error.message}`,
          severity: 'error',
          message: t('builder.validation.renderError', { slot: error.slot, line: error.line ?? '–', message: error.message }),
        });
      }
      for (const error of preview.rendered.cssErrors) {
        warnings.push({
          id: `css-${error.source}-${error.line}-${error.message}`,
          severity: 'error',
          message: t('builder.validation.cssError', { line: error.line ?? '–', message: error.message }),
        });
      }
    }
    return warnings;
  }, [publishIssues, document, preview, data.cards, locales, primaryLocale, menu.sourceMode, menu.sourceCardId, output, locale, t, languageName]);
}

const ICONS = {
  error: <FaExclamationCircle className="text-error" />,
  warning: <FaExclamationTriangle className="text-warning" />,
  info: <FaInfoCircle className="text-info" />,
};

export function ValidationPanel({ warnings }: { warnings: BuilderWarning[] }) {
  const { t } = useTranslation('guestMenu');
  const { select } = useBuilder();
  if (warnings.length === 0) {
    return (
      <p className="flex items-center gap-2 p-3 text-sm text-success">
        <FaCheckCircle /> {t('builder.validation.allGood')}
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-base-300">
      {warnings.map((warning) => (
        <li key={warning.id}>
          <button
            type="button"
            disabled={!warning.blockId}
            onClick={() => warning.blockId && select({ blockId: warning.blockId, itemId: warning.itemId ?? null })}
            className={cn('flex w-full items-start gap-2 px-3 py-2 text-left text-xs', warning.blockId && 'hover:bg-base-200')}
          >
            <span className="mt-0.5 shrink-0">{ICONS[warning.severity]}</span>
            <span>{warning.message}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
