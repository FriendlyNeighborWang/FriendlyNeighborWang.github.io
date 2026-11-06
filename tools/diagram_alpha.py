#!/usr/bin/env python3
"""
把白底示意图（matplotlib 图表、流程图）处理成透明底，并生成一张暗色版本。

    python3 tools/diagram_alpha.py IN.png OUT_DIR [--mode plot|flood]

输出 OUT_DIR/<name>.png（亮色：透明底 + 原色墨迹）和 OUT_DIR/<name>.dark.png
（暗色：墨迹 HSL 明度 L → max(L, 1-L)，黑字变白字，色相不变）。rendererer 主题的
render-image 会把 images/diagrams/ 下的图按明暗主题自动切换。

模式：
  plot   整张图做 color-to-alpha（纯图表，没有需要保护的照片内容）
  flood  只处理从边缘连通的白色背景 + 小连通块（文字、箭头），大块内容
         （嵌入的渲染截图、球体等）原样保留，边缘只做抗锯齿透明

纯标准库实现（zlib），只支持 8bit RGBA / RGB、非隔行 PNG。
"""
import argparse
import colorsys
import os
import struct
import sys
import zlib
from collections import deque


# ---------------------------------------------------------------- PNG I/O --
def read_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'not a PNG'
    pos, idat, w = 8, [], None
    while pos < len(data):
        n, typ = struct.unpack('>I4s', data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        if typ == b'IHDR':
            w, h, bd, ct, _, _, il = struct.unpack('>IIBBBBB', body)
            assert bd == 8 and ct in (2, 6) and il == 0, 'unsupported PNG format'
            bpp = 4 if ct == 6 else 3
        elif typ == b'IDAT':
            idat.append(body)
        elif typ == b'IEND':
            break
        pos += 12 + n

    raw = zlib.decompress(b''.join(idat))
    stride = w * bpp
    out = bytearray(w * h * 4)
    prev = bytearray(stride)
    for y in range(h):
        f = raw[y * (stride + 1)]
        line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        if f == 1:
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 255
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                left = line[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        prev = line
        if bpp == 4:
            out[y * w * 4:(y + 1) * w * 4] = line
        else:
            o = y * w * 4
            for x in range(w):
                out[o + x * 4:o + x * 4 + 3] = line[x * 3:x * 3 + 3]
                out[o + x * 4 + 3] = 255
    return w, h, out


def write_png(path, w, h, rgba):
    def chunk(typ, body):
        c = struct.pack('>I', len(body)) + typ + body
        return c + struct.pack('>I', zlib.crc32(typ + body) & 0xffffffff)

    stride = w * 4
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += rgba[y * stride:(y + 1) * stride]
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)))
        f.write(chunk(b'IDAT', zlib.compress(bytes(raw), 9)))
        f.write(chunk(b'IEND', b''))


# ------------------------------------------------------------- per pixel --
def color_to_alpha(r, g, b):
    """GIMP-style: treat the pixel as ink composited over white, recover ink + alpha."""
    a = max(255 - r, 255 - g, 255 - b)
    if a == 0:
        return 0, 0, 0, 0
    k = 255.0 / a
    ink = lambda c: max(0, min(255, int(round(255 - (255 - c) * k))))
    return ink(r), ink(g), ink(b), a


def invert_lightness(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
    # Only dark ink is lifted; colours that are already light enough stay as they are.
    r2, g2, b2 = colorsys.hls_to_rgb(h, max(l, 1.0 - l), s)
    return int(r2 * 255 + 0.5), int(g2 * 255 + 0.5), int(b2 * 255 + 0.5)


# --------------------------------------------------------------- masks ----
def flood_masks(w, h, px, white_min=235, small_max=None, ring=2):
    """Return (process, edge): process = background + small blobs, edge = AA ring of big blobs."""
    n = w * h
    small_max = small_max or max(4000, n // 400)
    is_white = bytearray(n)
    for i in range(n):
        o = i * 4
        if min(px[o], px[o + 1], px[o + 2]) >= white_min:
            is_white[i] = 1

    process = bytearray(n)
    q = deque()
    for x in range(w):
        for i in (x, (h - 1) * w + x):
            if is_white[i] and not process[i]:
                process[i] = 1
                q.append(i)
    for y in range(h):
        for i in (y * w, y * w + w - 1):
            if is_white[i] and not process[i]:
                process[i] = 1
                q.append(i)
    while q:
        i = q.popleft()
        x, y = i % w, i // w
        for j, ok in ((i - 1, x > 0), (i + 1, x < w - 1), (i - w, y > 0), (i + w, y < h - 1)):
            if ok and is_white[j] and not process[j]:
                process[j] = 1
                q.append(j)

    # Label everything outside the background; small components are text / arrows.
    label = bytearray(n)  # 0 = unvisited, 1 = small, 2 = big
    for start in range(n):
        if process[start] or label[start]:
            continue
        comp = [start]
        label[start] = 3
        k = 0
        while k < len(comp):
            i = comp[k]
            k += 1
            x, y = i % w, i // w
            for dy in (-1, 0, 1):
                yy = y + dy
                if yy < 0 or yy >= h:
                    continue
                for dx in (-1, 0, 1):
                    xx = x + dx
                    if 0 <= xx < w:
                        j = yy * w + xx
                        if not process[j] and not label[j]:
                            label[j] = 3
                            comp.append(j)
        tag = 1 if len(comp) <= small_max else 2
        for i in comp:
            label[i] = tag

    edge = bytearray(n)
    for i in range(n):
        if label[i] == 1:
            process[i] = 1
    # Anti-aliased rim of the big blobs: alpha only, keep original colour.
    frontier = [i for i in range(n) if process[i]]
    for _ in range(ring):
        nxt = []
        for i in frontier:
            x, y = i % w, i // w
            for j, ok in ((i - 1, x > 0), (i + 1, x < w - 1), (i - w, y > 0), (i + w, y < h - 1)):
                if ok and label[j] == 2 and not edge[j]:
                    edge[j] = 1
                    nxt.append(j)
        frontier = nxt
    return process, edge


# ---------------------------------------------------------------- main ----
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('out_dir')
    ap.add_argument('--mode', choices=('plot', 'flood'), default='plot')
    args = ap.parse_args()

    w, h, px = read_png(args.src)
    n = w * h
    if args.mode == 'plot':
        process, edge = None, None
    else:
        process, edge = flood_masks(w, h, px)

    light = bytearray(px)
    dark = bytearray(px)
    cache = {}
    for i in range(n):
        o = i * 4
        if process is not None and not process[i] and not edge[i]:
            continue
        r, g, b = px[o], px[o + 1], px[o + 2]
        key = (r, g, b)
        res = cache.get(key)
        if res is None:
            ir, ig, ib, a = color_to_alpha(r, g, b)
            dr, dg, db = invert_lightness(ir, ig, ib) if a else (0, 0, 0)
            res = cache[key] = (ir, ig, ib, a, dr, dg, db)
        ir, ig, ib, a, dr, dg, db = res
        a = a * px[o + 3] // 255
        light[o:o + 4] = bytes((ir, ig, ib, a))
        if process is not None and edge[i]:
            dark[o:o + 4] = bytes((ir, ig, ib, a))
        else:
            dark[o:o + 4] = bytes((dr, dg, db, a))

    os.makedirs(args.out_dir, exist_ok=True)
    name = os.path.splitext(os.path.basename(args.src))[0]
    write_png(os.path.join(args.out_dir, name + '.png'), w, h, light)
    write_png(os.path.join(args.out_dir, name + '.dark.png'), w, h, dark)
    print(f'{name}: {w}x{h} ({args.mode})', file=sys.stderr)


if __name__ == '__main__':
    main()
