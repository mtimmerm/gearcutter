/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

import { CrappyClippingPen } from './ClippingPen';
import { RecordingPen } from './RecordingPen';
import { PathFunc, Pen, Point } from './types';

export class XForm {
  // The transformation is:
  // 1. y *= flipYinFac
  // 2. rotate by rotDegrees around (0,0)
  // 3. translate the origin to (tx,ty)
  // 4. apply prevTransform
  private prevTransform: ((pen: Pen) => Pen) | undefined;
  private rotDegrees: number;
  private scaleFactor: number;
  private flipYinFac: number;
  private tx: number;
  private ty: number;
  // memo for (cos(rot), sin(rot))*scale
  private xProjection: Point | undefined;

  constructor() {
    this.prevTransform = undefined;
    this.rotDegrees = 0;
    this.flipYinFac = 1.0;
    this.scaleFactor = 1.0;
    this.tx = 0.0;
    this.ty = 0.0;
  }

  /**
   * Rotate the output of this transform
   *
   * The output position of (0,0) is not changed.
   *
   * If `degrees` is positive, then the current (1,0) direction is rotated toward the current (0,1) direction.
   *
   * @param degrees Degrees to rotate the positive X axis toward the positive Y axis
   * @returns this
   */
  rotate(degrees: number): XForm {
    this.rotDegrees += degrees * this.flipYinFac;
    this.rotDegrees -= Math.floor(this.rotDegrees / 360.0) * 360.0;
    this.xProjection = undefined;
    return this;
  }

  /**
   * Translate the output of this transform.
   *
   * The origin moves to (x,y) in the current coordinate system
   *
   * @param x coordinate of new origin in current coordinates
   * @param y coordinate of new origin in current coordinates
   * @returns this
   */
  translate(x: number, y: number): XForm {
    const [xx, xy] = this.getXProjection();
    const tx = this.tx;
    const ty = this.ty;
    this.tx = tx + x * xx - y * this.flipYinFac * xy;
    this.ty = ty + x * xy + y * this.flipYinFac * xx;
    return this;
  }

  /**
   * Scale the output of this transform around the current (0,0) origin.
   *
   * @param fac Scale factor
   * @param flipY set true to flip the current Y axis
   * @returns this
   */
  scale(fac: number, flipY?: boolean | undefined): XForm {
    if (fac < 0.0) {
      this.rotate(180);
      this.scaleFactor *= -fac;
    } else {
      this.scaleFactor *= fac;
    }
    if (flipY) {
      this.flipYinFac = -this.flipYinFac;
    }
    return this;
  }

  clip(nx: number, ny: number, minprod: number): XForm {
    this.processInput((pen: Pen) => new CrappyClippingPen(pen, nx, ny, minprod));
    return this;
  }

  processInput(preprocess: (pen: Pen) => Pen): XForm {
    if (this.rotDegrees == 0 && this.flipYinFac == 1.0 && this.scaleFactor == 1.0 && this.tx == 0.0 && this.ty == 0.0) {
      if (this.prevTransform) {
        const p1 = this.prevTransform;
        const p2 = preprocess;
        this.prevTransform = (pen: Pen) => p2(p1(pen));
      } else {
        this.prevTransform = preprocess;
      }
    } else {
      const prevX = new XForm();
      if (this.prevTransform) {
        prevX.processInput(this.prevTransform);
      }
      prevX.translate(this.tx, this.ty);
      prevX.rotate(this.rotDegrees);
      prevX.scale(this.scaleFactor, this.flipYinFac != 1.0);
      const p2 = preprocess;
      this.prevTransform = (pen: Pen) => p2(prevX.apply(pen));
      this.rotDegrees = 0;
      this.flipYinFac = 1.0;
      this.scaleFactor = 1.0;
      this.tx = 0.0;
      this.ty = 0.0;
    }
    return this;
  }

  xformInput(xform: XForm): XForm {
    if (xform.prevTransform) {
      this.processInput(xform.prevTransform);
    }
    this.translate(xform.tx, xform.ty);
    this.rotate(xform.rotDegrees);
    this.scale(xform.scaleFactor, xform.flipYinFac < 0.0);
    return this;
  }

  transformPath(path: PathFunc): RecordingPen {
    const rec = new RecordingPen();
    path(this.apply(rec), true);
    return rec;
  }

  processPath(pen: Pen, path: PathFunc, doMove: boolean): XForm {
    path(this.apply(pen), doMove);
    return this;
  }

  apply(target: Pen): Pen {
    const [xx, xy] = this.getXProjection();
    const tx = this.tx;
    const ty = this.ty;
    const flipYinFac = this.flipYinFac;
    const transformPoint = (x: number, y: number): Point => [
      tx + x * xx - y * flipYinFac * xy,
      ty + x * xy + y * flipYinFac * xx,
    ];
    const transformTurn = (turn: number) => turn * flipYinFac;
    if (this.prevTransform) {
      target = this.prevTransform(target);
    }
    return new XFormPen(target, transformPoint, transformTurn);
  }

  private getXProjection(): Point {
    let xx = Math.cos((this.rotDegrees * Math.PI) / 180.0);
    let xy = Math.sin((this.rotDegrees * Math.PI) / 180.0);
    const quarters = this.rotDegrees / 90;
    if (Math.floor(quarters) === quarters) {
      // be exactly right for multiples of 90 degrees
      if ((quarters & 1) == 0) {
        xx = Math.sign(xx);
        xy = 0;
      } else {
        xx = 0;
        xy = Math.sign(xy);
      }
    }
    xx *= this.scaleFactor;
    xy *= this.scaleFactor;
    return [xx, xy];
  }
}

class XFormPen implements Pen {
  private delegate: Pen;
  private transformPoint: (x: number, y: number) => Point;
  private transformTurn: (turn: number) => number;

  constructor(delegate: Pen, transformPoint: (x: number, y: number) => Point, transformTurn: (turn: number) => number) {
    this.transformPoint = transformPoint;
    this.transformTurn = transformTurn;
    this.delegate = delegate;
    if (delegate.reset) {
      this.reset = delegate.reset.bind(delegate);
    }
  }

  reset?: () => void;

  moveTo(x: number, y: number): void {
    const [newX, newY] = this.transformPoint(x, y);
    this.delegate.moveTo(newX, newY);
  }
  arcTo(x: number, y: number, leftTurnRadians: number) {
    const [newX, newY] = this.transformPoint(x, y);
    this.delegate.arcTo(newX, newY, this.transformTurn(leftTurnRadians));
  }
}
