import type { PermFlags, FlagKey } from '@/types/sftp';

/** 将权限数字转为标志对象 */
export function permToFlags(perm: string): PermFlags {
  const num = parseInt(perm, 8);
  if (isNaN(num))
    return {
      ur: false,
      uw: false,
      ux: false,
      gr: false,
      gw: false,
      gx: false,
      or: false,
      ow: false,
      ox: false,
    };
  return {
    ur: !!(num & 0o400),
    uw: !!(num & 0o200),
    ux: !!(num & 0o100),
    gr: !!(num & 0o040),
    gw: !!(num & 0o020),
    gx: !!(num & 0o010),
    or: !!(num & 0o004),
    ow: !!(num & 0o002),
    ox: !!(num & 0o001),
  };
}

/** 将标志对象转为权限数字 */
export function flagsToPerm(flags: PermFlags): string {
  const num =
    (flags.ur ? 0o400 : 0) |
    (flags.uw ? 0o200 : 0) |
    (flags.ux ? 0o100 : 0) |
    (flags.gr ? 0o040 : 0) |
    (flags.gw ? 0o020 : 0) |
    (flags.gx ? 0o010 : 0) |
    (flags.or ? 0o004 : 0) |
    (flags.ow ? 0o002 : 0) |
    (flags.ox ? 0o001 : 0);
  return num.toString(8).padStart(3, '0');
}

/** 所有权限标志键名 */
export const ALL_FLAG_KEYS: FlagKey[] = ['ur', 'uw', 'ux', 'gr', 'gw', 'gx', 'or', 'ow', 'ox'];
