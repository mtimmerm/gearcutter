/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

/**
 * Do a binary search for a floating point value
 *
 * Given a `lo` < `hi`, and a test `isLowerBound` such that `isLowerBound(lo)===true`,
 * this function performs a binary search to return the smallest possible range `[l,h]`
 * such that `lo <= l < h <= hi`, `isLowerBound(l)==true`, and `isLowerBound(h)==false`.
 *
 * `isLowerBound` must be monotonic
 *
 * If given `lo >= hi`, then `[lo,hi]` is returned.
 *
 * All values passed to `isLowerBound` will be > 'lo' and < 'hi'.
 *
 * @param lo D
 * @param hi
 * @param isLowerBound
 * @returns
 */
export function searchForFloat(lo: number, hi: number, isLowerBound: (testVal: number) => boolean) {
  if (!(lo < hi)) {
    return [lo, hi];
  }
  [lo, hi] = getLinearRange(lo, hi, isLowerBound);
  for (;;) {
    const testVal = lo + (hi - lo) * 0.5;
    if (testVal <= lo || testVal >= hi) {
      break;
    }
    if (isLowerBound(testVal)) {
      lo = testVal;
    } else {
      hi = testVal;
    }
  }
  return [lo, hi];
}

/**
 * Reduce a floating-point range to a size where a conventional binary
 * search is appropriate.
 * @returns [newlow, newhigh]
 */
function getLinearRange(low: number, high: number, isLowerBound: (n: number) => boolean): [number, number] {
  let negRange: [number, number] | undefined;
  if (low < 0) {
    if (high > 0) {
      if (isLowerBound(0)) {
        return scaleRange(0, high, 0.25, isLowerBound);
      } else {
        const isNegLowerBound = (n: number) => !isLowerBound(-n);
        negRange = scaleRange(0, -low, 0.25, isNegLowerBound);
      }
    } else {
      const isNegLowerBound = (n: number) => !isLowerBound(-n);
      negRange = scaleRange(-high, -low, 0.25, isNegLowerBound);
    }
  } else {
    return scaleRange(low, high, 0.25, isLowerBound);
  }
  // we have to negate the range
  low = -negRange[1];
  negRange[1] = -negRange[0];
  negRange[0] = low;
  return negRange;
}

/**
 * Reduce a positive range until low/high >= minScale
 * @returns [newlow, newhigh]
 */
function scaleRange(
  low: number,
  high: number,
  minScale: number,
  isLowerBound: (n: number) => boolean
): [number, number] {
  if (!(minScale > 0 && low < high * minScale)) {
    return [low, high];
  }
  const range = scaleRange(low, high, minScale * minScale, isLowerBound);
  [low, high] = range;
  const test = high * minScale;
  if (test > low && test < high) {
    if (isLowerBound(test)) {
      range[0] = test;
    } else {
      range[1] = test;
    }
  }
  return range;
}
