import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaCheck, FaChevronDown, FaSearch } from 'react-icons/fa';

interface EntityComboboxProps {
  value: string | null;
  onChange: (value: string | null) => void;
  fetchOptions: (search: string) => Promise<any[]>;
  getOptionLabel: (option: any) => string;
  getOptionValue: (option: any) => string;
  placeholder?: string;
  disabled?: boolean;
}

export function EntityCombobox({
  value,
  onChange,
  fetchOptions,
  getOptionLabel,
  getOptionValue,
  placeholder = 'Auswählen...',
  disabled = false,
}: EntityComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<any | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fetchOptionsRef = useRef(fetchOptions);
  const getOptionValueRef = useRef(getOptionValue);
  const getOptionLabelRef = useRef(getOptionLabel);
  const hasLoadedInitialRef = useRef(false);
  const lastSearchRef = useRef<string>('');

  // Keep refs updated
  useEffect(() => {
    fetchOptionsRef.current = fetchOptions;
    getOptionValueRef.current = getOptionValue;
    getOptionLabelRef.current = getOptionLabel;
  }, [fetchOptions, getOptionValue, getOptionLabel]);

  // Load selected option when value is set (even if dropdown is closed)
  useEffect(() => {
    const loadSelectedOption = async () => {
      if (!value) {
        setSelectedOption(null);
        return;
      }

      // If we already have the selected option, don't reload
      if (selectedOption && getOptionValueRef.current(selectedOption) === value) {
        return;
      }

      // Try to find in existing options first
      if (options.length > 0) {
        const selected = options.find((opt) => getOptionValueRef.current(opt) === value);
        if (selected) {
          setSelectedOption(selected);
          return;
        }
      }

      // If not found, fetch from API
      try {
        const results = await fetchOptionsRef.current('');
        const selected = results.find((opt) => getOptionValueRef.current(opt) === value);
        if (selected) {
          setSelectedOption(selected);
        }
      } catch (error) {
        console.error('Error loading selected option:', error);
      }
    };

    loadSelectedOption();
  }, [value, options, selectedOption]);

  // Fetch options when search changes OR when dropdown opens
  useEffect(() => {
    const loadOptions = async () => {
      setLoading(true);
      try {
        const results = await fetchOptionsRef.current(search);
        setOptions(results);
        lastSearchRef.current = search;

        // Update selected option if value exists
        if (value) {
          const selected = results.find((opt) => getOptionValueRef.current(opt) === value);
          if (selected) {
            setSelectedOption(selected);
          }
        }
      } catch (error) {
        console.error('Error fetching options:', error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only load if dropdown is open
    if (!isOpen) {
      return;
    }

    // If search changed, debounce the request
    if (search !== lastSearchRef.current) {
      debounceTimerRef.current = setTimeout(() => {
        loadOptions();
      }, 300);
    } else if (!hasLoadedInitialRef.current) {
      // Load immediately only once when opening without search
      hasLoadedInitialRef.current = true;
      loadOptions();
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search, isOpen, value]);

  // Reset hasLoadedInitial when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      hasLoadedInitialRef.current = false;
      lastSearchRef.current = '';
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (option: any) => {
    const optionValue = getOptionValue(option);
    setSelectedOption(option);
    onChange(optionValue);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOption(null);
    onChange(null);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <div className={`btn btn-sm w-full justify-between ${disabled ? 'btn-disabled' : ''}`} onClick={() => !disabled && setIsOpen(!isOpen)}>
        <span className="truncate">{selectedOption ? getOptionLabelRef.current(selectedOption) : placeholder}</span>
        <FaChevronDown className={`ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-[100] mt-2 w-full rounded-lg border border-base-300 bg-base-100 shadow-lg">
          {/* Search Input */}
          <div className="border-b border-base-300 p-2">
            <div className="input input-sm flex items-center gap-2">
              <FaSearch className="opacity-50" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Suchen..."
                className="grow"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : options.length === 0 ? (
              <div className="py-4 text-center text-sm text-base-content/50">Keine Ergebnisse gefunden</div>
            ) : (
              <ul className="menu menu-sm gap-1 p-0">
                {options.map((option, index) => {
                  const optionValue = getOptionValue(option);
                  const isSelected = value === optionValue;
                  return (
                    <li key={index}>
                      <button type="button" className={`flex items-center justify-between ${isSelected ? 'active' : ''}`} onClick={() => handleSelect(option)}>
                        <span>{getOptionLabel(option)}</span>
                        {isSelected && <FaCheck className="text-primary" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
