#!/usr/bin/env python3
"""Generate Kelo World's deterministic 4x4 rural soil tile atlas."""

from pathlib import Path
from PIL import Image, ImageDraw

TILE = 32
OUT = Path(__file__).resolve().parents[1] / "assets" / "rural-soil-v1.png"

GRASS = (77, 207, 54, 255)
GRASS_DARK = (46, 156, 45, 255)
GRASS_LIGHT = (109, 224, 67, 255)
SOIL = (105, 62, 36, 255)
SOIL_LIGHT = (132, 81, 45, 255)
SOIL_DARK = (69, 39, 28, 255)
FURROW = (82, 47, 31, 255)
PEBBLE = (169, 119, 66, 255)


def noise(draw, tile_id):
    """Sparse deterministic pixel clusters; no runtime randomness or visible seams."""
    for i in range(9):
        x = 4 + ((tile_id * 17 + i * 11) % 24)
        y = 4 + ((tile_id * 23 + i * 7) % 24)
        color = SOIL_LIGHT if i % 3 else SOIL_DARK
        draw.point((x, y), fill=color)
        if i in (2, 7):
            draw.point((min(30, x + 1), y), fill=color)
    for i in range(2):
        x = 7 + ((tile_id * 13 + i * 16) % 18)
        y = 7 + ((tile_id * 19 + i * 9) % 18)
        draw.point((x, y), fill=PEBBLE)


def jagged_edge(draw, side, seed):
    """Pixel-authored grass lip with a dark contact edge."""
    offsets = (5, 4, 6, 4, 5, 7, 4, 6)
    if side in ("top", "bottom"):
        for x in range(TILE):
            depth = offsets[((x // 4) + seed) % len(offsets)]
            if side == "top":
                draw.line((x, 0, x, depth - 1), fill=GRASS)
                draw.point((x, depth), fill=GRASS_DARK)
                if x % 7 == seed % 7: draw.point((x, max(0, depth - 2)), fill=GRASS_LIGHT)
            else:
                draw.line((x, TILE - depth, x, TILE - 1), fill=GRASS)
                draw.point((x, TILE - depth - 1), fill=GRASS_DARK)
                if x % 7 == seed % 7: draw.point((x, min(31, TILE - depth + 1)), fill=GRASS_LIGHT)
    else:
        for y in range(TILE):
            depth = offsets[((y // 4) + seed) % len(offsets)]
            if side == "left":
                draw.line((0, y, depth - 1, y), fill=GRASS)
                draw.point((depth, y), fill=GRASS_DARK)
            else:
                draw.line((TILE - depth, y, TILE - 1, y), fill=GRASS)
                draw.point((TILE - depth - 1, y), fill=GRASS_DARK)


def make_tile(tile_id, sides=(), variant=0):
    im = Image.new("RGBA", (TILE, TILE), SOIL)
    d = ImageDraw.Draw(im)
    # Vertical furrows join cleanly across the 3x3 plot.
    for x in (10, 21):
        d.line((x, 0, x, 31), fill=FURROW)
        d.line((x + 1, 0, x + 1, 31), fill=SOIL_LIGHT)
    noise(d, tile_id + variant * 17)
    for side in sides:
        jagged_edge(d, side, tile_id + variant)
    return im


def main():
    atlas = Image.new("RGBA", (TILE * 4, TILE * 4), (0, 0, 0, 0))
    specs = [
        (("top", "left"), 0), (("top",), 0), (("top", "right"), 0), ((), 1),
        (("left",), 0), ((), 0), (("right",), 0), ((), 2),
        (("bottom", "left"), 0), (("bottom",), 0), (("bottom", "right"), 0), ((), 3),
        (("top", "left", "right"), 1), (("bottom", "left", "right"), 1), (("top", "bottom"), 2), (("left", "right"), 2),
    ]
    for tile_id, (sides, variant) in enumerate(specs):
        atlas.alpha_composite(make_tile(tile_id, sides, variant), ((tile_id % 4) * TILE, (tile_id // 4) * TILE))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT, optimize=True)
    print(f"generated {OUT} {atlas.width}x{atlas.height} tiles={len(specs)}")


if __name__ == "__main__":
    main()
