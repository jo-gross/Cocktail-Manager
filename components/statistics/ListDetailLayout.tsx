import React from 'react';

interface ListDetailLayoutProps {
  list: React.ReactNode;
  detail: React.ReactNode;
  className?: string;
}

export function ListDetailLayout({ list, detail, className = '' }: ListDetailLayoutProps) {
  return (
    <div className={`grid grid-cols-1 gap-4 lg:grid-cols-3 ${className}`}>
      <div className="lg:col-span-1">{list}</div>
      <div className="lg:col-span-2">{detail}</div>
    </div>
  );
}
