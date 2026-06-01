# apply_changes.py
import re

def patch_antisovetov_images():
    filepath = "articles/20-antisovetov-pastoru/index.html"
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update line 571's srcset to use mirror instead of hero
    old_line_571 = 'srcset="../../images/pastor-series/hero-600w.webp 600w, ../../images/pastor-series/hero-900w.webp 900w, ../../images/pastor-series/mirror.webp 1672w"'
    new_line_571 = 'srcset="../../images/pastor-series/mirror-600w.webp 600w, ../../images/pastor-series/mirror-900w.webp 900w, ../../images/pastor-series/mirror.webp 1672w"'
    content = content.replace(old_line_571, new_line_571)

    # 2. Update line 668 to use manipulation.webp completely
    old_img_668 = '<img alt="Силуэт у кафедры в темноте — откуда берётся разрушение" decoding="async" loading="lazy" src="../../images/pastor-series/mirror.webp" width="2688" height="1536"/ srcset="../../images/pastor-series/hero-600w.webp 600w, ../../images/pastor-series/hero-900w.webp 900w, ../../images/pastor-series/mirror.webp 2688w" sizes="(max-width: 640px) 600px, (max-width: 1024px) 900px, 2688px">'
    new_img_668 = '<img alt="Рука, управляющая марионетками — откуда берётся скрытое манипулирование" decoding="async" loading="lazy" src="../../images/pastor-series/manipulation.webp" width="2688" height="1536" srcset="../../images/pastor-series/manipulation-600w.webp 600w, ../../images/pastor-series/manipulation-900w.webp 900w, ../../images/pastor-series/manipulation.webp 2688w" sizes="(max-width: 640px) 600px, (max-width: 1024px) 900px, 2688px">'
    content = content.replace(old_img_668, new_img_668)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully corrected 20-antisovetov article's image duplicate with manipulation.webp")

patch_antisovetov_images()
