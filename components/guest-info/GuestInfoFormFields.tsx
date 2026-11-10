/**
 * Formik field groups for the guest-information section of the ingredient,
 * garnish and cocktail forms. They read/write fixed field names via
 * useFormikContext, so they must be rendered inside the respective <Formik>.
 */
import React from 'react';
import { useFormikContext } from 'formik';
import { useTranslation } from 'react-i18next';
import { Divider, FormControl, Input, Label, LabelText, LabelTextAlt, Toggle } from '@components/ui';
import type { Additive, Allergen } from '@lib/guest-info/constants';
import { AllergenSelect } from './AllergenSelect';
import { AdditiveSelect } from './AdditiveSelect';
import { CocktailGuestInfoPreview } from './CocktailGuestInfoPreview';

export interface GarnishGuestInfoFormValues {
  allergens: Allergen[];
  additives: Additive[];
  guestInfoComplete: boolean;
}

export interface IngredientGuestInfoFormValues extends GarnishGuestInfoFormValues {
  /** % vol as typed (string while editing, '' = unknown). */
  abv: number | string;
  hideOnGuestMenu: boolean;
  guestName: string;
}

export interface CocktailGuestInfoFormValues {
  abvOverride: number | string;
  extraAllergens: Allergen[];
  extraAdditives: Additive[];
}

/** '' / undefined → null, otherwise a number. */
export function parseOptionalPercent(value: number | string | null | undefined): number | null {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SectionTitle() {
  const { t } = useTranslation(['guestInfo']);
  return (
    <div className="col-span-full flex items-center gap-3 py-2">
      <Divider className="my-0 flex-1" />
      <span className="shrink-0 text-sm font-medium text-base-content/70">{t('guestInfo:form.sectionTitle')}</span>
      <Divider className="my-0 flex-1" />
    </div>
  );
}

function ToggleRow(props: { name: string; checked: boolean; label: string; hint?: string; onChange: (checked: boolean) => void }) {
  return (
    <FormControl>
      <Label htmlFor={props.name} className="cursor-pointer flex-row items-center gap-3">
        <Toggle id={props.name} name={props.name} checked={props.checked} onChange={(event) => props.onChange(event.target.checked)} />
        <span className="flex flex-col">
          <LabelText>{props.label}</LabelText>
          {props.hint && <LabelTextAlt>{props.hint}</LabelTextAlt>}
        </span>
      </Label>
    </FormControl>
  );
}

function AllergenAdditiveFields(props: {
  allergens: Allergen[];
  additives: Additive[];
  onAllergens: (value: Allergen[]) => void;
  onAdditives: (value: Additive[]) => void;
  allergensLabel?: string;
  additivesLabel?: string;
}) {
  const { t } = useTranslation(['guestInfo']);
  return (
    <>
      <FormControl className="col-span-full">
        <Label className="flex-row items-center justify-between">
          <LabelText>{props.allergensLabel ?? t('guestInfo:allergensTitle')}</LabelText>
        </Label>
        <AllergenSelect value={props.allergens} onChange={props.onAllergens} />
      </FormControl>
      <FormControl className="col-span-full">
        <Label className="flex-row items-center justify-between">
          <LabelText>{props.additivesLabel ?? t('guestInfo:additivesTitle')}</LabelText>
        </Label>
        <AdditiveSelect value={props.additives} onChange={props.onAdditives} />
      </FormControl>
    </>
  );
}

export function GarnishGuestInfoFields() {
  const { t } = useTranslation(['guestInfo']);
  const { values, setFieldValue } = useFormikContext<GarnishGuestInfoFormValues>();
  return (
    <div className="col-span-full grid grid-cols-1 gap-2">
      <SectionTitle />
      <AllergenAdditiveFields
        allergens={values.allergens}
        additives={values.additives}
        onAllergens={(value) => setFieldValue('allergens', value)}
        onAdditives={(value) => setFieldValue('additives', value)}
      />
      <ToggleRow
        name="guestInfoComplete"
        checked={values.guestInfoComplete}
        label={t('guestInfo:form.complete')}
        hint={t('guestInfo:form.completeHint')}
        onChange={(checked) => setFieldValue('guestInfoComplete', checked)}
      />
    </div>
  );
}

/** `wrapGuestName` lets the ingredient form add translation tabs around the guest name input. */
export function IngredientGuestInfoFields(props: { wrapGuestName?: (input: React.ReactElement) => React.ReactNode } = {}) {
  const { t } = useTranslation(['guestInfo']);
  const { values, errors, handleChange, handleBlur, setFieldValue } = useFormikContext<IngredientGuestInfoFormValues>();
  return (
    <div className="col-span-full grid grid-cols-1 gap-2 md:grid-cols-2">
      <SectionTitle />
      <FormControl>
        <Label htmlFor="abv" className="flex-row items-center justify-between">
          <LabelText>{t('guestInfo:form.abv')}</LabelText>
          <LabelTextAlt className="text-error">{errors.abv as string | undefined}</LabelTextAlt>
        </Label>
        <Input
          id="abv"
          name="abv"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step={0.1}
          placeholder={t('guestInfo:form.abvPlaceholder')}
          value={values.abv}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <Label className="flex-row">
          <LabelTextAlt>{t('guestInfo:form.abvHint')}</LabelTextAlt>
        </Label>
      </FormControl>
      <FormControl>
        <Label htmlFor="guestName" className="flex-row items-center justify-between">
          <LabelText>{t('guestInfo:form.guestName')}</LabelText>
        </Label>
        {(props.wrapGuestName ?? ((input: React.ReactElement) => input))(
          <Input
            id="guestName"
            name="guestName"
            type="text"
            autoComplete="off"
            placeholder={t('guestInfo:form.guestNamePlaceholder')}
            value={values.guestName}
            onChange={handleChange}
            onBlur={handleBlur}
          />,
        )}
      </FormControl>
      <AllergenAdditiveFields
        allergens={values.allergens}
        additives={values.additives}
        onAllergens={(value) => setFieldValue('allergens', value)}
        onAdditives={(value) => setFieldValue('additives', value)}
      />
      <ToggleRow
        name="guestInfoComplete"
        checked={values.guestInfoComplete}
        label={t('guestInfo:form.complete')}
        hint={t('guestInfo:form.completeHint')}
        onChange={(checked) => setFieldValue('guestInfoComplete', checked)}
      />
      <ToggleRow
        name="hideOnGuestMenu"
        checked={values.hideOnGuestMenu}
        label={t('guestInfo:form.hideOnGuestMenu')}
        hint={t('guestInfo:form.hideOnGuestMenuHint')}
        onChange={(checked) => setFieldValue('hideOnGuestMenu', checked)}
      />
    </div>
  );
}

export function CocktailGuestInfoFields(props: { workspaceId: string | string[]; cocktailId?: string; reloadKey?: unknown }) {
  const { t } = useTranslation(['guestInfo']);
  const { values, errors, handleChange, handleBlur, setFieldValue } = useFormikContext<CocktailGuestInfoFormValues>();
  return (
    <div className="col-span-full grid grid-cols-1 gap-2">
      <CocktailGuestInfoPreview workspaceId={props.workspaceId} cocktailId={props.cocktailId} reloadKey={props.reloadKey} />
      <FormControl className="max-w-xs">
        <Label htmlFor="abvOverride" className="flex-row items-center justify-between">
          <LabelText>{t('guestInfo:form.abvOverride')}</LabelText>
          <LabelTextAlt className="text-error">{errors.abvOverride as string | undefined}</LabelTextAlt>
        </Label>
        <Input
          id="abvOverride"
          name="abvOverride"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step={0.1}
          placeholder={t('guestInfo:form.abvOverridePlaceholder')}
          value={values.abvOverride}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <Label className="flex-row">
          <LabelTextAlt>{t('guestInfo:form.abvOverrideHint')}</LabelTextAlt>
        </Label>
      </FormControl>
      <AllergenAdditiveFields
        allergens={values.extraAllergens}
        additives={values.extraAdditives}
        onAllergens={(value) => setFieldValue('extraAllergens', value)}
        onAdditives={(value) => setFieldValue('extraAdditives', value)}
        allergensLabel={t('guestInfo:form.extraAllergens')}
        additivesLabel={t('guestInfo:form.extraAdditives')}
      />
    </div>
  );
}
