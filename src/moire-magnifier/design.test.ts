import { expect, test } from "vitest";
import { clearOfQuarterTurn } from "./design";

// The moiré lattice turns by arg(e^{iθ} − s), taking whichever of ±q lies nearer the lens grid's
// x axis. These cases are worked by hand from that.
test.for([
  // 0° at the design with no rotation.
  [0.95, 0],
  // 35.2°.
  [0.95, 2],
  [0.95, -2],
  // Above 1, −q: 34.6°.
  [1.05, -2],
])(
  "at scale ratio %d and rotation %d° the lattice is clear of a quarter-turn",
  ([scaleRatio, rotation]) => {
    expect(clearOfQuarterTurn(scaleRatio, rotation)).toBe(true);
  },
);

test.for([
  // 42.8°: short of 45°, but near enough that a defect could tip it.
  [0.95, 2.6],
  // 45.0°, the limit at the design.
  [0.95, 2.8],
  // 53.1° and 52.2°: past it, as ±1.5° is this near 1.
  [0.98, 1.5],
  [1.02, -1.5],
])(
  "at scale ratio %d and rotation %d° the lattice is near or past a quarter-turn",
  ([scaleRatio, rotation]) => {
    expect(clearOfQuarterTurn(scaleRatio, rotation)).toBe(false);
  },
);
