29.03.2026 UI Mihomo / Ultra — сообщение для нового чата (v1.2.101)

Проект: UI Mihomo / Ultra
Репозиторий: NightShadowDevOPs/UltraUIXkeen
Локальная папка: Y:\Мой диск\Git\UltraUIXkeen
Путь на роутере/сервере: /opt/UltraUIXkeen
Стек: Vue 3 + TypeScript + router-agent (shell/cgi на роутере)

Текущие версии:
- UI: v1.2.101
- router-agent: 0.6.22

Что добавлено в v1.2.101:
- переработаны экраны `proxy-providers` и `rule-providers`
- добавлен поиск по списку для обеих секций, чтобы быстрее находить нужный provider в длинном конфиге
- для `proxy-providers` появился профиль типа (`http / file / inline`), quick-presets и более явные блоки `идентификация`, `источник / фильтрация`, `health-check`, `override`, `advanced YAML`
- для `rule-providers` появился профиль поведения (`classical / domain / ipcidr`), quick-presets и более явные блоки `идентификация / поведение`, `источник / обновление`, `advanced YAML`
- raw YAML не убирался; router-agent не менялся

Что важно дальше:
- логичный следующий шаг — сделать мастера/шаблоны создания новых сущностей и дальше расширять form-покрытие редких nested-полей, чтобы raw YAML всё реже был основным путём
