/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

import { Pen, Point } from './types';

export class XFormPen implements Pen {
  private delegate: Pen;
  private rotDegrees: number;
  private scaleFactor: number;
  private flipYinFac: number;
  private xx: number;
  private xy: number;
  private tx: number;
  private ty: number;

  constructor(delegate: Pen) {
    this.delegate = delegate;
    this.rotDegrees = 0;
    this.flipYinFac = 1.0;
    this.scaleFactor = 1.0;
    this.xx = 1.0;
    this.xy = 0.0;
    this.tx = 0.0;
    this.ty = 0.0;
  }
  /**
   * Rotate the output of this transform
   *
   * @param degrees Degrees to rotate the positive X axis toward the positive Y axis
   * @returns this
   */
  rotate(degrees: number): XFormPen {
    this.rotDegrees += degrees * this.flipYinFac;
    this.rotDegrees -= Math.floor(this.rotDegrees / 360.0) * 360.0;
    this.xx = Math.cos((this.rotDegrees * Math.PI) / 180.0);
    this.xy = Math.sin((this.rotDegrees * Math.PI) / 180.0);
    const quarters = this.rotDegrees / 90;
    if (Math.floor(quarters) === quarters) {
      // be exactly right for multiples of 90 degrees
      if ((quarters & 1) == 0) {
        this.xx = Math.sign(this.xx);
        this.xy = 0;
      } else {
        this.xx = 0;
        this.xy = Math.sign(this.xy);
      }
    }
    this.xx *= this.scaleFactor;
    this.xy *= this.scaleFactor;
    return this;
  }

  transformPoint(x: number, y: number): Point {
    return [
      this.tx + x * this.xx - y * this.flipYinFac * this.xy,
      this.ty + x * this.xy + y * this.flipYinFac * this.xx,
    ];
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
  translate(x: number, y: number): XFormPen {
    [this.tx, this.ty] = this.transformPoint(x, y);
    return this;
  }
  /**
   * Scale the output of this transform
   *
   * @param fac Scale factor
   * @param flipY set true to flip the current Y axis
   * @returns this
   */
  scale(fac: number, flipY?: boolean | undefined): XFormPen {
    if (fac < 0.0) {
      this.rotate(180);
      this.scaleFactor *= -fac;
    } else {
      this.scaleFactor *= fac;
    }
    if (flipY) {
      this.flipYinFac = -this.flipYinFac;
    }
    this.xx = Math.cos((this.rotDegrees * Math.PI) / 180.0) * this.scaleFactor;
    this.xy = Math.sin((this.rotDegrees * Math.PI) / 180.0) * this.scaleFactor;
    return this;
  }
  copy(): XFormPen {
    return new XFormPen(this.delegate)
      .translate(this.tx, this.ty)
      .rotate(this.rotDegrees)
      .scale(this.scaleFactor, this.flipYinFac < 0.0);
  }
  moveTo(x: number, y: number): void {
    const [newX, newY] = this.transformPoint(x, y);
    this.delegate.moveTo(newX, newY);
  }
  arcTo(x: number, y: number, leftTurnRadians: number) {
    const [newX, newY] = this.transformPoint(x, y);
    this.delegate.arcTo(newX, newY, leftTurnRadians * this.flipYinFac);
  }
}
