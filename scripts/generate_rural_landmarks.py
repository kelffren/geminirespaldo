#!/usr/bin/env python3
"""Generate Kelo World's deterministic 8x4 rural landmark atlas."""

from pathlib import Path
from PIL import Image, ImageDraw

TILE = 32
OUT = Path(__file__).resolve().parents[1] / "assets" / "rural-landmarks-v1.png"

INK = (31, 45, 43, 255)
SHADOW = (25, 45, 37, 92)
ROOF_DARK = (27, 70, 73, 255)
ROOF = (38, 91, 91, 255)
ROOF_LIGHT = (61, 119, 108, 255)
BARN_DARK = (91, 38, 40, 255)
BARN = (145, 55, 49, 255)
BARN_LIGHT = (186, 74, 56, 255)
CREAM = (239, 214, 151, 255)
GOLD = (213, 167, 74, 255)
WOOD_DARK = (83, 51, 31, 255)
WOOD = (139, 87, 42, 255)
WOOD_LIGHT = (190, 128, 60, 255)
METAL_DARK = (51, 73, 76, 255)
METAL = (101, 130, 127, 255)
METAL_LIGHT = (166, 181, 163, 255)
GRASS = (77, 207, 54, 255)
GRASS_DARK = (42, 139, 45, 255)
GRASS_LIGHT = (119, 229, 73, 255)
HAY = (221, 175, 61, 255)
HAY_LIGHT = (244, 211, 104, 255)


def rect(draw, box, fill, outline=None, width=1):
    draw.rectangle(box, fill=fill, outline=outline, width=width)


def barn():
    im = Image.new("RGBA", (160, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((13, 108, 150, 125), fill=SHADOW)
    rect(d, (20, 54, 140, 112), BARN_DARK, INK, 3)
    rect(d, (25, 58, 135, 110), BARN)
    for x in range(29, 136, 16):
        d.line((x, 60, x, 108), fill=BARN_LIGHT, width=2)
        d.line((x + 3, 60, x + 3, 108), fill=BARN_DARK)
    d.polygon([(8, 55), (34, 19), (126, 19), (152, 55)], fill=INK)
    d.polygon([(13, 52), (38, 23), (122, 23), (147, 52)], fill=ROOF_DARK)
    d.polygon([(21, 48), (42, 27), (80, 27), (80, 48)], fill=ROOF)
    d.polygon([(80, 27), (118, 27), (139, 48), (80, 48)], fill=ROOF_LIGHT)
    d.line((39, 22, 121, 22), fill=GOLD, width=3)
    d.line((16, 53, 144, 53), fill=CREAM, width=3)
    for x in range(31, 137, 18): d.line((x, 48, x + 17, 27), fill=ROOF_DARK, width=2)
    d.polygon([(51, 57), (80, 35), (109, 57)], fill=BARN_DARK, outline=INK)
    d.polygon([(57, 55), (80, 40), (103, 55)], fill=BARN, outline=CREAM)
    rect(d, (72, 45, 88, 57), ROOF_DARK, CREAM, 2)
    d.line((80, 46, 80, 56), fill=GOLD); d.line((73, 51, 87, 51), fill=GOLD)
    rect(d, (57, 75, 103, 112), WOOD_DARK, CREAM, 3)
    d.line((80, 78, 80, 110), fill=CREAM, width=2)
    d.line((60, 78, 78, 109), fill=WOOD_LIGHT, width=3)
    d.line((100, 78, 82, 109), fill=WOOD_LIGHT, width=3)
    for x in (29, 115): rect(d, (x, 70, x + 16, 86), ROOF_DARK, CREAM, 2)
    rect(d, (112, 10, 124, 30), BARN_DARK, INK, 2)
    rect(d, (110, 8, 126, 13), ROOF_DARK, INK, 2)
    d.line((21, 113, 139, 113), fill=INK, width=3)
    for x in (27, 49, 111, 133):
        d.rectangle((x, 114, x + 7, 117), fill=GRASS_DARK)
        d.point((x + 3, 113), fill=GRASS_LIGHT)
    return im


def silo():
    im = Image.new("RGBA", (64, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((7, 110, 58, 124), fill=SHADOW)
    d.ellipse((8, 17, 56, 50), fill=INK)
    d.ellipse((11, 20, 53, 47), fill=METAL_LIGHT)
    d.polygon([(11, 34), (20, 15), (44, 15), (53, 34)], fill=METAL, outline=INK)
    d.line((21, 15, 43, 15), fill=GOLD, width=3)
    rect(d, (10, 35, 54, 113), METAL_DARK, INK, 3)
    rect(d, (15, 37, 49, 111), METAL)
    d.rectangle((17, 38, 25, 110), fill=METAL_LIGHT)
    d.rectangle((44, 38, 49, 110), fill=(70, 101, 101, 255))
    for y in (52, 72, 92):
        d.line((11, y, 53, y), fill=GOLD, width=3)
        d.line((14, y + 3, 50, y + 3), fill=METAL_DARK)
    d.line((37, 40, 37, 108), fill=CREAM, width=2)
    d.line((45, 40, 45, 108), fill=CREAM, width=2)
    for y in range(45, 109, 10): d.line((37, y, 45, y), fill=CREAM, width=2)
    d.polygon([(18, 112), (46, 112), (51, 118), (13, 118)], fill=INK)
    return im


def small_prop(kind):
    im = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((4, 23, 28, 30), fill=SHADOW)
    if kind == "hay":
        rect(d, (4, 11, 27, 25), HAY, INK, 2)
        d.ellipse((4, 9, 27, 18), fill=HAY_LIGHT, outline=INK, width=2)
        d.line((15, 10, 15, 25), fill=WOOD_DARK, width=2)
    elif kind == "crate":
        rect(d, (6, 8, 26, 27), WOOD, INK, 2)
        d.line((8, 10, 24, 25), fill=WOOD_LIGHT, width=3)
        d.line((24, 10, 8, 25), fill=WOOD_DARK, width=2)
    elif kind == "bush":
        for box, color in [((4, 13, 18, 27), GRASS_DARK), ((13, 8, 28, 26), GRASS), ((8, 6, 20, 21), GRASS_LIGHT)]:
            d.ellipse(box, fill=color, outline=INK)
    else:
        for i, color in enumerate(((255, 218, 74, 255), (244, 113, 109, 255), CREAM)):
            x = 8 + i * 8
            d.line((x, 14, x, 26), fill=GRASS_DARK, width=2)
            d.rectangle((x - 3, 9 + (i % 2) * 3, x + 3, 15 + (i % 2) * 3), fill=color)
            d.point((x, 12 + (i % 2) * 3), fill=INK)
    return im


def main():
    atlas = Image.new("RGBA", (256, 128), (0, 0, 0, 0))
    atlas.alpha_composite(barn(), (0, 0))
    atlas.alpha_composite(silo(), (160, 0))
    for row, kind in enumerate(("hay", "crate", "bush", "flowers")):
        atlas.alpha_composite(small_prop(kind), (224, row * TILE))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT, optimize=True)
    print(f"generated {OUT} {atlas.width}x{atlas.height} tile=32 grid=8x4")


if __name__ == "__main__":
    main()
