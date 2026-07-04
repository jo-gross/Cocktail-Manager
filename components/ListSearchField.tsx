import { FaSearch } from 'react-icons/fa';
import React from 'react';
import { Input } from '@components/ui';

interface ListSearchFieldProps {
  onFilterChange: (filterString: string) => void;
}

export default function ListSearchField(props: ListSearchFieldProps) {
  const [filterString, setFilterString] = React.useState('');

  return (
    <div className="relative w-full">
      <FaSearch className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base-content/40" aria-hidden />
      <Input
        className="w-full pl-9"
        placeholder="Suche..."
        value={filterString}
        onChange={(e) => {
          setFilterString(e.target.value);
          props.onFilterChange(e.target.value);
        }}
      />
    </div>
  );
}
