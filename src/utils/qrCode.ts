/**
 * 輕量級離線 QR Code 矩陣產生器（ISO/IEC 18004 Byte Mode）
 * 支援 Version 1–4（ECC Level L），供 Canvas 離線繪製分享網址二維碼，零外部依賴。
 */

interface QrVersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  eccCodewords: number;
  alignmentCenters: readonly number[];
}

const QR_VERSIONS_L: readonly QrVersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, eccCodewords: 7, alignmentCenters: [] },
  { version: 2, size: 25, dataCodewords: 34, eccCodewords: 10, alignmentCenters: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, eccCodewords: 15, alignmentCenters: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, eccCodewords: 20, alignmentCenters: [6, 26] },
];

// GF(256) 指數與對數查表（本原多項式 x^8 + x^4 + x^3 + x^2 + 1 = 0x11D）
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildRsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function computeRsEcc(data: Uint8Array, eccCount: number): Uint8Array {
  const gen = buildRsGenerator(eccCount);
  const rem = new Uint8Array(eccCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[eccCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < eccCount; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

function encodeDataCodewords(bytes: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const totalBits = spec.dataCodewords * 8;
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Byte mode indicator (0100) + 8-bit character count
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) {
    pushBits(b, 8);
  }

  // Terminator (up to 4 zero bits)
  const terminatorLen = Math.min(4, totalBits - bits.length);
  pushBits(0, terminatorLen);

  // Byte align
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const out = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let val = 0;
    for (let b = 0; b < 8; b++) {
      val = (val << 1) | bits[i * 8 + b];
    }
    out[i] = val;
  }

  // Pad codewords 0xEC, 0x11
  let idx = bits.length / 8;
  let padToggle = true;
  while (idx < spec.dataCodewords) {
    out[idx++] = padToggle ? 0xec : 0x11;
    padToggle = !padToggle;
  }

  return out;
}

function computeFormatBits(maskId: number): number {
  // ECC Level L = 01
  const data = (0b01 << 3) | (maskId & 0x7);
  let rem = data << 10;
  for (let i = 4; i >= 0; i--) {
    if ((rem >> (i + 10)) & 1) {
      rem ^= 0x537 << i;
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function placeFinderPattern(
  modules: boolean[][],
  reserved: boolean[][],
  row: number,
  col: number,
  size: number
) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const inBox = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const isDark =
        inBox &&
        (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      modules[rr][cc] = isDark;
      reserved[rr][cc] = true;
    }
  }
}

function placeAlignmentPattern(
  modules: boolean[][],
  reserved: boolean[][],
  centerR: number,
  centerC: number
) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = centerR + r;
      const cc = centerC + c;
      if (reserved[rr][cc]) return;
    }
  }
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = centerR + r;
      const cc = centerC + c;
      modules[rr][cc] = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
      reserved[rr][cc] = true;
    }
  }
}

function applyFormatInfo(modules: boolean[][], size: number, maskId: number) {
  const fmt = computeFormatBits(maskId);
  for (let i = 0; i < 15; i++) {
    const bit = ((fmt >> i) & 1) === 1;
    // Vertical + Horizontal top-left
    if (i < 6) {
      modules[i][8] = bit;
    } else if (i < 8) {
      modules[i + 1][8] = bit;
    } else {
      modules[size - 15 + i][8] = bit;
    }

    if (i < 8) {
      modules[8][size - 1 - i] = bit;
    } else if (i < 9) {
      modules[8][15 - i] = bit;
    } else {
      modules[8][15 - i - 1] = bit;
    }
  }
  // Dark module
  modules[size - 8][8] = true;
}

function maskCondition(maskId: number, r: number, c: number): boolean {
  switch (maskId) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return false;
  }
}

function scorePenalty(modules: boolean[][]): number {
  const size = modules.length;
  let penalty = 0;

  // Rule 1: 5+ consecutive same-color modules
  for (let r = 0; r < size; r++) {
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (modules[r][c] === modules[r][c - 1]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  for (let c = 0; c < size; c++) {
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (modules[r][c] === modules[r - 1][c]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const val = modules[r][c];
      if (
        modules[r][c + 1] === val &&
        modules[r + 1][c] === val &&
        modules[r + 1][c + 1] === val
      ) {
        penalty += 3;
      }
    }
  }

  return penalty;
}

/**
 * 產生指定字串的標準 QR Code 雙維布林矩陣（true = 黑塊，false = 白塊）
 */
export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const spec = QR_VERSIONS_L.find((v) => v.dataCodewords - 2 >= bytes.length);
  if (!spec) {
    throw new Error(`QR payload too long (${bytes.length} bytes)`);
  }

  const data = encodeDataCodewords(bytes, spec);
  const ecc = computeRsEcc(data, spec.eccCodewords);
  const fullCodewords = new Uint8Array(data.length + ecc.length);
  fullCodewords.set(data, 0);
  fullCodewords.set(ecc, data.length);

  const size = spec.size;
  const baseModules: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false)
  );

  // Finder patterns
  placeFinderPattern(baseModules, reserved, 0, 0, size);
  placeFinderPattern(baseModules, reserved, 0, size - 7, size);
  placeFinderPattern(baseModules, reserved, size - 7, 0, size);

  // Alignment patterns
  for (const r of spec.alignmentCenters) {
    for (const c of spec.alignmentCenters) {
      placeAlignmentPattern(baseModules, reserved, r, c);
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    if (!reserved[6][i]) {
      baseModules[6][i] = dark;
      reserved[6][i] = true;
    }
    if (!reserved[i][6]) {
      baseModules[i][6] = dark;
      reserved[i][6] = true;
    }
  }

  // Reserve format info area
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
  reserved[size - 8][8] = true;

  // Place data bits in zig-zag order
  let bitIdx = 0;
  const totalDataBits = fullCodewords.length * 8;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset++) {
        const c = right - offset;
        if (reserved[r][c]) continue;
        let bit = false;
        if (bitIdx < totalDataBits) {
          const byteVal = fullCodewords[bitIdx >> 3];
          bit = ((byteVal >> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx++;
        }
        baseModules[r][c] = bit;
      }
    }
    upward = !upward;
  }

  // Try all 8 masks and pick lowest penalty
  let bestMatrix = baseModules;
  let bestPenalty = Infinity;

  for (let maskId = 0; maskId < 8; maskId++) {
    const candidate = baseModules.map((row, r) =>
      row.map((val, c) => (!reserved[r][c] && maskCondition(maskId, r, c) ? !val : val))
    );
    applyFormatInfo(candidate, size, maskId);
    const p = scorePenalty(candidate);
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMatrix = candidate;
    }
  }

  return bestMatrix;
}
