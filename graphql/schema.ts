import './types/User';
import './types/Workspace';
import './types/WorkspaceUser';
import './types/Glass';

import { builder } from './builder';

export const schema = builder.toSchema();
