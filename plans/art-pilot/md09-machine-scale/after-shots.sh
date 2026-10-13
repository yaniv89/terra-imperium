#!/bin/sh
# plans/art-pilot/md09-machine-scale/after-shots.sh
# Every AFTER screenshot of this folder (dev server on port 5202 first, restarted after code changes):
#   CHROMIUM="C:/Program Files/Google/Chrome/Application/chrome.exe" sh plans/art-pilot/md09-machine-scale/after-shots.sh
D=plans/art-pilot/md09-machine-scale
# a warm-up load: the first battle after a cold server start can time out while Vite compiles
CASES="bronze:small:infantry" ZOOMS="z1:1" node $D/shots.mjs "$TEMP" md09-warmup > /dev/null 2>&1
node $D/shots.mjs $D after > $D/after.log 2>&1
CASES="classical:siege:siege" EXTRA="&people=bosporan_kingdom" node $D/shots.mjs $D after-bosporan >> $D/after.log 2>&1
CASES="gunpowder:siege:siege" EXTRA="&people=tondo" node $D/shots.mjs $D after-tondo >> $D/after.log 2>&1
CASES="modern:balanced:cavalry" EXTRA="&people=israel" node $D/shots.mjs $D after-merkava >> $D/after.log 2>&1
CASES="classical:cavalry:cavalry" EXTRA="&people=magadha" node $D/shots.mjs $D after-elephant >> $D/after.log 2>&1
CASES="classical:cavalry:cavalry" EXTRA="&people=qedar" node $D/shots.mjs $D after-camel >> $D/after.log 2>&1
echo AFTER_SHOTS_DONE >> $D/after.log
