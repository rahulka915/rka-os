import { QRCodeSVG } from 'qrcode.react';

interface Props {
  url: string | null;
}

export function QRPanel({ url }: Props) {
  if (!url) return null;

  return (
    <div className="qr-panel">
      <QRCodeSVG value={url} size={180} level="M" />
      <p className="qr-url">{url}</p>
      <button
        className="btn-secondary"
        onClick={() => navigator.clipboard.writeText(url)}
      >
        Copy URL
      </button>
    </div>
  );
}
