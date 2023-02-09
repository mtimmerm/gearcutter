/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

import { Pen } from './types';

// x,y, tx,ty.  (tx,ty) must be unit length
export type PointAndTangent = [number, number, number, number];

/**
 * Given endpoints and tangents, determine the connection point and tangent for
 * the biarc that connects them.
 *
 * This doesn't work for paths in which the curvature changes sign, and the angle between
 * tangents must be significantly less than 180 degrees.
 *
 * Given tangents must be normalized to unit length.
 *
 * @param pt0 Starting point and *unit* direction
 * @param pt1 Ending point and *unit* direction
 * @returns connection point and unit direction at that point, which can make circular
 *          arcs with pt0 and pt1
 */
export function biArcSplit(pt0: PointAndTangent, pt1: PointAndTangent): PointAndTangent {
  const [x0, y0, tx0, ty0] = pt0;
  const [x1, y1, tx1, ty1] = pt1;

  const dx = x1 - x0;
  const dy = y1 - y0;
  // tangent at joint point
  let dmag = Math.sqrt(dx * dx + dy * dy);
  const txm = dx / dmag;
  const tym = dy / dmag;
  // (dx,dy) = a0(t0+tm) + a1(t1+tm)
  // let N = (-dy,dx)
  // a0(t0+tm).N = -a1(t1+tm).N
  // a0t0.N = -a1t1.N
  // a0 = K(t1.N), a1 = -K(t0.N)
  // a0 = Kf0, a1 = Kf1
  const f0 = ty1 * dx - tx1 * dy;
  const f1 = tx0 * dy - ty0 * dx;
  // let D = (dx,dy)
  // a0(t0+tm).tm + a1(t1+tm).tm = dmag
  // a0(t0.tm+1) + a1(t1.tm+1) = dmag
  // k(f0(t0.tm+1) + f1(t1.tm+1)) = dmag
  // k = dmag / (f0(t0.tm+1) + f1(t1.tm+1))
  const k = dmag / ((tx0 * txm + ty0 * tym + 1) * f0 + (tx1 * txm + ty1 * tym + 1) * f1);
  const a0 = k * f0;
  const xm = x0 + (tx0 + txm) * a0;
  const ym = y0 + (ty0 + tym) * a0;
  return [xm, ym, txm, tym];
}

/**
 * Given an array of point and tangent samples for a path, remove as many as possible
 * such that biarc interpolation between the remaining samples follows the omitted
 * samples to a given tolerance.
 *
 * An expensive dynamic programming algorithm is used to determine a nice sample
 * selection, so the list shouldn't be too long
 *
 * @param samples point and tangent samples
 * @param tolerance maximum deviation
 */
export function biArcApproximate(samples: PointAndTangent[], tolerance: number): PointAndTangent[] {
  // for each sample, [best division count, best division max error, best division predecessor]
  const best: Array<[number, number, number]> = [[0, 0, -1]];
  let nextScanStart = 0;
  for (let pos = 1; pos < samples.length; ++pos) {
    const thisScanStart = nextScanStart;
    nextScanStart = pos - 1;
    let bestCount = best[pos - 1][0] + 1;
    let bestMaxError = best[pos - 1][1];
    let bestPred = pos - 1;
    for (let testPos = thisScanStart; testPos < pos - 1; ++testPos) {
      const error = getApproxError(samples, testPos, pos);
      if (error > tolerance) {
        continue;
      }
      if (testPos < nextScanStart) {
        nextScanStart = testPos;
      }
      const count = best[testPos][0] + 1;
      const maxError = Math.max(best[testPos][1], error);
      if (count > bestCount) {
        break;
      }
      if (count < bestCount || maxError < bestMaxError) {
        bestCount = count;
        bestMaxError = maxError;
        bestPred = testPos;
      }
      if (error < maxError) {
        break;
      }
    }
    best.push([bestCount, bestMaxError, bestPred]);
  }
  const ret: PointAndTangent[] = [];
  for (let i = best.length - 1; i >= 0; i = best[i][2]) {
    ret.push(samples[i]);
  }
  return ret.reverse();
}

function getApproxError(samples: PointAndTangent[], fromPos: number, toPos: number): number {
  const pt0 = samples[fromPos];
  const pt1 = samples[toPos];
  const ptm = biArcSplit(pt0, pt1);
  let maxError = 0;
  for (let i = fromPos + 1; i < toPos; ++i) {
    maxError = Math.max(maxError, getBiArcPointError(pt0, ptm, pt1, samples[i]));
  }
  return maxError;
}

/**
 * Given the 3 control points ofa biarc, determine the distance from a point to the biarc
 *
 * The point is expected to be on the approximated path between the biarc ends. Accurate
 * results are only produced for "incenter-connecting" biarcs like those produced by
 * [[biArcSplit]]
 *
 * This function works by determining which arc segment the point belongs to, and then
 * determining its distance from the arc center.  If the curvature is too small, then
 * the distance from the line connecting the arc endpoints will be used.
 *
 * @param pt0 Biarc initial point and tangent
 * @param ptm Biarc connection point and tangent
 * @param pt1 Biarc final point and tangent
 * @param sample point and tangent to measure error from.  The tangent part is ignored
 * @returns distance from the point to the biarc
 */
export function getBiArcPointError(
  pt0: PointAndTangent,
  ptm: PointAndTangent,
  pt1: PointAndTangent,
  sample: PointAndTangent
): number {
  const [x0, y0] = pt0;
  const [x1, y1] = pt1;
  const [xm, ym] = ptm;
  const [xs, ys] = sample;
  const dx = x1 - x0;
  const dy = y1 - y0;
  if ((xs - x0) * dx + (ys - y0) * dy > (xm - x0) * dx + (ym - y0) * dy) {
    // measure error against the ptm-pt1 circle
    return getArcPointError(ptm, pt1, sample);
  } else {
    return getArcPointError(pt0, ptm, sample);
  }
}

function getArcPointError(pt0: PointAndTangent, pt1: PointAndTangent, sample: PointAndTangent) {
  // measure error againt the pt0-ptm circle
  // C = P1+R*(-ty1,tx1)
  // C = P0+R(-ty0,tx0)
  // R = (P1-P0) / ( (ty1,-tx1)+(-ty0,+tx0) )
  // R = (P1-P0).(P1-P0) / ( (ty1,-tx1)+(-ty0,+tx0) ).(P1-P0)
  const [x0, y0, tx0, ty0] = pt0;
  const [x1, y1, tx1, ty1] = pt1;
  const [xs, ys] = sample;
  const dxa = x1 - x0;
  const dya = y1 - y0;
  const den = dxa * (ty1 - ty0) + dya * (tx0 - tx1);
  const da2 = dxa * dxa + dya * dya;
  if (da2 > Math.abs(den) * 1e8) {
    // it's effectively a straight line
    const xh = (x0 + x1) * 0.5;
    const yh = (y0 + y1) * 0.5;
    return Math.abs((xs - xh) * (ty0 + ty1) - (ys - yh) * (tx0 + tx1)) * 0.5;
  }
  const r = da2 / den;
  const xc = (x0 + x1 - r * (ty0 + ty1)) * 0.5;
  const yc = (y0 + y1 + r * (tx0 + tx1)) * 0.5;
  const xcs = xs - xc;
  const ycs = ys - yc;
  const rs = Math.sqrt(xcs * xcs + ycs * ycs);
  return Math.abs(rs - Math.abs(r));
}

/**
 * Draw a biarc with two `arcTo` operations
 *
 * [[biarcSplit]] will be used to determine the two arcs
 *
 * @param pen target pen
 * @param pt0 beginning point and tanget
 * @param pt1 final point and tangent
 */
export function drawBiArc(pen: Pen, pt0: PointAndTangent, pt1: PointAndTangent) {
  const [, , tx0, ty0] = pt0;
  const [x1, y1, tx1, ty1] = pt1;
  const [xm, ym, txm, tym] = biArcSplit(pt0, pt1);
  const rot0 = Math.asin(tx0 * tym - ty0 * txm);
  const rot1 = Math.asin(txm * ty1 - tym * tx1);
  pen.arcTo(xm, ym, rot0);
  pen.arcTo(x1, y1, rot1);
}
