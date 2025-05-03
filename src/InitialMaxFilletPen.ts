/**
 * Copyright 2025 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

import { angleFromTo, arcCenter, bulgeFactor, interpolateArcTurn } from './arcUtils';
import { CrappyClippingPen } from './ClippingPen';
import { RecordingPen } from './RecordingPen';
import { PathFunc, Pen } from './types';
import { XForm } from './XFormPen';

export class InitialMaxFilletPen implements Pen {
  private readonly target: Pen;
  private haveStart: boolean = false;
  private haveArcs: boolean = false;
  private isDone: boolean = false;
  private qualified: boolean = false;
  // unit length vector towards start point
  private snx: number = 0;
  private sny: number = 0;
  private tx: number = 0;
  private ty: number = 0;
  private tdir: number = 0;
  // measured from +y towards -x
  private outFromStartDir = 0;
  private startDirection = 0;

  constructor(target: Pen) {
    this.target = target;
    if (!target.reset) {
      throw new Error('InitialMaxFilletPen requires a resettable pen');
    }
  }

  reset(): void {
    this.target.reset!();
    this.haveStart = false;
    this.haveArcs = false;
    this.isDone = false;
    this.qualified = false;
  }

  moveTo(x: number, y: number): void {
    if (this.haveArcs) {
      this.isDone = true;
    } else {
      this.setStart(x, y);
    }
    this.target.moveTo(x, y);
  }

  private setStart(x: number, y: number) {
    this.haveStart = true;
    this.tx = x;
    this.ty = y;
    const mag = Math.sqrt(x * x + y * y);
    this.snx = x / mag;
    this.sny = y / mag;
    this.outFromStartDir = angleFromTo(-this.sny, this.snx, x, y);
    this.startDirection = this.outFromStartDir + Math.PI * 0.5;
  }

  arcTo(x: number, y: number, turn: number): void {
    if (this.isDone) {
      this.target.arcTo(x, y, turn);
      return;
    }
    if (!this.haveStart) {
      this.setStart(x, y);
      this.target.arcTo(x, y, turn);
      return;
    }
    const lineDir = angleFromTo(-this.sny, this.snx, x - this.tx, y - this.ty);
    const startDir = lineDir - turn * 0.5;
    const endDir = lineDir + turn * 0.5;
    if (!this.qualified) {
      // we don't start considering this to be the fillet area until we see it
      // bend toward the tooth a bit
      if (endDir < this.startDirection - Math.PI * 0.125) {
        this.qualified = true;
      } else {
        this.tx = x;
        this.ty = y;
        this.tdir = endDir;
        this.haveArcs = true;
        this.target.arcTo(x, y, turn);
        return;
      }
    }

    if (startDir < this.outFromStartDir || (this.qualified && endDir > this.startDirection - Math.PI * 0.1)) {
      // we're through the fillet
      this.isDone = true;
      this.target.arcTo(x, y, turn);
      return;
    }
    if (this.haveArcs && startDir < this.tdir - 0.1) {
      // inside corner at start
      this.refillet(this.tx, this.ty, startDir);
    }
    let badArc = false;
    if (turn < -1e-5) {
      const [cx, cy] = arcCenter(this.tx, this.ty, x, y, turn);
      if (angleFromTo(this.snx, this.sny, cx, cy) > 0) {
        // radius of curvature is too small, center
        badArc = true;
      }
    }
    if (!badArc) {
      this.target.arcTo(x, y, turn);
      this.tx = x;
      this.ty = y;
      this.tdir = endDir;
      this.haveArcs = true;
      this.target.arcTo(x, y, turn);
      return;
    }
    if (endDir < this.outFromStartDir) {
      // note we made sure above that startDir > startRadiusAngle
      // filleting to the end of the current arc would make more than a quarter circle
      // (more than a semi-circle with the adjacent tooth)
      // That's not useful, so divide the arc
      const [mx, my] = interpolateArcTurn(this.tx, this.ty, x, y, turn, this.outFromStartDir - startDir);
      this.refillet(mx, my, this.outFromStartDir);
      this.target.arcTo(x, y, endDir - this.outFromStartDir);
      this.isDone = true;
    } else {
      // Fillet to the end of the current arc
      this.refillet(x, y, endDir);
    }
    this.tx = x;
    this.ty = y;
    this.tdir = endDir;
    this.haveArcs = true;
  }

  private refillet(x: number, y: number, direction: number) {
    const turn = direction - this.startDirection; //negative
    // projection of x,y onto start radius
    let fxy = x * this.snx + y * this.sny;
    // projection of x,y onto start direction
    const cxy = this.snx * y - this.sny * x;
    // The arc from -cxy to +cxy turns 2*turn and crosses the start radius at the bulge
    fxy -= bulgeFactor(turn * 2.0) * cxy * 2.0;
    this.target.reset!();
    this.target.moveTo(this.snx * fxy, this.sny * fxy);
    this.target.arcTo(x, y, turn);
  }
}

export class InitialMaxInsideFilletPen implements Pen {
  private readonly target: Pen;
  private haveStart: boolean = false;
  private haveArcs: boolean = false;
  private isDone: boolean = false;
  private qualified: boolean = false;
  // unit length vector towards start point
  private snx: number = 0;
  private sny: number = 0;
  private tx: number = 0;
  private ty: number = 0;
  private tdir: number = 0;
  // measured from +y towards -x
  private inFromStartDir = 0;
  private startDirection = 0;

  constructor(target: Pen) {
    this.target = target;
    if (!target.reset) {
      throw new Error('InitialMaxInsideFilletPen requires a resettable pen');
    }
  }

  reset(): void {
    this.target.reset!();
    this.haveStart = false;
    this.haveArcs = false;
    this.isDone = false;
    this.qualified = false;
  }

  moveTo(x: number, y: number): void {
    if (this.haveArcs) {
      this.isDone = true;
    } else {
      this.setStart(x, y);
    }
    this.target.moveTo(x, y);
  }

  private setStart(x: number, y: number) {
    this.haveStart = true;
    this.tx = x;
    this.ty = y;
    const mag = Math.sqrt(x * x + y * y);
    this.snx = x / mag;
    this.sny = y / mag;
    const outFromStartDir = angleFromTo(-this.sny, this.snx, x, y);
    this.startDirection = outFromStartDir + Math.PI * 0.5;
    this.inFromStartDir = outFromStartDir + Math.PI;
  }

  arcTo(x: number, y: number, turn: number): void {
    if (this.isDone) {
      this.target.arcTo(x, y, turn);
      return;
    }
    if (!this.haveStart) {
      this.setStart(x, y);
      this.target.arcTo(x, y, turn);
      return;
    }
    const lineDir = angleFromTo(-this.sny, this.snx, x - this.tx, y - this.ty);
    const startDir = lineDir - turn * 0.5;
    const endDir = lineDir + turn * 0.5;
    if (!this.qualified) {
      // we don't start considering this to be the fillet area until we see it
      // bend toward the tooth a bit
      if (endDir > this.startDirection + Math.PI * 0.125) {
        this.qualified = true;
      } else {
        this.tx = x;
        this.ty = y;
        this.tdir = endDir;
        this.haveArcs = true;
        this.target.arcTo(x, y, turn);
        return;
      }
    }

    if (startDir > this.inFromStartDir || (this.qualified && endDir < this.startDirection + Math.PI * 0.1)) {
      // we're through the fillet
      this.isDone = true;
      this.target.arcTo(x, y, turn);
      return;
    }
    if (this.haveArcs && startDir > this.tdir + 0.1) {
      // inside corner at start
      this.refillet(this.tx, this.ty, startDir);
    }
    let badArc = false;
    if (turn > 1e-5) {
      const [cx, cy] = arcCenter(this.tx, this.ty, x, y, turn);
      if (angleFromTo(this.snx, this.sny, cx, cy) > 0) {
        // radius of curvature is too small, center
        badArc = true;
      }
    }
    if (!badArc) {
      this.target.arcTo(x, y, turn);
      this.tx = x;
      this.ty = y;
      this.tdir = endDir;
      this.haveArcs = true;
      this.target.arcTo(x, y, turn);
      return;
    }
    if (endDir < this.inFromStartDir) {
      // note we made sure above that startDir > startRadiusAngle
      // filleting to the end of the current arc would make more than a quarter circle
      // (more than a semi-circle with the adjacent tooth)
      // That's not useful, so divide the arc
      const [mx, my] = interpolateArcTurn(this.tx, this.ty, x, y, turn, this.inFromStartDir - startDir);
      this.refillet(mx, my, this.inFromStartDir);
      this.target.arcTo(x, y, endDir - this.inFromStartDir);
      this.isDone = true;
    } else {
      // Fillet to the end of the current arc
      this.refillet(x, y, endDir);
    }
    this.tx = x;
    this.ty = y;
    this.tdir = endDir;
    this.haveArcs = true;
  }

  private refillet(x: number, y: number, direction: number) {
    const turn = direction - this.startDirection; // positive
    // projection of x,y onto start radius
    let fxy = x * this.snx + y * this.sny;
    // projection of x,y onto start direction
    const cxy = this.snx * y - this.sny * x;
    // The arc from -cxy to +cxy turns 2*turn and crosses the start radius at the bulge
    fxy -= bulgeFactor(turn * 2.0) * cxy * 2.0;
    this.target.reset!();
    this.target.moveTo(this.snx * fxy, this.sny * fxy);
    this.target.arcTo(x, y, turn);
  }
}

export function applyMaxToothFillet(toothPath: PathFunc): PathFunc {
  toothPath = applyLeadingFillet(toothPath);
  toothPath = reverseAndFlipPath(toothPath);
  toothPath = applyLeadingFillet(toothPath);
  toothPath = reverseAndFlipPath(toothPath);
  return toothPath;
}

function reverseAndFlipPath(path: PathFunc): PathFunc {
  const rec = new XForm().scale(1, true).transformPath(path);
  return rec.reversedPath;
}

function applyLeadingFillet(path: PathFunc): PathFunc {
  const rec = new XForm().processInput((pen) => new InitialMaxFilletPen(pen)).transformPath(path);
  return rec.path;
}

export function applyInternalToothFillet(toothPath: PathFunc): PathFunc {
  const fixedFromMid = new XForm()
    .processInput((pen) => new InitialMaxInsideFilletPen(pen))
    .clip(0, 1, 0)
    .transformPath(toothPath);
  const outRec = new XForm().scale(1, true).transformPath(fixedFromMid.reversedPath);
  fixedFromMid.path(outRec, false);
  return outRec.path;
}
