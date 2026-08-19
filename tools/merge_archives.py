# merge operator archives into data.js
import json, re
from pathlib import Path

ROOT = Path(r"d:\Terra-Echo")
TSV = ROOT / "tools" / "archives.tsv"
DATA = ROOT / "data.js"

def load_archives():
    text = TSV.read_text(encoding="utf-8")
    arch = {}
    pending = None
    for raw in text.splitlines():
        if not raw.strip() or raw.startswith("中文姓名"):
            continue
        parts = raw.split("\t")
        # continuation of previous solo/row
        if pending is not None and (not parts[0].strip() or len(parts) < 4):
            extra = raw.strip()
            if extra:
                pending["solo"] = (pending["solo"] + extra).strip()
                # if this continuation also carries trailing fields
                rest = parts[1:] if not parts[0].strip() else parts
                if len(rest) >= 6:
                    pending["enName"] = rest[-6] or pending["enName"]
                    pending["gender"] = rest[-5] or pending["gender"]
                    pending["faction"] = rest[-4] or pending["faction"]
                    pending["origin"] = rest[-3] or pending["origin"]
                    pending["race"] = rest[-2] or pending["race"]
                    pending["subclass"] = rest[-1] or pending["subclass"]
                    arch[pending["name"]] = pending
                    pending = None
            continue
        if len(parts) < 4:
            continue
        name = parts[0].strip()
        rec = {
            "name": name,
            "author": parts[1].strip() if len(parts) > 1 else "",
            "solo": parts[2].strip() if len(parts) > 2 else "",
            "enName": parts[3].strip() if len(parts) > 3 else "",
            "gender": parts[4].strip() if len(parts) > 4 else "",
            "faction": parts[5].strip() if len(parts) > 5 else "",
            "origin": parts[6].strip() if len(parts) > 6 else "",
            "race": parts[7].strip() if len(parts) > 7 else "",
            "subclass": parts[8].strip() if len(parts) > 8 else "",
        }
        # incomplete row (e.g. 薇薇安娜 split)
        if len(parts) < 8:
            pending = rec
            continue
        if pending and pending["name"] == name:
            rec["solo"] = (pending["solo"] + rec["solo"]).strip()
            pending = None
        arch[name] = rec
        pending = None
    if pending:
        arch[pending["name"]] = pending
    return arch

def patch_object(block, rec):
    def js(s):
        return json.dumps(s or "", ensure_ascii=False)

    def repl_solo(m):
        if rec.get("solo"):
            return "solo: " + js(rec["solo"])
        return m.group(0)

    block = re.sub(r'solo:\s*"(?:[^"\\]|\\.)*"', repl_solo, block, count=1)

    fields = (
        f'enName: {js(rec.get("enName"))}, gender: {js(rec.get("gender"))}, '
        f'faction: {js(rec.get("faction"))}, origin: {js(rec.get("origin"))}, '
        f'race: {js(rec.get("race"))}, subclass: {js(rec.get("subclass"))}, '
        f'author: {js(rec.get("author"))}'
    )
    # drop old copies then insert before ending
    block = re.sub(
        r',?\s*enName:\s*"(?:[^"\\]|\\.)*"\s*,\s*gender:\s*"(?:[^"\\]|\\.)*"'
        r'\s*,\s*faction:\s*"(?:[^"\\]|\\.)*"\s*,\s*origin:\s*"(?:[^"\\]|\\.)*"'
        r'\s*,\s*race:\s*"(?:[^"\\]|\\.)*"\s*,\s*subclass:\s*"(?:[^"\\]|\\.)*"'
        r'\s*,\s*author:\s*"(?:[^"\\]|\\.)*"',
        "",
        block,
    )
    if "enName:" not in block:
        block = re.sub(r",\s*ending:", f", {fields}, ending:", block, count=1)
    return block

def main():
    arch = load_archives()
    src = DATA.read_text(encoding="utf-8")
    m = re.search(r"const OPERATORS = \[", src)
    if not m:
        raise SystemExit("OPERATORS not found")
    start = m.end()
    end = src.find("];", start)
    body = src[start:end]

    matched, missing = 0, []
    def sub_op(mo):
        nonlocal matched
        block = mo.group(0)
        nm = mo.group(1)
        rec = arch.get(nm)
        if not rec:
            return block
        matched += 1
        return patch_object(block, rec)

    new_body, n = re.subn(
        r'\{ name: "([^"]+)",[\s\S]*?ending: \[[^\]]*\] \}',
        sub_op,
        body,
    )
    DATA.write_text(src[:start] + new_body + src[end:], encoding="utf-8")
    unused = [k for k in arch if k not in re.findall(r'name: "([^"]+)"', new_body)]
    print(f"operators patched: {matched}")
    print(f"archive rows: {len(arch)}")
    print(f"unused archive names: {len(unused)}")
    if unused:
        print("\n".join(unused[:40]))

if __name__ == "__main__":
    main()
