declare module "qrcode" {
  interface QrOptions {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    type?: "svg" | "png" | "utf8" | "terminal";
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  interface QrCode {
    modules: {
      size: number;
      get(row: number, col: number): boolean;
    };
  }

  const QRCode: {
    create(payload: string, options?: QrOptions): QrCode;
    toString(payload: string, options?: QrOptions): Promise<string>;
    toDataURL(payload: string, options?: QrOptions): Promise<string>;
    toBuffer(
      payload: string,
      options: QrOptions,
      callback: (err: Error | null, buffer: Buffer) => void,
    ): void;
  };

  export default QRCode;
}
