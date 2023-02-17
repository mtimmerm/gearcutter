/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

import { PathFunc, Pen } from './types';

/**
 * A simple pen that captures the last point sent to it
 */
export class LastPointCapturePen implements Pen {
  x: number | undefined;
  y: number | undefined;
  moveTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
  arcTo(x: number, y: number, turn: number): void {
    this.x = x;
    this.y = y;
  }
  transferMove(target: Pen) {
    if (this.x != undefined && this.y != undefined) {
      target.moveTo(this.x, this.y);
      return true;
    }
    return false;
  }
}
