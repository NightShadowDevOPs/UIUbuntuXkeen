# Build hotfix audit — v0.6.21

Этот hotfix закрывает следующий набор build/type-check ошибок, пришедших из CI/Actions после `v0.6.20`:

- `src/views/TasksPage.vue`
  - добавлен локальный `sleep()` helper для polling-циклов;
  - исправлен `@click` для `usersDbPushNow`, чтобы Vue не пытался передать DOM event в функцию с сигнатурой `(baseRev?, overridePayload?)`;
  - исправлен `@input` на поле `sslWarnDays`, чтобы `EventTarget` не читался как объект с обязательным `value`.
- `src/i18n/zh.ts`
  - переведён на схему `...en` + локальные override-переводы, чтобы новые ключи из `en.ts` не валили типизацию при отставании китайского словаря.
- `src/composables/userLimits.ts`
  - `getUserLimit()` теперь явно возвращает `UserLimitResolved`, чтобы downstream-код не получал optional-поля вместо нормализованных значений.

Что важно:
- релиз не меняет архитектуру проекта;
- это build/type-check hotfix поверх cleanup-линии Ubuntu UI;
- серверная проверка сертификатов Провайдеров по-прежнему остаётся отдельным следующим этапом.
