import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutGraph, type Box } from "./layout.ts";

const box = (id: string, group = "software"): Box => ({ id, width: 160, height: 100, group });

const chain = [
  { item_id: "compiler", depends_on_id: "rust" },
  { item_id: "rust", depends_on_id: "basics" },
];

test("prerequisites are laid out to the left of what they unlock", () => {
  const positions = layoutGraph([box("compiler"), box("rust"), box("basics")], chain);
  const x = (id: string) => positions.get(id)!.x;
  assert.ok(x("basics") < x("rust"));
  assert.ok(x("rust") < x("compiler"));
});

test("unconnected items still get a position", () => {
  const positions = layoutGraph([box("a"), box("b")], []);
  assert.equal(positions.size, 2);
});

test("no two boxes overlap", () => {
  const boxes = [
    ...["a", "b", "c", "d", "e"].map((id) => box(id, "music")),
    ...["f", "g", "h"].map((id) => box(id, "software")),
    box("i", "none"),
  ];
  const positions = layoutGraph(boxes, [{ item_id: "b", depends_on_id: "a" }]);
  const ids = boxes.map((b) => b.id);
  for (const p of ids) {
    for (const q of ids) {
      if (p >= q) continue;
      const a = positions.get(p)!;
      const b = positions.get(q)!;
      const apart = Math.abs(a.x - b.x) >= 160 || Math.abs(a.y - b.y) >= 100;
      assert.ok(apart, `${p} and ${q} overlap`);
    }
  }
});

test("the same input always gives the same layout", () => {
  const boxes = [box("compiler"), box("rust"), box("basics"), box("x", "music")];
  assert.deepEqual(layoutGraph(boxes, chain), layoutGraph(boxes, chain));
});
