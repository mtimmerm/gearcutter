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
  private nextHandle: number;

  constructor(props: DxfRecorderProps) {
    this.entitites = [];
    this.createDate = new Date();
    this.nextHandle = 0x40;
    this.unitNumber = DXF_UNITS[props.unit] || DXF_UNITS.mm;
  }

  addEntity(entity: DxfEntity) {
    this.entitites.push(entity);
  }

  allocHandle(): string {
    const ret = this.nextHandle.toString(16).toUpperCase();
    this.nextHandle++;
    return ret;
  }

  getDxfText(): string {
    const template: string[] = DXF_TEMPLATE.split('\n');
    const replacers: Replacers = {
      '@@JULIANDATE': this.getJulianCreateDay(),
      '@@NEXTHANDLE': this.nextHandle.toString(16).toUpperCase(),
      '@@ENTITIES': (dest) => {
        for (const e of this.entitites) {
          e.generate(dest);
        }
      },
      '@@UNITS': String(this.unitNumber),
      '@@UUIDGEN': (dest) => {
        dest.push(`{${uuidv4().toUpperCase()}}`);
      },
    };
    const output: string[] = [];
    templateReplace(replacers, output, template);
    output.push('');
    return output.join('\n');
  }

  private getJulianCreateDay(): string {
    return String(this.createDate.getTime() / 86400000 + 2440587.5);
  }

  drawCircle(drawProps: DxfDrawProps, cx: number, cy: number, radius: number) {
    this.entitites.push(new DxfCircle(this, cx, cy, radius));
    //this.drawing.drawCircle(cx, cy, radius);
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
  private havePoint = false;
  private havePath = false;
  private pendingProps: DxfDrawProps | null;
  private lastx = 0;
  private lasty = 0;
  private firstx = 0;
  private firsty = 0;

  constructor(recorder: DxfRecorder, drawProps: DxfDrawProps) {
    this.recorder = recorder;
    this.pendingProps = drawProps;
    this.closePaths = !!drawProps.closed;
  }
  moveTo(x: number, y: number): void {
    if (this.havePath) {
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
    if (this.pendingProps) {
      // This is the first path
      this.pendingProps = null;
    }
    if (!this.havePath) {
      this.havePath = true;
      this.firstx = this.lastx;
      this.firsty = this.lasty;
    }
    if (Math.abs(turn) < 1e-5) {
      this.recorder.addEntity(new DxfLine(this.recorder, this.lastx, this.lasty, x, y));
    } else {
      const dx = x - this.lastx;
      const dy = y - this.lasty;
      const tana = Math.tan(turn * 0.5);
      const midx = this.lastx + dx * 0.5 + dy * tana * 0.5;
      const midy = this.lasty + dy * 0.5 - dx * tana * 0.5;
      const cosa = Math.cos(turn * 0.5);
      this.recorder.addEntity(new DxfQuadSpline(this.recorder, this.lastx, this.lasty, midx, midy, x, y, cosa));
    }
    this.lastx = x;
    this.lasty = y;
  }

  finish() {
    if (this.havePath) {
      if (this.closePaths) {
        if (this.firstx !== this.lastx || this.firsty !== this.lasty) {
          this.recorder.addEntity(new DxfLine(this.recorder, this.lastx, this.lasty, this.firstx, this.firsty));
        }
      }
      this.havePath = false;
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

const LINE_TEMPLATE = `  0
LINE
  5
@@handle
330
17
100
AcDbEntity
  8
0
100
AcDbLine
 10
@@x0
 20
@@y0
 30
0.0
 11
@@x1
 21
@@y1
 31
0.0`
  .split('\n')
  .map((s) => s.replace('\r', ''));

class DxfLine implements DxfEntity {
  readonly replacers: Replacers;

  constructor(recorder: DxfRecorder, x0: number, y0: number, x1: number, y1: number) {
    this.replacers = {
      '@@x0': String(x0),
      '@@y0': String(y0),
      '@@x1': String(x1),
      '@@y1': String(y1),
      '@@handle': recorder.allocHandle(),
    };
  }
  generate(dest: string[]): void {
    templateReplace(this.replacers, dest, LINE_TEMPLATE);
  }
}

const CIRCLE_TEMPLATE = `  0
CIRCLE
  5
@@handle
330
17
100
AcDbEntity
  8
0
100
AcDbCircle
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
  readonly replacers: Replacers;

  constructor(recorder: DxfRecorder, x0: number, y0: number, r: number) {
    this.replacers = {
      '@@x0': String(x0),
      '@@y0': String(y0),
      '@@r': String(r),
      '@@handle': recorder.allocHandle(),
    };
  }
  generate(dest: string[]): void {
    templateReplace(this.replacers, dest, CIRCLE_TEMPLATE);
  }
}

const QUAD_SPLINE_TEMPLATE = `  0
SPLINE
  5
@@handle
330
17
100
AcDbEntity
  8
0
100
AcDbSpline
 70
4
 71
2
 72
6
 73
3
 74
0
 40
0
 40
0
 40
0
 40
1
 40
1
 40
1
 41
1.0
 41
@@w
 41
1.0
 10
@@x0
 20
@@y0
 30
0.0
 10
@@x1
 20
@@y1
 30
0.0
 10
@@x2
 20
@@y2
 30
0.0`
  .split('\n')
  .map((s) => s.replace('\r', ''));

class DxfQuadSpline implements DxfEntity {
  readonly replacers: Replacers;

  constructor(
    recorder: DxfRecorder,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    w: number
  ) {
    this.replacers = {
      '@@x0': String(x0),
      '@@y0': String(y0),
      '@@x1': String(x1),
      '@@y1': String(y1),
      '@@x2': String(x2),
      '@@y2': String(y2),
      '@@w': String(w),
      '@@handle': recorder.allocHandle(),
    };
  }
  generate(dest: string[]): void {
    templateReplace(this.replacers, dest, QUAD_SPLINE_TEMPLATE);
  }
}
