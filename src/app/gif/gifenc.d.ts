/*
  The three parts of gifenc this app uses, declared here because the package
  ships no types of its own.

  Imported from its ES-module build by path rather than by the package's name:
  the name resolves to a minified CommonJS build whose exports node cannot see,
  and the unit tests run straight under node.
*/
declare module "gifenc/dist/gifenc.esm.js" {
  export type Palette = number[][];

  export interface GifFrameOptions {
    palette?: Palette;
    /** In milliseconds; written in hundredths of a second. */
    delay?: number;
    transparent?: boolean;
    transparentIndex?: number;
    /** 0 forever, -1 once. */
    repeat?: number;
    /** GIF disposal: 1 leaves the frame in place for the next to draw over. */
    dispose?: number;
  }

  export interface GifEncoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: GifFrameOptions
    ): void;
    finish(): void;
    /** A copy of what has been written, in a buffer of its own. */
    bytes(): Uint8Array<ArrayBuffer>;
    bytesView(): Uint8Array;
  }

  export function GIFEncoder(): GifEncoder;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number
  ): Palette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette
  ): Uint8Array;
}
