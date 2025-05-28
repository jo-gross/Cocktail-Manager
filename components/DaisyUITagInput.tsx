import React, { useEffect, useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import classNames from 'classnames';
import '../lib/ArrayUtils';
import { useRouter } from 'next/router';

interface DaisyUITagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  validate?: (tag: string) => boolean;
}

export function DaisyUITagInput(props: DaisyUITagInputProps) {
  // Hilfsfunktion: Wandelt die Tags in das Format von `react-select` um
  const formatTags = (tags: string[]) => tags.map((tag) => ({ value: tag, label: tag }));
  // Hilfsfunktion: Wandelt das Format von `react-select` zurück in ein Array von Strings
  const parseTags = (options: { value: string; label: string }[]) => options.map((option) => option.value);

  const handleChange = (options: any) => {
    const newTags = options ? parseTags(options) : [];
    props.onChange(newTags);
  };

  const handleCreate = (inputValue: string) => {
    if (props.validate && !props.validate(inputValue)) {
      // Validierung schlägt fehl, also Abbruch
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

  // Keep placeholder visible: https://github.com/JedWatson/react-select/issues/1828
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
        // Keep placeholder visible: https://github.com/JedWatson/react-select/issues/1828
        controlShouldRenderValue={menuIsOpen}
        onMenuOpen={() => setMenuIsOpen(true)}
        onMenuClose={() => setMenuIsOpen(false)}
        // Apply DaisyUI classes
        unstyled // Remove all non-essential styles
        classNames={{
          control: ({ isDisabled, isFocused }) => classNames('select'),
          indicatorsContainer: () => classNames('invisible'),
          menu: () => classNames('dropdown', 'dropdown-open', 'w-full'),
          menuList: () => classNames('dropdown-content', 'w-full', 'bg-base-100', 'rounded-lg'),
          multiValue: () => classNames('invisible', 'w-0'),
          option: ({ isDisabled, isFocused, isSelected }) =>
            classNames(
              isFocused ? 'bg-secondary' : isSelected ? 'bg-primary' : 'bg-transparent',
              isDisabled ? 'text-neutral-200' : isFocused ? 'text-secondary-content' : isSelected ? 'text-primary-content' : 'text-inherit',
              'py-2',
              'px-3',
            ),
          placeholder: () => classNames('text-neutral-500', 'mx-0.5'),
        }}
      />
      <div className={'pt-2'}>
        {props.value.map((tag) => (
          <span key={tag} className="badge badge-primary mr-1">
            {tag}
            <button
              className="btn btn-square btn-ghost btn-xs"
              onClick={() => {
                const newTags = props.value.filter((t) => t !== tag);
                props.onChange(newTags);
              }}
            >
              &times;
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
