"""
Featured-news image renderer for FSF Wix /sk/news/ listing.

1200×900 (4:3) — safe aspect for Wix news thumbnails and article hero.
Replicates the OG image layout 1:1 in a taller canvas so Wix doesn't
crop the left half (logo + headline) the way it does with 1200×630.

Sequence:
  1. Inpaint marigold dots from full-res source → clean blueprint bg
  2. Crop / resize to 1200×900 (center-crop horizontally)
  3. Cream backdrop fade — wider for the taller text block
  4. Logo (Color_RGB, with white→sapphire recolor of text)
  5. Headline + subheadline (sapphire)
  6. CTA pill (marigold bg, sapphire text)
  7. Footer: marigold dot + URL + tagline
  8. Export + pre-flight
"""

import cv2
import numpy as np
import os
from PIL import Image, ImageDraw, ImageFont

# ── Paths ──────────────────────────────────────────────────────────
DIR = "/Users/davidboruta/Documents/MachineProjects/healthy_future/partneri-zmeny"
SRC = os.path.join(DIR, "og-source-cleaned.png")
LOGO = os.path.join(DIR, "_brand", "Logo_FSF_Color_RGB.png")
OUT = os.path.join(DIR, "FSF_news_partneri_zmeny_1200x900.png")
FONT_DIR = os.path.join(DIR, "_fonts")

# ── Canvas dims ────────────────────────────────────────────────────
W, H = 1200, 900

# ── Brand colors ───────────────────────────────────────────────────
SAPPHIRE = (6, 36, 75)
MARIGOLD = (255, 174, 0)
SAPPHIRE_MUTED = (6, 36, 75, 178)   # 70% alpha for tagline
CREAM = (245, 220, 175)

# ── Layout (1200×900) ──────────────────────────────────────────────
MARGIN_X = 72
LOGO_TOP = 72
LOGO_H = 72
HEAD_TOP = 240        # headline y
HEAD_LINE_H = 84
SUB_TOP = 470         # subheadline y
CTA_TOP = 560         # CTA pill y
URL_TOP = 680         # URL y
DOT_Y = 692           # marigold bullet vertically centered with URL
TAGLINE_TOP = 820     # tagline at bottom (centered)

# Backdrop fade zone — covers all left-aligned text
BACKDROP_FADE_START = 620
BACKDROP_FADE_END = 1000
BACKDROP_Y_TOP = 60
BACKDROP_Y_BOTTOM = 880
BACKDROP_ALPHA = 235


# ── Font loader ────────────────────────────────────────────────────
def load_font(weight, size):
    path = os.path.join(FONT_DIR, "Nunito[wght].ttf")
    font = ImageFont.truetype(path, size)
    font.set_variation_by_name(weight)
    return font


# ── Step 1: Inpaint marigold from source ───────────────────────────
def step1_inpaint_marigold():
    img = cv2.imread(SRC)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([5, 140, 100]), np.array([30, 255, 255]))
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)
    clean = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)
    print(f"[step1] marigold inpainted from source")
    return clean


# ── Step 2: Crop + resize to 1200×900 (4:3) ────────────────────────
def step2_canvas(clean_bgr):
    rgb = cv2.cvtColor(clean_bgr, cv2.COLOR_BGR2RGB)
    src_h, src_w = rgb.shape[:2]
    target_ratio = W / H            # 1.333
    src_ratio = src_w / src_h       # 1.785

    if src_ratio > target_ratio:
        # Source is wider → crop horizontally (lose some left/right)
        new_w = int(src_h * target_ratio)
        # Bias crop to keep MORE of the right side (where the blueprint is
        # densely packed after the earlier flip) and lose some sparse left
        left = (src_w - new_w) // 2 + int((src_w - new_w) * 0.20)
        left = max(0, min(left, src_w - new_w))
        cropped = rgb[:, left:left + new_w]
    else:
        new_h = int(src_w / target_ratio)
        top = (src_h - new_h) // 2
        cropped = rgb[top:top + new_h, :]

    pil_img = Image.fromarray(cropped).resize((W, H), Image.LANCZOS).convert("RGBA")
    print(f"[step2] canvas {pil_img.size}")
    return pil_img


# ── Step 3: Cream backdrop fade ────────────────────────────────────
def step3_backdrop(canvas):
    backdrop = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(backdrop)
    for x in range(W):
        if x < BACKDROP_FADE_START:
            alpha = BACKDROP_ALPHA
        elif x < BACKDROP_FADE_END:
            t = (x - BACKDROP_FADE_START) / (BACKDROP_FADE_END - BACKDROP_FADE_START)
            alpha = int(BACKDROP_ALPHA * (1 - t))
        else:
            alpha = 0
        if alpha > 0:
            draw.line([(x, BACKDROP_Y_TOP), (x, BACKDROP_Y_BOTTOM)],
                      fill=CREAM + (alpha,))
    canvas = Image.alpha_composite(canvas, backdrop)
    print(f"[step3] backdrop fade {BACKDROP_FADE_START}→{BACKDROP_FADE_END} "
          f"y=[{BACKDROP_Y_TOP},{BACKDROP_Y_BOTTOM}]")
    return canvas


# ── Step 4: Logo (Color_RGB with white→sapphire recolor) ───────────
def step4_logo(canvas):
    logo = Image.open(LOGO).convert("RGBA")
    arr = np.array(logo)
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]
    sat = rgb.max(axis=-1).astype(int) - rgb.min(axis=-1).astype(int)
    text_mask = (
        (alpha > 32) &
        (rgb[:, :, 0] > 200) & (rgb[:, :, 1] > 200) & (rgb[:, :, 2] > 200) &
        (sat < 30)
    )
    arr[text_mask, 0] = SAPPHIRE[0]
    arr[text_mask, 1] = SAPPHIRE[1]
    arr[text_mask, 2] = SAPPHIRE[2]
    logo = Image.fromarray(arr)

    lw, lh = logo.size
    new_w = int(lw * LOGO_H / lh)
    logo = logo.resize((new_w, LOGO_H), Image.LANCZOS)
    canvas.paste(logo, (MARGIN_X, LOGO_TOP), logo)
    print(f"[step4] logo {new_w}×{LOGO_H} @ ({MARGIN_X},{LOGO_TOP})")
    return canvas


# ── Step 5: Headline + subheadline ─────────────────────────────────
def step5_headline(canvas):
    draw = ImageDraw.Draw(canvas)
    font_h = load_font("Black", 84)
    for i, line in enumerate(["Reformy nevznikajú", "v deň volieb."]):
        y = HEAD_TOP + i * HEAD_LINE_H
        draw.text((MARGIN_X, y), line, font=font_h, fill=SAPPHIRE, anchor="lt")
        bbox = draw.textbbox((MARGIN_X, y), line, font=font_h, anchor="lt")
        print(f"[step5]   '{line}' right edge {bbox[2]}")

    font_sub = load_font("SemiBold", 34)
    sub_text = "Pripravme ich, kým je čas."
    draw.text((MARGIN_X, SUB_TOP), sub_text, font=font_sub,
              fill=SAPPHIRE, anchor="lt")
    print(f"[step5]   sub rendered")
    return canvas


# ── Step 6: CTA pill ───────────────────────────────────────────────
def step6_cta(canvas):
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font_cta = load_font("Bold", 28)
    cta_text = "Staňte sa partnerom"
    pad_x, pad_y = 28, 16

    bbox = font_cta.getbbox(cta_text)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    pill_w = text_w + 2 * pad_x
    pill_h = text_h + 2 * pad_y

    draw.rounded_rectangle(
        [MARGIN_X, CTA_TOP, MARGIN_X + pill_w, CTA_TOP + pill_h],
        radius=14, fill=MARIGOLD
    )
    canvas = Image.alpha_composite(canvas, overlay)

    text_draw = ImageDraw.Draw(canvas)
    text_draw.text(
        (MARGIN_X + pad_x - bbox[0], CTA_TOP + pad_y - bbox[1]),
        cta_text, font=font_cta, fill=SAPPHIRE
    )
    print(f"[step6] CTA pill {pill_w}×{pill_h} @ ({MARGIN_X},{CTA_TOP})")
    return canvas


# ── Step 7: Footer — URL with marigold bullet ──────────────────────
def step7_url(canvas):
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    dx, dy, r = MARGIN_X + 14, DOT_Y, 7
    draw.ellipse([dx - r, dy - r, dx + r, dy + r], fill=MARIGOLD)
    canvas = Image.alpha_composite(canvas, overlay)

    text_draw = ImageDraw.Draw(canvas)
    font_url = load_font("Medium", 22)
    text_draw.text((MARGIN_X + 38, URL_TOP),
                   "healthy-future.sk/partneri-zmeny",
                   font=font_url, fill=SAPPHIRE, anchor="lt")
    print(f"[step7] URL with bullet @ y={URL_TOP}")
    return canvas


# ── Step 8: Tagline (bottom) ───────────────────────────────────────
def step8_tagline(canvas):
    font_tag = load_font("Regular", 22)
    tag_text = "Fakty a činy. Reformy pre Slovensko."
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.text((MARGIN_X, TAGLINE_TOP), tag_text,
              font=font_tag, fill=SAPPHIRE_MUTED, anchor="lt")
    canvas = Image.alpha_composite(canvas, overlay)
    print(f"[step8] tagline @ y={TAGLINE_TOP}")
    return canvas


# ── Pre-flight ─────────────────────────────────────────────────────
def preflight():
    img = Image.open(OUT)
    size_kb = os.path.getsize(OUT) / 1024
    print()
    print("─── Pre-flight ───")
    assert img.size == (W, H), f"Bad dims: {img.size}"
    assert img.mode in ("RGB", "RGBA"), f"Bad mode: {img.mode}"
    print(f"  ✓ Dimensions: {img.size}")
    print(f"  ✓ Mode: {img.mode}")
    print(f"  ✓ Size: {size_kb:.1f} KB")


# ── Main ───────────────────────────────────────────────────────────
def main():
    clean = step1_inpaint_marigold()
    canvas = step2_canvas(clean)
    canvas = step3_backdrop(canvas)
    canvas = step4_logo(canvas)
    canvas = step5_headline(canvas)
    canvas = step6_cta(canvas)
    canvas = step7_url(canvas)
    canvas = step8_tagline(canvas)

    final = Image.new("RGB", canvas.size, (255, 255, 255))
    final.paste(canvas, mask=canvas.split()[3])
    final.save(OUT, "PNG", optimize=True, compress_level=9)
    print(f"\n[save] {OUT}")
    preflight()


if __name__ == "__main__":
    main()
