#!/usr/bin/env bash
set -euo pipefail
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$source_dir/dist"
gnome-extensions pack "$source_dir" --force --out-dir="$source_dir/dist" \
    --extra-source=Badges.js --extra-source=Colors.js \
    --extra-source=Animations.js --extra-source=Panel.js --extra-source=Icons.js --extra-source=Menu.js \
    --extra-source=Autohide.js
