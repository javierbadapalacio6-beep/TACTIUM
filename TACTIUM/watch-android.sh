AND=ca1cde72-7e14-4574-96e6-6d0b403949fe
parse() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).status||'?')}catch(e){console.log('PENDING')}})"; }
for i in $(seq 1 72); do
  sa=$(npx eas-cli@latest build:list --platform android --limit 1 --non-interactive --json 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const a=JSON.parse(d);const b=a.find(x=>x.id&&x.id.startsWith('ca1cde72'))||a[0];console.log(b?b.status:'?')}catch(e){console.log('PENDING')}})")
  echo "[poll $i $(date +%H:%M)] Android=$sa"
  case "$sa" in FINISHED|ERRORED|CANCELED) echo "ANDROID_DONE=$sa"; exit 0;; esac
  sleep 300
done
echo "WATCH_TIMEOUT"
