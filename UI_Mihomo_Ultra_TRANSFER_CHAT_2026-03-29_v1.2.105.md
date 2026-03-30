29.03.2026 UI Mihomo / Ultra — сообщение для нового чата

Проект: UI Mihomo / Ultra
Репозиторий: NightShadowDevOPs/UltraUIXkeen
Локальная папка проекта: Y:\Мой диск\Git\UltraUIXkeen
Путь на роутере/сервере: /opt/UltraUIXkeen
Стек: Vue 3 + TypeScript + router-agent (shell/cgi на роутере)

Текущие версии:
- UI: v1.2.105
- v1.2.105: мастер создания `proxies` стал сценарным (`Reality / WS / gRPC / WireGuard peer`) и начал проверять ключевые поля до шага «Проверка»; router-agent не менялся
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
- `proxies`: большой form-driven редактор по полям, type-aware поведение и теперь ещё сценарный мастер создания
- `proxy-groups`: form-driven редактор состава группы, type-aware профиль, chips для `proxies / use / providers`
- `proxy-providers` и `rule-providers`: более понятные карточки с поиском, profile/presets и разбиением по смысловым блокам

Что добавлено в v1.2.105:
- мастер `proxies` теперь умеет не только broad-тип, но и более конкретные сценарии подключения: `VLESS Reality`, `VLESS WS + TLS`, `VMess WS + TLS`, `Trojan gRPC`, `Trojan TLS`, `WireGuard peer`, `Hysteria2`, `TUIC`
- на шаге `Основное` показывается summary по выбранному сценарию и набор бейджей, чтобы сразу было видно профиль подключения
- переход к шагу `Проверка` теперь блокируется, если не заполнены обязательные поля для выбранного сценария (например `Reality public-key`, `WS path`, `gRPC service name`, `WireGuard keys/IP`)
- закрыт хвост с недостающими i18n-ключами для мастер/шаблонов: интерфейс мастеров теперь не должен показывать сырые translation keys

Что важно не потерять:
- если меняется `router-agent`, нужно синхронизировать версии в `install.sh` и в status API
- в командах для роутера добавлять `clear`
- обновление UI на роутере делается через сам интерфейс UI, а не через `git pull` на роутере
- `config.yaml` editing должен всегда сохранять fallback на эталонный/рабочий конфиг, чтобы при невалидной правке можно было откатиться

Что смотреть дальше:
- следующий логичный шаг после v1.2.105: либо делать ещё более умные мастера по сценариям для `proxy-groups`/`providers`, либо продолжать вытаскивать редкие nested-поля `proxies` из extra YAML в нормальные form-блоки
- отдельно продолжать аудит структуры меню/информационной архитектуры, чтобы разделы не разрастались в перегруженные экраны
