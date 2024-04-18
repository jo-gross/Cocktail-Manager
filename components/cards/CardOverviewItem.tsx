import { Role } from '@prisma/client';
import Link from 'next/link';
import { FaRegEdit } from 'react-icons/fa';
import React, { useContext } from 'react';
import { UserContext } from '../../lib/context/UserContextProvider';
import { CocktailCardFull } from '../../models/CocktailCardFull';

interface CardOverviewItemProps {
  card: CocktailCardFull;
  workspaceId: string;
}

export default function CardOverviewItem(props: CardOverviewItemProps) {
  const userContext = useContext(UserContext);

  return (
    <div key={'card-' + props.card.id} className={'card'}>
      <div className={'card-body'}>
        <div className={`card-title ${props.card.archived ? 'italic' : ''}`}>
          {props.card.archived ? 'Archiviert:' : ''} {props.card.name}{' '}
          {props.card.date != undefined ? `(${new Date(props.card.date).toLocaleDateString()})` : ''}
        </div>
        <div className={'grid grid-cols-2'}>
          <div>{props.card.groups?.length} Gruppen</div>
          <div>{props.card.groups?.reduce((acc, group) => acc + group.items.length, 0)} Cocktails</div>
        </div>
        <>
          {userContext.isUserPermitted(Role.MANAGER) && (
            <div className="card-actions justify-end">
              <Link href={`/workspaces/${props.workspaceId}/manage/cards/${props.card.id}`}>
                <div className="btn btn-primary">
                  <FaRegEdit />
                </div>
              </Link>
            </div>
          )}
        </>
      </div>
    </div>
  );
}
