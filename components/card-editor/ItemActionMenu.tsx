import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaEllipsisV } from 'react-icons/fa';
import { Button, Menu } from '@components/ui';

export interface ItemAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  isDanger?: boolean;
}

interface ItemActionMenuProps {
  actions: ItemAction[];
  ariaLabel?: string;
}

/**
 * Lightweight, portal-based ellipsis menu (mirrors the pattern used in ManageColumn).
 * A portal is required because the surrounding group Card uses `overflow-hidden`, which
 * would clip an absolutely positioned dropdown.
 */
export function ItemActionMenu({ actions, ariaLabel = 'Aktionen' }: ItemActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 208; // w-52 = 13rem = 208px
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const actualMenuHeight = menuRef.current?.getBoundingClientRect().height || 120;
    const margin = 8;

    let top = rect.bottom + margin;
    let left = rect.right - menuWidth;

    if (top + actualMenuHeight > viewportHeight) {
      top = rect.top - actualMenuHeight - margin;
    }
    if (left < 8) {
      left = 8;
    }
    if (left + menuWidth > viewportWidth - 8) {
      left = viewportWidth - menuWidth - 8;
    }

    setPosition({ top, left });
  }, []);

  const handleToggle = useCallback(() => {
    if (!isOpen) {
      calculatePosition();
      requestAnimationFrame(() => calculatePosition());
    }
    setIsOpen((prev) => !prev);
  }, [isOpen, calculatePosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        calculatePosition();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', calculatePosition);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [isOpen, calculatePosition]);

  const menu =
    isOpen && typeof document !== 'undefined'
      ? createPortal(
          <div ref={menuRef} style={{ position: 'fixed', top: position.top, left: position.left }}>
            <Menu
              size="sm"
              className="z-9999 w-52 gap-1 rounded-box border border-base-200 bg-base-100 p-2 shadow-lg [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-field [&_button]:px-3 [&_button]:py-2 [&_button]:text-left [&_button]:hover:bg-base-200 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50"
            >
              {actions.map((action, index) => (
                <li key={`item-action-${index}`}>
                  <button
                    type="button"
                    className={`flex items-center gap-2 ${action.isDanger ? 'text-error' : ''}`}
                    onClick={() => {
                      setIsOpen(false);
                      action.onClick();
                    }}
                    disabled={action.disabled}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                </li>
              ))}
            </Menu>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <Button ref={buttonRef} type="button" variant="ghost" shape="square" size="sm" onClick={handleToggle} aria-label={ariaLabel}>
        <FaEllipsisV />
      </Button>
      {menu}
    </>
  );
}
