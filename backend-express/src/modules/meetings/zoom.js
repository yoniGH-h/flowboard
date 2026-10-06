// A minimal Zoom API client (Server-to-Server OAuth app).
//
// Setup: create a "Server-to-Server OAuth" app at https://marketplace.zoom.us, give it the
// meeting:write:meeting:admin (or meeting:write) scope, activate it, and put its three
// credentials in .env: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.
//
// Meetings are created on the Zoom account that owns the app ("users/me").
import { config } from '../../config.js';
import { HttpError } from '../../utils/httpError.js';

const TOKEN_URL = 'https://zoom.us/oauth/token';
const API_URL = 'https://api.zoom.us/v2';

export const isZoomConfigured = () => Boolean(config.zoom.accountId && config.zoom.clientId && config.zoom.clientSecret);

// Zoom access tokens live for an hour; reuse one until shortly before it expires.
let cachedToken = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const basic = Buffer.from(`${config.zoom.clientId}:${config.zoom.clientSecret}`).toString('base64');
  const url = `${TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(config.zoom.accountId)}`;
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Basic ${basic}` } });
  if (!res.ok) {
    console.error('Zoom token request failed:', res.status, await res.text());
    throw new HttpError(502, 'Could not sign in to Zoom - check the ZOOM_* settings in .env');
  }

  const body = await res.json();
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

// Creates an instant meeting. mode 'voice' starts with every camera off.
// Returns { id, joinUrl, startUrl } - startUrl lets the host in without signing in to
// Zoom, so it must only ever be given to the person who started the call.
export async function createInstantMeeting({ topic, mode }) {
  const video = mode === 'video';
  const token = await getAccessToken();

  const res = await fetch(`${API_URL}/users/me/meetings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic,
      type: 1, // 1 = instant meeting
      settings: {
        host_video: video,
        participant_video: video,
        join_before_host: true,
        waiting_room: false,
        audio: 'voip',
      },
    }),
  });
  if (!res.ok) {
    console.error('Zoom create-meeting failed:', res.status, await res.text());
    throw new HttpError(502, 'Zoom could not create the meeting. Please try again.');
  }

  const meeting = await res.json();
  return { id: meeting.id, joinUrl: meeting.join_url, startUrl: meeting.start_url };
}
