#!/usr/bin/env python3
"""Download MPP Classic piano samples for local development."""
import os
import urllib.request

BASE = "https://game.multiplayerpiano.com/sounds/mppclassic/"
OUT = os.path.join(os.path.dirname(__file__), "sounds", "mppclassic")

def all_keys():
    keys = ["a-1", "as-1", "b-1"]
    notes = "c cs d ds e f fs g gs a as b".split()
    for oct in range(7):
        for n in notes:
            keys.append(n + str(oct))
    keys.append("c7")
    return keys

def main():
    os.makedirs(OUT, exist_ok=True)
    keys = all_keys()
    for i, key in enumerate(keys, 1):
        path = os.path.join(OUT, key + ".mp3")
        if os.path.isfile(path) and os.path.getsize(path) > 1000:
            print(f"[{i}/{len(keys)}] skip {key}")
            continue
        url = BASE + key + ".mp3"
        print(f"[{i}/{len(keys)}] {url}")
        urllib.request.urlretrieve(url, path)
    info = {"name": "MPP Classic", "keys": keys, "ext": ".mp3"}
    import json
    with open(os.path.join(OUT, "info.json"), "w", encoding="utf-8") as f:
        json.dump(info, f)
    print("Done:", OUT)

if __name__ == "__main__":
    main()
