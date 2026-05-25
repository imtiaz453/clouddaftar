declare module "bwip-js" {
  interface ToSvgOptions {
    bcid: string;
    text: string;
    scaleX?: number;
    scaleY?: number;
    height?: number;
    includetext?: boolean;
    textxalign?: string;
  }

  const bwipjs: {
    toSVG(options: ToSvgOptions): string;
  };

  export default bwipjs;
}
