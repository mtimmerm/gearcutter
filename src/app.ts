/**
 * Copyright 2022 Matthew David Timmermans
 *
 * This work is licensed under the Creative Commons Attribution 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
 * send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA
 */
import { CanvasPen } from './CanvasPen';
import { GearCutter } from './GearCutter';
import { makeRack, RackProps } from './rack';
import { RecordingPen } from './RecordingPen';
import { SvgRecorder } from './svg';
import { Pen, PathFunc } from './types';
import { XFormPen } from './XFormPen';

//slider values
const DEFAULT_CLEARANCE_PERCENT = 15;
let clearancePercent = DEFAULT_CLEARANCE_PERCENT;
const DEFAULT_BACKLASH_PERCENT = 0;
let backlashPercent = DEFAULT_BACKLASH_PERCENT;
const DEFAULT_BALANCE_PERCENT = 50;
let balancePercent = DEFAULT_BALANCE_PERCENT;
const DEFAUT_PRESSURE_ANGLE = 20;
let pressureAngle = DEFAUT_PRESSURE_ANGLE;
const DEFAULT_CONTACT_RATIO = 1.5;
let contactRatio = DEFAULT_CONTACT_RATIO;
const DEFAULT_PROFILE_SHIFT_PERCENT = 0;
let profileShift = DEFAULT_PROFILE_SHIFT_PERCENT;
const DEFAULT_GEAR_TEETH = 14;
let gearTeeth = DEFAULT_GEAR_TEETH;
const DEFAULT_PINION_TEETH = 8;
let pinionTeeth = DEFAULT_PINION_TEETH;
const DEFAULT_IS_INTERNAL = false;
let isInternal = DEFAULT_IS_INTERNAL;
const DEFAULT_FACE_TOL = 0.05;
let faceTolPercent = DEFAULT_FACE_TOL;
const DEFAULT_FILLET_TOL = 0.5;
let filletTolPercent = DEFAULT_FILLET_TOL;
const DEFAULT_SIZE_NUMBER = 1;
const DEFAULT_SIZE_UNIT = 'mm';
const DEFAULT_SIZE_MEASUREMENT = 'mod';
let sizeNumber = DEFAULT_SIZE_NUMBER;
let sizeMeasurement = DEFAULT_SIZE_MEASUREMENT;
let sizeUnit = DEFAULT_SIZE_UNIT;

const SIZE_UNITS: Record<string, number> = {
  px: 1,
  mm: 96 / 25.4,
  in: 96,
  ptmm: 72 / 25.4,
  ptin: 72,
};

let animationStartTime = Date.now();

let gearRadius: number = 0;
let pinionRadius: number = 0;
let stdRack: PathFunc = () => {};
let gearRack: PathFunc = () => {};
let pinionRack: PathFunc = () => {};
let pinionPath: PathFunc | null | undefined;
let gearPath: PathFunc | null | undefined;
let pinionSvgUrl: string | null | undefined;
let gearSvgUrl: string | null | undefined;
let pinionSegsPerTooth: number = 0;
let gearSegsPerTooth: number = 0;

function update() {
  let params = new URLSearchParams((window.location.hash || '').substring(1));
  pressureAngle = numberParam(params, 'pa', 10, 30, DEFAUT_PRESSURE_ANGLE);
  clearancePercent = numberParam(params, 'clr', 0, 50, DEFAULT_CLEARANCE_PERCENT);
  backlashPercent = numberParam(params, 'bkl', 0, 50, DEFAULT_BACKLASH_PERCENT);
  balancePercent = numberParam(params, 'bp', 0, 100, DEFAULT_BALANCE_PERCENT);
  contactRatio = numberParam(params, 'cr', 1, 2.5, DEFAULT_CONTACT_RATIO);
  profileShift = numberParam(params, 'ps', -100, 100, DEFAULT_PROFILE_SHIFT_PERCENT);
  pinionTeeth = numberParam(params, 'pt', 4, 200, DEFAULT_PINION_TEETH);
  gearTeeth = numberParam(params, 'gt', -300, 300, DEFAULT_GEAR_TEETH);
  isInternal = false;
  if (gearTeeth < 0) {
    gearTeeth = -gearTeeth;
    isInternal = true;
  }
  if (gearTeeth < 4) {
    gearTeeth = 4;
  }
  if (isInternal && gearTeeth <= pinionTeeth) {
    gearTeeth = pinionTeeth + 1;
  }
  faceTolPercent = numberParam(params, 'ft', 0.000001, 10, DEFAULT_FACE_TOL);
  filletTolPercent = numberParam(params, 'fit', 0.000001, 10, DEFAULT_FILLET_TOL);

  gearRadius = (gearTeeth * 0.5) / Math.PI;
  pinionRadius = (pinionTeeth * 0.5) / Math.PI;

  let szLen: number;
  if (params.get('mod')) {
    szLen = 1.0 / Math.PI;
    sizeMeasurement = 'mod';
  } else if (params.get('dp')) {
    szLen = 1.0;
    sizeMeasurement = 'dp';
  } else if (params.get('cd')) {
    szLen = gearRadius + (isInternal ? -pinionRadius : pinionRadius);
    sizeMeasurement = 'cd';
  } else {
    szLen = 1.0 / Math.PI;
    sizeMeasurement = 'mod';
  }
  const szString: string = stringParam(params, sizeMeasurement, '');
  sizeUnit = szString.match(/[a-zA-Z]+$/)?.[0] || '';
  sizeNumber = Number(szString.substring(0, szString.length - sizeUnit.length));
  if (!isFinite(sizeNumber) || sizeNumber <= 0) {
    sizeNumber = DEFAULT_SIZE_NUMBER;
  }
  if (!SIZE_UNITS[sizeUnit]) {
    sizeUnit = 'mm';
  }
  const svgScale = (sizeNumber * SIZE_UNITS[sizeUnit]!) / szLen;

  setNumber('pa', pressureAngle);
  setNumber('cr', contactRatio);
  setNumber('gt', gearTeeth);
  setCheck('isinternal', isInternal);
  setNumber('pt', pinionTeeth);
  setNumber('ps', profileShift);
  setNumber('bp', balancePercent);
  setNumber('clr', clearancePercent);
  setNumber('bkl', backlashPercent);
  setNumber('ft', faceTolPercent);
  setNumber('fit', filletTolPercent);
  setNumber('sz', sizeNumber);
  setString('meas', sizeMeasurement);
  setString('unit', sizeUnit);

  const rackProps: RackProps = {
    contactRatio,
    pressureAngle,
    profileShift,
    balancePercent,
    balanceAbsPercent: 0.0,
    topClrPercent: 0,
    botClrPercent: 0,
  };

  stdRack = makeRack(rackProps);
  pinionRack = makeRack({
    ...rackProps,
    botClrPercent: clearancePercent,
    balanceAbsPercent: backlashPercent * -0.5,
  });
  gearRack = makeRack({
    ...rackProps,
    balancePercent: isInternal ? rackProps.balancePercent : 100 - rackProps.balancePercent,
    profileShift: isInternal ? profileShift : -profileShift,
    botClrPercent: isInternal ? 0 : clearancePercent,
    topClrPercent: isInternal ? clearancePercent : 0,
    balanceAbsPercent: backlashPercent * (isInternal ? 0.5 : -0.5),
  });

  const faceT = faceTolPercent / (100 * Math.PI);
  const filletT = filletTolPercent / (100 * Math.PI);

  const pinionCutter = new GearCutter(pinionTeeth, pinionRadius, faceT, filletT);
  pinionRack(new XFormPen(pinionCutter).rotate(-90).translate(0, pinionRadius), true);
  const pinionRecorder = new RecordingPen();
  pinionCutter.drawToothPath(pinionRecorder, true);
  pinionPath = pinionRecorder.path;
  pinionSegsPerTooth = pinionRecorder.countSegments();

  const gearCutter = new GearCutter(gearTeeth, gearRadius, faceT, filletT);
  gearRack(new XFormPen(gearCutter).rotate(-90).translate(0, gearRadius), true);
  const gearRecorder = new RecordingPen();
  gearCutter.drawToothPath(gearRecorder, true);
  gearPath = gearRecorder.path;
  gearSegsPerTooth = gearRecorder.countSegments();

  // Set pinion download links
  if (pinionSvgUrl) {
    URL.revokeObjectURL(pinionSvgUrl);
  }
  pinionSvgUrl = createSvgObjectUrl(svgScale, pinionPath, pinionRadius, pinionTeeth);
  (document.getElementById('img1') as HTMLImageElement).src = pinionSvgUrl;
  (document.getElementById('link1') as HTMLAnchorElement).href = pinionSvgUrl;
  (document.getElementById('link1') as HTMLAnchorElement).download = `pinion${pinionTeeth}pa${pressureAngle}.svg`;
  (document.getElementById('svgTitle1') as HTMLElement).innerText = `Pinion (${pinionSegsPerTooth} arcs/tooth)`;

  // Set gear download links
  if (gearSvgUrl) {
    URL.revokeObjectURL(gearSvgUrl);
  }
  gearSvgUrl = createSvgObjectUrl(svgScale, gearPath, gearRadius, gearTeeth);
  (document.getElementById('img2') as HTMLImageElement).src = gearSvgUrl;
  (document.getElementById('link2') as HTMLAnchorElement).href = gearSvgUrl;
  (document.getElementById('link2') as HTMLAnchorElement).download = `gear${gearTeeth}pa${pressureAngle}.svg`;
  (document.getElementById('svgTitle2') as HTMLElement).innerText = `Gear (${gearSegsPerTooth} arcs/tooth)`;
}

function submit() {
  const fields: [string, number][] = [
    ['pa', DEFAUT_PRESSURE_ANGLE],
    ['cr', DEFAULT_CONTACT_RATIO],
    ['gt', -1],
    ['pt', -1],
    ['ps', DEFAULT_PROFILE_SHIFT_PERCENT],
    ['bp', DEFAULT_BALANCE_PERCENT],
    ['clr', DEFAULT_CLEARANCE_PERCENT],
    ['bkl', DEFAULT_BACKLASH_PERCENT],
    ['ft', DEFAULT_FACE_TOL],
    ['fit', DEFAULT_FILLET_TOL],
  ];
  let parts: string[] = [];
  for (const [id, defval] of fields) {
    let val = (document.getElementById(id) as HTMLInputElement).value.trim();
    if (id === 'gt' && (document.getElementById('isinternal') as HTMLInputElement).checked) {
      val = '-' + val;
    }
    if (val !== String(defval)) {
      parts.push(id + '=' + val);
    }
  }
  const sz = Number((document.getElementById('sz') as HTMLInputElement).value) || DEFAULT_SIZE_NUMBER;
  const meas = (document.getElementById('meas') as HTMLInputElement).value;
  const unit = (document.getElementById('unit') as HTMLInputElement).value;
  if (meas !== DEFAULT_SIZE_MEASUREMENT || sz !== DEFAULT_SIZE_NUMBER || unit !== DEFAULT_SIZE_UNIT) {
    parts.push(`${meas}=${sz}${unit}`);
  }
  let newhash = '#' + parts.join('&');
  if (newhash != window.location.hash) {
    window.location.hash = newhash;
  } else {
    update();
  }
}

function createSvgObjectUrl(svgScale: number, path: PathFunc, pitchRadius: number, nTeeth: number) {
  const svg = new SvgRecorder({
    scale: -svgScale,
  });
  svg.drawCircle(
    {
      stroke: 'blue',
      strokeWidth: 0.01,
    },
    0,
    0,
    pitchRadius
  );
  svg.draw(
    {
      stroke: 'black',
      strokeWidth: 0.01,
    },
    (pen, domove) => {
      for (let i = 0; i < nTeeth; ++i) {
        const p = new XFormPen(pen);
        p.rotate((i * 360) / nTeeth);
        path(p, domove);
        domove = false;
      }
    }
  );
  const blob = new Blob([svg.getSvgText()], { type: 'image/svg+xml' });
  return URL.createObjectURL(blob);
}

function setNumber(id: string, val: number) {
  (document.getElementById(id) as HTMLInputElement).value = String(val);
}

function setString(id: string, val: string) {
  (document.getElementById(id) as HTMLInputElement).value = val;
}

function setCheck(id: string, val: boolean) {
  (document.getElementById(id) as HTMLInputElement).checked = val;
}

function numberParam(
  params: Record<string, any>,
  name: string,
  minval: number | null | undefined,
  maxval: number | null | undefined,
  defval: number
) {
  let v = params.get(name);
  if (v == null) {
    return defval;
  }
  v = Number(v);
  if (isNaN(v)) {
    return defval;
  }
  if (minval != null && v < minval) {
    return minval;
  }
  if (maxval != null && v > maxval) {
    return maxval;
  }
  return v;
}

function stringParam(params: Record<string, any>, name: string, defval: string) {
  return params.get(name) || defval;
}

function drawRack(pen: Pen, rack: PathFunc, shift: number, mint: number, maxt: number) {
  mint -= shift;
  maxt -= shift;
  let start = Math.floor(mint + 0.5);
  const xpen = new XFormPen(pen);
  rack(xpen.copy().translate(start + shift, 0), true);
  for (let t = start + 1; t < maxt + 0.9; t++) {
    rack(xpen.copy().translate(t + shift, 0), false);
  }
}

/*
 * Set up and start a new maze generation
 */
function animationFrame() {
  let canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const cwid = canvas.width;
  const chei = canvas.height;
  let ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.save();
  ctx.clearRect(0, 0, cwid, chei);
  let scale = cwid / 3;
  const pen = new XFormPen(new CanvasPen(ctx)).translate(cwid / 2, chei / 2).scale(scale, true);
  let shift = Date.now() - animationStartTime;
  shift /= 4000;
  shift -= Math.floor(shift);
  ctx.beginPath();
  ctx.strokeStyle = '#A0A0A0';
  drawRack(pen, stdRack, shift, -1.5, 1.5);
  ctx.stroke();
  ctx.strokeStyle = '#000000';
  const bkwAdjust = backlashPercent / (400 * Math.PI);
  if (pinionPath) {
    ctx.beginPath();
    const p = pen
      .copy()
      .translate(0, -pinionRadius)
      .rotate(90 - 360 / pinionTeeth);
    p.rotate(((shift + bkwAdjust) * -360) / pinionTeeth);
    pinionPath(p, true);
    p.rotate(360 / pinionTeeth);
    pinionPath(p, true);
    p.rotate(360 / pinionTeeth);
    pinionPath(p, true);
    p.rotate(360 / pinionTeeth);
    pinionPath(p, true);
    p.rotate(360 / pinionTeeth);
    pinionPath(p, true);
    ctx.stroke();
  }
  if (gearPath) {
    ctx.beginPath();
    let p: XFormPen;
    let sh = shift;
    if (isInternal) {
      p = pen
        .copy()
        .translate(0, -gearRadius)
        .rotate(90 - 360 / gearTeeth);
    } else {
      p = pen
        .copy()
        .translate(0, gearRadius)
        .scale(1, true)
        .rotate(90 - 360 / gearTeeth);
      sh += -0.5;
      sh -= Math.floor(sh);
    }
    p.rotate(((sh - bkwAdjust) * -360) / gearTeeth);
    gearPath(p, true);
    p.rotate(360 / gearTeeth);
    gearPath(p, true);
    p.rotate(360 / gearTeeth);
    gearPath(p, true);
    p.rotate(360 / gearTeeth);
    gearPath(p, true);
    p.rotate(360 / gearTeeth);
    gearPath(p, true);
    ctx.stroke();
  }
  ctx.restore();
  requestAnimationFrame(animationFrame);
}

update();
window.onhashchange = update;
document.getElementById('submit')!.onclick = submit;
requestAnimationFrame(animationFrame);
