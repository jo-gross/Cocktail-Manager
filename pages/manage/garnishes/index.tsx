import { Garnish } from '@prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '../../../components/layout/ManageEntityLayout';
import { ManageColumn } from '../../../components/ManageColumn';
import { useEffect, useState } from 'react';
import { Loading } from '../../../components/Loading';

export default function ManageGlassesOverviewPage() {
  const [garnishes, setGarnishes] = useState<Garnish[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/garnishes')
      .then((response) => response.json())
      .then((data) => {
        setGarnishes(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <ManageEntityLayout title={'Garnituren'} backLink={'/manage'}>
      <div className={'card'}>
        <div className={'card-body'}>
          <div className="overflow-x-auto">
            <table className="table table-compact w-full">
              <thead>
                <tr>
                  <th className="">Name</th>
                  <th className="">Preis</th>
                  <th className="flex justify-end">
                    <Link href={'/manage/garnishes/create'}>
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
                ) : garnishes.length == 0 ? (
                  <tr>
                    <td colSpan={3} className={'text-center'}>
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  garnishes
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((garnish) => (
                      <tr className={'p-4'} key={garnish.id}>
                        <td>
                          <div className="font-bold">{garnish.name}</div>
                        </td>
                        <td>{garnish.price} €</td>
                        <ManageColumn entity={'garnishes'} id={garnish.id} />
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
