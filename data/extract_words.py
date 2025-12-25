import re

INPUT = "hu_HU.dic"
OUTPUT = "allowed_words.txt"

words = set()

with open(INPUT, encoding="utf-8") as f:
    next(f)  # skip first line (word count)
    for line in f:
        line = line.strip()
        if not line:
            continue

        # take only before first slash
        word = line.split("/", 1)[0].strip().lower()

        # skip if contains digits
        if any(char.isdigit() for char in word):
            continue

        # keep only letters (Hungarian included)
        if not re.fullmatch(r"[a-záéíóöőúüű]+", word):
            continue

        words.add(word)

with open(OUTPUT, "w", encoding="utf-8") as out:
    for w in sorted(words):
        out.write(w + "\n")

print(f"Saved {len(words)} clean words to {OUTPUT}")
