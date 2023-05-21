import { Glass } from '@prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '../../../components/layout/ManageEntityLayout';
import { ManageColumn } from '../../../components/ManageColumn';
import { useEffect, useState } from 'react';
import { Loading } from '../../../components/Loading';

export default function ManageGlassesOverviewPage() {
  const [glasses, setGlasses] = useState<Glass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/glasses')
      .then((response) => response.json())
      .then((data) => {
        setGlasses(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <ManageEntityLayout backLink={'/manage'} title={'Gläser'}>
      <div className={'card'}>
        <div className={'card-body'}>
          <div className="overflow-x-auto">
            <table className="table table-compact w-full">
              <thead>
                <tr>
                  <th className="">Name</th>
                  <th className="">Pfand</th>
                  <th className="flex justify-end">
                    <Link href={'/manage/glasses/create'}>
                      <div className={'btn btn-primary btn-sm'}>Hinzufügen</div>
                    </Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3}>
                      <Loading />
                    </td>
                  </tr>
                ) : glasses.length == 0 ? (
                  <tr>
                    <td colSpan={3} className={'text-center'}>
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  glasses.map((glass) => (
                    <tr className={'p-4'} key={glass.id}>
                      <td>
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 mask-squircle mask">
                            <img
                              className={'w-fit h-full mr-2 object-contain'}
                              src={glass.image ?? '/images/glasses/default-glass.png'}
                              alt="Avatar Tailwind CSS Component"
                            />
                          </div>
                          <div className="font-bold">{glass.name}</div>
                        </div>
                      </td>
                      <td>{glass.deposit} €</td>
                      <ManageColumn entity={'glasses'} id={glass.id} />
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
