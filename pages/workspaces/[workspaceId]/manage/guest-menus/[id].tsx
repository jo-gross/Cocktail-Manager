import { useRouter } from 'next/router';
import { Role } from '@generated/prisma/client';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { GuestMenuBuilder, GuestMenuBuilderSkeleton } from '@components/guest-menu/builder';

function GuestMenuBuilderPage() {
  const router = useRouter();
  const { workspaceId, id } = router.query;
  if (typeof workspaceId !== 'string' || typeof id !== 'string') return <GuestMenuBuilderSkeleton />;
  return <GuestMenuBuilder key={`${workspaceId}:${id}`} workspaceId={workspaceId} menuId={id} />;
}

export default withPagePermission([Role.MANAGER], GuestMenuBuilderPage, '/workspaces/[workspaceId]/manage');
