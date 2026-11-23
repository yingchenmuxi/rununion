from PIL import Image
from pathlib import Path

root = Path(__file__).resolve().parent.parent
out = root / "pwa" / "icons"
out.mkdir(parents=True, exist_ok=True)
base = Image.open(out / "icon-1024.png").convert("RGBA")

def save_resized(size, name):
    base.resize((size, size), Image.Resampling.LANCZOS).save(out / name, optimize=True)

save_resized(192, "icon-192.png")
save_resized(512, "icon-512.png")
save_resized(180, "apple-touch-icon.png")

# Maskable icons get cropped by Android; keep the mark inside the central safe area.
canvas = Image.new("RGBA", (1024, 1024), (14, 90, 74, 255))
inner = base.resize((720, 720), Image.Resampling.LANCZOS)
canvas.alpha_composite(inner, ((1024 - 720) // 2, (1024 - 720) // 2))
canvas.resize((512, 512), Image.Resampling.LANCZOS).save(out / "maskable-512.png", optimize=True)
print("PWA icons:", sorted(p.name for p in out.glob("*.png")))
