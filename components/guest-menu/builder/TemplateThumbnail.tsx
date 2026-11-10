/** Stylised mini preview of a template (colors, fonts, layout) – no rendering needed. */
import { useTranslation } from 'react-i18next';
import { cn } from '@components/ui';
import type { GuestMenuLayout, ThemeTokens } from '@lib/guest-menu/schema';
import { getFontStack } from '@lib/guest-menu/theme';

export interface TemplateThumbnailInfo {
  id: string;
  name: string;
  description?: string;
  layout: GuestMenuLayout | string;
  tokens: ThemeTokens;
}

export function useTemplateTexts() {
  const { t } = useTranslation('guestMenu');
  return {
    name: (template: { id: string; name: string }) => t(`templates.names.${template.id}`, { defaultValue: template.name }),
    description: (template: { id: string; description?: string }) => t(`templates.descriptions.${template.id}`, { defaultValue: template.description ?? '' }),
  };
}

function MiniItem({ tokens, grid }: { tokens: ThemeTokens; grid: boolean }) {
  const { colors } = tokens;
  return (
    <div
      className={cn('flex gap-1', grid ? 'flex-col' : 'items-center')}
      style={{ background: grid ? colors.surface : 'transparent', borderRadius: Math.min(tokens.radius, 6), padding: grid ? 3 : 0 }}
    >
      {grid && <div className="h-4 w-full" style={{ background: colors.muted, opacity: 0.25, borderRadius: Math.min(tokens.radius, 4) }} />}
      <div className="h-1.5 flex-1 rounded-full" style={{ background: colors.text, opacity: 0.85 }} />
      {!grid && <div className="h-0 flex-1 border-b border-dotted" style={{ borderColor: colors.muted }} />}
      <div className="h-1.5 w-3 rounded-full" style={{ background: colors.accent }} />
    </div>
  );
}

export function TemplateThumbnail({
  template,
  selected,
  onClick,
  disabled,
}: {
  template: TemplateThumbnailInfo;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const texts = useTemplateTexts();
  const { tokens } = template;
  const grid = ['grid', 'cards', 'tiles', 'gallery'].includes(template.layout);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      title={texts.description(template)}
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border-2 text-left transition-colors disabled:cursor-not-allowed',
        selected ? 'border-primary' : 'border-base-300 hover:border-base-content/30',
      )}
    >
      <div className="flex aspect-[4/3] w-full flex-col gap-1.5 p-2" style={{ background: tokens.colors.bg, color: tokens.colors.text }}>
        <div className="truncate text-center text-[0.7rem] leading-tight font-bold" style={{ fontFamily: getFontStack(tokens.fontHeading) }}>
          {texts.name(template)}
        </div>
        <div className="mx-auto h-0.5 w-6" style={{ background: tokens.colors.accent }} />
        <div className={cn('gap-1', grid ? 'grid grid-cols-2' : 'flex flex-col')}>
          {[0, 1, 2, 3].map((index) => (
            <MiniItem key={index} tokens={tokens} grid={grid} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-0.5 bg-base-100 px-2 py-1.5">
        <span className="truncate text-xs font-semibold">{texts.name(template)}</span>
      </div>
    </button>
  );
}
