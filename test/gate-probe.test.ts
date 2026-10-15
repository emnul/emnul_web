import { expect, test } from "vitest";

// Throwaway probe for RED-26: proves a failing unit test blocks merging. Never merge.
test("Workers Builds gate probe", () => {
  expect(1).toBe(2);
});
