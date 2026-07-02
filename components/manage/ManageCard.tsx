import Link from 'next/link';
import React from 'react';
import { Button, Card, CardBody, CardTitle } from '@components/ui';

interface ManageCardProps {
  title: string;
  icon?: React.JSX.Element;
  link: string;
}

export function ManageCard(props: ManageCardProps) {
  return (
    <Card>
      <CardBody className="flex flex-row justify-between">
        <CardTitle>
          {props.icon}
          {props.title}
        </CardTitle>
        <Link href={props.link}>
          <Button variant="primary">Verwalten</Button>
        </Link>
      </CardBody>
    </Card>
  );
}
