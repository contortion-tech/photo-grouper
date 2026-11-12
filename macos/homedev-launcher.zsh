#!/bin/zsh
set -eu
project='/Users/joakimthomter/Desktop/10_SYSTEMS/20_PROJECTS/tools/photo-grouper'
project="${project:A}"
service="gui/$(/usr/bin/id -u)/local.homedev.photo-grouper.server"
resources="$(/usr/bin/dirname "$0")/../Resources"
url='http://127.0.0.1:53492/'
fail() {
  /usr/bin/osascript -e 'display alert "Photo Grouper could not start" message "Check the project folder and /Users/joakimthomter/Library/Logs/Photo Grouper/server.log. Port 53492 may be used by another app." as critical' >/dev/null 2>&1 || true
  exit 1
}
[[ -d "$project/node_modules/next" && -x /usr/local/bin/node ]] || fail
pids=$(/usr/sbin/lsof -nP -iTCP:53492 -sTCP:LISTEN -t 2>/dev/null || true)
if [[ -n "$pids" ]]; then
  for pid in ${(f)pids}; do
    cwd=$(/usr/sbin/lsof -a -p "$pid" -d cwd -Fn 2>/dev/null || true)
    print -r -- "$cwd" | /usr/bin/grep -Fxq "n$project" || fail
  done
else
  if ! /bin/launchctl print "$service" >/dev/null 2>&1; then
    /bin/launchctl bootstrap "gui/$(/usr/bin/id -u)" "$resources/server.plist" || fail
  fi
  /bin/launchctl kickstart "$service" || fail
fi
for attempt in {1..60}; do
  if /usr/bin/curl --silent --fail --max-time 2 "$url" >/dev/null; then
    /usr/bin/open "$url"
    exit 0
  fi
  /bin/sleep 1
done
fail
