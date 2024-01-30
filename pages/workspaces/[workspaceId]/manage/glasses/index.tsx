import { Glass, Role } from '@prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { ManageColumn } from '../../../../../components/ManageColumn';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Loading } from '../../../../../components/Loading';
import { useRouter } from 'next/router';
import { alertService } from '../../../../../lib/alertService';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import DefaultGlassIcon from '../../../../../components/DefaultGlassIcon';
import { FaPlus } from 'react-icons/fa';
import NextImage from '../../../../../components/NextImage';

export default function ManageGlassesOverviewPage() {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);

  const [glasses, setGlasses] = useState<Glass[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshGlasses = useCallback(() => {
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}/glasses`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setGlasses(body.data);
        } else {
          console.log('Glasses -> fetchGlasses', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((err) => alertService.error(err.message))
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
                ) : glasses.length == 0 ? (
                  <tr>
                    <td colSpan={4} className={'text-center'}>
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  glasses.map((glass) => (
                    <tr className={'p-4'} key={glass.id}>
                      <td>
                        <div className="flex items-center space-x-3">
                          <div className="mask mask-squircle h-12 w-12">
                            <NextImage
                              src={`/api/workspaces/${glass.workspaceId}/glasses/${glass.id}/image`}
                              className={'h-12 w-12 bg-white object-contain'}
                              alt="Glass"
                              width={300}
                              height={300}
                              altComponent={<DefaultGlassIcon />}
                            />
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
