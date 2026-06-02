import sys
from PIL import Image

def resize_and_crop(img_path, out_path, target_size=(1200, 630)):
    try:
        with Image.open(img_path) as img:
            target_ratio = target_size[0] / target_size[1]
            img_ratio = img.width / img.height
            if img_ratio > target_ratio:
                new_width = int(img.height * target_ratio)
                left = (img.width - new_width) // 2
                img = img.crop((left, 0, left + new_width, img.height))
            elif img_ratio < target_ratio:
                new_height = int(img.width / target_ratio)
                top = (img.height - new_height) // 2
                img = img.crop((0, top, img.width, top + new_height))
            img = img.resize(target_size, Image.Resampling.LANCZOS)
            img.save(out_path, format="WEBP", quality=85)
            print(f"Saved {out_path}")
    except Exception as e:
        print(f"Error processing {img_path}: {e}")

resize_and_crop("images/gill-five-volumes-shelf.webp", "images/og-gill-five-volumes-shelf.webp")

