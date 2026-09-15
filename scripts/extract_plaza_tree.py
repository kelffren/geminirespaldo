from pathlib import Path
from PIL import Image
import numpy as np
import cv2

SRC = Path('assets/Arboleskelo1.PNG')
OUT = Path('assets/plaza-tree-large-v1.png')

LEFT, TOP, RIGHT, BOTTOM = 10, 20, 440, 550
FRAME_W, FRAME_H = RIGHT - LEFT, BOTTOM - TOP

im = Image.open(SRC).convert('RGB')
assert im.size == (1536, 1024), im.size
rgb = np.array(im.crop((LEFT, TOP, RIGHT, BOTTOM)))
h, w, _ = rgb.shape
assert (w, h) == (FRAME_W, FRAME_H)
bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

# GrabCut remains the reliable separator for this presentation sheet because the
# source cell contains non-tree artwork/background tones that a simple color
# threshold can accidentally preserve. The fix is to seed the COMPLETE authored
# base, not to switch to threshold segmentation.
mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
mask[:18, :] = cv2.GC_BGD
mask[-8:, :] = cv2.GC_BGD
mask[:, :8] = cv2.GC_BGD
mask[:, -8:] = cv2.GC_BGD

# Probable foreground covers the complete canopy, trunk, roots, floral ring and
# stones. This is intentionally wider/lower than the old mask that clipped the base.
cv2.ellipse(mask, (215, 170), (202, 158), 0, 0, 360, cv2.GC_PR_FGD, -1)
trunk_and_base = np.array([
    [92,232],[330,232],[338,390],[360,455],[348,505],
    [300,522],[120,522],[76,502],[64,456],[88,392]
], np.int32)
cv2.fillPoly(mask, [trunk_and_base], cv2.GC_PR_FGD)
cv2.ellipse(mask, (210, 470), (150, 52), 0, 0, 360, cv2.GC_PR_FGD, -1)

# Definite foreground seeds on canopy/trunk plus multiple points around the stone /
# flower ring so GrabCut cannot discard disconnected decoration.
for cx,cy,rx,ry in [
    (210,118,82,62),(116,178,48,46),(307,188,48,46),
    (220,276,34,48),(205,360,38,72),
    (135,448,34,24),(205,456,42,28),(282,448,34,24),
    (104,480,22,18),(166,495,24,18),(238,497,24,18),(308,480,22,18),
]:
    cv2.ellipse(mask, (cx,cy), (rx,ry), 0, 0, 360, cv2.GC_FGD, -1)

bgd = np.zeros((1,65), np.float64)
fgd = np.zeros((1,65), np.float64)
cv2.grabCut(bgr, mask, None, bgd, fgd, 12, cv2.GC_INIT_WITH_MASK)
raw = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8)

# Keep the dominant tree plus nearby authored components. The proximity pass is what
# preserves disconnected rocks/flowers while rejecting remote presentation artwork.
num, labels, stats, centroids = cv2.connectedComponentsWithStats(raw, 8)
assert num > 1, 'tree segmentation failed'
main = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
main_mask = (labels == main).astype(np.uint8)
proximity = cv2.dilate(main_mask, np.ones((51,51), np.uint8), iterations=1)
keep = main_mask.astype(bool)
mx,my,mw,mh,_ = stats[main]

for i in range(1, num):
    if i == main:
        continue
    x,y,cw,ch,area = stats[i]
    if area < 24:
        continue
    comp = labels == i
    cx, cy = centroids[i]
    near = bool(np.any(proximity[comp]))
    in_authored_base = (55 <= cx <= 365 and 400 <= cy <= 522)
    if near or in_authored_base:
        keep |= comp

alpha = np.where(keep, 255, 0).astype(np.uint8)
# Remove tiny isolated leftovers after selection.
num2, lab2, st2, _ = cv2.connectedComponentsWithStats((alpha>0).astype(np.uint8), 8)
clean = np.zeros((h,w), dtype=bool)
for i in range(1, num2):
    if int(st2[i, cv2.CC_STAT_AREA]) >= 24:
        clean |= lab2 == i
alpha = np.where(clean, 255, 0).astype(np.uint8)

# Full frame stays 430x530 so registry geometry is stable. Transparent padding is
# preferable to another destructive tight crop.
alpha[:2,:] = 0; alpha[-2:,:] = 0; alpha[:,:2] = 0; alpha[:,-2:] = 0
ys, xs = np.where(alpha > 0)
assert len(xs) > 16000, len(xs)
assert ys.max() >= 500, ('base clipped', int(ys.max()))
base_pixels = int(np.count_nonzero(alpha[405:525, 55:365]))
assert base_pixels >= 1800, ('insufficient authored base', base_pixels)
# Presentation-background regression guard: the four broad corners must remain
# mostly transparent. This catches the black/green blocks visible in the failed LIVE.
corner = np.concatenate([
    alpha[40:170, 0:80].ravel(), alpha[40:170, 350:430].ravel(),
    alpha[300:420, 0:55].ravel(), alpha[300:420, 375:430].ravel(),
])
assert np.count_nonzero(corner) < int(corner.size * 0.40), 'background artifact regression'

Image.fromarray(np.dstack([rgb, alpha]), 'RGBA').save(OUT, 'PNG', optimize=True)
print('PASS clean complete authored tree frame', OUT, (w,h), 'base_pixels=', base_pixels)
