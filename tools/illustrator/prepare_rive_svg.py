#!/usr/bin/env python3

import argparse
import copy
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path


SVG_NS = "http://www.w3.org/2000/svg"
NS = f"{{{SVG_NS}}}"
ET.register_namespace("", SVG_NS)


SEMANTIC_GROUP_NAMES = {
    (3, 1): "Skin and Face",
    (3, 1, 1): "Face",
    (3, 1, 1, 1): "Eye Details",
    (3, 1, 1, 2): "Face Details",
    (3, 2): "Clothing and Limbs",
    (3, 2, 1): "Body Silhouette",
    (3, 2, 1, 1): "Scabbard Tip",
    (3, 2, 1, 2): "Outfit and Limbs",
    (3, 2, 1, 2, 1): "Outfit Core",
    (3, 2, 1, 2, 1, 1): "Small Outfit Details",
    (3, 2, 1, 2, 1, 2): "Outfit Shapes",
    (3, 2, 1, 2, 1, 2, 1): "Sash Detail",
    (3, 3): "Sword Hand Detail",
    (4, 1): "Hair and Bandana Details",
    (4, 1, 1): "Bandana Tails",
    (5, 1): "Tail",
    (5, 1, 1): "Tail Stripes",
    (5, 2): "Body Head and Legs",
    (5, 2, 1): "Head and Legs",
    (5, 2, 1, 1): "Head and Feet",
    (5, 2, 1, 1, 1): "Head",
    (5, 2, 1, 1, 1, 1): "Eye",
    (6, 1): "Backpack Body",
    (6, 1, 1): "Pack and Bedroll",
    (6, 1, 1, 1): "Pack Detail",
    (6, 1, 1, 2): "Pack and Bedroll Fills",
    (6, 1, 1, 2, 1): "Bedroll",
    (6, 1, 1, 2, 1, 1): "Bedroll Core",
}


RIG_READINESS = [
    {"part": "Ronin rear boot", "status": "separate", "group": "RONIN / Rear Boot"},
    {"part": "Ronin sword", "status": "separate", "group": "RONIN / Sword"},
    {"part": "Ronin backpack", "status": "separate", "group": "RONIN / Backpack"},
    {"part": "Ronin hair and bandana", "status": "partially-separated", "group": "RONIN / Hair + Bandana"},
    {"part": "Ronin head, torso, arms and legs", "status": "fused-by-paint-order", "group": "RONIN / Body"},
    {"part": "Cat tail", "status": "separate", "group": "CAT / Character / Tail"},
    {"part": "Cat head, body and legs", "status": "fused-by-paint-order", "group": "CAT / Character / Body Head and Legs"},
]


SUGGESTED_PIVOTS = {
    "coordinateSpace": "1255x1255 artboard; verify after Rive import",
    "ronin": {
        "root": [755, 820],
        "head": [735, 465],
        "rearShoulder": [665, 535],
        "rearElbow": [650, 670],
        "rearWrist": [690, 745],
        "frontShoulder": [815, 545],
        "frontElbow": [835, 645],
        "frontWrist": [865, 690],
        "rearHip": [710, 810],
        "rearKnee": [675, 900],
        "rearAnkle": [680, 970],
        "frontHip": [825, 805],
        "frontKnee": [850, 900],
        "frontAnkle": [885, 970],
    },
    "cat": {
        "root": [365, 890],
        "head": [445, 810],
        "tailBase": [285, 860],
        "rearHip": [330, 900],
        "frontShoulder": [430, 885],
    },
}


def safe_id(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", value).strip("_")


def path_count(element: ET.Element) -> int:
    return sum(1 for child in element.iter() if child.tag == NS + "path")


def find_artwork_container(root: ET.Element) -> ET.Element:
    candidates = [
        group
        for group in root.iter(NS + "g")
        if sum(1 for child in group if child.tag == NS + "g") >= 6
        and path_count(group) >= 160
    ]
    if not candidates:
        raise ValueError("Could not find the generated vector artwork container")
    return min(candidates, key=path_count)


def name_descendants(group: ET.Element, prefix: str, structural_path: tuple[int, ...]) -> None:
    group_number = 0
    path_number = 0
    for child in group:
        if child.tag == NS + "g":
            group_number += 1
            existing = child.get("data-name") or child.get("id")
            child_path = structural_path + (group_number,)
            name = SEMANTIC_GROUP_NAMES.get(child_path) or existing or f"Group {group_number:02d}"
            full_name = f"{prefix} / {name}"
            child.set("id", safe_id(full_name))
            child.set("data-name", full_name)
            name_descendants(child, full_name, child_path)
        elif child.tag == NS + "path":
            path_number += 1
            child.set("id", safe_id(f"{prefix} / Shape {path_number:02d}"))
            child.set("data-name", f"{prefix} / Shape {path_number:02d}")


def prepare(source: Path, destination: Path, manifest_path: Path) -> None:
    tree = ET.parse(source)
    source_root = tree.getroot()
    source_container = find_artwork_container(source_root)
    container = copy.deepcopy(source_container)

    primary_names = [
        "RONIN / Rear Boot",
        "RONIN / Sword",
        "RONIN / Body",
        "RONIN / Hair + Bandana",
        "CAT / Character",
        "RONIN / Backpack",
    ]
    primary_groups = [child for child in container if child.tag == NS + "g"]
    if len(primary_groups) != len(primary_names):
        raise ValueError(f"Expected 6 primary groups, found {len(primary_groups)}")

    manifest = []
    for primary_index, (group, name) in enumerate(zip(primary_groups, primary_names), 1):
        group.set("id", safe_id(name))
        group.set("data-name", name)
        name_descendants(group, name, (primary_index,))
        manifest.append({"name": name, "paths": path_count(group)})

    loose_path_number = 0
    for child in container:
        if child.tag == NS + "path":
            loose_path_number += 1
            name = f"RONIN / Shared Detail {loose_path_number:02d}"
            child.set("id", safe_id(name))
            child.set("data-name", name)

    container.set("id", "RKA_Rive_Source")
    container.set("data-name", "RKA Rive Source")

    output_root = ET.Element(
        NS + "svg",
        {
            "width": "1255",
            "height": "1255",
            "viewBox": "0 0 1255 1255",
            "fill": "none",
        },
    )
    defs = source_root.find(NS + "defs")
    if defs is not None:
        output_root.append(copy.deepcopy(defs))
    translated = ET.SubElement(
        output_root,
        NS + "g",
        {
            "id": "Artwork",
            "data-name": "Artwork",
            "transform": "translate(-1429.4248 0)",
        },
    )
    translated.append(container)

    destination.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(output_root).write(destination, encoding="utf-8", xml_declaration=True)
    manifest_path.write_text(
        json.dumps(
            {
                "source": source.name,
                "output": destination.name,
                "embeddedRasterRemoved": True,
                "backgroundRemoved": True,
                "primaryGroups": manifest,
                "sharedDetailPaths": loose_path_number,
                "totalVectorPaths": path_count(container),
                "rigReadiness": RIG_READINESS,
                "suggestedPivots": SUGGESTED_PIVOTS,
            },
            indent=2,
        )
        + "\n"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--manifest", type=Path)
    args = parser.parse_args()
    manifest = args.manifest or args.destination.with_suffix(".manifest.json")
    prepare(args.source, args.destination, manifest)
