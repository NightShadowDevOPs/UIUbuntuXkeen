# UIUbuntuXkeen

**UIUbuntuXkeen** — Ubuntu-oriented веб-интерфейс для управления **Mihomo**.

Проект стартует на базе линии **UltraUIXkeen**, но развивается как отдельный продукт под Ubuntu: с нормальной моделью путей, сервисов, фоновых задач и хранения operational state.

## Текущий статус

- Текущая версия линии: **v0.6.16**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Текущий шаг: **cleanup wave 1 / page-by-page legacy teardown**



Релиз **v0.6.12** добивает fallback и cache-flow в Tasks: в разделе **«Задачи»**:
- direct `ssl_probe_batch` больше не запускается из UI и не подвешивает экран на длинных таймаутах;
- обновление SSL теперь идёт через штатный agent cache flow: `ssl_cache_refresh` + повторное чтение `mihomo_providers`;
- таблица Tasks читает `panelSslNotAfter` из agent provider cache и показывает результат проверки URL 3x-ui подписок.


### v0.6.16

- cleanup release wave 1: Home no longer auto-bootstraps router legacy; Host is now host-only; Traffic no longer shows router QoS / Netcraze cards; Tasks/Users/Policies are hidden from primary navigation for audit-only access.

### v0.6.13
- Tasks SSL снова использует прямую проверку по сохранённым URL 3x-ui подписок провайдеров.
- URL из backend/provider metadata не используются как authoritative source для этой таблицы.
