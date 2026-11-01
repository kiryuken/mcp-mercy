#!/bin/sh
set -eu

mercy_package='https://github.com/kiryuken/mcp-mercy/archive/refs/heads/main.tar.gz'
mercy_prefix=${MERCY_INSTALL_PREFIX:-"$HOME/.local"}
while [ "$#" -gt 0 ]; do
  case "$1" in
    --package|--prefix)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then printf '%s\n' "Nilai untuk $1 wajib diisi." >&2; exit 1; fi
      case "$1" in --package) mercy_package=$2 ;; --prefix) mercy_prefix=$2 ;; esac
      shift 2 ;;
    --help|-h)
      printf '%s\n' 'Penggunaan: sh install.sh [--package npm-spec-atau-tarball] [--prefix direktori]' 'Default: source GitHub main; instalasi ke ~/.local tanpa sudo.'
      exit 0 ;;
    *) printf '%s\n' "Opsi tidak dikenal: $1" >&2; exit 1 ;;
  esac
done
case "$mercy_package" in -*) printf '%s\n' 'Package tidak boleh diawali tanda minus.' >&2; exit 1 ;; esac
case "$mercy_prefix" in /*) ;; *) printf '%s\n' 'Prefix harus berupa path absolut.' >&2; exit 1 ;; esac
case "$(uname -s)" in Linux|Darwin) ;; *) printf '%s\n' 'Untuk Windows native, gunakan scripts/install.ps1 atau npm install --global.' >&2; exit 1 ;; esac
command -v node >/dev/null 2>&1 || { printf '%s\n' 'Pasang Node.js 22.22+ (disarankan 24) dari https://nodejs.org/.' >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { printf '%s\n' 'npm tidak ditemukan; pasang distribusi Node.js yang menyertakan npm.' >&2; exit 1; }
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 22)) { console.error("Node.js 22.22+ diperlukan."); process.exit(1); }'
npm install --global --prefix "$mercy_prefix" "$mercy_package"
printf '%s\n' "mcp-mercy terpasang di $mercy_prefix." "Pastikan $mercy_prefix/bin ada di PATH terminal dan harness Anda." 'Lanjutkan: mercy --help, mercy config opencode|claude|codex, dan mercy login.'
