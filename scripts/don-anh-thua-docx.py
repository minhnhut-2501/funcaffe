# -*- coding: utf-8 -*-
"""
Don anh mo coi trong tep .docx.

Vi sao can: khi doi anh bang python-docx, anh cu KHONG bi xoa khoi goi tin — no chi
thoi duoc tham chieu. Tep vi the cu phinh them sau moi lan thay anh (bao cao nay tu
40 MB len 59 MB chi vi mot luot thay 43 anh).

Cach lam: quet moi tep .rels, giu lai nhung media thuc su con duoc tham chieu tu
document/header/footer, roi ghi lai goi tin ZIP khong kem nhung tep con lai. Cac
quan he tro toi media da bien mat cung bi go, neu khong Word se bao tep hong.

Chay: python scripts/don-anh-thua-docx.py <duong-dan.docx>
"""
import os
import re
import shutil
import sys
import zipfile

duong_dan = sys.argv[1] if len(sys.argv) > 1 else r'C:\FunCafe\doc\DATN_FunCaffe.docx'

with zipfile.ZipFile(duong_dan) as z:
    ten_tep = z.namelist()
    noi_dung = {t: z.read(t) for t in ten_tep}

# rId thuc su duoc dung trong tung phan (document.xml, headerN.xml, footerN.xml...)
dang_dung = {}
for t, data in noi_dung.items():
    if not t.endswith('.xml') or '/_rels/' in t:
        continue
    ids = set(re.findall(rb'r:(?:embed|id|link)="(rId\d+)"', data))
    if ids:
        dang_dung[t] = ids

# Duyet cac tep .rels: bo quan he tro toi media ma khong con ai dung
media_con_dung = set()
rels_moi = {}
so_rel_bo = 0

for t, data in noi_dung.items():
    if not t.endswith('.rels'):
        continue
    # word/_rels/document.xml.rels  ->  word/document.xml
    chu = os.path.dirname(os.path.dirname(t))
    ten_chu = os.path.join(chu, os.path.basename(t)[:-5]).replace('\\', '/')
    ids = dang_dung.get(ten_chu, set())

    # Chu y: KHONG duoc tim b'<Relationship' de cat phan dau — chuoi do khop luon
    # ca the goc <Relationships>, cat theo no la mat the goc va tep hong. Phai bat
    # dung the con: '<Relationship ' co dau cach, hoac '<Relationship/>'.
    ket_qua = []
    for the in re.finditer(rb'<Relationship[ /][^>]*/>', data):
        the = the.group(0)
        m_id = re.search(rb'Id="([^"]+)"', the)
        m_tg = re.search(rb'Target="([^"]+)"', the)
        la_media = bool(m_tg) and b'media/' in m_tg.group(1)
        if la_media and m_id and m_id.group(1) not in ids:
            so_rel_bo += 1
            continue
        if la_media:
            ten = m_tg.group(1).decode().split('/')[-1]
            media_con_dung.add('word/media/' + ten)
        ket_qua.append(the)

    m_goc = re.search(rb'<Relationships[^>]*>', data)
    if m_goc and ket_qua:
        rels_moi[t] = data[:m_goc.end()] + b''.join(ket_qua) + b'</Relationships>'

tat_ca_media = {t for t in ten_tep if t.startswith('word/media/')}
bo_di = tat_ca_media - media_con_dung

truoc = os.path.getsize(duong_dan)
tam = duong_dan + '.tam'

with zipfile.ZipFile(tam, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for t in ten_tep:
        if t in bo_di:
            continue
        z.writestr(t, rels_moi.get(t, noi_dung[t]))

shutil.move(tam, duong_dan)
sau = os.path.getsize(duong_dan)

print(f'Da bo {len(bo_di)} anh mo coi va {so_rel_bo} quan he khong con dung.')
print(f'Con lai {len(media_con_dung)} anh.')
print(f'Kich thuoc: {truoc/1024/1024:.1f} MB -> {sau/1024/1024:.1f} MB')
