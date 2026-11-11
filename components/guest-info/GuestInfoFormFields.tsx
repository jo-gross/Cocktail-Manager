/**
 * Formik field groups for the guest-information section of the ingredient,
 * garnish and cocktail forms. They read/write fixed field names via
 * useFormikContext, so they must be rendered inside the respective <Formik>.
 */
import React from 'react';
import { useFormikContext } from 'formik';
import { useTranslation } from 'react-i18next';
import { Input } from '@components/ui';
import { FormField, visibleFieldError } from '@components/forms/FormField';
import { ToggleField } from '@components/forms/ToggleField';
import { pruneAllergenSources, type Additive, type Allergen, type AllergenSource } from '@lib/guest-info/constants';
import { AllergenSelect } from './AllergenSelect';
import { AllergenSourceFields } from './AllergenSourceFields';
import { AdditiveSelect } from './AdditiveSelect';

export interface GarnishGuestInfoFormValues {
  allergens: Allergen[];
  /** Specific cereals/nuts behind GLUTEN/NUTS. */
  allergenSources: AllergenSource[];
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

function AllergenAdditiveFields(props: {
  allergens: Allergen[];
  additives: Additive[];
  onAllergens: (value: Allergen[]) => void;
  /** Ingredients/garnishes can name the specific cereals/nuts (cocktail extras can't). */
  allergenSources?: AllergenSource[];
  onAllergenSources?: (value: AllergenSource[]) => void;
  onAdditives: (value: Additive[]) => void;
  allergensLabel?: string;
  additivesLabel?: string;
}) {
  const { t } = useTranslation(['guestInfo']);
  return (
    <>
      <FormField label={props.allergensLabel ?? t('guestInfo:allergensTitle')} className="col-span-full">
        <AllergenSelect value={props.allergens} onChange={props.onAllergens} />
        {props.allergenSources && props.onAllergenSources ? (
          <AllergenSourceFields allergens={props.allergens} value={props.allergenSources} onChange={props.onAllergenSources} />
        ) : null}
      </FormField>
      <FormField label={props.additivesLabel ?? t('guestInfo:additivesTitle')} className="col-span-full">
        <AdditiveSelect value={props.additives} onChange={props.onAdditives} />
      </FormField>
    </>
  );
}

/** Guest information of a garnish; render inside a FormSection (it brings no heading of its own). */
export function GarnishGuestInfoFields() {
  const { t } = useTranslation(['guestInfo']);
  const { values, setFieldValue } = useFormikContext<GarnishGuestInfoFormValues>();
  return (
    <div className="grid grid-cols-1 gap-4">
      <AllergenAdditiveFields
        allergens={values.allergens}
        additives={values.additives}
        onAllergens={(value) => {
          setFieldValue('allergens', value);
          // Deselecting GLUTEN / NUTS also drops „Weizen“, „Haselnüsse“ …
          setFieldValue('allergenSources', pruneAllergenSources(value, values.allergenSources));
        }}
        allergenSources={values.allergenSources}
        onAllergenSources={(value) => setFieldValue('allergenSources', value)}
        onAdditives={(value) => setFieldValue('additives', value)}
      />
      <ToggleField
        name="guestInfoComplete"
        checked={values.guestInfoComplete}
        label={t('guestInfo:form.complete')}
        hint={t('guestInfo:form.completeHint')}
        onCheckedChange={(checked) => setFieldValue('guestInfoComplete', checked)}
      />
    </div>
  );
}

/**
 * Guest information of an ingredient; render inside a FormSection.
 * `wrapGuestName` lets the ingredient form add translation tabs around the guest name input.
 */
export function IngredientGuestInfoFields(props: { wrapGuestName?: (input: React.ReactElement) => React.ReactNode } = {}) {
  const { t } = useTranslation(['guestInfo']);
  const formik = useFormikContext<IngredientGuestInfoFormValues>();
  const { values, handleChange, handleBlur, setFieldValue } = formik;
  const abvError = visibleFieldError(formik, 'abv');
  return (
    <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
      <FormField label={t('guestInfo:form.abv')} htmlFor="abv" hint={t('guestInfo:form.abvHint')} error={abvError}>
        <Input
          id="abv"
          name="abv"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step={0.1}
          placeholder={t('guestInfo:form.abvPlaceholder')}
          error={!!abvError}
          value={values.abv}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      </FormField>
      <FormField label={t('guestInfo:form.guestName')} htmlFor="guestName">
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
      </FormField>
      <AllergenAdditiveFields
        allergens={values.allergens}
        additives={values.additives}
        onAllergens={(value) => {
          setFieldValue('allergens', value);
          // Deselecting GLUTEN / NUTS also drops „Weizen“, „Haselnüsse“ …
          setFieldValue('allergenSources', pruneAllergenSources(value, values.allergenSources));
        }}
        allergenSources={values.allergenSources}
        onAllergenSources={(value) => setFieldValue('allergenSources', value)}
        onAdditives={(value) => setFieldValue('additives', value)}
      />
      <ToggleField
        name="guestInfoComplete"
        checked={values.guestInfoComplete}
        label={t('guestInfo:form.complete')}
        hint={t('guestInfo:form.completeHint')}
        onCheckedChange={(checked) => setFieldValue('guestInfoComplete', checked)}
      />
      <ToggleField
        name="hideOnGuestMenu"
        checked={values.hideOnGuestMenu}
        label={t('guestInfo:form.hideOnGuestMenu')}
        hint={t('guestInfo:form.hideOnGuestMenuHint')}
        onCheckedChange={(checked) => setFieldValue('hideOnGuestMenu', checked)}
      />
    </div>
  );
}

/**
 * Overrides of the guest information a cocktail derives from its ingredients; render inside a
 * (collapsible) FormSection. The derived values are shown by CocktailGuestInfoPreview.
 */
export function CocktailGuestInfoFields() {
  const { t } = useTranslation(['guestInfo']);
  const formik = useFormikContext<CocktailGuestInfoFormValues>();
  const { values, handleChange, handleBlur, setFieldValue } = formik;
  const abvOverrideError = visibleFieldError(formik, 'abvOverride');
  return (
    <div className="grid grid-cols-1 gap-4">
      <FormField
        label={t('guestInfo:form.abvOverride')}
        htmlFor="abvOverride"
        hint={t('guestInfo:form.abvOverrideHint')}
        error={abvOverrideError}
        className="max-w-xs"
      >
        <Input
          id="abvOverride"
          name="abvOverride"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step={0.1}
          placeholder={t('guestInfo:form.abvOverridePlaceholder')}
          error={!!abvOverrideError}
          value={values.abvOverride}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      </FormField>
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
