#!/usr/bin/env python3
"""Genera los íconos cuadrados de la app a partir del logo.

Uso (desde la carpeta frontend):
    python3 scripts/make-app-icons.py [public/brand/jbell-logo.png]

Crea en public/brand/: icon-192.png, icon-512.png e icon-maskable-512.png.
El fondo del cuadrado toma el color de la esquina del logo, así el logo rectangular no queda recortado.
El ícono "maskable" deja un margen de seguridad (Android puede recortarlo en círculo o con esquinas).
"""
import sys
from pathlib import Path
from PIL import Image

src = Path(sys.argv[1] if len(sys.argv) > 1 else 'public/brand/jbell-logo.png')
if not src.exists():
    sys.exit(f'No se encontró {src}. Copia el logo a esa ruta y vuelve a ejecutar.')

logo = Image.open(src).convert('RGBA')
bg = logo.getpixel((2, 2))[:3]  # color de la esquina


def make(size, fill):
    """Logo centrado, ocupando 'fill' del ancho del cuadrado, sobre el color de fondo."""
    canvas = Image.new('RGBA', (size, size), bg + (255,))
    scale = (size * fill) / max(logo.width, logo.height)
    w, h = max(1, round(logo.width * scale)), max(1, round(logo.height * scale))
    resized = logo.resize((w, h), Image.LANCZOS)
    canvas.paste(resized, ((size - w) // 2, (size - h) // 2), resized)
    return canvas


out = src.parent
make(192, 0.90).save(out / 'icon-192.png')
make(512, 0.90).save(out / 'icon-512.png')
make(512, 0.62).save(out / 'icon-maskable-512.png')
print('Íconos generados en', out)
