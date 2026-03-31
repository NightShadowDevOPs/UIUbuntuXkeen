# Следующий шаг после v0.6.40

1. Встроить 3x-ui host SSL checks в текущий backend проекта.
2. Сохранять `providerPanelUrls`, дату окончания сертификата, время последней проверки и историю в текущей БД backend-а.
3. Встроить users inventory (`IP / MAC / hostname / proxyAccess`) в ту же БД.
4. После появления endpoint'ов подключить UI к реальному backend-слою без отдельного service.
