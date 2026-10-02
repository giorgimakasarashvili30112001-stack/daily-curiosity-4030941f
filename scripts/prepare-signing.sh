#!/usr/bin/env bash
# prepare-signing.sh
# ------------------
# CI helper: turns the KEYSTORE_* GitHub secrets into a verified keystore file
# and tells you EXACTLY what is wrong if something is off, instead of Java's
# vague "keystore was tampered with, or password was incorrect".
#
# Inputs (env): KEYSTORE_FILE (base64), KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD
# Arg 1: output path for the decoded keystore (default android/app/release.keystore)
# Writes cleaned KEYSTORE_PASSWORD / KEY_ALIAS / KEY_PASSWORD to $GITHUB_ENV when set.
# Never prints passwords.
set -uo pipefail

OUT="${1:-android/app/release.keystore}"

fail() { echo "::error title=Signing setup: $1::$2"; echo "ERROR: $1 - $2" >&2; exit 1; }

# Strip leading/trailing whitespace (pasted secrets often carry a trailing newline/space).
trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }

RAW_FILE="${KEYSTORE_FILE:-}"
SP="$(trim "${KEYSTORE_PASSWORD:-}")"
KA="$(trim "${KEY_ALIAS:-}")"
KP="$(trim "${KEY_PASSWORD:-}")"

# 1. Nothing configured -> unsigned/debug fallback is handled by Gradle.
if [ -z "$(trim "$RAW_FILE")" ] && [ -z "$SP" ] && [ -z "$KA" ] && [ -z "$KP" ]; then
  echo "No signing secrets set: release build will use the debug key (testing only)."
  exit 0
fi

# 2. All four must be present.
missing=""
[ -z "$(trim "$RAW_FILE")" ] && missing="$missing KEYSTORE_FILE"
[ -z "$SP" ] && missing="$missing KEYSTORE_PASSWORD"
[ -z "$KA" ] && missing="$missing KEY_ALIAS"
[ -z "$KP" ] && missing="$missing KEY_PASSWORD"
[ -n "$missing" ] && fail "missing secret(s)" "These secrets are empty or not created (names are case-sensitive, must be under the Secrets tab):$missing"

# 3. Decode the keystore (tolerates line breaks / CRLF / spaces from copy-paste).
mkdir -p "$(dirname "$OUT")"
if ! printf '%s' "$RAW_FILE" | tr -d '[:space:]' | base64 -d > "$OUT" 2>/dev/null || [ ! -s "$OUT" ]; then
  fail "KEYSTORE_FILE is not valid base64" "Re-create it: on Windows PowerShell run [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path .\\release.keystore).Path)) | Set-Clipboard and paste the WHOLE text."
fi
echo "Decoded keystore: $(wc -c < "$OUT") bytes."

# 4. Open it with the keystore password.
LOG="$(mktemp)"
if ! keytool -list -keystore "$OUT" -storepass "$SP" > "$LOG" 2>&1; then
  if grep -qi "password was incorrect" "$LOG"; then
    fail "keystore password rejected" "The file is a valid keystore but KEYSTORE_PASSWORD does not open it (leading/trailing spaces were already ignored). Check: (1) it is the KEYSTORE password; with PKCS12 keystores (default) the 'key password' you may have typed at the keytool prompt was ignored, so the keystore password is the one to use for BOTH KEYSTORE_PASSWORD and KEY_PASSWORD; (2) the secret has no typos; (3) the keystore you encoded is the same one you created with that password; (4) use a plain letters-and-digits password: symbols and non-English characters are often mangled on Windows. Simplest fix: create a NEW keystore with a simple password and update all four secrets."
  elif grep -qiE "integrity|EOFException|empty|invalid keystore|format|corrupt" "$LOG"; then
    fail "KEYSTORE_FILE is damaged or incomplete" "The decoded bytes are not a complete keystore (paste cut off, extra characters, or wrong file). Re-create the base64 text and paste the WHOLE value. keytool said: $(head -n1 "$LOG")"
  else
    fail "cannot open keystore" "keytool said: $(head -n1 "$LOG")"
  fi
fi
TYPE="$(sed -n 's/^Keystore type: //p' "$LOG" | head -n1)"

# 5. Alias must exist (list names; they are not secret).
ALIASES="$(grep -E ', (PrivateKeyEntry|trustedCertEntry)' "$LOG" | sed 's/,.*//' )"
if ! printf '%s\n' "$ALIASES" | grep -qixF "$KA"; then
  fail "alias not found" "KEY_ALIAS is '$KA' but this keystore contains: $(printf '%s' "$ALIASES" | tr '\n' ' '). Set KEY_ALIAS to one of these."
fi

# 6. Key password. PKCS12 stores the key under the keystore password.
if [ "$TYPE" = "PKCS12" ] && [ "$KP" != "$SP" ]; then
  echo "::notice title=KEY_PASSWORD ignored::PKCS12 keystores use the keystore password for the key; using KEYSTORE_PASSWORD for both."
  KP="$SP"
elif [ "$TYPE" != "PKCS12" ]; then
  if ! keytool -certreq -alias "$KA" -keystore "$OUT" -storepass "$SP" -keypass "$KP" -file /dev/null > "$LOG" 2>&1; then
    fail "key password rejected" "KEY_PASSWORD does not unlock the key '$KA'. keytool said: $(head -n1 "$LOG")"
  fi
fi

# 7. Export the cleaned values for the Gradle step.
if [ -n "${GITHUB_ENV:-}" ]; then
  for pair in "KEYSTORE_PASSWORD=$SP" "KEY_ALIAS=$KA" "KEY_PASSWORD=$KP"; do
    name="${pair%%=*}"; value="${pair#*=}"
    echo "::add-mask::$value"
    { echo "$name<<__EOF_SIGN__"; echo "$value"; echo "__EOF_SIGN__"; } >> "$GITHUB_ENV"
  done
fi
echo "OK: keystore type $TYPE, alias '$KA' verified. Release will be signed with YOUR key."
