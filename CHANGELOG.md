## v0.6.42
- removed the legacy `router-agent/` directory from the distribution;
- removed root-level helper leftovers `_api*.sh`, `_backup_new.sh`, `extracted_api*.sh` from the release package;
- documented the confirmed recovery path: stop `mihomo`, remove the UI directory, start `mihomo` again, let it redownload the UI from the repository;
- kept the runtime/server contour unchanged: no new standalone service and no new backend layer in this release.

## v0.6.41
- removed the phantom standalone `ubuntu-service/` introduced in v0.6.39;
- removed separate-service deployment instructions from the current release path;
- decoupled **3x-ui Hosts** and **Users** pages from a hard requirement on `ubuntu-service` mode;
- updated docs to treat the existing project backend as the only valid direction for SSL checks and users DB.

## v0.6.39
- introduced a standalone `ubuntu-service/` backend MVP (later reverted by v0.6.41).
