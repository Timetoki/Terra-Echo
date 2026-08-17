"""
把 assets/portraits/ 里的 427 张透明底立绘,批量处理成白色剪影 PNG,
输出到 assets/silhouettes/。文件名保持一致(代码按同名对应)。

用法(在仓库根目录):
    pip install pillow numpy
    python make_silhouettes.py

原理:立绘是透明底,直接用 alpha 通道当形状 —— 有像素的地方填白,
透明处保持透明。不改变原立绘,只多生成一套剪影图。
"""
from PIL import Image
import numpy as np
import os, glob

SRC = r"D:\Terra-Echo\assets\portraits"
DST = r"D:\Terra-Echo\assets\silhouettes"  # 输出白剪影
ALPHA_THRESH = 25             # alpha 高于此值算作人物(过滤边缘杂散半透明)
FILL_ALPHA = 240             # 剪影白色的不透明度

os.makedirs(DST, exist_ok=True)
files = sorted(glob.glob(os.path.join(SRC, "*.png")))
print(f"共 {len(files)} 张待处理")

for i, src in enumerate(files, 1):
    a = np.array(Image.open(src).convert("RGBA"))
    person = a[:, :, 3] > ALPHA_THRESH
    out = np.zeros_like(a)
    out[:, :, 0:3] = 255                                   # RGB 全白
    out[:, :, 3] = np.where(person, FILL_ALPHA, 0).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(os.path.join(DST, os.path.basename(src)))
    if i % 50 == 0:
        print(f"  {i}/{len(files)}")

print(f"完成,输出在 {DST}/  —— 把这个文件夹一起 push 到仓库即可")
