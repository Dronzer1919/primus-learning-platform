import { SHAPE_GROUPS, SHAPE_PALETTE } from './flowchart.model';

// flowchart.model.ts is mostly types/constants, but SHAPE_PALETTE is a derived data
// contract (a flat reduce of SHAPE_GROUPS) that the flowchart component, its export
// service, and the palette UI all rely on staying in sync with the grouped source of
// truth. This suite exists to catch that contract silently drifting.
describe('flowchart.model — SHAPE_PALETTE contract', () => {
  it('contains exactly the shapes from every group, in order', () => {
    const expected = SHAPE_GROUPS.reduce((all: typeof SHAPE_PALETTE, g) => all.concat(g.shapes), []);
    expect(SHAPE_PALETTE).toEqual(expected);
  });

  it('has no duplicate shape types', () => {
    const types = SHAPE_PALETTE.map((s) => s.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('gives every palette shape a positive width and height', () => {
    for (const shape of SHAPE_PALETTE) {
      expect(shape.w).toBeGreaterThan(0);
      expect(shape.h).toBeGreaterThan(0);
    }
  });

  it('gives every palette shape a non-empty label and meaning', () => {
    for (const shape of SHAPE_PALETTE) {
      expect(shape.label.trim().length).toBeGreaterThan(0);
      expect(shape.meaning.trim().length).toBeGreaterThan(0);
    }
  });

  it('every group has at least one shape', () => {
    for (const group of SHAPE_GROUPS) {
      expect(group.shapes.length).toBeGreaterThan(0);
    }
  });
});
