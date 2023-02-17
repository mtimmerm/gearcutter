/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

export type Unit = 'px' | 'mm' | 'in' | 'ptmm' | 'ptin';

export type Point = [number, number];
export type Span = [number, number];
export type LineSeg = [number, number, number, number];
export type Arc = [number, number, number];
// The first arc in the path is a moveTo -- the turn angle is ignored
export type Path = Arc[];
export type PathFunc = (pen: Pen, doMove: boolean) => void;

export interface Pen {
  /**
   * Set the current point
   *
   * @param x New current X coordinate
   * @param y New current Y coordinate
   */
  moveTo(x: number, y: number): void;
  /**
   * Draw an arc or line
   *
   * @param x target X coordinate
   * @param y target Y coordinate
   * @param turn total rotation of direction along the arc/line, in the direction that
   *      turns the positive X axis toward the positive Y axis
   */
  arcTo(x: number, y: number, turn: number): void;
}

/**
 * Represents a cutting path in polar coordinates.
 */
export interface CutCurve {
  /**
   * Get the radius of the cut at angle theta
   * @param theta Angle in radians at which to get the curve radius
   */
  getR(theta: number): number;

  /**
   * Get any thetas between minTheta and maxTheta at which discontinuities occur
   *
   * @param minTheta Exclusive lower bound
   * @param maxTheta Exclusive upper bound
   */
  getDiscontinuityThetas(minTheta: number, maxTheta: number): number[];

  /**
   * Draw a segment of the cut
   */
  drawSegment(pen: Pen, thetaFrom: number, thetaTo: number, doInitialMove: boolean): void;
}

/**
 * A segment of a cutting path in polar coords:
 *
 * [starting angle, ending angle (greater), curve, rotate curve around axis by this amount]
 *
 * Angles are in *teeth*
 */
export type PolarCutSegment = [number, number, CutCurve, number];

/**
 * A simple on a cutting path in polar coords:
 *
 * [angle, curve, rotate curve around axis by this amount]
 */
export type PolarPathSample = [number, CutCurve, number];
