import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { adminCreateWorkspaceHandler } from '@lib/workspace/adminCreateWorkspace';

/** Alias of `/api/admin/workspace` (master key only). */
export default withHttpMethods({
  [HTTPMethod.POST]: adminCreateWorkspaceHandler,
});
