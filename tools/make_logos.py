# Builds 512x512 logo stickers for each brand into tools/logos/brand-<slug>.png.
# Real logos (from _source/) are placed on a light plate; missing ones get a
# typographic logo in the brand color. Output is RGBA PNG for the 3D texture.
import os
import re
import unicodedata
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, "logos", "_source")
SIZE = 512
PLATE = (251, 247, 240, 255)
PLATE_BORDER = (210, 198, 184, 255)
MARGIN = 44
RADIUS = 72

BRANDS = [
    ("havanna", "Havanna", "#6b4423"),
    ("cachafaz", "Cachafaz", "#232526"),
    ("guaymallen", "Guaymallen", "#d4a017"),
    ("jorgito", "Jorgito", "#2b6cb0"),
    ("fantoche", "Fantoche", "#e8590c"),
    ("terrabusi", "Terrabusi", "#2980b9"),
    ("aguila", "Aguila", "#a93226"),
    ("suchard", "Suchard", "#7d3c98"),
    ("rasta", "Rasta", "#27ae60"),
    ("blanco-y-negro", "Blanco y Negro", "#e0e0e0"),
]

FONT_CANDIDATES = [
    "C:/Windows/Fonts/trebucbd.ttf",  # Trebuchet MS Bold - friendly, rounded
    "C:/Windows/Fonts/segoeuib.ttf",  # Segoe UI Bold
    "C:/Windows/Fonts/arialbd.ttf",
]


def find_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def plate():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([4, 4, SIZE - 4, SIZE - 4], radius=RADIUS, fill=PLATE, outline=PLATE_BORDER, width=4)
    return img


def paste_contain(img, logo):
    logo = logo.convert("RGBA")
    max_w = SIZE - 2 * MARGIN
    max_h = int(SIZE * 0.55)
    scale = min(max_w / logo.width, max_h / logo.height)
    logo = logo.resize((max(1, int(logo.width * scale)), max(1, int(logo.height * scale))), Image.LANCZOS)
    x = (SIZE - logo.width) // 2
    y = (SIZE - logo.height) // 2
    img.alpha_composite(logo, (x, y))


def text_logo(img, text, color):
    d = ImageDraw.Draw(img)
    size = 110
    font = find_font(size)
    max_w = SIZE - 2 * (MARGIN + 10)
    while size > 36:
        bbox = d.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_w:
            break
        size -= 6
        font = find_font(size)
    bbox = d.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (SIZE - w) // 2 - bbox[0]
    y = (SIZE - h) // 2 - bbox[1]
    d.text((x, y), text, font=font, fill=color + "ff")

    # small underline accent for a sticker look
    d.rounded_rectangle([SIZE // 2 - 70, y + h + 26, SIZE // 2 + 70, y + h + 36], radius=5, fill=color + "cc")


def readable(color):
    # Light brand colors would vanish on the light plate -> darken for the text.
    r, g, b = int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)
    lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return '#1c1c1c' if lum > 0.72 else color


def find_source(slug):
    # User-dropped names first (alfajor-<slug>.png / <slug>.png), then classic brand-<slug>.png.
    for name in ("alfajor-%s.png" % slug, "%s.png" % slug, "brand-%s.png" % slug):
        path = os.path.join(SOURCE, name)
        if os.path.exists(path):
            return path
    return None


def strip_white_bg(logo):
    """Make the white background of product photos transparent (flood from corners
    only, so whites inside the packaging are preserved)."""
    rgba = logo.convert("RGBA")
    bg = Image.new("RGB", rgba.size, (255, 255, 255))
    bg.paste(rgba, mask=rgba.getchannel("A"))
    marker = (255, 0, 255)
    w, h = bg.size
    for pt in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(bg, pt, marker, thresh=50)
    rgb = list(bg.getdata())
    src = list(rgba.getdata())
    out = Image.new("RGBA", rgba.size)
    out.putdata([
        (r, g, b, 0) if (r, g, b) == marker or sa == 0 else (r, g, b, sa)
        for (r, g, b), (_, _, _, sa) in zip(rgb, src)
    ])
    return out


def main():
    used = []
    for slug, name, color in BRANDS:
        img = plate()
        src = find_source(slug)
        if src:
            paste_contain(img, strip_white_bg(Image.open(src)))
        else:
            text_logo(img, name, readable(color))
        out = os.path.join(HERE, "logos", "brand-" + slug + ".png")
        img.save(out, "PNG", optimize=True)
        # Photographic/old logos blow up as RGBA -> palette-quantize if heavy.
        if os.path.getsize(out) > 90 * 1024:
            img.quantize(colors=128, method=Image.FASTOCTREE).save(out, "PNG", optimize=True)
        used.append("%s (%s, %d KB)" % (slug, "real" if src else "texto", os.path.getsize(out) // 1024))
    print("Logos generados:")
    for u in used:
        print(" -", u)


if __name__ == "__main__":
    main()
