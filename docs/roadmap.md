# Roadmap

Текущая версия линии: **v0.6.25**

## Ближайший фокус

### v0.6.25 — workflow early-failure diagnostics hotfix

- Добавить GitHub Actions workflow в репозиторий.
- Раскрывать полный лог `vite build --debug` при падении шага `Build UI`.
- Не добавлять upload artifacts на этом шаге.

## Следом после этого

- Получить фактическую build-ошибку из CI.
- Закрыть следующий code hotfix уже по конкретному падению.
- Продолжить cleanup `TasksPage.vue` и разделение Ubuntu-линии от роутерного наследия.
- Вернуться к server-side схеме проверки SSL сертификатов Провайдеров как к отдельному этапу.
