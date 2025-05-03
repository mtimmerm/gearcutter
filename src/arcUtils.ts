export function vecLength(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return vecLength(x2 - x1, y2 - y1);
}

/**
 * Measure the angle from vector 1 to vector 2.
 *
 * Result is from -PI to PI.  from +x to +y is PI/2.
 * @param fromx
 * @param fromy
 * @param tox
 * @param toy
 */
export function angleFromTo(fromx: number, fromy: number, tox: number, toy: number): number {
  return Math.atan2(fromx * toy - fromy * tox, fromx * tox + fromy * toy);
}

/**
 * Get the circle radius from the straight-line distance and turn angle.
 *
 * Radius has the same sign as the turn angle.
 *
 * CHECK TO MAKE SURE THE TURN IS SIGNIFICANT FIRST
 *
 * @param distance straight line distance
 * @param turn amount turned in rads in +x toward +y direction
 */
export function radiusFromDistance(distance: number, turn: number): number {
  return (distance * 0.5) / Math.sin(turn * 0.5);
}

/**
 * Distance from the line to the circle center, in line lengths.
 *
 * Sign is the same as the turn angle, so the center is at:
 *
 * ` cx = midx - dy * cdfac; cy = midy + dx * cdfac; `
 *
 * ... where `(midx,midy)` is the midpoint of the line.
 *
 * CHECK TO MAKE SURE THE TURN IS SIGNIFICANT FIRST
 */
export function centerDistanceFactor(turn: number): number {
  return 0.5 / Math.tan(turn * 0.5);
}

/**
 * Maximum distance from the line to the arc, in line lengths.
 *
 * Sign is OPPOSITE the turn angle, so the arc midpoint is at:
 *
 * ` x = midx - dy * bfac; cy = midy + dx * bfac; `
 *
 * ... where `(midx,midy)` is the midpoint of the line.
 */
export function bulgeFactor(turn: number): number {
  return Math.tan(turn * 0.25) * -0.5;
}

/**
 * Given a vector and a cross factor from the midpoint (i.e., like a center
 * distance factor or bulge factor), get the resulting point
 */
export function vecPointFromCrossFactor(dx: number, dy: number, cfac: number): [number, number] {
  return [dx * 0.5 - dy * cfac, dy * 0.5 + dx * cfac];
}

/**
 * Given line segment and a cross factor from the midpoint (i.e., like a center
 * distance factor or bulge factor), get the resulting point
 */
export function pointFromCrossFactor(x1: number, y1: number, x2: number, y2: number, cfac: number): [number, number] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return [x1 + dx * 0.5 - dy * cfac, y1 + dy * 0.5 + dx * cfac];
}

export function pointFromForwardAndCrossFactors(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  ffac: number,
  cfac: number
): [number, number] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return [x1 + dx * ffac - dy * cfac, y1 + dy * ffac + dx * cfac];
}

export function arcMidpoint(x1: number, y1: number, x2: number, y2: number, turn: number): [number, number] {
  return pointFromCrossFactor(x1, y1, x2, y2, bulgeFactor(turn));
}

/**
 * Get arc length / chord length for a given turn angle
 */
export function arcLengthFactor(turn: number): number {
  // arc / chord = r*theta / 2*r*sin(theta/2)
  // = theta*0.5 / sin(theta*0.5)
  return (turn * 0.5) / Math.sin(turn * 0.5);
}

/**
 * Get the center of an arc's circle.
 *
 * CHECK TO MAKE SURE THE TURN IS SIGNIFICANT FIRST
 */
export function arcCenter(x1: number, y1: number, x2: number, y2: number, turn: number): [number, number] {
  return pointFromCrossFactor(x1, y1, x2, y2, centerDistanceFactor(turn));
}

/**
 * Calculate 1-cos(theta) in a way that is stable for small angles.
 * @param theta
 */
export function versine(theta: number): number {
  let x = Math.sin(theta * 0.5);
  return 2.0 * x * x;
}

/**
 * Find the point that breaks an arc at a specific tangent angle.
 *
 * The calculation is numerically stable for large turning radii/small turn, but of course
 * it still only makes sense to call this for arcs with meaningful turn, since it interpolates between turn values.
 *
 * @param x1 start point x
 * @param y1 start point y
 * @param x2 end point x
 * @param y2 end point y
 * @param turn total turn along the arc in the direction that turns the positive X axis toward the positive Y axis
 * @param target_turn total turn at which to break.  Must be >= 0 and <= turn
 */
export function interpolateArcTurn(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  turn: number,
  target_turn: number
): [number, number] {
  // use the unit circle, and then transform the result.
  // total arc length for segment = turn, since it's in radians.
  const halfturn = turn * 0.5;
  const endy = Math.sin(halfturn);
  const endx = -versine(halfturn);
  const midy = Math.sin(target_turn - halfturn);
  const midx = -versine(target_turn - halfturn);
  // we need to scale so that 2*endy maps to 1, which will map to the p1-p2 segment.
  const scale = 0.5 / endy;
  // forward and cross factors
  const ffac = midy * scale;
  const cfac = (midx - endx) * scale;
  return pointFromForwardAndCrossFactors(x1, y1, x2, y2, ffac, cfac);
}
