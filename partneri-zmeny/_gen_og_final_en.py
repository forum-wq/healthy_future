"""
English variant of the OG image renderer.

Mirrors _gen_og_final.py 1:1 — same layout, colors, fonts, backdrop
fade, logo recolor, footer bullet. Only text constants and output
filename differ. Generates `og-image-en.png` for the future-slovakia.eu
English landing.

Slug `/partnerships` is an assumption from the Wix menu item; ask
Dávid to confirm before final upload.
"""

import cv2
import numpy as np
import os
from PIL import Image, ImageDraw, ImageFont

# ── Paths ──────────────────────────────────────────────────────────
DIR = "/Users/davidboruta/Documents/MachineProjects/healthy_future/partneri-zmeny"
SRC = os.path.join(DIR, "og-source-cleaned.png")
LOGO = os.path.join(DIR, "logo-fsf.png")
BG_CLEAN = os.path.join(DIR, "_og_background_clean.png")
OUT = os.path.join(DIR, "og-image-en.png")
FONT_DIR = os.path.join(DIR, "_fonts")

# ── Brand colors ───────────────────────────────────────────────────
SAPPHIRE = (6, 36, 75)
MARIGOLD = (255, 174, 0)
WHITE = (255, 255, 255)
SAPPHIRE_MUTED = (6, 36, 75, 178)   # 70% alpha for footer slogan
CREAM = (245, 220, 175)             # backdrop fill — matches source bg

# ── Font loader ────────────────────────────────────────────────────
# Nunito ships on Google Fonts as a single variable font with a weight axis
# (named variations: ExtraLight, Light, Regular, Medium, SemiBold, Bold,
# ExtraBold, Black). Load fresh per call so axis changes don't leak.
def load_font(weight, size):
    path = os.path.join(FONT_DIR, "Nunito[wght].ttf")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing font: {path}")
    font = ImageFont.truetype(path, size)
    font.set_variation_by_name(weight)
    return font


# ── Step 1: Inpaint all marigold from source ─────────────────────
def step1_inpaint_marigold():
    img = cv2.imread(SRC)
    if img is None:
        raise SystemExit(f"Cannot read source: {SRC}")
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([5, 140, 100]), np.array([30, 255, 255]))
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)
    clean = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)
    cv2.imwrite(BG_CLEAN, clean)
    print(f"[step1] inpainted marigold → {BG_CLEAN}")
    return clean


# ── Step 2: Crop + resize to 1200×630 RGBA canvas ─────────────────
def step2_canvas(clean_bgr):
    rgb = cv2.cvtColor(clean_bgr, cv2.COLOR_BGR2RGB)
    H, W = rgb.shape[:2]
    target_ratio = 1200 / 630
    src_ratio = W / H
    if src_ratio < target_ratio:
        new_h = int(W / target_ratio)
        top = (H - new_h) // 2
        cropped = rgb[top:top + new_h, :]
    else:
        new_w = int(H * target_ratio)
        left = (W - new_w) // 2
        cropped = rgb[:, left:left + new_w]
    pil_img = Image.fromarray(cropped).resize((1200, 630), Image.LANCZOS).convert("RGBA")
    print(f"[step2] canvas {pil_img.size} ready")
    return pil_img


# ── Step 2b: Cream backdrop for text legibility ──────────────────
# Per option 3: subtle left→right linear-fade cream panel behind the
# text block. Keeps blueprint visible on the right while preventing
# the headline ("nevznikajú") from mixing with sapphire scaffolding
# at thumbnail/share-preview scale.
def step2b_backdrop(canvas, max_alpha=235,
                     fade_start=560, fade_end=920,
                     y_top=140, y_bottom=510):
    backdrop = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(backdrop)
    for x in range(canvas.size[0]):
        if x < fade_start:
            alpha = max_alpha
        elif x < fade_end:
            progress = (x - fade_start) / (fade_end - fade_start)
            alpha = int(max_alpha * (1 - progress))
        else:
            alpha = 0
        if alpha > 0:
            draw.line([(x, y_top), (x, y_bottom)], fill=CREAM + (alpha,))
    canvas = Image.alpha_composite(canvas, backdrop)
    print(f"[step2b] cream backdrop alpha≤{max_alpha} "
          f"fade {fade_start}→{fade_end} y=[{y_top},{y_bottom}]")
    return canvas


# ── Step 3: Logo directly on cream (no pill) ──────────────────────
# Per latest brief: use the official Color_RGB brand variant which has
# sapphire text + colored mark — designed exactly for cream/light bg.
#
# IMPORTANT: the file currently present in _brand/Logo_FSF_Color_RGB.png
# is byte-identical to the older white-text logo (verified via MD5 +
# pixel inspection: text area is RGB 255/255/255). The official sapphire
# variant was not copyable from the user's Desktop (macOS TCC blocked
# bulk copy). As a workaround we derive the sapphire-text variant from
# the white source at render time:
#   1. Find pixels whose saturation is low (near-grayscale = the text)
#      AND whose alpha is visible AND whose RGB is light (white-ish).
#   2. Recolor those pixels to sapphire #06244B.
#   3. Leave the colored mark (highly saturated maya blue + marigold)
#      untouched — the saturation test excludes them.
# If the user later supplies the real Color_RGB asset, swap LOGO_PATH
# below and remove the recolor branch.
def step3_logo(canvas, target_h=80):
    logo_path = os.path.join(DIR, "_brand", "Logo_FSF_Color_RGB.png")
    if not os.path.exists(logo_path):
        raise FileNotFoundError(f"Missing brand logo: {logo_path}")
    logo = Image.open(logo_path).convert("RGBA")
    arr = np.array(logo)

    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]
    saturation = rgb.max(axis=-1).astype(int) - rgb.min(axis=-1).astype(int)
    text_mask = (
        (alpha > 32) &
        (rgb[:, :, 0] > 200) & (rgb[:, :, 1] > 200) & (rgb[:, :, 2] > 200) &
        (saturation < 30)
    )
    recolored_px = int(text_mask.sum())
    if recolored_px > 0:
        arr[text_mask, 0] = SAPPHIRE[0]
        arr[text_mask, 1] = SAPPHIRE[1]
        arr[text_mask, 2] = SAPPHIRE[2]
        print(f"[step3]   recolored {recolored_px} white text px → sapphire")
    logo = Image.fromarray(arr)

    lw, lh = logo.size
    new_w = int(lw * target_h / lh)
    logo = logo.resize((new_w, target_h), Image.LANCZOS)

    # Pred-launch tweak: logo posunutý o 10 px nižšie (viac vzduchu hore)
    logo_x, logo_y = 72, 64
    canvas.paste(logo, (logo_x, logo_y), logo)
    print(f"[step3] logo Color_RGB {new_w}×{target_h} @ ({logo_x},{logo_y}), no pill")
    return canvas


# ── Step 4: Headline + subheadline ────────────────────────────────
def step4_headline(canvas):
    draw = ImageDraw.Draw(canvas)
    font_h = load_font("Black", 84)
    # EN headline mirrors SK split: subject+verb on line 1, prep phrase on line 2
    headline_lines = ["Reforms aren't built", "on election day."]
    y = 170
    for line in headline_lines:
        draw.text((72, y), line, font=font_h, fill=SAPPHIRE, anchor="lt")
        # Measure rendered width for log + overflow check
        bbox = draw.textbbox((72, y), line, font=font_h, anchor="lt")
        print(f"[step4]   headline '{line}' → width {bbox[2]-bbox[0]} px (right edge {bbox[2]})")
        y += 84  # line-height 1.0

    font_sub = load_font("SemiBold", 34)
    sub_text = "Build them while there's time."
    bbox = draw.textbbox((72, 370), sub_text, font=font_sub, anchor="lt")
    sub_w = bbox[2] - bbox[0]
    if sub_w > 1128:
        font_sub = load_font("SemiBold", 32)
        print(f"[step4]   sub at 34 too wide ({sub_w}), dropping to 32")
    draw.text((72, 370), sub_text, font=font_sub, fill=SAPPHIRE, anchor="lt")
    print(f"[step4]   sub '{sub_text}' rendered")
    return canvas


# ── Step 5: CTA pill ──────────────────────────────────────────────
def step5_cta(canvas):
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font_cta = load_font("Bold", 28)
    cta_text = "Become a partner"
    pad_x, pad_y = 28, 16

    bbox = font_cta.getbbox(cta_text)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    text_off_x = bbox[0]
    text_off_y = bbox[1]

    pill_x, pill_y = 72, 450
    pill_w = text_w + 2 * pad_x
    pill_h = text_h + 2 * pad_y

    draw.rounded_rectangle(
        [pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
        radius=14,
        fill=MARIGOLD
    )
    canvas = Image.alpha_composite(canvas, overlay)

    # Text drawn directly on canvas so it doesn't get alpha-blended with pill alpha
    text_draw = ImageDraw.Draw(canvas)
    text_draw.text(
        (pill_x + pad_x - text_off_x, pill_y + pad_y - text_off_y),
        cta_text,
        font=font_cta,
        fill=SAPPHIRE
    )
    print(f"[step5] CTA pill {pill_w}×{pill_h} @ ({pill_x},{pill_y}) text='{cta_text}'")
    return canvas


# ── Step 6: Footer (dot + URL + slogan) ───────────────────────────
def step6_footer(canvas):
    # Marigold dot
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    dx, dy, r = 86, 560, 7
    draw.ellipse([dx - r, dy - r, dx + r, dy + r], fill=MARIGOLD)
    canvas = Image.alpha_composite(canvas, overlay)

    # URL — Nunito Medium, pred-launch bump 22 → 26 (+18 %)
    text_draw = ImageDraw.Draw(canvas)
    font_url = load_font("Medium", 26)
    # URL slug "/partnerships" is an assumption from the Wix menu — confirm
    # with Dávid before final upload. If different (e.g. /partners or
    # /become-a-partner), update the string and re-render.
    text_draw.text((110, 548), "future-slovakia.eu/partnerships",
                   font=font_url, fill=SAPPHIRE, anchor="lt")

    # Tagline — Nunito Regular, +15 % vs initial spec, sapphire @ 70 %
    font_slogan = load_font("Regular", 23)
    slogan_overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    slogan_draw = ImageDraw.Draw(slogan_overlay)
    slogan_draw.text((110, 585), "Facts into action. Reforms for Slovakia.",
                     font=font_slogan, fill=SAPPHIRE_MUTED, anchor="lt")
    canvas = Image.alpha_composite(canvas, slogan_overlay)

    print(f"[step6] footer: marigold dot @ ({dx},{dy}) r={r}; URL + slogan")
    return canvas


# ── Pre-flight ─────────────────────────────────────────────────────
def preflight():
    img = Image.open(OUT)
    size_kb = os.path.getsize(OUT) / 1024
    print()
    print("─── Pre-flight ───")
    assert img.size == (1200, 630), f"Bad dimensions: {img.size}"
    assert img.mode in ("RGB", "RGBA"), f"Bad mode: {img.mode}"
    assert size_kb < 1024, f"Too big: {size_kb:.0f} KB"
    print(f"  ✓ Dimensions: {img.size}")
    print(f"  ✓ Mode: {img.mode}")
    print(f"  ✓ Size: {size_kb:.1f} KB")


# ── Main ───────────────────────────────────────────────────────────
def main():
    clean = step1_inpaint_marigold()
    canvas = step2_canvas(clean)
    canvas = step2b_backdrop(canvas)   # option-3 cream fade panel
    canvas = step3_logo(canvas, target_h=64)
    canvas = step4_headline(canvas)
    canvas = step5_cta(canvas)
    canvas = step6_footer(canvas)

    # Flatten RGBA → RGB on white before save (PNG keeps quality + smaller)
    final = Image.new("RGB", canvas.size, (255, 255, 255))
    final.paste(canvas, mask=canvas.split()[3])
    final.save(OUT, "PNG", optimize=True, compress_level=9)
    print(f"\n[save] {OUT}")

    # Thumbnail simulation — Slack / FB / LinkedIn share preview is ~300px wide
    thumb_path = os.path.join(DIR, "_thumb_simulation_en.png")
    thumb = final.resize((300, 157), Image.LANCZOS)
    thumb.save(thumb_path, "PNG", optimize=True)
    print(f"[save] thumbnail simulation: {thumb_path}")

    preflight()


if __name__ == "__main__":
    main()
