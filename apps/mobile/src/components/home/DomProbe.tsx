'use dom';

// Minimal DOM-component runtime check for the __DEV__ bench on ProfileScreen:
// if this renders visibly, the dev client's dom-webview pipeline (native
// view → web bundle → React DOM) works end-to-end. Confirmed working on the
// installed client 2026-07-09; kept as a bench canary for future clients.
import type { DOMProps } from 'expo/dom';

export default function DomProbe(_props: { dom?: DOMProps }) {
  console.log('[DOM_PROBE] OK — rendering inside DOM component webview');
  return (
    <div
      style={{
        background: '#16a34a',
        color: '#fff',
        padding: '6px 10px',
        borderRadius: 8,
        fontFamily: 'system-ui',
        fontSize: 13,
        textAlign: 'center',
      }}
    >
      DOM OK
    </div>
  );
}
