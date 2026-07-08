// Body/hair/shoulders/scarf silhouette traced from a flat-vector character sheet generated
// by Codex per CODEX_FLAT_VECTOR_BRIEF.md (Ronin References/CODEX_FLAT_VECTOR_BRIEF.md),
// via ImageMagick outline-threshold + flood-fill isolate + potrace. The lower body/knee
// outline was too faint to trace cleanly, so knees are still a hand-drawn accent below.
import type { RoninMood } from '../../utils/roninMood';

const SCARF_COLOR = '#9c2a1f';
const EYE_COLOR = '#fff2dc';

const DEFS = `<defs>
 <linearGradient id="cloakGrad" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0" stop-color="#4a3c30"/><stop offset="35%" stop-color="#2a221b"/><stop offset="100%" stop-color="#0a0806"/></linearGradient>
 <radialGradient id="aura" cx="50%" cy="44%" r="55%"><stop offset="0" stop-color="#ff9d2e" stop-opacity=".28"/><stop offset=".3" stop-color="#ff9d2e" stop-opacity=".2"/><stop offset=".65" stop-color="#ff9d2e" stop-opacity=".08"/><stop offset="1" stop-color="#ff9d2e" stop-opacity="0"/></radialGradient>
 <radialGradient id="shadow" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#000" stop-opacity=".65"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>`;

const aura = (opacity: number) => `<ellipse cx="510" cy="740" rx="470" ry="640" fill="url(#aura)" opacity="${opacity}"/>`;
const shadowEllipse = `<ellipse cx="510" cy="1630" rx="360" ry="60" fill="url(#shadow)"/>`;
const eyes = `<g fill="${EYE_COLOR}"><ellipse cx="357" cy="521" rx="36" ry="24"/><ellipse cx="561" cy="521" rx="36" ry="24"/></g>`;
const scarfAccent = `<g fill="${SCARF_COLOR}" opacity=".92"><path d="M300 650 C380 615 570 615 660 655 C670 705 640 745 570 735 C480 745 400 745 330 725 C295 700 285 670 300 650 Z"/><path d="M650 660 C760 630 870 675 960 750 C860 745 780 765 700 810 Z"/><path d="M660 720 C770 730 870 780 970 855 C870 850 790 845 705 855 Z"/></g>`;
const kneeFolds = `<g fill="none" stroke="#000" stroke-opacity=".35" stroke-width="12" stroke-linecap="round"><path d="M250 1400 C330 1355 420 1350 475 1405"/><path d="M770 1400 C690 1355 600 1350 545 1405"/></g>`;
const sword = `<g fill="#c58a37" opacity=".85"><path d="M155 1305 L775 1220 L775 1244 L155 1330 Z"/><rect x="115" y="1285" width="52" height="38" rx="9" fill="#3a2a15"/><rect x="163" y="1278" width="13" height="53" rx="5"/></g>`;

// NOTE: sibling top-level elements are joined with newlines deliberately (see prior debugging —
// zero-whitespace-adjacent tags caused some renderers to mis-parse the document).
// Rim-light is a *separate* stroke-only duplicate of the body, not a stroke on the same fill
// element — combining fill+stroke on this many-subpath compound path silently dropped the fill.
function svg(innerParts: string[]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1020 1680">${DEFS}
${innerParts.join("\n")}
</svg>`;
}

const BODY = `<g transform="translate(0.000000,1680.000000) scale(0.100000,-0.100000)" fill="url(#cloakGrad)"><path d="M1 11953 l0 -4848 137 -67 c165 -80 260 -123 327 -149 28 -11 64 -26 80 -33 17 -7 46 -19 65 -26 19 -7 64 -26 100 -42 128 -58 148 -50 201 77 36 86 38 95 39 200 0 175 39 286 165 476 78 115 94 153 106 239 5 36 36 166 69 290 85 317 107 402 130 505 88 388 218 750 325 902 27 37 99 120 161 183 126 129 134 145 134 272 0 42 5 90 12 105 28 64 134 205 229 303 81 83 102 110 102 133 0 42 -32 69 -88 72 -84 6 -151 92 -174 224 -21 123 -59 126 -175 12 -49 -47 -92 -81 -104 -81 -13 0 -31 17 -52 49 -37 59 -52 142 -44 246 10 124 -20 156 -115 124 -84 -29 -217 -42 -291 -29 -63 11 -136 49 -146 75 -11 28 15 53 68 64 60 13 100 36 147 85 45 46 45 80 0 119 -184 159 -240 255 -284 483 -21 108 -19 228 6 364 11 63 21 124 20 134 -1 43 -24 50 -184 58 -153 8 -233 25 -275 60 -9 8 -30 22 -45 32 -37 22 -35 67 3 78 176 51 204 62 277 110 91 61 244 205 266 250 14 29 14 36 -4 80 -11 29 -19 73 -19 108 0 69 26 277 42 335 70 256 147 447 270 669 81 146 73 163 -87 170 -154 7 -214 24 -313 90 -77 52 -68 108 14 89 121 -28 303 11 446 96 132 78 248 173 458 377 316 307 483 446 693 578 196 122 490 249 687 296 52 12 113 28 135 34 45 14 68 47 56 80 -16 43 -42 47 -263 40 -192 -6 -208 -5 -214 11 -8 21 5 46 32 60 11 6 40 22 64 36 106 62 302 126 485 159 75 13 291 9 401 -8 154 -24 356 -114 478 -213 72 -58 117 -108 195 -211 60 -81 84 -81 155 -2 89 101 255 215 385 265 131 51 234 69 394 69 127 0 158 -4 260 -29 138 -36 242 -77 319 -128 74 -49 148 -118 148 -137 0 -29 -31 -35 -81 -16 -69 28 -191 45 -314 45 -119 0 -162 -12 -176 -51 -15 -41 11 -66 91 -91 363 -113 734 -333 1009 -598 90 -87 235 -249 411 -459 99 -118 233 -249 309 -301 70 -48 190 -104 243 -113 37 -7 43 -11 43 -32 0 -51 -111 -75 -224 -49 -25 5 -76 23 -113 40 -61 27 -71 28 -95 17 -44 -22 -44 -44 3 -161 125 -310 207 -683 181 -817 -11 -52 -2 -86 53 -203 120 -257 317 -459 520 -533 90 -33 100 -40 100 -70 0 -29 -48 -66 -115 -88 -73 -23 -230 -37 -311 -27 -124 15 -143 -9 -108 -133 65 -229 52 -436 -38 -606 -17 -30 -43 -69 -60 -87 -62 -65 -24 -125 107 -165 38 -12 76 -26 83 -31 22 -17 13 -45 -25 -75 -56 -43 -136 -63 -249 -61 -124 2 -131 -4 -124 -104 12 -184 0 -256 -53 -314 -37 -41 -59 -30 -115 57 -56 86 -84 106 -127 90 -32 -12 -40 -33 -54 -144 -13 -95 -45 -172 -108 -258 -36 -49 -61 -59 -83 -33 -10 12 -11 24 -1 56 11 36 10 45 -13 94 -15 29 -26 58 -26 63 0 17 -40 45 -65 45 -37 -1 -52 -18 -65 -76 -15 -66 -43 -145 -70 -194 -25 -48 -20 -64 44 -134 28 -31 58 -66 66 -78 12 -17 30 -24 80 -31 193 -25 378 -121 610 -316 63 -53 129 -103 147 -110 63 -27 188 -14 340 36 89 28 441 193 519 243 53 33 247 132 372 191 344 160 676 207 977 138 72 -17 167 -44 213 -60 l82 -31 0 3210 0 3209 -5100 0 -5100 0 1 -4847z"/></g>`;
function rimLayer(bodyXml: string): string {
  return bodyXml.replace('fill="url(#cloakGrad)"', 'fill="none" stroke="#ffb347" stroke-opacity=".35" stroke-width="5"');
}

// Posture offsets per mood (px, in this viewBox scale) layered on top of the shared BODY shape —
// only one pose has been traced so far (see README note above); moods differ by posture/eyes/aura.
const POSTURE: Record<RoninMood, number> = { normal: 0, alert: -10, tired: 14, focused: 0, overwhelmed: 26, resolved: -6 };

function bodyAt(dy: number): string {
  return dy === 0 ? BODY : BODY.replace('<g transform="', '<g transform="translate(0 ' + dy + ')" ><g transform="') + '</g>';
}

export const RONIN_STATE_XML: Record<RoninMood, string> = {
  normal: svg([aura(0.8), shadowEllipse, bodyAt(POSTURE.normal), kneeFolds, sword, rimLayer(bodyAt(POSTURE.normal)), eyes, scarfAccent]),
  alert: svg([aura(0.8), shadowEllipse, bodyAt(POSTURE.alert), kneeFolds, sword, rimLayer(bodyAt(POSTURE.alert)), eyes, scarfAccent]),
  tired: svg([aura(0.8), shadowEllipse, bodyAt(POSTURE.tired), kneeFolds, sword, rimLayer(bodyAt(POSTURE.tired)), eyes, scarfAccent]),
  focused: svg([aura(0.8), shadowEllipse, bodyAt(POSTURE.focused), kneeFolds, sword, rimLayer(bodyAt(POSTURE.focused)), eyes, scarfAccent]),
  overwhelmed: svg([aura(0.8), shadowEllipse, bodyAt(POSTURE.overwhelmed), kneeFolds, sword, rimLayer(bodyAt(POSTURE.overwhelmed)), eyes, scarfAccent]),
  resolved: svg([aura(0.8), shadowEllipse, bodyAt(POSTURE.resolved), kneeFolds, sword, rimLayer(bodyAt(POSTURE.resolved)), eyes, scarfAccent]),
};

export const RONIN_GLOW_XML = svg([aura(0.8)]);