import { describe, it, expect } from "vitest";
import { spectralDifference } from "./spectral";
import { pairIssues } from "./catalog";
import { interpret } from "./api";
const a = { red: [0.2, 0.2], nir: [0.6, 0.6], green: [0.2, 0.2], scl: [4, 9] };
describe("spectral evidence", () => {
  it("intersects cloud masks before measuring loss", () => {
    const r = spectralDifference(a, { ...a, nir: [0.2, 0.2], scl: [4, 4] });
    expect(r.valid).toBe(1);
    expect(r.loss).toBe(1);
    expect(r.total).toBe(2);
  });
  it("does not count nodata as change", () => {
    const r = spectralDifference({ ...a, nir: [NaN, 0.6] }, a);
    expect(r.valid).toBe(0);
  });
  it("rejects shape mismatch", () =>
    expect(() => spectralDifference(a, { ...a, red: [0.2] })).toThrow());
  it("rejects invalid threshold", () =>
    expect(() => spectralDifference(a, a, -1)).toThrow());
  it("rejects incompatible grids and reverse dates", () => {
    expect(
      pairIssues(
        { id: "a", date: "2025-02-01", epsg: 32643, tile: "A" } as any,
        { id: "b", date: "2025-01-01", epsg: 32644, tile: "B" } as any,
      ),
    ).toHaveLength(2);
  });
  it("extracts a deterministic request", () => {
    expect(
      interpret("Show vegetation loss near Pune between 2022 and 2025"),
    ).toEqual({
      place: "Pune",
      mode: "vegetation",
      start: "2022-01-01",
      end: "2025-12-31",
    });
  });
});
