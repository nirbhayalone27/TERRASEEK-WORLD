import { describe, it, expect } from "vitest";
import { json2satrec } from "satellite.js";
import { position, xyz, category } from "./orbit";
import fixture from "./fixtures/orbit.json";
describe("real CelesTrak OMM propagation", () => {
  it("moves a low Earth object over one minute while staying in physical bounds", () => {
    const rec = json2satrec({ ...fixture, EPHEMERIS_TYPE: 0, CLASSIFICATION_TYPE: "U" }),
      t = Date.parse(fixture.EPOCH + "Z");
    const a = position(rec, t)!,
      b = position(rec, t + 60000)!;
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a.alt).toBeGreaterThan(100);
    expect(a.alt).toBeLessThan(2000);
    expect(Math.abs(a.lat - b.lat) + Math.abs(a.lon - b.lon)).toBeGreaterThan(
      0.1,
    );
    expect(a.lat).toBeGreaterThanOrEqual(-90);
    expect(a.lat).toBeLessThanOrEqual(90);
  });
  it("retains Earth-fixed geographic orientation", () => {
    expect(xyz(0, 0)).toEqual([1, 0, -0]);
    expect(xyz(0, 90)[2]).toBeCloseTo(-1);
    expect(xyz(90, 0)[1]).toBeCloseTo(1);
  });
  it("does not label communications and debris as imaging payloads", () => {
    expect(category("STARLINK-123")).toBe("Communications");
    expect(category("SENTINEL-2A")).toBe("Earth observation");
    expect(category("COSMOS DEB")).toBe("Debris / rocket body");
    expect(category("UNKNOWN")).toBe("Other / unclassified");
  });
});
