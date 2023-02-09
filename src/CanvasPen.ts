/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

import { Pen } from './types';

export class CanvasPen implements Pen {
  private ctx: CanvasRenderingContext2D;
  private lastx: number | undefined;
  private lasty: number | undefined;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }
  moveTo(x: number, y: number) {
    this.ctx.moveTo(x, y);
    this.lastx = x;
    this.lasty = y;
  }
  arcTo(x: number, y: number, turn: number) {
    if (this.lastx == undefined || this.lasty == undefined) {
      throw new Error('CanvasPen - arc/line with no current point');
    }
    const absTurn = Math.abs(turn);
    if (absTurn < 0.00001) {
      this.ctx.lineTo(x, y);
    } else {
      const sinHalf = Math.sin(absTurn * 0.5);
      const tanHalf = sinHalf / Math.cos(absTurn * 0.5);
      const yfac = turn <= 0.0 ? 1.0 : -1.0;
      const dx = x - this.lastx;
      const dy = y - this.lasty;
      const px = this.lastx + (dx - dy * tanHalf * yfac) * 0.5;
      const py = this.lasty + (dy + dx * tanHalf * yfac) * 0.5;
      const r = (Math.sqrt(dx * dx + dy * dy) * 0.5) / sinHalf;
      this.ctx.arcTo(px, py, x, y, r);
    }
    this.lastx = x;
    this.lasty = y;
  }
}
