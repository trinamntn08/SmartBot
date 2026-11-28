#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

case "${1-}" in
  '') upload=true ;;
  --build-only) upload=false ;;
  *) echo 'Usage: bash scripts/build-apk.sh [--build-only]' >&2; exit 2 ;;
esac

# Build only from a clean checkout of the currently published main branch.
live_main=$(git ls-remote --exit-code origin refs/heads/main)
commit=$(git rev-parse HEAD)
if [[ $commit != "${live_main%%$'\t'*}" || -n $(git status --porcelain) ]]; then
  echo 'Use a clean checkout of the current origin/main to build the APK.' >&2
  exit 1
fi

sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
if [[ -z $sdk || ! -x $sdk/build-tools/35.0.0/apksigner ]]; then
  echo 'Set ANDROID_HOME to an Android SDK with Build Tools 35.0.0.' >&2
  exit 1
fi

if $upload; then
  folder_id=1fsFrBfhXqu2BNwO7lFyNC0tZbvt5eqeg
  drive_remote=smartbot-drive:
  # Check access before spending time on the build.
  rclone lsf "$drive_remote" --drive-root-folder-id "$folder_id" >/dev/null
fi

bash android/gradlew -p android :app:assembleDebug :app:lintDebug
apk=android/app/build/outputs/apk/debug/app-debug.apk
"$sdk/build-tools/35.0.0/apksigner" verify "$apk"
"$sdk/build-tools/35.0.0/zipalign" -c 4 "$apk"
printf 'Built %s from %s\n' "$PWD/$apk" "$commit"

if $upload; then
  filename="SmartBot-debug-${commit:0:12}.apk"
  rclone copyto "$apk" "$drive_remote$filename" --drive-root-folder-id "$folder_id" --checksum --immutable
  printf 'Uploaded %s to https://drive.google.com/drive/folders/%s\n' "$filename" "$folder_id"
fi
