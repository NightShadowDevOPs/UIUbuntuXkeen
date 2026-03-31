# Backend fix v0.6.46

## Что исправлено
- `Хосты 3x-ui` больше не зависят только от `providerPanelUrls` в shared users DB.
- Список строк теперь строится из объединения трёх источников:
  1. реальный список `mihomo providers` из `api.sh`;
  2. сохранённые `providerPanelUrls` из shared users DB;
  3. локальная карта `proxyProviderPanelUrlMap`, если URL панелей уже видны в `Прокси-провайдерах`.

## Зачем это нужно
Раньше страница могла быть пустой даже при наличии реальных провайдеров и уже заданных URL панелей в UI.

## Технически
- `src/api/ubuntuService.ts` — fallback `listProvidersFromUsersDb()` теперь подмешивает реальные Mihomo provider names.
- `src/views/XuiHostsPage.vue` — таблица строится через merge provider names + saved panel URLs, и повторно синхронизируется после загрузки provider health.
