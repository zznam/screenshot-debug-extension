import { workspacesSlice } from './workspaces.reducer.js';

export { workspacesPrivateAPI } from './workspaces-private.api.js';

export const workspacesReducer = workspacesSlice.reducer;

export { workspacesPublicAPI } from './workspaces-public.api.js';
