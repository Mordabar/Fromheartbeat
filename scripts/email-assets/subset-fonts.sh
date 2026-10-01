#!/bin/sh
# Regenerates the latin woff2 subsets used by the emails (48 KB instead of the 1.4 MB site fonts).
#   pip install fonttools brotli && sh scripts/email-assets/subset-fonts.sh
U="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2190-2193,U+2713"
cd "$(dirname "$0")/../.."
pyftsubset assets/fonts/CormorantGaramond.ttf --unicodes="$U" --layout-features='kern,liga,lnum' --flavor=woff2 --output-file=assets/email/fonts/cormorant-garamond.woff2
pyftsubset assets/fonts/Manrope.ttf --unicodes="$U" --layout-features='kern,liga,lnum' --flavor=woff2 --output-file=assets/email/fonts/manrope.woff2
