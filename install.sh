#!/usr/bin/env bash
set -euo pipefail
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/io.github.IzsakiRobi.Native.Dash"
glib-compile-schemas --strict "$source_dir/schemas"
mkdir -p "$extension_dir/schemas"
for file in metadata.json extension.js Badges.js Colors.js Animations.js Panel.js prefs.js stylesheet.css; do
    install -m 644 "$source_dir/$file" "$extension_dir/$file"
done
install -m 644 "$source_dir/schemas/org.gnome.shell.extensions.native-dash.gschema.xml" "$extension_dir/schemas/"
install -m 644 "$source_dir/schemas/gschemas.compiled" "$extension_dir/schemas/"
printf 'Installed: %s\n' "$extension_dir"

for obsolete in badgeHighlight.js launcherBadges.js; do
    rm -f -- "$extension_dir/$obsolete"
done
