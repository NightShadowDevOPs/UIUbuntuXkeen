Prepared release: v0.6.37. Build UI remains fixed, the 3x-ui panel hosts are moved into a dedicated menu section, and the Users tab is visible again.

Проект: UIUbuntuXkeen
Актуальный релиз для переноса: **v0.6.37**

Что сделано в `v0.6.37`
- отдельный раздел меню **3x-ui Hosts** только для адресов панелей 3x-ui;
- список на странице строится только из `providerPanelUrls` в общей БД;
- видны статус сертификата, дата окончания и время последней проверки;
- вкладка **Пользователи** снова видна в левом меню;
- backend-опрос сертификатов: router-agent `api.sh` / `router-agent/install.sh`, автообновление каждые 4 часа + ручной запуск.
