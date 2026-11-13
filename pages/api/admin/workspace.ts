import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { adminCreateWorkspaceHandler } from '@lib/workspace/adminCreateWorkspace';

/** Master key only: creates an empty workspace with defaults and a join code. */
export default withHttpMethods({
  [HTTPMethod.POST]: adminCreateWorkspaceHandler,
});
