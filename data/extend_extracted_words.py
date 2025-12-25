import ctypes
from pathlib import Path

# ---------------- CONFIG ----------------

HUNSPELL_DLL = r"D:\vcpkg\installed\x64-windows\bin\hunspell-1.7-0.dll"
lib = ctypes.cdll.LoadLibrary(HUNSPELL_DLL)

# --- Hunspell bindings ---

lib.Hunspell_create.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
lib.Hunspell_create.restype = ctypes.c_void_p

lib.Hunspell_spell.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
lib.Hunspell_spell.restype = ctypes.c_int

lib.Hunspell_suggest.argtypes = [
    ctypes.c_void_p,
    ctypes.POINTER(ctypes.POINTER(ctypes.c_char_p)),
    ctypes.c_char_p,
]
lib.Hunspell_suggest.restype = ctypes.c_int

lib.Hunspell_destroy.argtypes = [ctypes.c_void_p]

DICT_DIR = Path(r"TODO")
AFF_FILE = DICT_DIR / "hu_HU.aff"
DIC_FILE = DICT_DIR / "hu_HU.dic"

BASE_WORDS_FILE = DICT_DIR / "base_words.txt"
OUTPUT_FILE = DICT_DIR / "allowed_words.txt"

MAX_WORD_LENGTH = 15
MIN_WORD_LENGTH = 2

# ---------------- HELPERS ----------------

def create_hunspell(lang="hu_HU"):
    aff = str(DICT_DIR / f"{lang}.aff").encode("utf-8")
    dic = str(DICT_DIR / f"{lang}.dic").encode("utf-8")
    return lib.Hunspell_create(aff, dic)

def spell(hs, word):
    return lib.Hunspell_spell(hs, word.encode("utf-8")) == 1

def suggest(hs, word):
    slst = ctypes.POINTER(ctypes.c_char_p)()
    n = lib.Hunspell_suggest(hs, ctypes.byref(slst), word.encode("utf-8"))
    return [slst[i].decode("utf-8") for i in range(n)]

# ---------------- LOAD ----------------

print("Loading Hunspell...")
h = create_hunspell()

print("Loading base words...")
base_words = {
    w.strip().lower()
    for w in BASE_WORDS_FILE.read_text(encoding="utf-8").splitlines()
    if w.strip()
}

print(f"Loaded {len(base_words)} base words\n")

# ---------------- GENERATE ----------------

allowed = set()
total_suggestions_added = 0

for idx, word in enumerate(sorted(base_words), start=1):
    print(f"[{idx}/{len(base_words)}] Processing: {word}")

    before = len(allowed)
    allowed.add(word)

    try:
        suggestions = suggest(h, word)
    except Exception as e:
        print(f"Suggest failed: {e}")
        continue

    for s in suggestions:
        s = s.lower()

        if not (MIN_WORD_LENGTH <= len(s) <= MAX_WORD_LENGTH):
            continue
        if not s.isalpha():
            continue

        allowed.add(s)

    added_now = len(allowed) - before
    total_suggestions_added += max(0, added_now - 1)  # exclude base word itself

    print(f"Added {added_now - 1} new suggestions")

# ---------------- SAVE ----------------

OUTPUT_FILE.write_text(
    "\n".join(sorted(allowed)),
    encoding="utf-8"
)

print("\n---------------- SUMMARY ----------------")
print(f"Base words processed: {len(base_words)}")
print(f"Total allowed words: {len(allowed)}")
print(f"Total suggestions added: {total_suggestions_added}")
print(f"Saved to: {OUTPUT_FILE}")

lib.Hunspell_destroy(h)
