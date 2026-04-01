# UIUbuntuXkeen v0.6.65 — provider action passthrough + last-success SSL snapshot

## Что исправлено
- Ubuntu backend теперь проксирует отсутствовавшие Mihomo-маршруты для обновления provider proxy/rule и nested proxy actions.
- Provider SSL payload теперь содержит последний успешный сертификат отдельно от последней неудачной попытки.
- `Хосты 3x-ui` и карточки провайдеров в тёмной теме показывают более читаемые TLS-статусы и отдельный блок последнего успешного сертификата.
