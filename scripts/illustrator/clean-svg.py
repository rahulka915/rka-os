#!/usr/bin/env python3
"""Strip non-rig content from an Illustrator SVG export.

Hiding a layer before export does NOT keep it out of the file: Illustrator writes
it as a display:none subtree, so a "hidden" working layer still ships every path
and id. Measured: 547 paths exported when 30 were in slots.

Also drops the opacity-0 canvas frame, which exists only to force the viewBox.

Usage: clean-svg.py <svg> [--check]
  --check verifies and reports without writing.
"""
import re
import sys
import xml.etree.ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
DROP_IDS = {"Generated", "Proxy", "Reference", "canvas-frame"}


def hidden(el):
    style = el.get("style", "")
    # Illustrator's spelling of this varies by build - 2026 emits no space, but
    # the project's plan documents a build that emits "display: none". Match both.
    return bool(re.search(r"display:\s*none", style)) or el.get("display") == "none"


def prune(parent):
    """Remove hidden subtrees and known non-rig layers. Returns count removed."""
    removed = 0
    for child in list(parent):
        tag = child.tag.split("}")[-1]
        if tag == "g" and (child.get("id") in DROP_IDS or hidden(child)):
            parent.remove(child)
            removed += 1
            continue
        if tag in ("rect", "path") and child.get("id") == "canvas-frame":
            parent.remove(child)
            removed += 1
            continue
        removed += prune(child)
    return removed


def count_paths(root):
    return sum(1 for el in root.iter() if el.tag.split("}")[-1] == "path")


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    path, check = sys.argv[1], "--check" in sys.argv

    ET.register_namespace("", SVG_NS)
    tree = ET.parse(path)
    root = tree.getroot()

    before = count_paths(root)
    removed = prune(root)
    after = count_paths(root)

    vb = root.get("viewBox")
    ids = sorted({el.get("id") for el in root.iter() if el.get("id")})

    print(f"viewBox: {vb}")
    print(f"paths:   {before} -> {after}   (removed {removed} subtrees)")
    print(f"ids:     {len(ids)}")

    problems = []
    if vb != "0 0 2500 2500":
        problems.append(f"viewBox is {vb!r}, expected '0 0 2500 2500'")
    leftover = [i for i in ids if i in DROP_IDS]
    if leftover:
        problems.append(f"non-rig ids survive: {leftover}")
    # Illustrator uniquifies duplicate ids with a long numeric suffix. Those become
    # Rive shape names verbatim, so they must not reach the export.
    mangled = [i for i in ids if re.search(r"_0{4,}\d", i)]
    if mangled:
        problems.append(f"{len(mangled)} uniquified duplicate ids, e.g. {mangled[0][:48]}...")

    if not check:
        tree.write(path, encoding="utf-8", xml_declaration=True)
        print("written")

    for p in problems:
        print(f"PROBLEM: {p}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
