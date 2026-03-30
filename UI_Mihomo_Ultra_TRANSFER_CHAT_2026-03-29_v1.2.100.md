29.03.2026 UI Mihomo / Ultra — сообщение для нового чата (v1.2.100)

Проект: UI Mihomo / Ultra
Репозиторий: NightShadowDevOPs/UltraUIXkeen
Локальная папка: Y:\Мой диск\Git\UltraUIXkeen
Путь на роутере/сервере: /opt/UltraUIXkeen
Стек: Vue 3 + TypeScript + router-agent (shell/cgi на роутере)

Текущие версии:
- UI: v1.2.100
- router-agent: 0.6.22

Что добавлено в v1.2.100:
- это patch-build-fix поверх `v1.2.99`
- исправлен сломанный фрагмент `splitFormList / joinFormList` в `src/components/settings/MihomoConfigEditor.vue`
- production build больше не должен падать на `Unterminated regular expression` в этом месте
- функциональность `v1.2.99` сохранена: form-driven `proxy-groups`, type-aware профиль группы и быстрые chips для `rules` никуда не делись
- raw YAML не убирался; router-agent не менялся

Что важно дальше:
- логичный следующий шаг — вернуться к ещё более явным form-сценариям для `rule-providers / proxy-providers`, а потом добавить шаблоны создания новых сущностей с готовыми пресетами
