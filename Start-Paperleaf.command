#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' '请先安装 Node.js 22.13 或更新版本：https://nodejs.org/'
  exit 1
fi
node scripts/portable-start.mjs
