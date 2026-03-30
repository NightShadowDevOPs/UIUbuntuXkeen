29.03.2026 UI Mihomo / Ultra — сообщение для нового чата

Проект: UI Mihomo / Ultra
Репозиторий: NightShadowDevOPs/UltraUIXkeen
Локальная папка проекта: Y:\Мой диск\Git\UltraUIXkeen
Путь на роутере/сервере: /opt/UltraUIXkeen
Стек: Vue 3 + TypeScript + router-agent (shell/cgi на роутере)

Текущие версии:
- UI: v1.2.104
- v1.2.104: мастер создания `proxies` стал type-aware на шаге «Основное»: для `VLESS / VMess / Trojan / WireGuard / Hysteria2 / TUIC` показываются разные ключевые поля; router-agent не менялся
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
- `proxies`: большой form-driven редактор по полям, включая type-aware поведение для `ss / vmess / vless / trojan / wireguard / hysteria2 / tuic`
- `proxy-groups`: form-driven редактор состава группы, type-aware профиль, chips для `proxies / use / providers`
- `proxy-providers` и `rule-providers`: более понятные карточки с поиском, profile/presets и разбиением по смысловым блокам

Что добавлено в v1.2.104:
- мастер создания `proxies` углублён по типам: на шаге `Основное` для `VLESS / VMess / Trojan / WireGuard / Hysteria2 / TUIC` теперь показываются разные профильные поля, а не один общий мини-набор
- для транспортных вариантов теперь есть более уместные поля прямо в мастере: например, `ws-opts.path` для `WS`, `grpc-service-name` для `gRPC`, ключи/IP/MTU для `WireGuard`, obfs для `Hysteria2`, базовые transport/auth-поля для `TUIC`
- на шаге `Проверка` мастер теперь показывает не только адрес, но и тип, transport и auth/keys, чтобы перед открытием полной формы было проще глазами проверить заготовку

Что важно не потерять:
- если меняется `router-agent`, нужно синхронизировать версии в `install.sh` и в status API
- в командах для роутера добавлять `clear`
- обновление UI на роутере делается через сам интерфейс UI, а не через `git pull` на роутере
- `config.yaml` editing должен всегда сохранять fallback на эталонный/рабочий конфиг, чтобы при невалидной правке можно было откатиться

Что смотреть дальше:
- следующий логичный шаг после v1.2.104: либо доводить type-aware мастера до ещё более точных сценариев (например, отдельно под `Reality / WS / gRPC`), либо добивать редкие nested-поля, чтобы raw YAML ещё реже был обязательным путём
- отдельно продолжать аудит структуры меню/информационной архитектуры, чтобы разделы не разрастались в перегруженные экраны
