import { Role } from '@generated/prisma/client';
import Link from 'next/link';
import { FaRegClone, FaRegEdit } from 'react-icons/fa';
import React, { useContext } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import type { CardDto, CardSummaryDto } from '@lib/schemas/cards';
import { ModalContext } from '@lib/context/ModalContextProvider';
import InputModal from '../modals/InputModal';
import { alertService } from '@lib/alertService';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import { Badge, Button, Card, CardActions, CardBody, CardTitle } from '@components/ui';
import CardSnapshot from './CardSnapshot';
import { alertApiV1Error, apiV1Mutate } from '@lib/network/apiV1';

interface CardOverviewItemProps {
  card: CardSummaryDto;
  workspaceId: string;
  today: string;
}

type DateBadgeState = 'today' | 'future' | 'past' | 'none';

function cardDateKey(date: Date | string): string {
  return new Date(date).toISOString().split('T')[0];
}

function getDateBadgeState(cardDate: Date | string | null | undefined, today: string): DateBadgeState {
  if (cardDate == null) return 'none';
  const key = cardDateKey(cardDate);
  if (key === today) return 'today';
  if (key > today) return 'future';
  return 'past';
}

function DateBadge({ cardDate, today }: { cardDate: Date | string | null | undefined; today: string }) {
  const state = getDateBadgeState(cardDate, today);

  if (state === 'none') {
    return (
      <Badge variant="ghost" size="sm" outline className="text-base-content/60">
        Kein Datum
      </Badge>
    );
  }

  const label = state === 'today' ? 'Heute' : new Date(cardDate!).toLocaleDateString('de-DE');

  if (state === 'today') {
    return (
      <Badge variant="primary" size="sm">
        {label}
      </Badge>
    );
  }

  if (state === 'future') {
    return (
      <Badge variant="primary" size="sm" outline>
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="ghost" size="sm" outline className="text-base-content/60">
      {label}
    </Badge>
  );
}

export default function CardOverviewItem(props: CardOverviewItemProps) {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);
  const routingContext = useContext(RoutingContext);

  const groupCount = props.card.groupCount;
  const cocktailCount = props.card.itemCount;

  return (
    <Card key={'card-' + props.card.id} variant="elevated">
      <div className="border-b border-base-300/60 bg-base-200/60 px-4 py-3">
        <CardTitle className={props.card.archived ? 'text-base-content/70 italic' : undefined}>
          <span className="min-w-0 flex-1 truncate">
            {props.card.archived ? 'Archiviert: ' : ''}
            {props.card.name}
          </span>
          <DateBadge cardDate={props.card.date} today={props.today} />
        </CardTitle>
      </div>
      <CardBody className="gap-3">
        <CardSnapshot groupCount={groupCount} itemCount={cocktailCount} />
        <div className="text-sm text-base-content/70">
          {groupCount} {groupCount === 1 ? 'Gruppe' : 'Gruppen'} · {cocktailCount} {cocktailCount === 1 ? 'Cocktail' : 'Cocktails'}
        </div>
        {userContext.isUserPermitted(Role.MANAGER) ? (
          <CardActions className="justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10"
              onClick={() =>
                modalContext.openModal(
                  <InputModal
                    title={'Name'}
                    onInputSubmit={async (value) => {
                      try {
                        const cloned = await apiV1Mutate<CardDto>(`/api/v1/workspaces/${props.workspaceId}/cards/${props.card.id}/clone`, 'POST', {
                          name: value,
                        });
                        alertService.success('Karte erfolgreich dupliziert');
                        await routingContext.conditionalBack(`/workspaces/${props.workspaceId}/manage/cards/${cloned.id}`);
                      } catch (error) {
                        alertApiV1Error(error, 'Fehler beim Duplizieren der Karte');
                        throw error;
                      }
                    }}
                    allowEmpty={false}
                    defaultValue={props.card.name + ' - Kopie'}
                  />,
                )
              }
            >
              <FaRegClone />
              Duplizieren
            </Button>
            <Link href={`/workspaces/${props.workspaceId}/manage/cards/${props.card.id}`}>
              <Button variant="primary">
                <FaRegEdit />
                Bearbeiten
              </Button>
            </Link>
          </CardActions>
        ) : null}
      </CardBody>
    </Card>
  );
}
