#!/usr/bin/env bash
# Installs headless Blender on a cloud session (download.blender.org is blocked; the Ubuntu mirror works).
# The package list must be refreshed first: a stale list 404s on two dependencies.
set -euo pipefail
command -v blender >/dev/null && { blender -b --version | head -1; exit 0; }
apt-get update -qq
apt-get install -y -qq --no-install-recommends blender python3-numpy  # numpy: the glTF exporter
blender -b --python-expr "import bpy; print('bpy', bpy.app.version_string)" | grep bpy
