Axon by AppLovin Prize Track Challenge

🎯 Goal:
Build a fully playable, self-contained mobile browser game with a total bundle size under 15 KB.

How this relates to Axon by Applovin: We serve interactive experiences that need to work across all devices, with any network quality.



📊 Parameters:
In order to be eligible to win:
Must be runnable via our provided script, which supports zstd/brotli/gzip
Compression artifact must be <15KB (15360 bytes)
No runtime network requests allowed
Two preliminary clarifications:
Judging at hackathons is very rushed, we likely will only have 2-3 minutes for your game. 
To get points for "completeness" you need to make sure that within that time we can figure out the game on our own (no verbal instructions from you), and start playing.
To make judging easier we want you submit: 
A link to your game (not going to check size limits here), just to make judging easier. The final artifact will be used to validate that you did not cheat however (works with no wifi, under 15KB, must be the same game as the one on the link)
*Please see the script at the end of the doc.*



📝 Judging Criteria:
*Judged on a hackathon team’s device; checked on modern Android and iPhone*
Best overall (each weighted equally):
Fun
Creativity
Completeness (playable without instructions or external dependencies)
“Playable without instructions” meaning no verbal instructions from you, we should be able to figure out how to play your game on our own


🏆 Prize Levels:
*A team can win one main prize AND up to one bonus prize, OR a team can win up to one of the bonus prizes only*

Main Prizes:
1st place: $4,000
2nd place: $3,000
3rd place: $2,000
Bonus Prizes:
Best Online Upgrade – $1,000
Most value added when wifi is turned on (game works without wifi, but when wifi comes on you get a nice lift)
Best Audio Design - $1,000
Most Binge Worthy (bonus points for ruining someone’s sleep schedule) - $500
The “this feels like you cheated” Award - $500
The “how did you even think of this?” Award - $500
Best use of scotty dog (CMU Mascot) - $500


🧑🏻‍💻 Script:
#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="$1"
OUT_DIR="extracted"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

ls -lh "$ARCHIVE"

case "$ARCHIVE" in
  *.tar.gz)
    tar -xzf "$ARCHIVE" -C "$OUT_DIR"
    ;;
  *.tar.br)
    brotli -d "$ARCHIVE" -o "${ARCHIVE%.br}"
    tar -xf "${ARCHIVE%.br}" -C "$OUT_DIR"
    rm "${ARCHIVE%.br}"
    ;;
  *.tar.zst)
    zstd -d "$ARCHIVE" -o "${ARCHIVE%.zst}"
    tar -xf "${ARCHIVE%.zst}" -C "$OUT_DIR"
    rm "${ARCHIVE%.zst}"
    ;;
  *)
    echo "Unsupported archive format"
    exit 1
    ;;
esac

echo "Extraction successful"

echo "Starting HTTP server on port 8000..."
cd "$OUT_DIR"
python3 -m http.server 8000


