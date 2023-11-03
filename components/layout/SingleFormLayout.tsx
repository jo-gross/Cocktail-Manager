import React from 'react';

interface SingleFormLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function SingleFormLayout(props: SingleFormLayoutProps) {
  return (
    <div className={'grid grid-cols-1 gap-2 p-2 xl:grid-cols-3 xl:gap-4 xl:p-12'}>
      <div></div>
      <div className={'card'}>
        <div className={'card-body'}>
          <div className={'text-center text-2xl font-bold'}>{props.title}</div>
          <div className={'divider'}></div>
          {props.children}
        </div>
      </div>
    </div>
  );
}
