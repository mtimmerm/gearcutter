/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

import { CutCurve, Pen } from './types';
import { biArcApproximate, drawBiArc, PointAndTangent } from './biarc';
import { searchForFloat } from './floatBinarySearch';

export class CircleCut implements CutCurve {
  readonly arcTolerance: number;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly a0: number;
  readonly a1: number;
  readonly DNUM: number;
  readonly DA: number;
  readonly DB: number;
  readonly mag02: number;
  readonly thetaMidpoint: number;
  readonly tmidpoint: number;
  readonly reversal:
    | undefined
    | {
        tstart: number;
        tend: number;
        thetaStart: number;
        thetaEnd: number;
      };

  /**
   * Create a cut curve
   *
   * @param a0 starting rotation angle of the cut object
   * @param x0 starting x position of the cutter, relative to cut object axis of rotation
   * @param y0 starting y position of the cutter, relative to cut object axis of rotation
   * @param a1 ending rotation angle of the cut object
   * @param x1 ending x position of the cutter, relative to cut object axis of rotation
   * @param y1 ending y position of the cutter, relative to cut object axis of rotation
   */
  constructor(a0: number, x0: number, y0: number, a1: number, x1: number, y1: number, arcTol: number) {
    this.arcTolerance = arcTol;
    if (a1 < a0) {
      // ensure da is always positive
      [a0, a1] = [a1, a0];
      [x0, x1] = [x1, x0];
      [y0, y1] = [y1, y0];
    }
    // Gear rotates counter-clockwise around the origin from a0 to a1, while
    // cut point moves from (x0,y0) to (x1,y1)
    // theta = atan2(P0 + t(P1-P0)) - a0 - t(a1-a0)
    // theta = atan( (y0 + tdy) / (x0 + tdx) ) - a0 - tda
    // dtheta/dt = ( (x0dy-y0dx) / ( t2(dx2 + dy2) + t(2x0dx + 2y0dy) + x02 + y02 ) ) - da
    // dtheta/dt = 0...
    // => (x0dy-y0dx) / ( t2(dx2 + dy2) + t(2x0dx + 2y0dy) + x02 + y02 ) = da
    // => (DNUM) / ( t2DA + tDB + mag02 ) = da
    // => (t2DA + tDB + mag02 ) / (DNUM)  = 1/da
    // => t2DA + tDB + mag02 - (DNUM)/da = 0;
    // => t2DA + tDB + DC = 0;
    // => t = -DB +- sqrt(DB*DB - 4DADC)

    this.x0 = x0;
    this.x1 = x1;
    this.y0 = y0;
    this.y1 = y1;
    this.a0 = a0;
    this.a1 = a1;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const da = a1 - a0;
    this.DNUM = x0 * dy - y0 * dx;
    this.DA = dx * dx + dy * dy;
    this.DB = 2.0 * (x0 * dx + y0 * dy);
    this.mag02 = x0 * x0 + y0 * y0;
    const DC = this.mag02 - this.DNUM / da;
    const disc = this.DB * this.DB - 4 * this.DA * DC;
    this.tmidpoint = -this.DB / (2.0 * this.DA);
    this.thetaMidpoint = this.getThetaForT(this.tmidpoint);
    if (disc > 0.0) {
      // there is a reversal
      const root = Math.sqrt(disc);
      const tstart = Math.max((-this.DB - root) / (2.0 * this.DA), 0);
      const tend = Math.min((-this.DB + root) / (2.0 * this.DA), 1);
      if (tstart < tend) {
        this.reversal = {
          tstart,
          tend,
          thetaStart: this.getThetaForT(tstart),
          thetaEnd: this.getThetaForT(tend),
        };
      }
    }
  }
  getDiscontinuityThetas(minTheta: number, maxTheta: number): number[] {
    const ret: number[] = [];
    if (!this.reversal) {
      return ret;
    }
    for (const theta of [this.reversal.thetaStart, this.reversal.thetaEnd]) {
      if (theta > minTheta && theta < maxTheta) {
        ret.push(theta);
      }
    }
    return ret;
  }

  drawSegment(pen: Pen, thetaFrom: number, thetaTo: number, doInitialMove: boolean): void {
    let tstart: number | undefined;
    let tend: number | undefined;
    if (this.reversal) {
      if (thetaTo > this.reversal.thetaEnd) {
        if (thetaFrom < this.reversal.thetaEnd) {
          this.drawSegment(pen, thetaFrom, this.reversal.thetaEnd, doInitialMove);
          thetaFrom = this.reversal.thetaEnd;
          doInitialMove = false;
        }
        //draw after reversal
        tstart = this.getTForThetaInBase(thetaFrom);
        tend = this.getTForThetaInBase(thetaTo);
      } else if (thetaTo > this.reversal.thetaStart) {
        if (thetaFrom < this.reversal.thetaStart) {
          this.drawSegment(pen, thetaFrom, this.reversal.thetaStart, doInitialMove);
          thetaFrom = this.reversal.thetaStart;
          doInitialMove = false;
        }
        //draw in reversal
        tstart = this.getTForThetaInReversal(thetaFrom);
        tend = this.getTForThetaInReversal(thetaTo);
      } else {
        // draw before reversal
        tstart = this.getTForThetaInBase(thetaFrom);
        tend = this.getTForThetaInBase(thetaTo);
      }
    } else if (thetaTo > this.thetaMidpoint) {
      // no reversal, after midpoint
      if (thetaFrom < this.thetaMidpoint) {
        this.drawSegment(pen, thetaFrom, this.thetaMidpoint, doInitialMove);
        thetaFrom = this.thetaMidpoint;
        doInitialMove = false;
      }
      tstart = this.getTForThetaInBase(thetaFrom);
      tend = this.getTForThetaInBase(thetaTo);
    } else {
      // no reversal, before midpoint
      tstart = this.getTForThetaInBase(thetaFrom);
      tend = this.getTForThetaInBase(thetaTo);
    }
    const tangentSign = Math.sign(tend - tstart);
    const pt0 = this.getPointAndTangentForT(tstart, tangentSign);
    const pt1 = this.getPointAndTangentForT(tend, tangentSign);
    if (doInitialMove) {
      pen.moveTo(pt0[0], pt0[1]);
    } else {
      pen.arcTo(pt0[0], pt0[1], 0);
    }

    let samples = [pt0];
    this.getApproxSamples(samples, tstart, pt0, tend, pt1);
    samples = biArcApproximate(samples, this.arcTolerance);
    for (let i = 1; i < samples.length; ++i) {
      drawBiArc(pen, samples[i - 1], samples[i]);
    }
  }

  private getApproxSamples(
    out: PointAndTangent[],
    tstart: number,
    ptstart: PointAndTangent,
    tend: number,
    ptend: PointAndTangent
  ) {
    if (tend == tstart) {
      return;
    }
    const tmid = tstart + (tend - tstart) * 0.5;

    if (tmid == tstart || tmid == tend) {
      out.push(ptend);
      return;
    }
    const tangentSign = Math.sign(tend - tstart);
    const ptmid = this.getPointAndTangentForT(tmid, tangentSign);
    const [x0, y0] = ptstart;
    const [x1, y1] = ptend;
    const [xm, ym] = ptmid;
    const dx = x1 - x0;
    const dy = y1 - y0;
    let dev = (xm - x0) * dy - (ym - y0) * dx; // deviation * mag(dx,dy)
    dev = (dev * dev) / (dx * dx + dy * dy); // deviation^2
    if (dev > this.arcTolerance * this.arcTolerance * 0.25) {
      this.getApproxSamples(out, tstart, ptstart, tmid, ptmid);
      this.getApproxSamples(out, tmid, ptmid, tend, ptend);
    } else {
      out.push(ptend);
    }
  }

  getR(theta: number): number {
    return this.getRForT(this.getTForTheta(theta));
  }

  getThetaForT(t: number): number {
    const invt = 1.0 - t;
    const y = this.y1 + (this.y0 - this.y1) * invt;
    const x = this.x1 + (this.x0 - this.x1) * invt;
    const a = this.a1 + (this.a0 - this.a1) * invt;
    return Math.atan2(y, x) - a;
  }

  private getRForT(t: number): number {
    const invt = 1.0 - t;
    const y = this.y1 + (this.y0 - this.y1) * invt;
    const x = this.x1 + (this.x0 - this.x1) * invt;
    return Math.sqrt(x * x + y * y);
  }
  private getPointAndTangentForT(t: number, tangentSign: number): [number, number, number, number] {
    const invt = 1.0 - t;
    const dpxdt = this.x1 - this.x0;
    const dpydt = this.y1 - this.y0;
    const dadt = this.a1 - this.a0;
    // position of cut point in space
    const py = this.y1 - dpydt * invt;
    const px = this.x1 - dpxdt * invt;
    // position on unrotated gear
    const rotc = Math.cos(dadt * invt - this.a1);
    const rots = Math.sin(dadt * invt - this.a1);
    const x = px * rotc - py * rots;
    const y = py * rotc + px * rots;

    // velocity of cut point relative to gear
    let dxdt = dpxdt * rotc - dpydt * rots + y * dadt;
    let dydt = dpydt * rotc + dpxdt * rots - x * dadt;
    let mag2 = dxdt * dxdt + dydt * dydt;
    if (mag2 < 1e-16) {
      // very close to the cusp.  The tangent is radial
      dxdt = x;
      dydt = y;
      mag2 = dxdt * dxdt + dydt * dydt;
      if (t < this.tmidpoint) {
        tangentSign = -tangentSign;
      }
    }
    const normfac = tangentSign / Math.sqrt(mag2);
    return [x, y, dxdt * normfac, dydt * normfac];
  }

  private getTForTheta(theta: number): number {
    if (this.reversal && theta >= this.reversal.thetaStart && theta <= this.reversal.thetaEnd) {
      return this.getTForThetaInReversal(theta);
    }
    return this.getTForThetaInBase(theta);
  }

  private getTForThetaInBase(theta: number): number {
    let tmin = 0;
    let tmax = 1.0;
    if (this.reversal) {
      // determine which leg of the base to use
      if (theta < this.thetaMidpoint) {
        // use the curve after the reversal
        tmin = this.reversal.tend;
      } else {
        // use the curve before the reversal
        tmax = this.reversal.tstart;
      }
    }
    [tmin, tmax] = searchForFloat(tmin, tmax, (t) => this.getThetaForT(t) >= theta);
    const thetaMin = this.getThetaForT(tmin);
    const thetaMax = this.getThetaForT(tmax);
    let interp = 0.0;
    if (thetaMax != thetaMin) {
      interp = Math.max((theta - thetaMin) / (thetaMax - thetaMin), 0.0);
      interp = Math.min(interp, 1.0);
    }
    return tmin + (tmax - tmin) * interp;
  }

  private getTForThetaInReversal(theta: number): number {
    if (!this.reversal) {
      return this.tmidpoint;
    }
    let tmin = this.reversal.tstart;
    let tmax = this.reversal.tend;
    [tmin, tmax] = searchForFloat(tmin, tmax, (t) => this.getThetaForT(t) <= theta);
    const thetaMin = this.getThetaForT(tmin);
    const thetaMax = this.getThetaForT(tmax);
    let interp = 0.5;
    if (thetaMax != thetaMin) {
      interp = Math.max((theta - thetaMin) / (thetaMax - thetaMin), 0.0);
      interp = Math.min(interp, 1.0);
    }
    return tmin + (tmax - tmin) * interp;
  }
}
