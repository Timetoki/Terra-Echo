import re
from pathlib import Path
t = Path(r"d:\Terra-Echo\data.js").read_text(encoding="utf-8")
names = re.findall(r'\{\s*name:\s*"([^"]+)"', t)
print(len(names))
Path(r"d:\Terra-Echo\tools\op_names.txt").write_text("\n".join(names), encoding="utf-8")
