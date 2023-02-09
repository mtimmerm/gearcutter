/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

import { PathFunc, Pen } from './types';
import { XFormPen } from './XFormPen';

export interface SvgDrawProps {
  readonly fill?: string | undefined;
  readonly stroke?: string | undefined;
  readonly strokeWidth?: number | undefined;
}

export interface SvgRecorderProps {
  /**
   * multiplier for input coordinates.  Negative scale flips the y axis.
   * If not specified, -96/25.4 is used, which will be millimeters with y axis up
   * for most consumers.
   */
  scale?: number | undefined;
}
export class SvgRecorder {
  private readonly buf: string[];
  private readonly scale: number;
  private bounds: [number, number, number, number] | null;

  constructor(props: SvgRecorderProps) {
    this.buf = [
      '<?xml version="1.0" encoding="UTF-8"?>\n',
      '<svg>', // this will be replaced with the real start tag
    ];
    this.bounds = null;
    this.scale = props.scale || -96.0 / 25.4;
  }

  getSvgText(): string {
    const oldlen = this.buf.length;
    let [minx, miny, width, height] = this.bounds || [0, 0, 0, 0];
    minx = Math.floor(minx - 0.1);
    miny = Math.floor(miny - 0.1);
    width = Math.ceil(width + 0.1) - minx;
    height = Math.ceil(height + 0.1) - miny;
    this.buf[1] = `<svg viewBox="${minx} ${miny} ${width} ${height}" width="${width}" height="${height}" version="1.1" xmlns="http://www.w3.org/2000/svg">\n`;
    this.buf.push('</svg>\n');
    const svg = this.buf.join('');
    this.buf.length = oldlen;
    return svg;
  }

  drawCircle(drawProps: SvgDrawProps, cx: number, cy: number, radius: number) {
    const fill = drawProps.fill || 'none';
    const stroke = drawProps.stroke || 'none';
    const strokeWidth = (drawProps.strokeWidth || 1) * Math.abs(this.scale);
    cx *= Math.abs(this.scale);
    cy *= this.scale;
    radius *= Math.abs(this.scale);
    this.buf.push(`<g fill="${fill}" stroke-width="${strokeWidth}" stroke="${stroke}">\n`);
    this.buf.push(`    <circle cx="${cx}" cy="${cy}" r="${radius}"/>\n`);
    this.buf.push('</g>');
    this.mergeBounds([cx - radius, cy - radius, cx + radius, cy + radius]);
  }

  draw(drawProps: SvgDrawProps, path: PathFunc) {
    const pen = new SvgPen(
      {
        ...drawProps,
        strokeWidth: (drawProps.strokeWidth ?? 1.0) * Math.abs(this.scale),
      },
      this.buf
    );
    const xfpen = new XFormPen(pen);
    xfpen.scale(Math.abs(this.scale), this.scale < 0);
    path(xfpen, true);
    this.mergeBounds(pen.finish());
  }

  private mergeBounds(bounds: [number, number, number, number] | null) {
    if (!this.bounds) {
      this.bounds = bounds;
    } else if (bounds) {
      for (let i = 0; i < 2; ++i) {
        this.bounds[i] = Math.min(this.bounds[i], bounds[i]);
        this.bounds[i + 2] = Math.max(this.bounds[i + 2], bounds[i + 2]);
      }
    }
  }
}

class SvgPen implements Pen {
  private readonly buf: string[];
  private readonly closePaths: boolean;
  private havePoint = false;
  private havePath = false;
  private pendingProps: SvgDrawProps | null;
  private lastx = 0;
  private lasty = 0;
  private minx = 0;
  private miny = 0;
  private maxx = 0;
  private maxy = 0;

  constructor(drawProps: SvgDrawProps, buf: string[]) {
    this.buf = buf;
    this.pendingProps = drawProps;
    this.closePaths = !!drawProps.fill;
  }
  finish(): [number, number, number, number] | null {
    if (this.pendingProps) {
      return null;
    }
    if (this.havePath) {
      this.buf.push(this.closePaths ? ' Z"/>\n' : '"/>\n');
      this.havePath = false;
    }
    this.buf.push('</g>');
    return [this.minx, this.miny, this.maxx, this.maxy];
  }
  moveTo(x: number, y: number): void {
    if (this.havePath) {
      this.buf.push(this.closePaths ? ' Z"/>\n' : '"/>\n');
      this.havePath = false;
    }
    this.lastx = x;
    this.lasty = y;
    this.havePoint = true;
  }
  arcTo(x: number, y: number, turn: number): void {
    if (!this.havePoint) {
      throw new Error('arcTo before moveTo in SVG with');
    }
    if (this.pendingProps) {
      // This is the first path
      const fill = this.pendingProps.fill || 'none';
      const stroke = this.pendingProps.stroke || 'none';
      const strokeWidth = this.pendingProps.strokeWidth ?? 1;
      this.pendingProps = null;
      this.buf.push(`<g fill="${fill}" stroke-width="${strokeWidth}" stroke="${stroke}">\n`);
      this.minx = Math.min(this.lastx, x);
      this.miny = Math.min(this.lasty, y);
      this.maxx = Math.max(this.lastx, x);
      this.maxy = Math.max(this.lasty, y);
    } else {
      this.minx = Math.min(this.minx, Math.min(this.lastx, x));
      this.maxx = Math.max(this.maxx, Math.max(this.lastx, x));
      this.miny = Math.min(this.miny, Math.min(this.lasty, y));
      this.maxy = Math.max(this.maxy, Math.max(this.lasty, y));
    }
    if (!this.havePath) {
      this.buf.push(`    <path d=" M ${this.lastx} ${this.lasty}`);
      this.havePath = true;
    }
    if (Math.abs(turn) < 1e-5) {
      this.buf.push(` L ${x} ${y}`);
    } else {
      // SVG arcTo command is
      // A r r 0 0 side x1 x1
      // where r is circle radius
      // side is 0
      const side = turn > 0 ? 1 : 0;
      const dx = x - this.lastx;
      const dy = y - this.lasty;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const a = Math.abs(turn * 0.5);
      const sina = Math.sin(a);
      const r = (dist * 0.5) / sina;
      const tanfac = (turn >= 0 ? 0.5 : -0.5) / Math.tan(a);
      const cx = x - dx * 0.5 - dy * tanfac;
      const cy = y - dy * 0.5 + dx * tanfac;
      if (cx > Math.min(this.lastx, x) && cx < Math.max(this.lastx, x)) {
        if (cy > (y + this.lasty) * 0.5) {
          this.miny = Math.min(this.miny, cy - r);
        } else {
          this.maxy = Math.max(this.maxy, cy + r);
        }
      }
      if (cy > Math.min(this.lasty, y) && cy < Math.max(this.lasty, y)) {
        if (cx > (x + this.lastx) * 0.5) {
          this.minx = Math.min(this.minx, cx - r);
        } else {
          this.maxx = Math.max(this.maxx, cx + r);
        }
      }
      this.buf.push(`A ${r} ${r} ${0} ${0} ${side} ${x} ${y}`);
    }
    this.lastx = x;
    this.lasty = y;
  }
}
