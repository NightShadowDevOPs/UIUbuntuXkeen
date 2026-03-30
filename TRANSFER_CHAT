29.03.2026 UI Mihomo / Ultra — сообщение для нового чата

Проект: UI Mihomo / Ultra
Репозиторий: NightShadowDevOPs/UltraUIXkeen
Локальная папка проекта: Y:\Мой диск\Git\UltraUIXkeen
Путь на роутере/сервере: /opt/UltraUIXkeen
Стек: Vue 3 + TypeScript + router-agent (shell/cgi на роутере)

Текущие версии:
- UI: v1.2.106
- v1.2.106: build-fix для `MihomoConfigEditor.vue`; исправлены недостающие закрывающие теги в секции `proxy-providers`, из-за которых production build падал на `Element is missing end tag`; router-agent не менялся
- router-agent: 0.6.22

Что уже сделано по Mihomo/UI:
- страница `Mihomo` выделена в отдельный рабочий раздел
- внутри Mihomo страница разбита на вкладки/подразделы, чтобы экран не был бесконечной простынёй
- внутри `Mihomo → Конфигурация` сделаны внутренние вкладки (`Editor / Overview / Structured editors / Diagnostics / Compare / History`)
- `Router` тоже разбит на разделы `Обзор / Трафик / Сеть`
- есть safe managed-config flow: `draft / validate / apply / rollback / baseline / history`
- YAML-редактор оставлен как fallback, но основной курс — перевод частых блоков в формы

Что уже переведено в формы:
- `dns`: nameserver, fallback, fake-ip-filter, dns-hijack, nameserver-policy, fallback-filter и связанные поля
- `rules`: фильтр, шаблоны типовых правил, form-поля для `type / payload / target / params`, quick-chips
- `tun / profile / sniffer`: базовые structured-формы
- `proxies`: большой form-driven редактор по полям, type-aware поведение и сценарный мастер создания
- `proxy-groups`: form-driven редактор состава группы, type-aware профиль, chips для `proxies / use / providers`
- `proxy-providers` и `rule-providers`: более понятные карточки с поиском, profile/presets и разбиением по смысловым блокам

Что важно по текущему состоянию:
- релиз `v1.2.105` принёс сценарный мастер `proxies`, но в нём же осталась build-мина в шаблоне `MihomoConfigEditor.vue`
- релиз `v1.2.106` исправляет именно production build: закрыты недостающие теги в секции `proxy-providers`, из-за которых Vite/Vue падали на `Element is missing end tag`
- новую функциональность поверх этого фикса не добавляли: это чистый стабилизирующий патч

Что важно не потерять:
- если меняется `router-agent`, нужно синхронизировать версии в `install.sh` и в status API
- в командах для роутера добавлять `clear`
- обновление UI на роутере делается через сам интерфейс UI, а не через `git pull` на роутере
- `config.yaml` editing должен всегда сохранять fallback на эталонный/рабочий конфиг, чтобы при невалидной правке можно было откатиться

Что смотреть дальше:
- следующий логичный шаг после `v1.2.106`: продолжать развитие мастеров/structured-редакторов уже на чистой сборочной базе
- отдельно продолжать аудит структуры меню/информационной архитектуры, чтобы разделы не разрастались в перегруженные экраны
