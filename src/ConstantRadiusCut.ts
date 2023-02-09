/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

import { CutCurve, Pen } from './types';

export class ConstantRadiusCut implements CutCurve {
  private readonly r: number;

  constructor(r: number) {
    this.r = r;
  }
  getDiscontinuityThetas(_minTheta: number, _maxTheta: number): number[] {
    return [];
  }
  drawSegment(pen: Pen, thetaFrom: number, thetaTo: number, doInitialMove: boolean): void {
    if (thetaFrom - thetaTo > Math.PI * 0.6) {
      const mid = thetaFrom + (thetaTo - thetaFrom) * 0.5;
      this.drawSegment(pen, thetaFrom, mid, doInitialMove);
      this.drawSegment(pen, mid, thetaTo, false);
      return;
    }
    const sx = Math.cos(thetaFrom) * this.r;
    const sy = Math.sin(thetaFrom) * this.r;
    const ex = Math.cos(thetaTo) * this.r;
    const ey = Math.sin(thetaTo) * this.r;
    if (doInitialMove) {
      pen.moveTo(sx, sy);
    } else {
      pen.arcTo(sx, sy, 0);
    }
    pen.arcTo(ex, ey, thetaTo - thetaFrom);
  }
  getR(theta: number): number {
    return this.r;
  }
}
