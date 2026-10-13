// לקוח ל-Zoom API.

// לקוח מינימלי ל-Zoom API (אפליקציית Server-to-Server OAuth).
//
// הגדרה: יוצרים אפליקציית "Server-to-Server OAuth" באתר https://marketplace.zoom.us, נותנים לה
// את ההרשאה meeting:write:meeting:admin (או meeting:write), מפעילים אותה, ושמים את שלושת
// המפתחות שלה ב-.env: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.
//
// הפגישות נוצרות בחשבון ה-Zoom שהאפליקציה שייכת לו ("users/me").
import { config } from '../../config.js';
import { HttpError } from '../../utils/httpError.js';

const TOKEN_URL = 'https://zoom.us/oauth/token';
const API_URL = 'https://api.zoom.us/v2';

// בודק אם שלושת מפתחות Zoom הוגדרו.
export const isZoomConfigured = () => Boolean(config.zoom.accountId && config.zoom.clientId && config.zoom.clientSecret);

// אסימון גישה של Zoom תקף לשעה; משתמשים באותו אסימון עד קצת לפני שהוא פג.
let cachedToken = null;

// מקבל אסימון גישה מ-Zoom (ושומר אותו לשימוש חוזר).
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

// יוצר פגישה מיידית ב-Zoom ומחזיר את הקישורים.
export async function createInstantMeeting({ topic, mode }) {
  const video = mode === 'video';
  const token = await getAccessToken();

  const res = await fetch(`${API_URL}/users/me/meetings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic,
      type: 1, // 1 = פגישה מיידית
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
