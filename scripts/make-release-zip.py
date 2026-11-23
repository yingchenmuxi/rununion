#!/usr/bin/env python3
"""把 releases/qingrun-server-vX.Y.Z 打成同版本 zip，并写 sha256。"""
import hashlib
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RELEASES = os.path.join(ROOT, "releases")

def main():
    if len(sys.argv) != 2:
        print("用法：python scripts/make-release-zip.py v0.1.0")
        return 1
    version = sys.argv[1]
    if not version.startswith("v"):
        version = "v" + version
    name = "qingrun-server-" + version
    source = os.path.join(RELEASES, name)
    if not os.path.isdir(source):
        print("发布目录不存在：" + source)
        return 1
    target = os.path.join(RELEASES, name + ".zip")
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for dirpath, _, files in os.walk(source):
            for filename in sorted(files):
                full = os.path.join(dirpath, filename)
                rel = os.path.relpath(full, RELEASES)
                archive.write(full, rel.replace(os.sep, "/"))
    digest = hashlib.sha256()
    with open(target, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    checksum = digest.hexdigest()
    with open(target + ".sha256", "w", encoding="utf-8") as handle:
        handle.write(checksum + "  " + name + ".zip\n")
    print("压缩包：" + target)
    print("大小：" + str(os.path.getsize(target)) + " bytes")
    print("SHA-256：" + checksum)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
