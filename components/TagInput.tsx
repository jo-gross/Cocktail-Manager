import React, { useEffect, useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import { MultiValue } from 'react-select';
import classNames from 'classnames';
import '../lib/ArrayUtils';
import { useRouter } from 'next/router';
import { Badge, Button } from '@components/ui';

interface TagOption {
  value: string;
  label: string;
}

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  validate?: (tag: string) => boolean;
}

const inputControlClasses =
  'w-full min-h-10 h-10 rounded-field border border-base-content/20 bg-base-100 px-3 text-sm text-base-content outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25';

export function TagInput(props: TagInputProps) {
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
    fetch(`/api/workspaces/${workspaceId}/tags`).then(async (response) => {
      const data = await response.json();
      setTagSuggestions(data.data);
    });
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
        placeholder="Tag hinzufügen..."
        isClearable={false}
        formatCreateLabel={(inputValue) => `Erstelle "${inputValue}"`}
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
              'cursor-pointer px-3 py-2',
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
          <Badge key={tag} variant="primary" className="gap-1">
            {tag}
            <Button
              type="button"
              variant="ghost"
              shape="square"
              size="xs"
              className="h-4 min-h-4 w-4 text-inherit hover:bg-primary-content/20"
              onClick={() => {
                const newTags = props.value.filter((t) => t !== tag);
                props.onChange(newTags);
              }}
            >
              &times;
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
