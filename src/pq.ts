/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

export type PriorityQueueElement = [priority: number, ...rest: unknown[]];

export function pqpush<T extends PriorityQueueElement>(q: T[], val: T): void {
  let pos = q.length;
  q.push(val);
  while (pos > 0) {
    let parpos = ((pos - 1) / 2) | 0;
    if (q[parpos][0] <= q[pos][0]) {
      break;
    }
    let t = q[parpos];
    q[parpos] = q[pos];
    q[pos] = t;
    pos = parpos;
  }
}

export function pqpop<T extends PriorityQueueElement>(q: T[]): T | undefined {
  if (!q.length) {
    return undefined;
  }
  if (q.length < 2) {
    return q.shift();
  }
  let ret = q[0];
  q[0] = q.pop()!;
  let pos = 0;
  let leftpos = 1;
  while (leftpos < q.length) {
    let minpos = pos;
    if (q[minpos][0] > q[leftpos][0]) {
      minpos = leftpos;
    }
    let rightpos = leftpos + 1;
    if (rightpos < q.length && q[minpos][0] > q[rightpos][0]) {
      minpos = rightpos;
    }
    if (minpos == pos) {
      break;
    }
    let t = q[pos];
    q[pos] = q[minpos];
    q[minpos] = t;
    pos = minpos;
    leftpos = minpos * 2 + 1;
  }
  return ret;
}
