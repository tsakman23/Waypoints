import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutGraph } from "./layout.ts";

const box = (id: string) => ({ id, width: 100, height: 50 });

test("prerequisites are laid out to the left of what they unlock", () => {
  const positions = layoutGraph(
    [box("compiler"), box("rust"), box("basics")],
    [
      { item_id: "compiler", depends_on_id: "rust" },
      { item_id: "rust", depends_on_id: "basics" },
    ],
  );
  const x = (id: string) => positions.get(id)!.x;
  assert.ok(x("basics") < x("rust"));
  assert.ok(x("rust") < x("compiler"));
});

test("unconnected items still get a position", () => {
  const positions = layoutGraph([box("a"), box("b")], []);
  assert.equal(positions.size, 2);
});
