import { Role } from '@prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { ManageColumn } from '../../../../../components/ManageColumn';
import React, { useContext, useEffect, useState } from 'react';
import { Loading } from '../../../../../components/Loading';
import { useRouter } from 'next/router';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import { FaPlus } from 'react-icons/fa';
import ListSearchField from '../../../../../components/ListSearchField';
import { GarnishModel } from '../../../../../models/GarnishModel';
import AvatarImage from '../../../../../components/AvatarImage';
import { fetchGarnishes } from '../../../../../lib/network/garnishes';
import ImageModal from '../../../../../components/modals/ImageModal';
import { ModalContext } from '../../../../../lib/context/ModalContextProvider';

export default function ManageGlassesOverviewPage() {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [garnishes, setGarnishes] = useState<GarnishModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterString, setFilterString] = useState('');

  useEffect(() => {
    fetchGarnishes(workspaceId, setGarnishes, setLoading);
  }, [workspaceId]);

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
          <ListSearchField onFilterChange={(filterString) => setFilterString(filterString)} />
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
                ) : garnishes.filter((garnish) => garnish.name.toLowerCase().includes(filterString.toLowerCase())).length == 0 ? (
                  <tr>
                    <td colSpan={4} className={'text-center'}>
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  garnishes
                    .filter((garnish) => garnish.name.toLowerCase().includes(filterString.toLowerCase()))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((garnish) => (
                      <tr className={'p-4'} key={garnish.id}>
                        <td>
                          <div className="flex items-center space-x-3">
                            <div className={'h-12 w-12'}>
                              {garnish._count.GarnishImage == 0 ? (
                                <></>
                              ) : (
                                <div
                                  className="h-12 w-12 cursor-pointer"
                                  onClick={() =>
                                    modalContext.openModal(<ImageModal image={`/api/workspaces/${garnish.workspaceId}/garnishes/${garnish.id}/image`} />)
                                  }
                                >
                                  <AvatarImage src={`/api/workspaces/${garnish.workspaceId}/garnishes/${garnish.id}/image`} alt="Garnitur" />
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="font-bold">{garnish.name}</div>
                        </td>
                        <td>{garnish.price ?? '-'} €</td>
                        <ManageColumn entity={'garnishes'} id={garnish.id} onRefresh={() => fetchGarnishes(workspaceId, setGarnishes, setLoading)} />
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
