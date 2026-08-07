# Generation prompt set

Built-in image generation used the canonical `ronin-cat-side-style-reference-v3.png` as the identity and storybook-style reference. Every sheet requested isolated opaque parts on a perfectly flat `#00ff00` chroma-key background with generous spacing, no shadows, no labels and no green inside the artwork.

1. **Core exploded sheet:** side-view Ronin head/face, rear hair, front hair, headband band and tails, backpack, sword, scabbard and waist sash, preserving the reference's proportions, palette, outlines and softly textured shading.
2. **Lower-body sheet:** three matching isolated thighs, three lower-leg/shin pieces and three boots for selecting rear/front walking-leg variants; every item complete and non-overlapping.
3. **Arm sheet:** rear upper arm, rear forearm, fist hand, front upper arm, front forearm and grip hand in a strict 3-by-2 layout; neutral joint ends suitable for rotation.
4. **Torso sheet:** one side-view kimono torso/hip core without head, arms, hands, legs, boots, backpack, sword or cat; hidden shoulder and hip overlap allowance retained for assembly.

The generated sheets are source material. The files in `parts/` are cropped, alpha-matted and despilled assembly candidates and remain subject to the seam test in Rive.
