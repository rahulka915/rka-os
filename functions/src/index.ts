import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as jwt from 'jsonwebtoken';

// Apple Maps Server API requires a long-lived ES256 JWT (signed with the
// private key from a Maps ID in Apple Developer) to be exchanged for a
// short-lived access token via GET /v1/token. That private key must never
// ship inside the mobile app bundle — anyone could extract it and mint
// tokens under this project's identity indefinitely. Minting happens here,
// server-side, where the key lives only as a Cloud Functions secret; the
// client only ever receives the short-lived accessToken this returns
// (~30 min, per Apple's expiresInSeconds), never the signing key itself.
//
// Set these secrets once via:
//   firebase functions:secrets:set APPLE_MAPS_TEAM_ID
//   firebase functions:secrets:set APPLE_MAPS_KEY_ID
//   firebase functions:secrets:set APPLE_MAPS_PRIVATE_KEY   (paste the full .p8 contents, including the BEGIN/END lines)
const appleMapsTeamId = defineSecret('APPLE_MAPS_TEAM_ID');
const appleMapsKeyId = defineSecret('APPLE_MAPS_KEY_ID');
const appleMapsPrivateKey = defineSecret('APPLE_MAPS_PRIVATE_KEY');

interface AppleTokenResponse {
  accessToken: string;
  expiresInSeconds: number;
}

// Signs the self-authorizing Maps token (short exp — this JWT itself is only
// ever used once, immediately, to fetch the real access token, so it doesn't
// need a long lifetime the way the private key does).
function signMapsAuthToken(teamId: string, keyId: string, privateKey: string): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: teamId, iat: nowSeconds, exp: nowSeconds + 60 * 15 },
    privateKey,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: keyId, typ: 'JWT' } },
  );
}

export const getAppleMapsToken = onCall(
  { secrets: [appleMapsTeamId, appleMapsKeyId, appleMapsPrivateKey], cors: true },
  async () => {
    const teamId = appleMapsTeamId.value();
    const keyId = appleMapsKeyId.value();
    const privateKey = appleMapsPrivateKey.value();
    if (!teamId || !keyId || !privateKey) {
      throw new HttpsError('failed-precondition', 'Apple Maps credentials are not configured on the server.');
    }

    const authToken = signMapsAuthToken(teamId, keyId, privateKey);

    const response = await fetch('https://maps-api.apple.com/v1/token', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!response.ok) {
      throw new HttpsError('unavailable', `Apple Maps token exchange failed (${response.status}).`);
    }

    const body = (await response.json()) as AppleTokenResponse;
    return { accessToken: body.accessToken, expiresInSeconds: body.expiresInSeconds };
  },
);

// WeatherKit REST API — unlike Maps, there's no token-exchange step: the
// self-signed JWT itself IS the bearer token Apple accepts directly. This
// function is a full proxy (mints the JWT AND calls WeatherKit itself, then
// relays the JSON) rather than handing a token to the client the way Maps
// does — one call site, so there was no reason to add a second
// token-caching path on the client for a single-endpoint integration.
// WeatherKit's JWT shape genuinely differs from Maps': the header needs an
// `id` claim (`{teamId}.{bundleId}`, NOT the app's own field name doubling as
// `kid`) and the payload needs `sub` (the bundle/Services ID with WeatherKit
// enabled) — Maps' JWT has neither.
//
// Set these once (APPLE_TEAM_ID is already shared with the APNs setup):
//   firebase functions:secrets:set APPLE_WEATHERKIT_KEY_ID
//   firebase functions:secrets:set APPLE_WEATHERKIT_PRIVATE_KEY
const appleTeamId = defineSecret('APPLE_TEAM_ID');
const appleWeatherKitKeyId = defineSecret('APPLE_WEATHERKIT_KEY_ID');
const appleWeatherKitPrivateKey = defineSecret('APPLE_WEATHERKIT_PRIVATE_KEY');

const WEATHERKIT_BUNDLE_ID = 'com.rahul.rkaos';

function signWeatherKitToken(teamId: string, keyId: string, privateKey: string): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: teamId, sub: WEATHERKIT_BUNDLE_ID, iat: nowSeconds, exp: nowSeconds + 60 * 30 },
    privateKey,
    {
      algorithm: 'ES256',
      // `id` is WeatherKit-specific (not part of jsonwebtoken's JwtHeader
      // type, which only knows the standard JWT header fields) — cast is
      // required, this isn't a typo.
      header: { alg: 'ES256', kid: keyId, id: `${teamId}.${WEATHERKIT_BUNDLE_ID}` } as jwt.JwtHeader,
    },
  );
}

interface GetWeatherRequest {
  latitude: number;
  longitude: number;
  timezone?: string;
}

export const getWeather = onCall(
  { secrets: [appleTeamId, appleWeatherKitKeyId, appleWeatherKitPrivateKey], cors: true },
  async (request) => {
    const { latitude, longitude, timezone } = (request.data ?? {}) as GetWeatherRequest;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new HttpsError('invalid-argument', 'latitude and longitude are required.');
    }

    const teamId = appleTeamId.value();
    const keyId = appleWeatherKitKeyId.value();
    const privateKey = appleWeatherKitPrivateKey.value();
    if (!teamId || !keyId || !privateKey) {
      throw new HttpsError('failed-precondition', 'WeatherKit credentials are not configured on the server.');
    }

    const token = signWeatherKitToken(teamId, keyId, privateKey);
    const params = new URLSearchParams({
      dataSets: 'currentWeather',
      timezone: timezone || 'UTC',
    });
    const response = await fetch(
      `https://weatherkit.apple.com/api/v1/weather/en/${latitude}/${longitude}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new HttpsError('unavailable', `WeatherKit request failed (${response.status}): ${errorBody}`);
    }

    return response.json();
  },
);
