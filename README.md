# UIUbuntuXkeen

**UIUbuntuXkeen** — Ubuntu-oriented веб-интерфейс для управления **Mihomo**.

Проект стартует на базе линии **UltraUIXkeen**, но развивается как отдельный продукт под Ubuntu: с нормальной моделью путей, сервисов, фоновых задач и хранения operational state.

## Текущий статус

- Текущая версия линии: **v0.6.14**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Текущий шаг: **Tasks provider SSL cache flow (no blocking batch probe)**



Релиз **v0.6.12** добивает fallback и cache-flow в Tasks: в разделе **«Задачи»**:
- direct `ssl_probe_batch` больше не запускается из UI и не подвешивает экран на длинных таймаутах;
- обновление SSL теперь идёт через штатный agent cache flow: `ssl_cache_refresh` + повторное чтение `mihomo_providers`;
- таблица Tasks читает `panelSslNotAfter` из agent provider cache и показывает результат проверки URL 3x-ui подписок.


### v0.6.14
- Tasks SSL снова использует router-side cache flow: `ssl_cache_refresh` + `mihomo_providers`, без blocking browser probe.
- URL 3x-ui подписок остаются общими через users DB и используются agent'ом как server-side source of truth для panel SSL.
- TLS-проверки устойчивее разбирают реальные subscription URL, включая query/fragment/userinfo.
