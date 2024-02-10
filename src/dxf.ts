/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */

import { PathFunc, Pen, Unit } from './types';
import { DXF_TEMPLATE } from './dxfTemplate';
import { v4 as uuidv4 } from 'uuid';

export interface DxfDrawProps {
  readonly closed: boolean;
}

export interface DxfRecorderProps {
  unit: Unit;
  marginFac: number;
}

const DXF_UNITS: { [unit in Unit]: number } = {
  px: 0,
  mm: 4,
  ptmm: 4,
  in: 1,
  ptin: 1,
};

export class DxfRecorder {
  private readonly entitites: DxfEntity[];
  private readonly createDate: Date;
  private readonly unitNumber: number;
  private minx: number;
  private maxx: number;
  private miny: number;
  private maxy: number;
  private marginFac: number;

  constructor(props: DxfRecorderProps) {
    this.entitites = [];
    this.createDate = new Date();
    this.marginFac = props.marginFac;
    this.unitNumber = DXF_UNITS[props.unit] || DXF_UNITS.mm;
    this.minx = this.miny = 0;
    this.maxx = this.maxy = 0;
  }

  addEntity(entity: DxfEntity) {
    this.entitites.push(entity);
  }

  includePoint(x: number, y: number) {
    this.minx = Math.min(this.minx, x);
    this.miny = Math.min(this.minx, y);
    this.maxx = Math.max(this.maxx, x);
    this.maxy = Math.max(this.maxx, y);
  }

  getDxfText(): string {
    const template: string[] = DXF_TEMPLATE.split('\n');
    const replacers: Replacers = {
      '@@ENTITIES': (dest) => {
        for (const e of this.entitites) {
          e.generate(dest);
        }
      },
      '@@minx': String(this.minx * this.marginFac),
      '@@miny': String(this.miny * this.marginFac),
      '@@maxx': String(this.maxx * this.marginFac),
      '@@maxy': String(this.maxy * this.marginFac),
      '@@UNITS': String(this.unitNumber),
    };
    const output: string[] = [];
    templateReplace(replacers, output, template);
    output.push('');
    return output.join('\n');
  }

  drawCircle(_drawProps: DxfDrawProps, cx: number, cy: number, radius: number) {
    this.includePoint(cx - radius, cy - radius);
    this.includePoint(cx + radius, cy + radius);
    this.entitites.push(new DxfCircle(this, cx, cy, radius));
  }

  draw(drawProps: DxfDrawProps, path: PathFunc) {
    const pen = new DxfPen(this, drawProps);
    path(pen, true);
    pen.finish();
  }
}

class DxfPen implements Pen {
  private readonly recorder: DxfRecorder;
  private readonly closePaths: boolean;
  private openPath: DxfPolyLine | null;
  private havePoint = false;
  private lastx = 0;
  private lasty = 0;

  constructor(recorder: DxfRecorder, drawProps: DxfDrawProps) {
    this.recorder = recorder;
    this.closePaths = !!drawProps.closed;
    this.openPath = null;
  }
  moveTo(x: number, y: number): void {
    if (this.openPath) {
      this.finish();
    }
    this.lastx = x;
    this.lasty = y;
    this.havePoint = true;
  }
  arcTo(x: number, y: number, turn: number): void {
    if (!this.havePoint) {
      throw new Error('arcTo before moveTo in SVG with');
    }
    if (!this.openPath) {
      this.openPath = new DxfPolyLine(this.recorder, this.lastx, this.lasty);
      this.recorder.addEntity(this.openPath);
      this.recorder.includePoint(this.lastx, this.lasty);
    }

    this.recorder.includePoint(x, y);
    const bulge = Math.abs(turn) < 1e-5 ? 0 : Math.tan(turn * 0.25);
    this.openPath.addVertex(x, y, bulge);
    this.lastx = x;
    this.lasty = y;
  }

  finish() {
    if (this.openPath) {
      if (this.closePaths) {
        this.openPath.close();
      }
      this.openPath = null;
    }
  }
}

type Replacement = null | string | ((dest: string[]) => void);
type Replacers = Record<string, Replacement>;

const REPLACER_PATTERN = /^ *@@/;

function templateReplace(replacers: Replacers, dest: string[], src: string[]) {
  for (const str of src) {
    let s = str.replace('\r', '');
    if (REPLACER_PATTERN.test(s)) {
      let rep = replacers[s.trim()];
      if (rep === undefined) {
        throw new Error(`undefined DXF replacer ${s}`);
      }
      if (typeof rep === 'function') {
        rep(dest);
      } else if (rep != null) {
        dest.push(rep);
      }
    } else {
      dest.push(s);
    }
  }
}

interface DxfEntity {
  generate(dest: string[]): void;
}

const POLYLINE_START_TEMPLATE = `  0
POLYLINE
  8
0
 66
1
 10
0.0
 20
0.0
 30
0.0
 70
@@closedflag`
  .split('\n')
  .map((s) => s.replace('\r', ''));

const POLYLINE_END_TEMPLATE = `  0
SEQEND`
  .split('\n')
  .map((s) => s.replace('\r', ''));

const POLYLINE_VERTEX_TEMPLATE = `  0
VERTEX
  8
0
 10
@@x
 20
@@y
 30
0.0
 42
@@bulge`
  .split('\n')
  .map((s) => s.replace('\r', ''));

class DxfPolyLine implements DxfEntity {
  private readonly recorder: DxfRecorder;
  private readonly replacers: Replacers;
  private readonly vertexReplacers: Replacers;
  private readonly vertexTriplets: number[];
  isClosed: boolean;

  constructor(recorder: DxfRecorder, startx: number, starty: number) {
    this.recorder = recorder;
    this.replacers = {
      '@@closedflag': '0',
    };
    this.vertexReplacers = {
      '@@x': '0.0',
      '@@y': '0.0',
      '@@bulge': '0.0',
      '@@handle': '0',
    };
    this.vertexTriplets = [startx, starty, 0];
    this.isClosed = false;
  }
  generate(dest: string[]): void {
    if (this.vertexTriplets.length < 6) {
      return;
    }
    if (this.isClosed) {
      this.replacers['@@closedflag'] = '1';
    }
    templateReplace(this.replacers, dest, POLYLINE_START_TEMPLATE);
    const vr = this.vertexReplacers;
    const vt = this.vertexTriplets;
    for (let i = 2; i < vt.length; i += 3) {
      vr['@@x'] = String(vt[i - 2]);
      vr['@@y'] = String(vt[i - 1]);
      vr['@@bulge'] = String(vt[i]);
      templateReplace(vr, dest, POLYLINE_VERTEX_TEMPLATE);
    }
    templateReplace(this.replacers, dest, POLYLINE_END_TEMPLATE);
  }
  addVertex(x: number, y: number, preBulge: number): void {
    this.vertexTriplets[this.vertexTriplets.length - 1] = preBulge;
    this.vertexTriplets.push(x, y, 0);
  }
  close() {
    this.isClosed = true;
    const vt = this.vertexTriplets;
    const lasti = vt.length - 3;
    if (lasti > 0 && vt[0] === vt[lasti] && vt[1] === vt[lasti + 1]) {
      // the last vertex is redundant
      vt.length = lasti;
    }
  }
}

const CIRCLE_TEMPLATE = `  0
CIRCLE
  8
0
 10
@@x0
 20
@@y0
 30
0.0
 40
@@r`
  .split('\n')
  .map((s) => s.replace('\r', ''));

class DxfCircle implements DxfEntity {
  private readonly replacers: Replacers;

  constructor(recorder: DxfRecorder, x0: number, y0: number, r: number) {
    this.replacers = {
      '@@x0': String(x0),
      '@@y0': String(y0),
      '@@r': String(r),
    };
  }
  generate(dest: string[]): void {
    templateReplace(this.replacers, dest, CIRCLE_TEMPLATE);
  }
}
