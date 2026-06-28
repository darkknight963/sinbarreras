export type AccessScope = {
  ownerId: string | null;
  includeAll: boolean;
};

type ScopedUser = {
  id: string;
  role?: string | null;
} | null | undefined;

type ScopedRequest = {
  authMode?: string;
} | null | undefined;

export const isSuperadmin = (user: ScopedUser) => (user?.role?.toLowerCase() || '') === 'superadmin';

export const resolveAccessScope = (request: ScopedRequest, user: ScopedUser): AccessScope => {
  const includeAll = request?.authMode === 'service' || isSuperadmin(user);
  return {
    ownerId: includeAll ? null : user?.id ?? null,
    includeAll,
  };
};
