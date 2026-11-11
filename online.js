export const OFFICIAL_PLAY_URL = 'https://poke2darena.com/play-online/';

// This is an observed integration limit, not a live server-health check.
export const ONLINE_STATUS = Object.freeze({
  directAvailable: false,
  checkedAt: '2026-11-11',
  officialUrl: OFFICIAL_PLAY_URL,
  summary: 'Online battles open in the official game.',
  detail: 'The official server rejected requests from a tested GitHub Pages origin. Direct play here requires the server operator to allow this site.',
});

/** Validate an invitation without changing its query parameters or fragment. */
export function validateInviteUrl(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Paste a complete Poke2D Arena invitation link.');
  }

  const invitation = value.trim();
  if (!/^https:\/\//iu.test(invitation) || /[\u0000-\u001f\u007f\\]/u.test(invitation)) {
    throw new TypeError('Paste a complete Poke2D Arena invitation link.');
  }

  let url;
  try {
    url = new URL(invitation);
  } catch {
    throw new TypeError('Paste a complete link starting with https://poke2darena.com/play-online/.');
  }

  if (
    url.origin !== 'https://poke2darena.com' ||
    url.username ||
    url.password ||
    !url.pathname.startsWith('/play-online/')
  ) {
    throw new TypeError('Use an invitation from https://poke2darena.com/play-online/.');
  }

  return invitation;
}

/** Use the result as an anchor href so launching stays an explicit user action. */
export function createOfficialPlayLink({ inviteUrl = '' } = {}) {
  if (typeof inviteUrl === 'string' && inviteUrl.trim() === '') {
    return OFFICIAL_PLAY_URL;
  }
  return validateInviteUrl(inviteUrl);
}
