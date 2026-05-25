// QR rendering service using qrcode library
import QRCode from "qrcode";

export type QrFormat = "svg" | "dataUri" | "buffer";

export interface QrOptions {
  width?: number;
  margin?: number;
  color?: { dark?: string; light?: string };
}

export async function renderQrSvg(payload: string, opts?: QrOptions): Promise<string> {
  return QRCode.toString(payload, {
    type: "svg",
    width: opts?.width ?? 200,
    margin: opts?.margin ?? 1,
    color: opts?.color ?? { dark: "#000000", light: "#ffffff" },
  });
}

export async function renderQrDataUri(payload: string, opts?: QrOptions): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: opts?.width ?? 200,
    margin: opts?.margin ?? 1,
    color: opts?.color ?? { dark: "#000000", light: "#ffffff" },
  });
}

export async function renderQrBuffer(payload: string, opts?: QrOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    QRCode.toBuffer(payload, {
      type: "png",
      width: opts?.width ?? 200,
      margin: opts?.margin ?? 1,
      color: opts?.color ?? { dark: "#000000", light: "#ffffff" },
    }, (err, buf) => {
      if (err) reject(err);
      else resolve(buf);
    });
  });
}
