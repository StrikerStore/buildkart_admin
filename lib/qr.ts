import 'server-only';
import QRCode from 'qrcode';

/**
 * A QR code as SVG markup, drawn on the server so the authenticator secret it
 * carries goes to the browser once, inside this one image, and no QR library
 * ships in the client bundle.
 */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
