import { FaSearch } from 'react-icons/fa';
import React from 'react';

interface ListSearchFieldProps {
  onFilterChange: (filterString: string) => void;
}

export default function ListSearchField(props: ListSearchFieldProps) {
  const [filterString, setFilterString] = React.useState('');
  return (
    <div className={'join self-center'}>
      <input
        className={'input join-item input-bordered'}
        placeholder={'Suche...'}
        value={filterString}
        onChange={(e) => {
          setFilterString(e.target.value);
          props.onFilterChange(e.target.value);
        }}
      />
      <span className={'join-item'}>
        <FaSearch className={'h-full w-fit rounded-r-md bg-primary pl-4 pr-4 text-neutral'} />
      </span>
    </div>
  );
}
