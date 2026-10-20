/** URL ảnh đại diện (qua rewrite /api của web). null: chưa có ảnh, giao diện hiện chữ cái đầu. */
export function avatarUrl(u: { id: string; avatarVersion: number }): string | null {
  return u.avatarVersion > 0 ? `/api/users/${u.id}/avatar?v=${u.avatarVersion}` : null;
}

/** Phần select dùng chung khi trả người dùng kèm ảnh đại diện. */
export const USER_BRIEF = { id: true, name: true, email: true, avatarVersion: true } as const;

/** { id, name, email, avatarVersion } → { id, name, email, avatarUrl } */
export function brief<T extends { id: string; avatarVersion: number }>({ avatarVersion, ...u }: T) {
  return { ...u, avatarUrl: avatarUrl({ id: u.id, avatarVersion }) };
}
