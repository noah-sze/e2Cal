import { describe, it, expect } from 'vitest';
import { generateQrMatrix } from './qrCode';

describe('generateQrMatrix', () => {
  it('generates a valid 25x25 Version 2 QR matrix for https://e2cal.pages.dev/', () => {
    const matrix = generateQrMatrix('https://e2cal.pages.dev/');
    expect(matrix).toHaveLength(25);
    expect(matrix[0]).toHaveLength(25);

    // Top-left finder pattern corners & center
    expect(matrix[0][0]).toBe(true);
    expect(matrix[0][6]).toBe(true);
    expect(matrix[6][0]).toBe(true);
    expect(matrix[3][3]).toBe(true);
    expect(matrix[1][1]).toBe(false);

    // Top-right & bottom-left finder pattern centers
    expect(matrix[3][21]).toBe(true);
    expect(matrix[21][3]).toBe(true);

    // Dark module at (size - 8, 8) = (17, 8)
    expect(matrix[17][8]).toBe(true);
  });
});
