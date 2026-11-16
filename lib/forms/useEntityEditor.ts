import { useEffect, useState } from 'react';
import type { ParsedUrlQuery } from 'querystring';
import { useRouter } from 'next/router';

/** Route id of the create pages (`/workspaces/[workspaceId]/manage/<entity>/create`). */
export const CREATE_ENTITY_ID = 'create';

export type EntityRoute = { kind: 'pending' } | { kind: 'create'; workspaceId: string } | { kind: 'edit'; workspaceId: string; id: string };

/**
 * Reads `[workspaceId]` and `[id]` of a manage edit page. `pending` while the router
 * query is not populated yet (statically optimized pages render once with an empty query).
 */
export function resolveEntityRoute(query: ParsedUrlQuery): EntityRoute {
  const { workspaceId, id } = query;
  if (typeof workspaceId !== 'string' || typeof id !== 'string' || workspaceId === '' || id === '') return { kind: 'pending' };
  if (id === CREATE_ENTITY_ID) return { kind: 'create', workspaceId };
  return { kind: 'edit', workspaceId, id };
}

export type EntityLoader<T> = (workspaceId: string, id: string) => Promise<T | undefined>;

export interface EntityLoadCallbacks<T> {
  setEntity: (entity: T | undefined) => void;
  setLoading: (loading: boolean) => void;
}

/**
 * Effect body of {@link useEntityEditor}: loads the entity of an edit route and never
 * requests anything for the create route (`GET …/create` answers 404). Returns a cleanup
 * that drops a response arriving after the route changed.
 */
export function startEntityLoad<T>(route: EntityRoute, load: EntityLoader<T>, { setEntity, setLoading }: EntityLoadCallbacks<T>): (() => void) | undefined {
  if (route.kind === 'pending') return undefined;
  if (route.kind === 'create') {
    setEntity(undefined);
    setLoading(false);
    return undefined;
  }

  let active = true;
  setLoading(true);
  load(route.workspaceId, route.id)
    .then((entity) => {
      if (active) setEntity(entity);
    })
    .catch((error) => {
      // Loaders report their own errors; this only keeps the page out of an endless spinner.
      console.error('useEntityEditor -> load', error);
    })
    .finally(() => {
      if (active) setLoading(false);
    });
  return () => {
    active = false;
  };
}

/**
 * State of a manage edit page (`…/manage/<entity>/[id]`): loads the entity for an
 * existing id and starts empty for `create`.
 */
export function useEntityEditor<T>(load: EntityLoader<T>) {
  const router = useRouter();
  const route = resolveEntityRoute(router.query);
  const workspaceId = route.kind === 'pending' ? undefined : route.workspaceId;
  const id = route.kind === 'edit' ? route.id : undefined;

  const [entity, setEntity] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(
    () => startEntityLoad(route, load, { setEntity, setLoading }),
    // `load` is usually an inline closure; the route alone decides when to (re)load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route.kind, workspaceId, id],
  );

  return { entity, setEntity, loading, workspaceId, isCreate: route.kind === 'create' };
}
