/** Modal for creating a guest menu: name, template (thumbnails), source mode/card. */
import { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select } from '@components/ui';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { ApiV1RequestError, alertApiV1Error, apiV1Fetch } from '@lib/network/apiV1';
import { createGuestMenu } from '@lib/network/guestMenus';
import { listBuiltInTemplates } from '@lib/guest-menu/templates';
import type { CardSummaryDto } from '@lib/schemas/cards';
import type { GuestMenuDto, GuestMenuCreateInput } from '@lib/schemas/guestMenus';
import { TemplateThumbnail } from '@components/guest-menu/builder/TemplateThumbnail';

export function CreateGuestMenuModal({ workspaceId, onCreated }: { workspaceId: string; onCreated: (menu: GuestMenuDto) => void }) {
  const { t } = useTranslation('guestMenu');
  const modalContext = useContext(ModalContext);
  const templates = useMemo(() => listBuiltInTemplates().filter((template) => template.outputs.includes('web')), []);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? 'classic');
  const [sourceMode, setSourceMode] = useState<NonNullable<GuestMenuCreateInput['sourceMode']>>('ACTIVE_CARD');
  const [sourceCardId, setSourceCardId] = useState('');
  const [cards, setCards] = useState<CardSummaryDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [slugTaken, setSlugTaken] = useState(false);

  useEffect(() => {
    apiV1Fetch<CardSummaryDto[]>(`/api/v1/workspaces/${workspaceId}/cards`)
      .then((list) => setCards(list.filter((card) => !card.archived)))
      .catch(() => setCards([]));
  }, [workspaceId]);

  const valid = name.trim() !== '' && (sourceMode !== 'FIXED_CARD' || sourceCardId !== '');

  const submit = async () => {
    setSaving(true);
    setSlugTaken(false);
    try {
      const created = await createGuestMenu(workspaceId, {
        name: name.trim(),
        templateId,
        sourceMode,
        sourceCardId: sourceMode === 'FIXED_CARD' ? sourceCardId : null,
      });
      modalContext.closeModal();
      onCreated(created);
    } catch (error) {
      if (error instanceof ApiV1RequestError && error.status === 409) setSlugTaken(true);
      else alertApiV1Error(error, t('errors.save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex w-full max-w-2xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) void submit();
      }}
    >
      <h2 className="text-2xl font-bold">{t('newMenu')}</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="gm-create-name" className="text-sm font-medium">
          {t('name')}
        </label>
        <Input id="gm-create-name" autoFocus value={name} placeholder={t('list.namePlaceholder')} onChange={(event) => setName(event.target.value)} />
        {slugTaken && <p className="text-xs text-error">{t('errors.slugTaken')}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t('list.template')}</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {templates.map((template) => (
            <TemplateThumbnail
              key={template.id}
              template={{ ...template, tokens: template.defaultTokens }}
              selected={templateId === template.id}
              onClick={() => setTemplateId(template.id)}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="gm-create-source" className="text-sm font-medium">
            {t('source.title')}
          </label>
          <Select id="gm-create-source" value={sourceMode} onChange={(event) => setSourceMode(event.target.value as typeof sourceMode)}>
            {(['ACTIVE_CARD', 'FIXED_CARD', 'NONE'] as const).map((value) => (
              <option key={value} value={value}>
                {t(`source.${value}`)}
              </option>
            ))}
          </Select>
        </div>
        {sourceMode === 'FIXED_CARD' && (
          <div className="flex flex-col gap-1">
            <label htmlFor="gm-create-card" className="text-sm font-medium">
              {t('source.card')}
            </label>
            <Select id="gm-create-card" value={sourceCardId} onChange={(event) => setSourceCardId(event.target.value)}>
              <option value="">{t('builder.schedule.chooseCard')}</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <p className="text-xs text-base-content/60">{t(`builder.schedule.sourceHint.${sourceMode}`)}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => modalContext.closeModal()}>
          {t('list.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={saving} disabled={!valid}>
          {t('list.create')}
        </Button>
      </div>
    </form>
  );
}
