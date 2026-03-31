# Backend route hotfix v0.6.51

## Что исправлено
- исправлена сборка абсолютного URL для capability-probe, когда у backend выбран `secondaryPath=/api`;
- backend `ubuntu-service` больше не проверяется по битому адресу `/capabilities` вместо `/api/capabilities`;
- ручное удаление `/api` из настроек больше не требуется для обхода бага.

## Что важно
- для текущего ubuntu backend путь `/api` остаётся корректным и рекомендуемым;
- helper для axios/baseURL не трогали, чтобы не сломать уже рабочие вызовы через baseURL `.../api`.
