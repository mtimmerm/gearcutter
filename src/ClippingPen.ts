import { interpolateArcTurn } from './arcUtils';
import { searchForFloat } from './floatBinarySearch';
import { RecordingPen } from './RecordingPen';
import { PathFunc, Pen } from './types';

/**
 * A filtering pen that clips a path to one side of a lit.
 *
 * It's crappy, though, in that it doesn't detect when an arc has both endpoints
 * on one side of the line, but the bulge extends into the other side.
 *
 * I'll implement that if I need it later.
 */
export class CrappyClippingPen implements Pen {
  readonly target: Pen;
  readonly nx: number;
  readonly ny: number;
  readonly minprod: number;
  private tx: number = 0;
  private ty: number = 0;
  private havePoint = false;
  private isInside = false;

  /**
   * Construct a clipping pen
   * @param nx x component of the clipping line normal
   * @param ny y component of the clipping line normal
   * @param minprod only portions of the path with x*nx + y*ny >= minprod will be kept.
   */
  constructor(target: Pen, nx: number, ny: number, minprod: number) {
    this.target = target;
    const mag = Math.sqrt(nx * nx + ny * ny);
    this.nx = nx / mag;
    this.ny = ny / mag;
    this.minprod = minprod / mag;
    if (target.reset) {
      this.reset = () => {
        target.reset!();
        this.tx = 0;
        this.ty = 0;
        this.havePoint = false;
        this.isInside = false;
      };
    }
  }

  reset?: () => void;

  moveTo(x: number, y: number): void {
    this.tx = x;
    this.ty = y;
    this.havePoint = true;
    this.isInside = x * this.nx + y * this.ny > this.minprod;
    if (this.isInside) {
      this.target.moveTo(x, y);
    }
  }

  arcTo(x: number, y: number, turn: number): void {
    if (!this.havePoint) {
      this.moveTo(x, y);
      return;
    }
    const wasInside = this.isInside;
    if (wasInside) {
      this.isInside = x * this.nx + y * this.ny >= this.minprod;
    } else {
      this.isInside = x * this.nx + y * this.ny > this.minprod;
    }
    if (!wasInside === !this.isInside) {
      this.tx = x;
      this.ty = y;
      if (wasInside) {
        this.target.arcTo(x, y, turn);
      }
      return;
    }

    if (turn < 1e-6) {
      // This is pretty much straight.  We'll just clip the line
      const p0 = this.tx * this.nx + this.ty * this.ny;
      const p1 = x * this.nx + y * this.ny;
      const t = (this.minprod - p0) / (p1 - p0);
      const mx = this.tx + (x - this.tx) * t;
      const my = this.ty + (y - this.ty) * t;
      if (this.isInside) {
        this.target.moveTo(mx, my);
        if (x != mx || y != my) {
          this.target.arcTo(x, y, 0);
        }
      } else {
        if (mx != this.tx || my != this.ty) {
          this.target.arcTo(mx, my, 0);
        }
      }
    } else if (this.isInside) {
      // Yes, I could write the intersection, but Ima just do the binary search for now
      const midturn = searchForFloat(0, turn, (t) => {
        const [mx, my] = interpolateArcTurn(this.tx, this.ty, x, y, turn, t);
        return mx * this.nx + my * this.ny < this.minprod;
      })[1];
      const [mx, my] = interpolateArcTurn(this.tx, this.ty, x, y, turn, midturn);
      this.target.moveTo(mx, my);
      if (x != mx || y != my) {
        this.target.arcTo(x, y, turn - midturn);
      }
    } else {
      const midTurn = searchForFloat(0, turn, (t) => {
        const [mx, my] = interpolateArcTurn(this.tx, this.ty, x, y, turn, t);
        return mx * this.nx + my * this.ny >= this.minprod;
      })[0];
      const [mx, my] = interpolateArcTurn(this.tx, this.ty, x, y, turn, midTurn);
      if (mx != this.tx || my != this.ty) {
        this.target.arcTo(mx, my, midTurn);
      }
    }
    this.tx = x;
    this.ty = y;
  }
}
