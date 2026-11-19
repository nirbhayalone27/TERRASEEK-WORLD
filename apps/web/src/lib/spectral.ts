export function spectralDifference(
  a: { red: number[]; nir: number[]; green: number[]; scl: number[] },
  b: typeof a,
  threshold = 0.2,
) {
  const n = a.red.length;
  if (
    !n ||
    Object.values(a).some((v) => v.length !== n) ||
    Object.values(b).some((v) => v.length !== n)
  )
    throw Error("Band dimensions do not match");
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 2)
    throw Error("Invalid index threshold");
  const mask = new Uint8ClampedArray(n * 4),
    waterMask = new Uint8ClampedArray(n * 4);
  let valid = 0,
    loss = 0,
    gain = 0,
    waterGain = 0,
    waterLoss = 0,
    ndviBefore = 0,
    ndviAfter = 0,
    waterBefore = 0,
    waterAfter = 0,
    waterAppeared = 0,
    waterDisappeared = 0;
  for (let i = 0; i < n; i++) {
    if (![4, 5, 6].includes(a.scl[i]) || ![4, 5, 6].includes(b.scl[i]))
      continue;
    const vals = [
      a.red[i],
      a.nir[i],
      a.green[i],
      b.red[i],
      b.nir[i],
      b.green[i],
    ];
    if (vals.some((v) => !Number.isFinite(v) || v < 0 || v > 1.5)) continue;
    if (
      a.nir[i] + a.red[i] <= 0.01 ||
      b.nir[i] + b.red[i] <= 0.01 ||
      a.green[i] + a.nir[i] <= 0.01 ||
      b.green[i] + b.nir[i] <= 0.01
    )
      continue;
    const na = (a.nir[i] - a.red[i]) / (a.nir[i] + a.red[i]),
      nb = (b.nir[i] - b.red[i]) / (b.nir[i] + b.red[i]);
    const wa = (a.green[i] - a.nir[i]) / (a.green[i] + a.nir[i]),
      wb = (b.green[i] - b.nir[i]) / (b.green[i] + b.nir[i]);
    if (wa > 0.2) waterBefore++;
    if (wb > 0.2) waterAfter++;
    if (wa <= 0.2 && wb > 0.2) waterAppeared++;
    if (wa > 0.2 && wb <= 0.2) waterDisappeared++;
    valid++;
    ndviBefore += na;
    ndviAfter += nb;
    if (nb - na < -threshold) {
      loss++;
      mask.set([245, 116, 83, 225], i * 4);
    } else if (nb - na > threshold) {
      gain++;
      mask.set([111, 214, 166, 225], i * 4);
    }
    if (wb - wa > threshold) {
      waterGain++;
      waterMask.set([28, 133, 255, 225], i * 4);
    }
    if (wb - wa < -threshold) {
      waterLoss++;
      waterMask.set([255, 164, 45, 225], i * 4);
    }
  }
  return {
    valid,
    total: n,
    loss,
    gain,
    waterGain,
    waterLoss,
    waterBefore,
    waterAfter,
    waterAppeared,
    waterDisappeared,
    waterThreshold: 0.2,
    ndviBefore: valid ? ndviBefore / valid : null,
    ndviAfter: valid ? ndviAfter / valid : null,
    mask,
    waterMask,
  };
}
