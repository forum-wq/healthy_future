"""
Generate 4 social formats derived from the existing OG images.

Outputs (1080×1080 IG feed, 1080×1920 IG/FB Story, in both SK and EN):
  FSF_partneri_zmeny_SK_1080x1080.png
  FSF_partneri_zmeny_EN_1080x1080.png
  FSF_partneri_zmeny_SK_1080x1920.png
  FSF_partneri_zmeny_EN_1080x1920.png

Wireframe motif is extracted from og-image.png right crop (x=600→1200).
The cream parts of the crop already match the canvas cream so reducing
opacity uniformly composites cleanly without halos.
"""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ── Paths ──────────────────────────────────────────────────────────
DIR = "/Users/davidboruta/Documents/MachineProjects/healthy_future/partneri-zmeny"
SRC_SK = os.path.join(DIR, "og-image.png")
SRC_EN = os.path.join(DIR, "og-image-en.png")
LOGO_PATH = os.path.join(DIR, "_brand", "Logo_FSF_Color_RGB.png")
FONT_PATH = os.path.join(DIR, "_fonts", "Nunito[wght].ttf")
OUT_DIR = DIR

# ── Brand colors ───────────────────────────────────────────────────
SAPPHIRE = (6, 36, 75)
MARIGOLD = (255, 174, 0)
CREAM = (246, 220, 175)                  # #F6DCAE — sampled from og-image.png
                                          # clean cream regions; brief's #F4E8C8
                                          # was inconsistent with the actual source,
                                          # this matches OG → no compositing halo.
SAPPHIRE_70 = SAPPHIRE + (int(0.70 * 255),)

# ── Content ────────────────────────────────────────────────────────
SK = {
    "headline": ["Reformy nevznikajú", "v deň volieb."],
    "subline": "Pripravme ich, kým je čas.",
    "cta": "Staňte sa partnerom",
    "url": "healthy-future.sk/partneri-zmeny",
    "tagline": "Fakty a činy. Reformy pre Slovensko.",
}
EN = {
    "headline": ["Reforms aren't built", "on election day."],
    "subline": "Build them while there's time.",
    "cta": "Become a partner",
    "url": "future-slovakia.eu/partnerships",
    "tagline": "Facts into action. Reforms for Slovakia.",
}


# ── Font loader ────────────────────────────────────────────────────
def load_font(weight, size):
    font = ImageFont.truetype(FONT_PATH, size)
    font.set_variation_by_name(weight)
    return font


# ── Logo: white→sapphire recolor (same as OG renderer) ─────────────
def get_logo_sapphire():
    logo = Image.open(LOGO_PATH).convert("RGBA")
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
    return Image.fromarray(arr)


# ── Wireframe: crop right portion of og-source-cleaned.png ─────────
# Brief says "right portion of og-image.png", but og-image.png already
# has the headline text rendered into it — cropping x=600→1200 picks
# up the right edges of "Reformy nevznikajú" / "v deň volieb." letters
# which would bleed through as ghost text behind the new headline.
# Switching to og-source-cleaned.png (the master before text overlay)
# fixes this. Same visual identity, no text contamination.
SRC_WF = os.path.join(DIR, "og-source-cleaned.png")

def get_wireframe_crop():
    img = Image.open(SRC_WF).convert("RGBA")
    W_src, H_src = img.size
    # og-image.png was a 1200×630 crop of this master. The right portion
    # (x=600→1200 in OG coords) corresponds to roughly the right half of
    # the master width. Take a 600/1200 = 0.5 of width on the right side.
    crop_w = W_src // 2
    left = W_src - crop_w
    return img.crop((left, 0, W_src, H_src))   # ≈ 1456×1632


def with_opacity(img, opacity):
    """Multiply alpha channel by `opacity` (0..1)."""
    arr = np.array(img.convert("RGBA"))
    arr[:, :, 3] = (arr[:, :, 3].astype(float) * opacity).astype(np.uint8)
    return Image.fromarray(arr)


# ── 1:1 layout (1080×1080 IG feed) ─────────────────────────────────
def render_square(content, out_path):
    W, H = 1080, 1080
    canvas = Image.new("RGBA", (W, H), CREAM + (255,))

    # Wireframe bottom-right, bleed out, opacity 60 %
    wf = get_wireframe_crop()
    target_w = 760
    aspect = wf.height / wf.width
    target_h = int(target_w * aspect)
    wf_s = wf.resize((target_w, target_h), Image.LANCZOS)
    wf_op = with_opacity(wf_s, 0.38)   # v2: 60% → 38% for text legibility
    # Place so that the dense scaffolding sits in bottom-right, bleeding slightly off-canvas
    x = W - target_w + 90
    y = H - target_h + 110
    canvas.alpha_composite(wf_op, (max(0, x), max(0, y)))

    # Logo top-left
    logo = get_logo_sapphire()
    logo_h = 120
    logo_w = int(logo.width * logo_h / logo.height)
    logo_s = logo.resize((logo_w, logo_h), Image.LANCZOS)
    canvas.alpha_composite(logo_s, (80, 80))

    # Headline 2 lines, Nunito Black 84, line-height 1.05
    draw = ImageDraw.Draw(canvas)
    font_h = load_font("Black", 84)
    y_hl = 280
    for line in content["headline"]:
        draw.text((80, y_hl), line, font=font_h, fill=SAPPHIRE, anchor="lt")
        y_hl += int(84 * 1.05)

    # v2: Subline Nunito Regular 36 → 46, y=480 → y=500 (+20 px breathing)
    font_sub = load_font("Regular", 46)
    draw.text((80, 500), content["subline"], font=font_sub, fill=SAPPHIRE, anchor="lt")

    # v2: CTA Nunito Bold 32 → 36, padding 24×40 → 32×56
    font_cta = load_font("Bold", 36)
    cta = content["cta"]
    bbox = font_cta.getbbox(cta)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    pad_x, pad_y = 56, 32
    btn_w = text_w + 2 * pad_x
    btn_h = text_h + 2 * pad_y
    btn_x, btn_y = 80, 620   # pushed down 20 px to clear larger subline
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([btn_x, btn_y, btn_x + btn_w, btn_y + btn_h], radius=12, fill=MARIGOLD)
    canvas = Image.alpha_composite(canvas, overlay)
    td = ImageDraw.Draw(canvas)
    td.text((btn_x + pad_x - bbox[0], btn_y + pad_y - bbox[1]), cta, font=font_cta, fill=SAPPHIRE)

    # v2: URL Nunito Medium 26 → 38, bullet 16 → 24 px, y=720 → y=770
    font_url = load_font("Medium", 38)
    bullet_overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bullet_overlay)
    # Bullet vertically centered with URL text (38 px font → glyph center ~y=789)
    bd.ellipse([80, 778, 104, 802], fill=MARIGOLD)   # 24×24
    canvas = Image.alpha_composite(canvas, bullet_overlay)
    ud = ImageDraw.Draw(canvas)
    ud.text((120, 770), content["url"], font=font_url, fill=SAPPHIRE, anchor="lt")

    # v2: Tagline Nunito Regular 24 → 32, full SAPPHIRE (was 70% opacity)
    # Important: rebind ImageDraw after the last alpha_composite — earlier
    # `draw` references the pre-composite canvas; drawing on it would not
    # appear in the saved output.
    font_tag = load_font("Regular", 32)
    tag_draw = ImageDraw.Draw(canvas)
    tag_draw.text((80, 1000), content["tagline"], font=font_tag, fill=SAPPHIRE, anchor="lt")

    final = Image.new("RGB", (W, H), CREAM)
    final.paste(canvas, mask=canvas.split()[3])
    final.save(out_path, "PNG", optimize=True, compress_level=9)
    return out_path


# ── 9:16 layout (1080×1920 IG/FB Story) ────────────────────────────
# Safe zones: top 250 / bottom 250 reserved for IG UI overlays. All
# meaningful content lives in y=250 → y=1670.
def render_story(content, out_path):
    W, H = 1080, 1920
    canvas = Image.new("RGBA", (W, H), CREAM + (255,))

    # Wireframe full-width bleed, opacity 40 %, background plate
    wf = get_wireframe_crop()
    target_w = W + 240   # bleed both sides
    aspect = wf.height / wf.width
    target_h = int(target_w * aspect)
    wf_s = wf.resize((target_w, target_h), Image.LANCZOS)
    wf_op = with_opacity(wf_s, 0.40)
    x = (W - target_w) // 2
    y = (H - target_h) // 2 + 200   # nudge slightly downward
    canvas.alpha_composite(wf_op, (x, y))

    # Logo @ y=320, centered, height 120
    logo = get_logo_sapphire()
    logo_h = 120
    logo_w = int(logo.width * logo_h / logo.height)
    logo_s = logo.resize((logo_w, logo_h), Image.LANCZOS)
    canvas.alpha_composite(logo_s, ((W - logo_w) // 2, 320))

    draw = ImageDraw.Draw(canvas)

    # Headline @ y=520, centered, Nunito Black 96, line-height 1.05
    font_h = load_font("Black", 96)
    y_hl = 520
    for line in content["headline"]:
        bbox = draw.textbbox((0, 0), line, font=font_h, anchor="lt")
        tw = bbox[2] - bbox[0]
        draw.text(((W - tw) // 2, y_hl), line, font=font_h, fill=SAPPHIRE, anchor="lt")
        y_hl += int(96 * 1.05)

    # v2: Subline @ y=820, Nunito Regular 40 → 52
    font_sub = load_font("Regular", 52)
    bbox = draw.textbbox((0, 0), content["subline"], font=font_sub, anchor="lt")
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, 820), content["subline"], font=font_sub, fill=SAPPHIRE, anchor="lt")

    # v2: CTA @ y=1100, Nunito Bold 36 → 42, padding 28×60 → 36×64
    font_cta = load_font("Bold", 42)
    cta = content["cta"]
    bbox = font_cta.getbbox(cta)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    pad_x, pad_y = 64, 36
    btn_w = text_w + 2 * pad_x
    btn_h = text_h + 2 * pad_y
    btn_x = (W - btn_w) // 2
    btn_y = 1100
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([btn_x, btn_y, btn_x + btn_w, btn_y + btn_h], radius=14, fill=MARIGOLD)
    canvas = Image.alpha_composite(canvas, overlay)
    td = ImageDraw.Draw(canvas)
    td.text((btn_x + pad_x - bbox[0], btn_y + pad_y - bbox[1]), cta, font=font_cta, fill=SAPPHIRE)

    # v2: URL @ y=1280, Nunito Medium 32 → 44, bullet 18 → 24 px
    font_url = load_font("Medium", 44)
    bbox = draw.textbbox((0, 0), content["url"], font=font_url, anchor="lt")
    tw = bbox[2] - bbox[0]
    dot_d = 24
    gap = 22
    group_w = dot_d + gap + tw
    group_x = (W - group_w) // 2
    bullet_overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bullet_overlay)
    dot_y = 1280 + (44 - dot_d) // 2 + 4   # vertically center with 44 px text
    bd.ellipse([group_x, dot_y, group_x + dot_d, dot_y + dot_d], fill=MARIGOLD)
    canvas = Image.alpha_composite(canvas, bullet_overlay)
    ud = ImageDraw.Draw(canvas)
    ud.text((group_x + dot_d + gap, 1280), content["url"], font=font_url, fill=SAPPHIRE, anchor="lt")

    # v2: Tagline @ y=1580 → y=1600 (Fix 3, inside safe zone),
    #     Nunito Regular 28 → 38, full SAPPHIRE (was 70% opacity)
    # Rebind ImageDraw after the last alpha_composite — see square notes.
    font_tag = load_font("Regular", 38)
    tag_draw = ImageDraw.Draw(canvas)
    bbox = tag_draw.textbbox((0, 0), content["tagline"], font=font_tag, anchor="lt")
    tw = bbox[2] - bbox[0]
    if tw > W - 200:
        font_tag = load_font("Regular", 34)
        bbox = tag_draw.textbbox((0, 0), content["tagline"], font=font_tag, anchor="lt")
        tw = bbox[2] - bbox[0]
    tag_draw.text(((W - tw) // 2, 1600), content["tagline"], font=font_tag, fill=SAPPHIRE, anchor="lt")

    final = Image.new("RGB", (W, H), CREAM)
    final.paste(canvas, mask=canvas.split()[3])
    final.save(out_path, "PNG", optimize=True, compress_level=9)
    return out_path


# ── Main ───────────────────────────────────────────────────────────
def main():
    outputs = []
    outputs.append(render_square(SK, os.path.join(OUT_DIR, "FSF_partneri_zmeny_SK_1080x1080.png")))
    outputs.append(render_square(EN, os.path.join(OUT_DIR, "FSF_partneri_zmeny_EN_1080x1080.png")))
    outputs.append(render_story(SK, os.path.join(OUT_DIR, "FSF_partneri_zmeny_SK_1080x1920.png")))
    outputs.append(render_story(EN, os.path.join(OUT_DIR, "FSF_partneri_zmeny_EN_1080x1920.png")))

    print()
    print("─── Validation ───")
    for path in outputs:
        img = Image.open(path)
        size_kb = os.path.getsize(path) / 1024
        print(f"  {os.path.basename(path):42s}  {img.size}  {img.mode}  {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
