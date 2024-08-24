import TagsInput from 'react-tagsinput';
import { FaTimes } from 'react-icons/fa';
import React from 'react';

interface DaisyUITagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  validate?: (tag: string) => boolean;
}

export function DaisyUITagInput(props: DaisyUITagInputProps) {
  return (
    <div className={'input-bordered w-full rounded-box border p-2'}>
      <TagsInput
        value={props.value}
        onChange={props.onChange}
        preventSubmit={true}
        onlyUnique={true}
        validate={props.validate ? (tag) => props.validate!(tag) : undefined}
        addOnBlur={true}
        // 8 = Backspace, 46 = Delete
        removeKeys={[]}
        renderLayout={(tagComponents, inputComponent) => (
          <>
            {tagComponents}
            {inputComponent}
          </>
        )}
        className={'flex flex-row flex-wrap items-center gap-2'}
        // 9= Tab, 10/13 = Enter, 188 = Comma, 32 = Space
        addKeys={[9, 10, 13, 188, 32]}
        inputProps={{
          className: 'input input-bordered',
          placeholder: 'Tag hinzufügen...',
        }}
        tagProps={{
          className: 'badge badge-outline gap-2',
          classNameRemove: 'btn btn-ghost',
        }}
        renderTag={(props) => (
          <span {...props}>
            {props.tag}
            <span {...props} className={'cursor-pointer'} onClick={() => props.onRemove(props.key)}>
              <FaTimes />
            </span>
          </span>
        )}
      />
    </div>
  );
}
