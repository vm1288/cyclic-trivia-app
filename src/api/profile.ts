import { API_BASE_URL, API_TIMEOUT_MS } from './config';

/**
 * Hồ sơ người chơi xuyên ván (mockup V6, Tony 2/10) - server `ProfileApiController`.
 *
 * Xác thực bằng header `X-Profile-Token`, KHÔNG phải `Authorization: Bearer` của licence/ghế:
 * đi qua `client.ts` thì một 401 ở đây sẽ kích hoạt bộ làm mới token LICENCE - sai hẳn chỗ.
 * 401 ở đây nghĩa là tài khoản đã đăng nhập trên máy khác (hoặc logout) → tạo hồ sơ khách mới.
 */

export type Profile = {
  id: string;
  nickName: string;
  avatarId: string;
  /** Đường tương đối trên server (`/images/character/lion-0.png`) - ghép bằng `assetUrl`. */
  avatarUrl: string;
  email: string | null;
};

export type ProfileGameStats = {
  sponsorId: string;
  name: string;
  logoUrl: string | null;
  played: number;
  won: number;
  /** Null = chưa chơi ván Leaderboard nào ở game này. */
  rank: number | null;
  score: number | null;
};

export type LeaderboardGame = { sponsorId: string; name: string; logoUrl: string | null };

export type LeaderboardEntry = {
  rank: number | null;
  nickName: string;
  avatarUrl: string;
  score: number | null;
  isMe: boolean;
};

export type ProfileResult<T> =
  | ({ ok: true } & T)
  | { ok: false; signedOut: boolean; errorCode?: string; network?: boolean };

async function call<T>(method: 'GET' | 'POST', path: string, token: string | null, body?: unknown): Promise<ProfileResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(API_BASE_URL + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { 'X-Profile-Token': token } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as ({ isSuccess?: boolean; errorCode?: string } & T) | null;
    if (res.status === 401) return { ok: false, signedOut: true, errorCode: json?.errorCode };
    if (!res.ok || !json) return { ok: false, signedOut: false, network: !res.ok && res.status >= 500 };
    if (json.isSuccess === false) return { ok: false, signedOut: false, errorCode: json.errorCode };
    return { ok: true, ...json };
  } catch {
    return { ok: false, signedOut: false, network: true };
  } finally {
    clearTimeout(timer);
  }
}

export const createGuest = (deviceId: string) =>
  call<{ token: string; profile: Profile }>('POST', '/api/profile/guest', null, { deviceId });

export const getMe = (token: string) =>
  call<{ profile: Profile; avatars: { id: string; url: string }[] }>('GET', '/api/profile/me', token);

export const setNickName = (token: string, nickName: string) =>
  call<{ profile: Profile }>('POST', '/api/profile/nickname', token, { nickName });

export const setAvatar = (token: string, avatarId: string) =>
  call<{ profile: Profile }>('POST', '/api/profile/avatar', token, { avatarId });

export const getProfileGames = (token: string) =>
  call<{ games: ProfileGameStats[] }>('GET', '/api/profile/games', token);

export const getLeaderboardGames = () =>
  call<{ games: LeaderboardGame[] }>('GET', '/api/leaderboards', null);

export const getLeaderboard = (sponsorId: string, token: string | null, top = 100) =>
  call<{ top: LeaderboardEntry[]; me: LeaderboardEntry | null }>('GET', `/api/leaderboards/${sponsorId}?top=${top}`, token);

export type EmailMode = 'register' | 'login';

/** Gửi mã 6 số tới email (Register Account / Login with Existing Account - mockup V6 slide 7-8). */
export const requestEmailCode = (token: string | null, email: string, mode: EmailMode) =>
  call<{}>('POST', '/api/profile/email/request', token, { email, mode });

/** register → email gắn vào hồ sơ đang dùng; login → token MỚI của hồ sơ đó (máy cũ bị đăng xuất). */
export const verifyEmailCode = (token: string | null, email: string, mode: EmailMode, code: string, deviceId: string) =>
  call<{ token: string | null; profile: Profile }>('POST', '/api/profile/email/verify', token, { email, mode, code, deviceId });

export const logoutProfile = (token: string) => call<{}>('POST', '/api/profile/logout', token, {});
