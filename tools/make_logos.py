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
    ("lesta", "Lesta", "#8e5b2f"),
    ("jorgito", "Jorgito", "#2b6cb0"),
    ("guaymallen", "Guaymallen", "#d4a017"),
    ("farito", "Farito", "#e67e22"),
    ("cofler", "Cofler", "#7d3c98"),
    ("aguila", "Aguila", "#a93226"),
    ("terrabusi", "Terrabusi", "#2980b9"),
    ("aguafiestas", "Aguafiestas", "#f39c12"),
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


def main():
    used = []
    for slug, name, color in BRANDS:
        img = plate()
        src = os.path.join(SOURCE, "brand-" + slug + ".png")
        if os.path.exists(src):
            paste_contain(img, Image.open(src))
            used.append(slug + " (real)")
        else:
            text_logo(img, name, color)
            used.append(slug + " (texto)")
        out = os.path.join(HERE, "logos", "brand-" + slug + ".png")
        img.save(out, "PNG", optimize=True)
    print("Logos generados:")
    for u in used:
        print(" -", u)


if __name__ == "__main__":
    main()
