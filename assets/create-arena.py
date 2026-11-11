"""Draw the site's original arena artwork with a deterministic pixel palette."""

from pathlib import Path
import math
import random

from PIL import Image, ImageDraw


random.seed(817)
WIDTH, HEIGHT = 640, 400
art = Image.new("RGB", (WIDTH, HEIGHT), "#456b35")
draw = ImageDraw.Draw(art)


def rectangle(box, fill, outline=None, width=1):
    draw.rectangle(tuple(round(v) for v in box), fill=fill, outline=outline, width=width)


def leaf_cluster(x, y, radius, palette):
    outline, dark, middle, light, highlight = palette
    # Individual square pixels build an irregular, layered canopy.
    for py in range(-radius, radius + 1):
        for px in range(-radius, radius + 1):
            distance = (px * px + py * py) / (radius * radius)
            if distance > 1 + random.uniform(-0.13, 0.08):
                continue
            if distance > 0.85:
                color = outline
            else:
                brightness = (-(px + py) / radius + random.uniform(-0.6, 0.6))
                color = dark if brightness < -0.45 else middle
                if brightness > 0.25:
                    color = light
                if brightness > 0.95:
                    color = highlight
            draw.point((x + px, y + py), fill=color)


def tree(x, y, radius=15):
    draw.ellipse((x - radius, y + 5, x + radius + 4, y + radius + 9), fill="#26452d")
    rectangle((x - 2, y, x + 2, y + radius + 6), "#604d35")
    rectangle((x - 1, y, x, y + radius + 4), "#95804b")
    palette = ("#1b4031", "#26543b", "#356c40", "#4d8545", "#70a451")
    leaf_cluster(x, y, radius, palette)
    leaf_cluster(x - radius // 3, y - radius // 4, radius * 2 // 3, palette)
    leaf_cluster(x + radius // 3, y + radius // 4, radius // 2, palette)


# The grass extends underneath the stadium and its surrounding garden.
for _ in range(34000):
    x, y = random.randrange(WIDTH), random.randrange(HEIGHT)
    draw.point((x, y), fill=random.choice(("#4b7439", "#527e3f", "#3f6535", "#5b8240")))

# Dense forest borders, cut by two garden entrances.
for row_y in (-2, 18, 383, 405):
    for x in range(-7, WIDTH + 16, 23):
        if 263 < x < 378:
            continue
        tree(x + random.randint(-5, 5), row_y + random.randint(-4, 4), random.randint(15, 21))
for x in (0, 15, 624, 640):
    for y in range(40, HEIGHT - 30, 23):
        tree(x + random.randint(-3, 3), y, random.randint(14, 19))

# Stone entrances with brick paving and short steps.
for y0, y1 in ((0, 37), (365, 400)):
    rectangle((268, y0, 372, y1), "#565e55")
    for y in range(y0, y1, 8):
        for x in range(268, 372, 13):
            shift = 6 if (y // 8) % 2 else 0
            rectangle((x + shift, y, min(x + shift + 11, 371), y + 6), random.choice(("#8c9380", "#9da38d", "#8e9683")))
    for y in ((25, 29, 33) if y0 == 0 else (366, 370, 374)):
        rectangle((271, y, 369, y + 2), "#b1b4a2")
        rectangle((271, y + 3, 369, y + 3), "#656f62")

# Field shadow and brick enclosure.
rectangle((31, 39, 613, 366), "#273e2e")
rectangle((29, 34, 609, 362), "#3d5044")
rectangle((30, 35, 608, 360), "#929b88")
rectangle((34, 40, 604, 354), "#485c45")
for x in range(31, 609, 13):
    for y in (35, 355):
        rectangle((x, y, min(x + 11, 607), y + 4), random.choice(("#8e9784", "#a0a792", "#8b9381")))
        draw.line((x, y, min(x + 11, 607), y), fill="#bac0aa")
for y in range(42, 355, 12):
    for x in (30, 604):
        rectangle((x, y, x + 3, y + 10), random.choice(("#8e9784", "#a0a792")))
        draw.line((x, y, x + 3, y), fill="#b4bca4")

# Alternating turf, with deliberately sparse two-pixel grass tufts.
rectangle((37, 43, 601, 352), "#6e9c43")
for x in range(37, 601, 40):
    if ((x - 37) // 40) % 2 == 0:
        rectangle((x, 43, min(x + 39, 601), 352), "#77a84a")
for _ in range(26000):
    x, y = random.randint(38, 600), random.randint(44, 351)
    bright = ((x - 37) // 40) % 2 == 0
    color = random.choice(("#7aaa4e", "#73a047", "#80ac52", "#77a748")) if bright else random.choice(("#709e47", "#679440", "#76a14b", "#699842"))
    draw.point((x, y), fill=color)
    if random.random() < 0.2:
        draw.point((x + 1, y), fill=color)
for _ in range(1400):
    x, y = random.randint(39, 599), random.randint(45, 350)
    draw.line((x, y, x + 1, y - 2), fill="#81ad50")
    draw.point((x + 2, y - 1), fill="#628d3e")

chalk = "#d4dfaf"
rectangle((47, 53, 591, 342), None, chalk, 2)
draw.line((319, 53, 319, 342), fill=chalk, width=2)
draw.ellipse((273, 151, 366, 245), outline=chalk, width=2)
draw.ellipse((313, 192, 326, 205), outline=chalk, width=2)
rectangle((47, 119, 136, 277), None, chalk, 2)
rectangle((47, 160, 80, 237), None, chalk, 2)
rectangle((502, 119, 591, 277), None, chalk, 2)
rectangle((558, 160, 591, 237), None, chalk, 2)
for x in (121, 518):
    rectangle((x, 195, x + 1, 202), chalk)
for x, y, start in ((47, 53, 0), (591, 53, 90), (591, 342, 180), (47, 342, 270)):
    draw.arc((x - 7, y - 7, x + 7, y + 7), start, start + 90, fill=chalk, width=2)

# Square stone posts and planted garden beds.
for x in (29, 606):
    for y in (34, 358):
        rectangle((x - 5, y - 5, x + 7, y + 8), "#35443b")
        rectangle((x - 5, y - 6, x + 6, y + 5), "#b3b7a1")
        rectangle((x - 3, y - 4, x + 4, y + 3), "#777f70")
        rectangle((x - 2, y - 3, x + 3, y + 1), "#939c85")

for x0 in (193, 383):
    for y0 in (19, 374):
        rectangle((x0, y0 + 4, x0 + 54, y0 + 12), "#2b5433")
        for x in range(x0, x0 + 55, 5):
            draw.ellipse((x, y0, x + 6, y0 + 8), fill="#538540", outline="#385f35")
            draw.point((x + 2, y0 + 1), fill="#7a9b4a")

for y0 in (28, 372):
    for x in list(range(52, 180, 13)) + list(range(456, 588, 13)):
        cy = y0 + random.randint(-3, 3)
        color = random.choice(("#e5d99a", "#dddcc1", "#bfd59b"))
        draw.line((x, cy + 1, x, cy + 4), fill="#436e37")
        for px, py in ((x - 1, cy), (x + 1, cy), (x, cy - 1), (x, cy + 1)):
            draw.point((px, py), fill=color)
        draw.point((x, cy), fill="#c9aa46")

# Navy flags complement the page's dark blue controls.
for x in (256, 382):
    for y in (1, 371):
        rectangle((x - 2, y, x + 2, y + 27), "#556357")
        rectangle((x - 1, y, x, y + 26), "#c3b984")
        rectangle((x - 4, y, x + 4, y + 3), "#d3bd69")
        draw.polygon(((x + 2, y + 5), (x + 13, y + 5), (x + 13, y + 22), (x + 7, y + 26), (x + 2, y + 23)), fill="#263d52", outline="#b5b17a")
        draw.ellipse((x + 5, y + 9, x + 10, y + 14), outline="#90afae")

output = Path(__file__).parent
final = art.resize((1280, 800), resample=Image.Resampling.NEAREST)
final.save(output / "arena.png", optimize=True)
final.save(output / "arena.webp", quality=94, method=6)
print(f"Created {output / 'arena.png'} and arena.webp at 1280 × 800")
