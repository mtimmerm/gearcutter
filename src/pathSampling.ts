/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

import { searchForFloat } from './floatBinarySearch';
import { pqpop, pqpush } from './pq';
import { PolarCutSegment } from './types';

const BOTTOM_TOLERANCE = 0.00001;

export function normalizePolarCutPath(segments: PolarCutSegment[], dadt: number): PolarCutSegment[] {
  const pq: PolarCutSegment[] = [];
  // Populate priority queue
  for (let cut of segments) {
    let [sa, ea] = cut;
    if (ea == sa) {
      continue;
    }
    if (ea < sa) {
      sa = cut[1];
      ea = cut[0];
    }
    const curve = cut[2];
    let rot = cut[3];
    if (sa < -0.5 || sa >= 0.5) {
      const flr = Math.floor(sa + 0.5);
      sa -= flr;
      ea -= flr;
      rot -= flr;
    }
    while (ea > 0.5) {
      pqpush(pq, [sa, 0.5, curve, rot]);
      sa = -0.5;
      ea -= 1;
      rot -= 1;
    }
    pqpush(pq, [sa, ea, curve, rot]);
  }

  if (!pq.length) {
    return [];
  }

  // Calculate all the sample points
  const sampleAs: number[] = [];
  {
    const eventPointsSet = new Set<number>();
    for (const [sa, ea, curve, rot] of pq) {
      eventPointsSet.add(sa);
      eventPointsSet.add(ea);
      for (const a of curve.getDiscontinuityThetas((sa - rot) * dadt, (ea - rot) * dadt)) {
        eventPointsSet.add(a / dadt + rot);
      }
    }
    const eventAs = [...eventPointsSet].sort((a, b) => a - b);
    // sample points will stay this far away from any sample;
    const avoidance = 0.000001;
    // next allowed sample point
    let rangeStart = -0.5;
    for (const a of eventAs) {
      if (a - avoidance >= rangeStart) {
        const rangeEnd = a - avoidance;
        if (rangeEnd - rangeStart < avoidance) {
          sampleAs.push(rangeStart + (rangeEnd - rangeStart) * 0.5);
        }
        const n = Math.floor((rangeEnd - rangeStart) / 0.001) + 1;
        for (let i = 0; i <= n; ++i) {
          sampleAs.push(rangeStart + ((rangeEnd - rangeStart) * i) / n);
        }
      }
      rangeStart = a + avoidance;
    }
  }
  let prevCandidates: PolarCutSegment[] = [];
  let prevCandidateStartSample = -0.5;
  let bottomCuts: PolarCutSegment[] = [];
  let bottomCutStartSamples: number[] = [];
  let bottomCutEndSamples: number[] = [];
  let preva: number = -0.5;
  let activeCuts: PolarCutSegment[] = [];

  for (const cura of sampleAs) {
    while (pq.length && pq[0][0] <= cura) {
      activeCuts.push(pqpop(pq)!);
    }
    let d = 0;
    for (let s = 0; s < activeCuts.length; ++s) {
      if (activeCuts[s][1] > cura) {
        activeCuts[d++] = activeCuts[s];
      }
    }
    activeCuts.length = d;

    const curMin = getMinR(activeCuts, dadt, cura);

    if (prevCandidates.length) {
      const survivors = curMin == null ? [] : getBottomSegs(prevCandidates, dadt, cura, curMin);
      if (!survivors.length) {
        bottomCuts.push(prevCandidates[0]);
        bottomCutStartSamples.push(prevCandidateStartSample);
        bottomCutEndSamples.push(preva);
      }
      prevCandidates = survivors;
      preva = cura;
    }
    if (!prevCandidates.length && curMin != null) {
      prevCandidates = getBottomSegs(activeCuts, dadt, cura, curMin);
      prevCandidateStartSample = cura;
    }
  }
  if (prevCandidates.length) {
    bottomCuts.push(prevCandidates[0]);
    bottomCutStartSamples.push(prevCandidateStartSample);
    bottomCutEndSamples.push(preva);
  }

  for (let i = 1; i < bottomCuts.length; ++i) {
    const locut = bottomCuts[i - 1];
    const hicut = bottomCuts[i];
    if (locut[1] > hicut[0]) {
      let loa = Math.max(bottomCutStartSamples[i - 1], hicut[0]);
      let hia = Math.min(bottomCutStartSamples[i], locut[1]);
      [loa, hia] = searchForFloat(loa, hia, (testa) => {
        const lor = locut[2].getR((testa - locut[3]) * dadt);
        const hir = hicut[2].getR((testa - hicut[3]) * dadt);
        return lor < hir;
      });
      const lor = locut[2].getR((loa - locut[3]) * dadt);
      const hir = hicut[2].getR((hia - hicut[3]) * dadt);
      if (lor == hir) {
        hia = loa;
      }
      locut[1] = loa;
      hicut[0] = hia;
    }
  }
  return bottomCuts;
}

function getBottomSegs(cuts: PolarCutSegment[], dadt: number, a: number, bottom: number): PolarCutSegment[] {
  let ret: PolarCutSegment[] = [];
  for (const cut of cuts) {
    if (cut[1] >= a) {
      const r = cut[2].getR((a - cut[3]) * dadt);
      if (r <= bottom + BOTTOM_TOLERANCE) {
        ret.push(cut);
      }
    }
  }
  return ret;
}

function getMinR(cuts: PolarCutSegment[], dadt: number, a: number): number | null {
  let ret: number | null = null;
  for (const cut of cuts) {
    const r = cut[2].getR((a - cut[3]) * dadt);
    if (ret == null || r <= ret) {
      ret = r;
    }
  }
  return ret;
}
