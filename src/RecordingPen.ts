/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

import { PathFunc, Pen } from './types';

export class RecordingPen implements Pen {
  private readonly xs: number[] = [];
  private readonly ys: number[] = [];
  private readonly turns: (number | null)[] = [];
  readonly path: PathFunc = (pen: Pen, doMove: boolean) => {
    const { xs, ys, turns } = this;
    let i = 0;
    if (!doMove) {
      while (i < turns.length && turns[i] == null) {
        ++i;
      }
    }
    for (; i < turns.length; ++i) {
      const x = xs[i];
      const y = ys[i];
      const a = turns[i];
      if (a == null) {
        pen.moveTo(x, y);
      } else {
        pen.arcTo(x, y, a);
      }
    }
  };
  moveTo(x: number, y: number): void {
    if (this.turns.length && this.turns[this.turns.length - 1] == null) {
      this.turns.pop();
      this.xs.pop();
      this.ys.pop();
    }
    this.xs.push(x);
    this.ys.push(y);
    this.turns.push(null);
  }
  arcTo(x: number, y: number, turn: number): void {
    if (!this.turns.length) {
      throw new Error('arc without preceding move in RecordingPen');
    } else {
      const i = this.turns.length - 1;
      const dx = x - this.xs[i];
      const dy = y - this.ys[i];
      const mag2 = dx * dx + dy * dy;
      if (mag2 < 1e-14) {
        return;
      }
      if (mag2 < 1e-8) {
        turn = 0;
      }
    }
    this.xs.push(x);
    this.ys.push(y);
    this.turns.push(turn);
  }

  countSegments(): number {
    let ret = 0;
    for (const t of this.turns) {
      if (t != null) {
        ++ret;
      }
    }
    return ret;
  }
}
