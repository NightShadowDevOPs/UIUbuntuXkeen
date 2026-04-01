Prepared release: v0.6.61. The active contour stays on `ubuntu-service`; this hotfix fixes the `3x-ui Hosts` page so it actually hydrates table rows from backend `/api/providers` and retries row loading after backend/capability refresh, instead of showing an empty list while backend storage already contains provider hosts.
Актуальный релиз для переноса: **v0.6.61**

## Update v0.6.61
- frontend-only fix for `Хосты 3x-ui`;
- force backend row hydration from `/api/providers`;
- retry provider row loading when active backend or backend capabilities refresh;
- keep `ubuntu-service` as the primary backend, `direct` only as fallback/diagnostics;
- server deploy workflow stays canonical: `git fetch origin --prune && git reset --hard origin/main` then install/build/deploy.

## Current architecture
- main backend: `ubuntu-service`;
- `direct` is fallback/diagnostics only;
- server repo path: `/opt/UIUbuntu/app`;
- backend runtime path: `/opt/ultra-ui-ubuntu-backend`;
- UI deploy path: `/etc/mihomo/uiubuntu`;
- backend service: `ultra-ui-ubuntu-backend.service`.

## Canonical server update block
```bash
clear
cd /opt/UIUbuntu/app

git fetch origin --prune
git reset --hard origin/main

chmod +x backend/scripts/install.sh
./backend/scripts/install.sh

corepack enable
pnpm install --no-frozen-lockfile
NODE_OPTIONS=--max-old-space-size=4096 pnpm build

mkdir -p /etc/mihomo/uiubuntu
rsync -a --delete dist/ /etc/mihomo/uiubuntu/
systemctl restart mihomo

curl -s http://127.0.0.1:18090/api/version
echo
curl -s http://127.0.0.1:18090/api/providers
echo

systemctl status ultra-ui-ubuntu-backend --no-pager
journalctl -u ultra-ui-ubuntu-backend -n 120 --no-pager
```

## Verified diagnosis before this release
- backend `/api/providers` returned 8 hosts;
- SQLite `provider_hosts` contained 8 rows;
- browser `fetch('http://192.168.5.23:18090/api/providers')` returned those rows;
- therefore the bug was in the `Хосты 3x-ui` page binding, not in backend storage.

## Next likely step after verification
After the list renders again from backend storage, continue fixing SSL action buttons and certificate polling on top of the live `ubuntu-service` provider list.
