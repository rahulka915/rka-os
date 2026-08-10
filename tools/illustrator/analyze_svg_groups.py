from copy import deepcopy
from pathlib import Path
import json
import sys
import xml.etree.ElementTree as ET

SVG = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")


def tag(name):
    return f"{{{SVG}}}{name}"


def path_count(node):
    return len(node.findall(f".//{tag('path')}"))


def find_vector_container(root):
    candidates = []
    for group in root.iter(tag("g")):
        direct_groups = sum(1 for child in group if child.tag == tag("g"))
        count = path_count(group)
        if direct_groups >= 5 and count >= 100:
            candidates.append((len(list(group.iter())), group))
    if not candidates:
        raise RuntimeError("Could not find the generated vector container")
    candidates.sort(key=lambda item: item[0])
    return candidates[0][1]


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: analyze_svg_groups.py input.svg output-directory")

    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)

    tree = ET.parse(source)
    root = tree.getroot()
    defs = root.find(tag("defs"))
    container = find_vector_container(root)
    branches = [child for child in container if child.tag == tag("g")]
    manifest = []

    for index, branch in enumerate(branches, 1):
        name = branch.get("data-name") or branch.get("id") or f"branch-{index:02}"
        preview_root = ET.Element(tag("svg"), {
            "width": "1255",
            "height": "1255",
            "viewBox": "1429.4248 0 1255 1255",
        })
        if defs is not None:
            preview_root.append(deepcopy(defs))
        preview_root.append(deepcopy(branch))
        preview_path = output / f"branch-{index:02}.svg"
        ET.ElementTree(preview_root).write(preview_path, encoding="utf-8", xml_declaration=True)
        manifest.append({"index": index, "name": name, "paths": path_count(branch), "file": preview_path.name})

    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
