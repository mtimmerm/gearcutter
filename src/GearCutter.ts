/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

import { CircleCut } from './CircleCut';
import { ConstantRadiusCut } from './ConstantRadiusCut';
import { normalizePolarCutPath } from './pathSampling';
import { CutCurve, PolarCutSegment, Pen, PolarPathSample } from './types';
import { XFormPen } from './XFormPen';

/**
 * A [[Pen]] implementation that cuts a path into a gear.
 *
 * The path sent to the pen defines the cutting edges of the cutter (rack) at
 * time t=0.  The resulting path defines the shape cut into the gear, as
 * the gear turns at constant velocity, and the cutter moves at constant velocity along y.
 *
 * Currently only straight paths are supported as input
 */
export class GearCutter implements Pen {
  private lastX: number | undefined;
  private lastY: number | undefined;
  private lastPointIsCut: boolean;
  private pointCurves: Map<number, CutCurve>;
  private flatCurves: Map<number, CutCurve>;
  private readonly faceTol: number;
  private readonly filletTol: number;

  // start angle, end angle, and rotations are in *teeth*
  private path: PolarCutSegment[];

  readonly nTeeth: number;
  readonly pitchRadius: number;
  // cutter moves this far per tooth
  private readonly dydTooth: number;
  // gear rotates this much per tooth
  private readonly dadTooth: number;

  constructor(nTeeth: number, pitchRadius: number, faceTol: number, filletTol: number) {
    this.lastPointIsCut = false;
    this.pointCurves = new Map();
    this.flatCurves = new Map();
    this.path = [];
    this.nTeeth = nTeeth;
    this.pitchRadius = pitchRadius;
    this.dadTooth = (Math.PI * 2.0) / nTeeth;
    this.dydTooth = this.dadTooth * pitchRadius;
    this.faceTol = faceTol;
    this.filletTol = filletTol;
  }

  drawToothPath(pen: Pen, doInitialMove: boolean): void {
    const segments = normalizePolarCutPath(this.path, this.dadTooth);
    for (const seg of segments) {
      const [sa, ea, c, rot] = seg;
      const xpen = new XFormPen(pen).rotate((rot * 360) / this.nTeeth);
      c.drawSegment(xpen, (sa - rot) * this.dadTooth, (ea - rot) * this.dadTooth, doInitialMove);
      doInitialMove = false;
    }
  }

  moveTo(x: number, y: number): void {
    if (x <= 0) {
      throw new Error('x <= 0 is not supported in GearCutter');
    }
    this.lastX = x;
    this.lastY = y;
    this.lastPointIsCut = false;
  }

  arcTo(x: number, y: number, turn: number): void {
    if (x <= 0) {
      throw new Error('x <= 0 is not supported in GearCutter');
    }
    if (Math.abs(turn) > 0.001) {
      throw new Error('Curved cutter paths are not supported in GearCutter');
    }
    if (this.lastX == undefined || this.lastY == undefined) {
      throw new Error('Curve without current point sent to GearCutter');
    }
    let x0 = this.lastX;
    let y0 = this.lastY;
    this.lastX = x;
    this.lastY = y;
    if (!this.lastPointIsCut) {
      this.cutPoint(x0, y0);
    }
    this.lastPointIsCut = true;
    if (x0 == x && y0 == y) {
      return;
    }
    this.cutPoint(x, y);

    if (x0 == x) {
      this.cutFlat(x, y0, y);
      return;
    }

    // The cut point always meets the rack and the pitch circle at the x axis
    const xp = this.pitchRadius;
    // The initial y value above/below xp
    const y0p = ((y - y0) * (xp - x0)) / (x - x0) + y0;
    // Time (in teeth) at which the cut point is on the x axis
    const tp = -y0p / this.dydTooth;
    // cut point direction dir (y0-y1,x1-x0)
    // (dx/dt, dy/dt) = k*dir
    // (dx/dt, dy/dt).dir = (0,dydTooth).dir
    // k*(dir.dir) = dydTooth*dir.y
    let dirx = y0 - y;
    let diry = x - x0;
    let k = (this.dydTooth * diry) / (dirx * dirx + diry * diry);
    let dxdt = k * dirx;
    let dydt = k * diry;
    // cut start time and end time
    const t0 = (x0 - xp) / dxdt;
    const t1 = (x - xp) / dxdt;
    const curve = new CircleCut(
      (t0 + tp) * this.dadTooth,
      x0,
      t0 * dydt,
      (t1 + tp) * this.dadTooth,
      x,
      t1 * dydt,
      this.faceTol
    );
    const thetaA = curve.getThetaForT(0) / this.dadTooth;
    const thetaB = curve.getThetaForT(1) / this.dadTooth;
    this.path.push([Math.min(thetaA, thetaB), Math.max(thetaA, thetaB), curve, 0]);
  }

  cutPoint(x: number, y: number): void {
    let curve = this.pointCurves.get(x);
    if (!curve) {
      curve = new CircleCut(
        -Math.PI,
        x,
        -Math.PI * this.pitchRadius,
        Math.PI,
        x,
        Math.PI * this.pitchRadius,
        this.filletTol
      );
      this.pointCurves.set(x, curve);
    }
    // closest_time = -y/dydT
    // closest_rot_angle = closest_time * dadT
    // curve_rot = -closest_rot_angle = y * dadT/dydT = y/pitchRadius
    // in teeth, curve_rot = y/dydT
    const rot = y / this.dydTooth;
    this.path.push([rot - Math.PI / this.dadTooth, rot + Math.PI / this.dadTooth, curve, rot]);
  }

  cutFlat(x: number, y0: number, y1: number): void {
    let curve = this.flatCurves.get(x);
    if (!curve) {
      curve = new ConstantRadiusCut(x);
      this.flatCurves.set(x, curve);
    }
    if (y0 < y1) {
      this.path.push([y0 / this.dydTooth, y1 / this.dydTooth, curve, 0]);
    } else {
      this.path.push([y1 / this.dydTooth, y0 / this.dydTooth, curve, 0]);
    }
  }
}
