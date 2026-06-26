import { QRCodeSVG } from 'qrcode.react';

interface Props {
  url: string;
  isDeviceConnected: boolean;
}

export function QRModal({ url, isDeviceConnected }: Props) {
  if (!url || isDeviceConnected) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">Scan to Connect</h2>

        <div className="qr-container">
          <QRCodeSVG value={url} size={200} level="M" />
        </div>

        <p className="modal-url">{url}</p>

        <div className="instructions">
          <ol>
            <li>Open <strong>Expo Go</strong> on your iPhone</li>
            <li>Tap the <strong>Scan QR Code</strong> button</li>
            <li>Point the camera at this QR code</li>
            <li>Your app will load automatically</li>
          </ol>
        </div>

        <p className="connecting-hint">Waiting for device connection…</p>
      </div>
    </div>
  );
}
