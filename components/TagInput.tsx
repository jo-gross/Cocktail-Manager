import React, { useEffect, useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import { MultiValue } from 'react-select';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import '../lib/ArrayUtils';
import { useRouter } from 'next/router';
import { Badge } from '@components/ui';
import { apiV1Fetch } from '@lib/network/apiV1';

interface TagOption {
  value: string;
  label: string;
}

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  validate?: (tag: string) => boolean;
}

// Same height, border and focus ring as the other form fields (Input / Select).
const inputControlClasses =
  'w-full min-h-11 h-11 rounded-lg border border-base-300 bg-base-100 px-3 text-sm pointer-coarse:text-base text-base-content outline-none transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1 focus-within:ring-offset-base-100';

export function TagInput(props: TagInputProps) {
  const { t } = useTranslation('common');
  const formatTags = (tags: string[]) => tags.map((tag) => ({ value: tag, label: tag }));

  const handleChange = (options: MultiValue<TagOption>) => {
    const newTags = options ? options.map((option) => option.value) : [];
    props.onChange(newTags);
  };

  const handleCreate = (inputValue: string) => {
    if (props.validate && !props.validate(inputValue)) {
      return;
    }
    const newTags = [...props.value, inputValue];
    props.onChange(newTags);
  };

  const router = useRouter();
  const workspaceId = router.query.workspaceId as string;
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  useEffect(() => {
    if (!workspaceId) return;
    apiV1Fetch<string[]>(`/api/v1/workspaces/${workspaceId}/tags`)
      .then(setTagSuggestions)
      .catch((error) => console.error('TagInput -> loadTags', error));
  }, [workspaceId]);

  const [menuIsOpen, setMenuIsOpen] = useState(false);

  return (
    <div className="w-full">
      <CreatableSelect
        isMulti
        value={formatTags(props.value)}
        options={[...tagSuggestions, ...props.value]
          .map((tag) => tag.trim().toLowerCase())
          .filterUnique()
          .sort((a, b) => a.localeCompare(b))
          .map((tag) => ({ value: tag, label: tag }))}
        onChange={handleChange}
        onCreateOption={handleCreate}
        classNamePrefix="react-select"
        placeholder={t('tagAdd')}
        isClearable={false}
        formatCreateLabel={(inputValue) => t('tagCreate', { value: inputValue })}
        hideSelectedOptions={false}
        backspaceRemovesValue={false}
        controlShouldRenderValue={menuIsOpen}
        onMenuOpen={() => setMenuIsOpen(true)}
        onMenuClose={() => setMenuIsOpen(false)}
        unstyled
        classNames={{
          control: () => inputControlClasses,
          indicatorsContainer: () => classNames('invisible'),
          menu: () => classNames('absolute z-50 mt-1 w-full'),
          menuList: () => classNames('w-full rounded-field border border-base-content/20 bg-base-100 shadow-lg'),
          multiValue: () => classNames('invisible', 'w-0'),
          option: ({ isDisabled, isFocused, isSelected }) =>
            classNames(
              'cursor-pointer px-3 py-2.5 pointer-coarse:py-3',
              isDisabled && 'text-base-content/30',
              isFocused && 'bg-secondary text-secondary-content',
              isSelected && !isFocused && 'bg-primary text-primary-content',
              !isFocused && !isSelected && !isDisabled && 'text-base-content',
            ),
          placeholder: () => classNames('mx-0.5 text-base-content/50'),
        }}
      />
      <div className="flex flex-wrap gap-1 pt-2">
        {props.value.map((tag) => (
          <Badge key={tag} variant="primary" className="gap-1 pointer-coarse:gap-1.5">
            {tag}
            {/* Compact like before; only the remove target grows on touch screens. */}
            <button
              type="button"
              aria-label={`${t('remove')}: ${tag}`}
              className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm text-inherit hover:bg-primary-content/20 focus-visible:ring-2 focus-visible:ring-primary-content focus-visible:outline-none pointer-coarse:h-6 pointer-coarse:w-6"
              onClick={() => props.onChange(props.value.filter((existing) => existing !== tag))}
            >
              &times;
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
