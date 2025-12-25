import ctypes
from pathlib import Path

# ---------------- CONFIG ----------------

HUNSPELL_DLL = r"D:\vcpkg\installed\x64-windows\bin\hunspell-1.7-0.dll"
DICT_DIR = Path(r"TODO")

AFF_FILE = DICT_DIR / "hu_HU.aff"
DIC_FILE = DICT_DIR / "hu_HU.dic"

INPUT_FILE = DICT_DIR / "allowed_words.txt"
OUTPUT_FILE = DICT_DIR / "allowed_words_clean.txt"

# ---------------- HUNSPELL BINDINGS ----------------

lib = ctypes.cdll.LoadLibrary(HUNSPELL_DLL)

lib.Hunspell_create.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
lib.Hunspell_create.restype = ctypes.c_void_p

lib.Hunspell_spell.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
lib.Hunspell_spell.restype = ctypes.c_int

lib.Hunspell_destroy.argtypes = [ctypes.c_void_p]

# ---------------- HELPERS ----------------

def create_hunspell():
    return lib.Hunspell_create(
        str(AFF_FILE).encode("utf-8"),
        str(DIC_FILE).encode("utf-8"),
    )

def spell(hs, word):
    return lib.Hunspell_spell(hs, word.encode("utf-8")) == 1

# ---------------- PROCESS ----------------

print("Loading Hunspell...")
h = create_hunspell()

print("Reading extracted words...")
words = [
    w.strip().lower()
    for w in INPUT_FILE.read_text(encoding="utf-8").splitlines()
    if w.strip()
]

print(f"Loaded {len(words)} words")

valid = []
invalid = 0

for i, word in enumerate(words, start=1):
    if spell(h, word):
        valid.append(word)
    else:
        invalid += 1

    if i % 1000 == 0:
        print(f"Checked {i} words...")

# ---------------- SAVE ----------------

OUTPUT_FILE.write_text(
    "\n".join(sorted(set(valid))),
    encoding="utf-8",
)

print("\n---------------- SUMMARY ----------------")
print(f"Input words     : {len(words)}")
print(f"Valid words     : {len(valid)}")
print(f"Rejected garbage: {invalid}")
print(f"Saved to        : {OUTPUT_FILE}")

lib.Hunspell_destroy(h)
