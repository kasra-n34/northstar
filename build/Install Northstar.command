#!/bin/bash
APP="/Applications/Northstar.app"

if [ ! -d "$APP" ]; then
  osascript -e 'display dialog "Please drag Northstar to your Applications folder first, then run this script." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

xattr -cr "$APP"
osascript -e 'display dialog "Northstar is ready! You can now open it from your Applications folder." buttons {"OK"} default button "OK"'
