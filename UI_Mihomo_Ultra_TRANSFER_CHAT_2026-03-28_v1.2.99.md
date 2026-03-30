28.03.2026 UI Mihomo / Ultra — сообщение для нового чата (v1.2.99)

Проект: UI Mihomo / Ultra
Репозиторий: NightShadowDevOPs/UltraUIXkeen
Локальная папка: Y:\Мой диск\Git\UltraUIXkeen
Путь на роутере/сервере: /opt/UltraUIXkeen
Стек: Vue 3 + TypeScript + router-agent (shell/cgi на роутере)

Текущие версии:
- UI: v1.2.99
- router-agent: 0.6.22

Что добавлено в v1.2.99:
- structured editor `proxy-groups` стал заметно более form-driven
- добавлен type-aware профиль группы для `select / url-test / fallback / load-balance / relay`
- появились быстрые пресеты типа группы и короткие подсказки, какие поля обычно важны для выбранного типа
- состав группы (`proxies`, `use`, `providers`) теперь можно редактировать чипами add/remove из текущих `proxies/groups/providers`, а не только ручным переписыванием textarea
- structured editor `rules` получил быстрые чипы-подсказки для `payload`, `target` и common params вроде `no-resolve`
- raw YAML не убирался; router-agent не менялся

Что важно дальше:
- логичный следующий шаг — сделать такие же более явные form-сценарии для `rule-providers / proxy-providers`, а потом добавить шаблоны создания новых сущностей с готовыми пресетами
