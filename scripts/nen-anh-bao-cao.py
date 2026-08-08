# -*- coding: utf-8 -*-
"""
Nen anh chup man hinh truoc khi nhung vao bao cao .docx.

Vi sao can: anh chup o deviceScaleFactor=2 ra ben ngang 2880px, rieng trang chu
va trang Tinh nang nang 8-10 MB moi tam. Nhung thang vao .docx la tep phong len
hang tram MB, Word mo se i va khong gui qua email duoc.

Cach lam: ha ben ngang ve 1600px (Word in ra chi rong ~16cm, 1600px la thua du
cho ban in 300dpi) roi luu lai PNG toi uu. Anh so do ve bang Pillow thi bo qua
- chung von da nhe va la net vector, ha do phan giai se mo chu.
"""
import io
import os
import sys
from PIL import Image

THU_MUC = r'C:\FunCafe\doc\report-shots'
BEN_NGANG_TOI_DA = 1600

# So do tu ve: giu nguyen, khong dung den.
BO_QUA = {
    'diagram-deploy', 'diagram-erd', 'diagram-tree-backend', 'diagram-tree-frontend',
    'so-do-giao-dien', 'usecase-admin', 'usecase-user', 'usecase-tongquat',
}

tong_truoc = tong_sau = 0
doi = 0

for ten in sorted(os.listdir(THU_MUC)):
    if not ten.lower().endswith('.png'):
        continue
    goc = os.path.splitext(ten)[0]
    duong_dan = os.path.join(THU_MUC, ten)
    truoc = os.path.getsize(duong_dan)
    tong_truoc += truoc

    if goc in BO_QUA:
        tong_sau += truoc
        continue

    im = Image.open(duong_dan)
    if im.width > BEN_NGANG_TOI_DA:
        cao = round(im.height * BEN_NGANG_TOI_DA / im.width)
        im = im.convert('RGB').resize((BEN_NGANG_TOI_DA, cao), Image.LANCZOS)
        im.save(duong_dan, 'PNG', optimize=True)
        doi += 1

    sau = os.path.getsize(duong_dan)
    tong_sau += sau
    if truoc != sau:
        print(f'  {goc:<28} {truoc/1024/1024:6.2f} MB -> {sau/1024/1024:5.2f} MB')

print(f'\nDa nen {doi} anh.  Tong: {tong_truoc/1024/1024:.1f} MB -> {tong_sau/1024/1024:.1f} MB')
