export interface AuthUser {
  sub: string;
  email: string;
  vaultId: string;
  role: 'owner' | 'member';
  displayName: string;
}
