IOS=ab459878-365f-474d-9038-ac00c574f77a
AND=0d24e7c8-6aca-45fb-9ca4-7e554124dce8
parse() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).status||'?')}catch(e){console.log('PENDING')}})"; }
term() { case "$1" in FINISHED|ERRORED|CANCELED) return 0;; *) return 1;; esac; }
for i in $(seq 1 72); do
  si=$(npx eas-cli@latest build:view "$IOS" --json --non-interactive 2>/dev/null | parse)
  sa=$(npx eas-cli@latest build:view "$AND" --json --non-interactive 2>/dev/null | parse)
  echo "[poll $i $(date +%H:%M)] iOS=$si  Android=$sa"
  if term "$si" && term "$sa"; then echo "BUILDS_DONE iOS=$si Android=$sa"; exit 0; fi
  sleep 300
done
echo "WATCH_TIMEOUT"
