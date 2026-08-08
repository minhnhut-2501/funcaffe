# -*- coding: utf-8 -*-
"""
Thay anh trong bao cao .docx theo SO HIEU CHU THICH, khong theo thu tu xuat hien.

Vi sao lam theo chu thich: mot tep anh trong .docx (word/media/imageNN.png) co the
duoc DUNG CHUNG cho nhieu hinh — chuong 3 va chuong 4 hay tro cung mot anh. Neu
thay theo ten tep media thi khong biet minh dang doi hinh nao; theo chu thich thi
noi ro duoc "Hinh 4.19 gio dung anh nao".

Chay:  python scripts/thay-anh-bao-cao.py "Hình 3.12.=user-menu" "Hình 4.18.=user-menu"
Ten anh la ten tep trong doc/report-shots, khong kem duoi .png.

Luu y: chay scripts/nen-anh-bao-cao.py TRUOC, va scripts/don-anh-thua-docx.py SAU —
anh cu bi bo lai trong goi .docx chu khong tu bien mat.
"""
import os
import sys

import docx
from PIL import Image
from docx.oxml.ns import qn

DOCX = r'C:\FunCafe\doc\DATN_FunCaffe.docx'
ANH = r'C:\FunCafe\doc\report-shots'

if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(1)

thay = {}
for cap in sys.argv[1:]:
    if '=' not in cap:
        print(f'Sai cu phap: {cap!r} — can dang "Hình 3.12.=user-menu"')
        sys.exit(1)
    khoa, ten = cap.split('=', 1)
    duong_dan = os.path.join(ANH, ten + '.png')
    if not os.path.exists(duong_dan):
        print(f'Khong co tep anh: {duong_dan}')
        sys.exit(1)
    thay[khoa.strip()] = ten.strip()

d = docx.Document(DOCX)
ps = d.paragraphs
da_thay = []

for i, p in enumerate(ps):
    blips = p._element.findall('.//' + qn('a:blip'))
    if not blips:
        continue

    # Chu thich nam o doan co chu dau tien SAU anh
    chu_thich = ''
    for j in range(i + 1, min(i + 3, len(ps))):
        if ps[j].text.strip():
            if ps[j].style.name == 'Caption Hinh':
                chu_thich = ps[j].text.strip()
            break

    ten = next((v for k, v in thay.items() if chu_thich.startswith(k)), None)
    if not ten:
        continue

    duong_dan = os.path.join(ANH, ten + '.png')
    rid, _ = d.part.get_or_add_image(duong_dan)
    blips[0].set(qn('r:embed'), rid)

    # Giu nguyen be ngang da can trong bao cao, chi tinh lai chieu cao theo ti le
    # anh moi — anh chup lai thuong cao thap khac anh cu.
    with Image.open(duong_dan) as im:
        ti_le = im.height / im.width
    for the in p._element.findall('.//' + qn('wp:extent')):
        the.set('cy', str(int(round(int(the.get('cx')) * ti_le))))
    for the in p._element.findall('.//' + qn('a:ext')):
        if the.get('cx'):
            the.set('cy', str(int(round(int(the.get('cx')) * ti_le))))

    da_thay.append((chu_thich, ten))

thieu = [k for k in thay if not any(c.startswith(k) for c, _ in da_thay)]

d.save(DOCX)
for c, t in da_thay:
    print(f'  {c[:56]:<58} <- {t}.png')
print(f'\nDa thay {len(da_thay)} hinh.')
if thieu:
    print('KHONG tim thay chu thich:', ', '.join(thieu))
    sys.exit(1)
