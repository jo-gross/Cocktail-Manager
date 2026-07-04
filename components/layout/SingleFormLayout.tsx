import React from 'react';
import { Card, CardBody, Divider } from '@components/ui';

interface SingleFormLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function SingleFormLayout(props: SingleFormLayoutProps) {
  return (
    <div className={'flex w-full flex-col items-center gap-3 p-3 xl:gap-5 xl:p-12'}>
      <Card className="w-fit">
        <CardBody>
          <div className={'text-center text-2xl font-bold'}>{props.title}</div>
          <Divider />
          {props.children}
        </CardBody>
      </Card>
    </div>
  );
}
