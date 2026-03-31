Current prepared release: v0.6.35. The real CI blocker is now fixed: stale transpiled src/*.js shadowed TypeScript / TSX sources, and Vite tried to parse JSX from plain .js files. Diagnostics from v0.6.34 remain useful, but this release removes the underlying cause.

# Текущий статус — v0.6.35

- Текущая линия: **v0.6.35**
- Подтверждённо рабочий пользователем релиз: **v0.2.10**
- Подготовленный релиз: **v0.6.35**

## Что исправлено
- Из `src/` удалены заехавшие transpiled-артефакты `*.js` и `*.d.ts`, которые перекрывали исходники `.ts` / `.tsx`.
- Vite-resolve теперь принудительно предпочитает `.ts` / `.tsx` раньше `.js`.
- Диагностика CI из `v0.6.34` сохранена: если всплывёт новый blocker, лог уже не потеряется.

## Следующая проверка
- Прогнать GitHub Actions на `v0.6.35`.
- Убедиться, что шаг `Build UI` проходит без ошибки `ConnectionCard.js (26:56): Expression expected`.
- После зелёной сборки вернуться к плану аудита безопасности и функциональным задачам по провайдерам / трафику / состоянию хоста.
