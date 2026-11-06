#!/usr/bin/env python3
"""Genera los íconos cuadrados de la app a partir del logo.

Uso (desde la carpeta frontend):
    python3 scripts/make-app-icons.py [public/brand/jbell-logo.png]

Crea en public/brand/: icon-192.png, icon-512.png e icon-maskable-512.png.
El fondo del cuadrado toma el color más frecuente del logo, así el logo rectangular no queda recortado.
El ícono "maskable" deja un margen de seguridad (Android puede recortarlo en círculo o con esquinas).
"""
import sys
from pathlib import Path
from PIL import Image

src = Path(sys.argv[1] if len(sys.argv) > 1 else 'public/brand/jbell-logo.png')
if not src.exists():
    sys.exit(f'No se encontró {src}. Copia el logo a esa ruta y vuelve a ejecutar.')

logo = Image.open(src).convert('RGBA')
# Color de fondo del cuadrado: el más frecuente del logo (el de una esquina puede diferir un poco del interior)
small = logo.convert('RGB').resize((96, 96))
bg = max(small.getcolors(96 * 96), key=lambda c: c[0])[1]


def edge_fade(w, h, ramp):
    """Máscara que se desvanece en los bordes (ramp = ancho del degradado en píxeles)."""
    mask = Image.new('L', (w, h))
    px = mask.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = round(255 * min(1.0, min(x, w - 1 - x, y, h - 1 - y) / ramp))
    return mask


def make(size, fill, feather=False):
    """Logo centrado, ocupando 'fill' del ancho del cuadrado, sobre el color de fondo.
    Con feather=True los bordes se desvanecen: así el patrón no se ve cortado cuando el logo se achica."""
    canvas = Image.new('RGBA', (size, size), bg + (255,))
    scale = (size * fill) / max(logo.width, logo.height)
    w, h = max(1, round(logo.width * scale)), max(1, round(logo.height * scale))
    resized = logo.resize((w, h), Image.LANCZOS)
    mask = edge_fade(w, h, 0.045 * max(w, h)) if feather else resized
    canvas.paste(resized, ((size - w) // 2, (size - h) // 2), mask)
    return canvas


out = src.parent
# Un logo casi cuadrado ocupa todo el icono; uno rectangular deja margen
full = 1.0 if abs(logo.width - logo.height) <= 0.05 * max(logo.size) else 0.90
make(192, full).save(out / 'icon-192.png')
make(512, full).save(out / 'icon-512.png')
make(512, 0.70, feather=True).save(out / 'icon-maskable-512.png')
print('Íconos generados en', out)
