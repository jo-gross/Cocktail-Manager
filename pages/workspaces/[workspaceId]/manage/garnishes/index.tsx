import { Garnish, Role } from '@prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { ManageColumn } from '../../../../../components/ManageColumn';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Loading } from '../../../../../components/Loading';
import { useRouter } from 'next/router';
import { alertService } from '../../../../../lib/alertService';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import { FaPlus } from 'react-icons/fa';
import NextImage from '../../../../../components/NextImage';

export default function ManageGlassesOverviewPage() {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);

  const [garnishes, setGarnishes] = useState<Garnish[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshGarnishes = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/garnishes`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setGarnishes(body.data);
        } else {
          console.error('Garnishes -> fetchGarnishes', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Garnituren', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('Garnishes -> fetchGarnishes', error);
        alertService.error('Fehler beim Laden der Garnituren');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceId]);

  useEffect(() => {
    refreshGarnishes();
  }, [refreshGarnishes]);

  return (
    <ManageEntityLayout
      title={'Garnituren'}
      backLink={`/workspaces/${workspaceId}/manage`}
      actions={
        userContext.isUserPermitted(Role.MANAGER) ? (
          <Link href={`/workspaces/${workspaceId}/manage/garnishes/create`}>
            <div className={'btn btn-square btn-primary btn-sm md:btn-md'}>
              <FaPlus />
            </div>
          </Link>
        ) : undefined
      }
    >
      <div className={'card'}>
        <div className={'card-body'}>
          <div className="overflow-x-auto">
            <table className="table-compact table table-zebra w-full">
              <thead>
                <tr>
                  <th className=""></th>
                  <th className="">Name</th>
                  <th className="">Preis</th>
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
                ) : garnishes.length == 0 ? (
                  <tr>
                    <td colSpan={4} className={'text-center'}>
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  garnishes
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((garnish) => (
                      <tr className={'p-4'} key={garnish.id}>
                        <td>
                          <div className="flex items-center space-x-3">
                            <div className="mask mask-squircle h-12 w-12">
                              <NextImage
                                src={`/api/workspaces/${garnish.workspaceId}/garnishes/${garnish.id}/image`}
                                className={'h-12 w-12 bg-white object-contain'}
                                alt="Garnitur"
                                width={300}
                                height={300}
                                altComponent={<></>}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="font-bold">{garnish.name}</div>
                        </td>
                        <td>{garnish.price} €</td>
                        <ManageColumn entity={'garnishes'} id={garnish.id} onRefresh={refreshGarnishes} />
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
