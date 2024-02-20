import { Role } from '@prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { ManageColumn } from '../../../../../components/ManageColumn';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Loading } from '../../../../../components/Loading';
import { useRouter } from 'next/router';
import { alertService } from '../../../../../lib/alertService';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import DefaultGlassIcon from '../../../../../components/DefaultGlassIcon';
import { FaPlus } from 'react-icons/fa';
import ListSearchField from '../../../../../components/ListSearchField';
import { GlassModel } from '../../../../../models/GlassModel';
import AvatarImage from '../../../../../components/AvatarImage';

export default function ManageGlassesOverviewPage() {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);

  const [glasses, setGlasses] = useState<GlassModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterString, setFilterString] = useState('');

  const refreshGlasses = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/glasses`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setGlasses(body.data);
        } else {
          console.error('Glasses -> fetchGlasses', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Gläser', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('Glasses -> fetchGlasses', error);
        alertService.error('Fehler beim Laden der Gläser');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceId]);

  useEffect(() => {
    refreshGlasses();
  }, [refreshGlasses]);

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title={'Gläser'}
      actions={
        userContext.isUserPermitted(Role.MANAGER) ? (
          <Link href={`/workspaces/${workspaceId}/manage/glasses/create`}>
            <div className={'btn btn-square btn-primary btn-sm md:btn-md'}>
              <FaPlus />
            </div>
          </Link>
        ) : undefined
      }
    >
      <div className={'card'}>
        <div className={'card-body'}>
          <ListSearchField onFilterChange={(filterString) => setFilterString(filterString)} />
          <div className="overflow-x-auto">
            <table className="table-compact table table-zebra w-full">
              <thead>
                <tr>
                  <th className=""></th>
                  <th className="">Name</th>
                  <th className="">Pfand</th>
                  <th className="flex justify-end"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4}>
                      <Loading />
                    </td>
                  </tr>
                ) : glasses.filter((glass) => glass.name.toLowerCase().includes(filterString.toLowerCase())).length == 0 ? (
                  <tr>
                    <td colSpan={4} className={'text-center'}>
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  glasses
                    .filter((glass) => glass.name.toLowerCase().includes(filterString.toLowerCase()))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((glass) => (
                      <tr className={'p-4'} key={glass.id}>
                        <td>
                          <div className="flex items-center space-x-3">
                            <div className="mask mask-squircle h-12 w-12">
                              {glass._count?.GlassImage == 0 ? (
                                <DefaultGlassIcon />
                              ) : (
                                <AvatarImage
                                  src={`/api/workspaces/${glass.workspaceId}/glasses/${glass.id}/image`}
                                  alt="Glass"
                                  altComponent={<DefaultGlassIcon />}
                                />
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="font-bold">{glass.name}</div>
                        </td>
                        <td>{glass.deposit} €</td>
                        <ManageColumn entity={'glasses'} id={glass.id} onRefresh={refreshGlasses} />
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ManageEntityLayout>
  );
}
