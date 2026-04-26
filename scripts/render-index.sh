#!/bin/sh
# Embeds import map JSON in index.html (?v=mtime per root *.js). Inline only — no separate file.
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -q '<script type="importmap">' index.html 2>/dev/null; then
  echo "index.html must contain <script type=\"importmap\">." >&2
  exit 1
fi

mtime() {
  if stat -c %Y "$1" >/dev/null 2>&1; then
    stat -c %Y "$1"
  else
    stat -f %m "$1"
  fi
}

MAP="$(mktemp)"
{
  printf '%s\n' '{'
  printf '%s\n' '  "imports": {'
  first=1
  for f in *.js; do
    [ -f "$f" ] || continue
    case "$f" in
      eslint.config.js|zzfx.js) continue ;;
    esac
    mt="$(mtime "$f")"
    if [ "$first" = 1 ]; then
      first=0
    else
      printf ',\n'
    fi
    printf '    "./%s": "./%s?v=%s"' "$f" "$f" "$mt"
  done
  printf '\n%s\n' '  }'
  printf '%s\n' '}'
} >"$MAP"

INDENTED="$(mktemp)"
sed 's/^/      /' "$MAP" >"$INDENTED"
rm -f "$MAP"

OUT="$(mktemp)"
awk -v mapfile="$INDENTED" '
  BEGIN {
    while ((getline line < mapfile) > 0) {
      block = block line "\n"
    }
    close(mapfile)
  }
  /<script type="importmap">/ {
    print
    printf "%s", block
    skip = 1
    next
  }
  skip {
    if (/<\/script>/) {
      print
      skip = 0
    }
    next
  }
  { print }
' index.html >"$OUT"
rm -f "$INDENTED"
mv "$OUT" index.html
echo "Updated import map in index.html"
