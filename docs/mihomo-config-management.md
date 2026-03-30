## Update v1.2.105

- the `proxies` creation wizard now works with more concrete connection scenarios instead of only broad families: added `VLESS WS + TLS`, `Trojan gRPC`, and `WireGuard peer` alongside the existing starts
- the `Basics` step now shows the active scenario summary/badges and blocks the move to `Review` until the fields that really matter for that scenario are filled
- completed the missing wizard/template i18n keys so the guided creation workspace reads like a real UI instead of exposing raw translation identifiers

## Update v1.2.104

- upgraded the `proxies` guided creation wizard so the `Basics` step is now type-aware: `VLESS / VMess / Trojan / WireGuard / Hysteria2 / TUIC` expose different focused fields instead of the same generic mini-form
- added smarter review cards for type, transport, and auth details before the prepared draft is opened in the full structured editor

# Mihomo config management

## Update v1.2.103

- added guided creation wizards for `proxies`, `proxy-providers`, `proxy-groups`, and `rule-providers`
- each wizard now goes through `template -> basics -> review` and then loads the prepared draft into the full structured form instead of dropping the user straight into a blank or fully expanded editor
- kept the existing quick template cards, so experienced users still have one-click presets while calmer step-by-step creation is available for new entities

## Update v1.2.102

- added quick-start template cards for `proxies`, `proxy-providers`, `proxy-groups`, and `rule-providers`, so new config entities now start from sensible form presets instead of empty forms
- restored the missing `proxy-groups` structured editor panel that accidentally disappeared in `v1.2.101`; the logic already existed, and the UI is now visible again

## Update v1.2.101
- reworked the `proxy-providers` editor into a clearer form workspace: list search, type profile (`http / file / inline`), quick presets, and separate blocks for identity, source/filtering, health-check, override, and extra YAML
- reworked the `rule-providers` editor in the same style: list search, behavior profile (`classical / domain / ipcidr`), quick presets, and clearer blocks for identity/behavior, source/refresh, and advanced YAML
- raw YAML still remains as the fallback lane, but these two provider sections now read much more like structured entities and much less like one long flat slab of inputs

## Update v1.2.100
- fixed the broken `splitFormList` / `joinFormList` fragment inside `MihomoConfigEditor.vue` where a regex and newline join literal had been split across real line breaks, breaking production builds with `Unterminated regular expression`
- this is a build-fix release on top of `v1.2.99`: the newer form-driven `proxy-groups` and quick `rules` chips stay in place, but the workspace now ships in a state that actually compiles

## Update v1.2.99
- the structured `proxy-groups` editor is now more form-driven: it adds a type-aware profile card for `select / url-test / fallback / load-balance / relay`, quick presets, and short per-type guidance for the fields that usually matter most
- group composition is no longer just three raw textareas: `proxies`, `use`, and `providers` now get chip-assisted add/remove flows based on the current config, so existing members can be toggled without retyping the whole list
- the structured `rules` editor now also offers quick chips for suggested payloads, targets, and common params such as `no-resolve`, so common routing edits stay inside the form instead of bouncing back to raw YAML

## Update v1.2.98
- the structured `proxies` editor is now type-aware for `ss / vmess / vless / trojan / wireguard / hysteria2 / tuic`
- a new proxy-type profile card adds quick presets, short guidance, and dynamic visibility for the most relevant blocks instead of showing every protocol branch at once
- raw YAML still stays available as the fallback path, but the main proxy form is now much easier to read for common proxy families

# Управление конфигурацией Mihomo (безопасный фундамент)

В релизе v1.2.75 добавлен первый безопасный этап управления `config.yaml` через `router-agent`.

## Что есть

- **active** — текущий рабочий `config.yaml`
- **draft** — отдельный черновик на роутере
- **baseline** — эталонная конфигурация для аварийного восстановления
- **history** — ревизии предыдущих активных конфигураций

## Конвейер применения

1. Пользователь редактирует `draft` в UI
2. Черновик сохраняется на роутер
3. Агент локально проверяет кандидат через бинарник Mihomo / clash-meta
4. Агент делает снимок текущей активной конфигурации
5. Кандидат записывается в `config.yaml`
6. Mihomo перезапускается
7. Если запуск неудачен — выполняется откат на предыдущую активную конфигурацию
8. Если откат не помог — выполняется возврат к эталонной версии

## Что нельзя делать обычным сохранением

Обычное сохранение меняет только **draft**.

**Эталонная конфигурация не должна перезаписываться** обычным редактированием.
Для неё есть отдельное действие: **сделать активную конфигурацию эталонной**.

## Команды router-agent

- `mihomo_cfg_state`
- `mihomo_cfg_get&kind=active|draft|baseline`
- `mihomo_cfg_put&kind=draft`
- `mihomo_cfg_copy&from=active|baseline&to=draft`
- `mihomo_cfg_validate&kind=draft|active|baseline`
- `mihomo_cfg_apply`
- `mihomo_cfg_set_baseline_from_active`
- `mihomo_cfg_restore_baseline`
- `mihomo_cfg_history`
- `mihomo_cfg_get_rev&rev=N`
- `mihomo_cfg_restore_rev&rev=N`

## Что добавлено в v1.2.80

- встроенный line-diff между `active / draft / baseline / editor` прямо в `Mihomo → Конфигурация`
- выбор левой и правой стороны сравнения
- быстрый обмен сторон местами
- фильтр «только изменения», чтобы не тонуть в длинном YAML

## Что добавлено в v1.2.81

- отдельный диагностический блок последней операции `validate / apply / rollback / restore`
- в UI теперь видны этап, источник, команда проверки, код выхода, способ перезапуска и результат восстановления
- `router-agent 0.6.21` отдаёт расширенные диагностические поля для `mihomo_cfg_validate`, `mihomo_cfg_apply`, `mihomo_cfg_restore_baseline`, `mihomo_cfg_restore_rev`
- логика применения не менялась: добавлена только более подробная телеметрия результата

## Что добавлено в v1.2.82

- новый блок **структурированного обзора** поверх `active / draft / baseline / editor`
- краткий срез по типовым секциям без ручного чтения всего YAML: `mode`, `log-level`, `allow-lan`, `ipv6`, `unified-delay`, `find-process-mode`, порты, `external-controller`, `secret`, `geodata-mode`
- отдельные статусы по модулям `tun / dns / profile / sniffer` и список top-level секций
- быстрые счётчики по `proxies`, `proxy-groups`, `rules`, `proxy-providers`, `rule-providers`
- обзор работает целиком на стороне UI и не требует новых router-agent API

## Что логично делать дальше

- отдельный просмотр последней успешно применённой версии
- потом — более умный редактор частых блоков `config.yaml`
- после этого уже можно решать, какие секции стоит переводить в формовый редактор


## Что добавлено в v1.2.83

- отдельный блок **последней успешно применённой версии** в `Mihomo → Конфигурация`
- `router-agent 0.6.22` хранит метаданные последней версии, которая действительно пережила проверку и запуск Mihomo
- UI умеет показать, является ли эта версия текущим `active` или снимком из `history`, и быстро загрузить её в редактор
- эта же точка доступна в line-diff как отдельный источник сравнения: **«Последний успешный»**
- для старых meta-файлов сделана мягкая миграция: при первом чтении текущий `active` становится исходной успешно применённой версией, если поле ещё отсутствовало


## Что добавлено в v1.2.84

- новый блок **быстрого редактора частых параметров** прямо в `Mihomo → Конфигурация`
- он работает поверх текущего YAML в редакторе и не подменяет raw-режим: сначала загружается `active / draft / baseline / last successful`, затем пользователь правит частые поля формой
- форма умеет читать и применять популярные top-level ключи: `mode`, `log-level`, `allow-lan`, `ipv6`, `unified-delay`, `find-process-mode`, `geodata-mode`, `external-controller`, `secret`, `mixed-port`, `port`, `socks-port`, `redir-port`, `tproxy-port`
- пустое значение в форме удаляет соответствующую top-level строку из редактора; остальная часть YAML не пересобирается и остаётся как была
- `router-agent` в этом релизе не менялся: остаётся линия `0.6.22`, а safe pipeline `draft / validate / apply / rollback / baseline fallback` остаётся прежним


## Что добавлено в v1.2.85

- быстрый редактор частых параметров получил отдельный блок **preview изменений** перед записью в raw YAML
- UI показывает, какие top-level ключи будут `добавлены / изменены / удалены`, и отдельно выводит группы влияния: `runtime`, `network`, `controller`, `ports`
- preview работает только поверх текущего содержимого редактора и не меняет safe pipeline `draft / validate / apply / rollback / baseline fallback`
- `router-agent` в этом релизе не менялся: остаётся линия `0.6.22`


## Что добавлено в v1.2.86

- быстрый редактор частых параметров расширен на nested-секции `tun` и `dns`, но только на безопасный набор scalar-полей
- UI теперь умеет читать, preview-ить и записывать: `tun.enable`, `tun.stack`, `tun.auto-route`, `tun.auto-detect-interface`, `dns.enable`, `dns.ipv6`, `dns.listen`, `dns.enhanced-mode`
- если секция `tun` или `dns` ещё отсутствует, форма может создать минимальный блок только из выбранных scalar-ключей; если поля очищены, соответствующие строки удаляются без пересборки остального YAML
- списки `nameserver`, `fallback`, `dns-hijack` и прочие сложные вложенные структуры этим релизом не трогаются
- `router-agent` в этом релизе не менялся: остаётся линия `0.6.22`, safe pipeline `draft / validate / apply / rollback / baseline fallback` остаётся прежним

## Что добавлено в v1.2.87

- в `Mihomo → Конфигурация` появился отдельный **редактор proxy-providers** поверх текущего YAML-редактора
- UI умеет показывать список провайдеров из секции `proxy-providers`, открывать каждого по отдельности, дублировать, добавлять нового из шаблона и сохранять изменения обратно в editor flow
- для частых полей провайдера поддержаны форма и сохранение: `name`, `type`, `url`, `path`, `interval`, `filter`, `exclude-filter`; для более сложных вещей вроде `health-check`, `override`, `exclude-type` оставлен отдельный блок **дополнительного YAML**
- для каждого провайдера UI показывает, в каких `proxy-groups` он используется через `use/providers`
- отключение провайдера — это контролируемое действие в редакторе: блок провайдера удаляется, ссылки в `proxy-groups` очищаются, а если группа после этого остаётся без `use/providers` и без собственного `proxies`, UI подставляет `DIRECT` как безопасную заглушку
- `router-agent` в этом релизе не менялся: остаётся линия `0.6.22`, safe pipeline `draft / validate / apply / rollback / baseline fallback` остаётся прежним

## Что добавлено в v1.2.88

- отдельный редактор `proxy-groups` поверх текущего YAML в редакторе
- можно редактировать группу по одной, дублировать, добавлять новую из шаблона и сохранять изменения обратно в editor flow
- переименование группы обновляет ссылки на неё в других `proxy-groups` и целевые группы в `rules`
- отключение группы удаляет её блок, очищает входящие ссылки, подставляет `DIRECT` в опустевшие группы и переводит затронутые `rules` на `DIRECT`
- для выбранной группы UI показывает, где она используется, и заранее отображает план отключения



## Что исправлено в v1.2.89

- исправлены placeholder-строки переводов блока `proxy-groups`, в которых реальные переносы строк были записаны внутри обычных строковых литералов
- теперь примеры многострочных значений (`proxies`, `use/providers`, `extra YAML`) хранятся как экранированные `\n`, поэтому `vite build` больше не должен падать с `Unterminated string literal`

## Update v1.2.90

- Added dedicated editors for `rule-providers` and `rules` inside `Mihomo → Конфигурация`.
- `rule-providers` can now be edited, duplicated, created from a template, renamed with `RULE-SET` references rewritten, and disabled with dependent `RULE-SET` rules removed from `rules`.
- `rules` now has a line-based editor that preserves raw rule rows while still allowing per-rule add / edit / duplicate / remove flows.

## Update v1.2.91

- страница `Mihomo` приведена к реальным вкладкам рабочего пространства: `Обзор / Runtime / Providers / Rules / Config`, чтобы секции не превращались в одну длинную страницу со скроллом
- редактор `proxy-providers` теперь умеет structured-редактирование nested-блоков `health-check` и `override`, сохраняя отдельные textarea для редких YAML-полей
- редактор `proxy-groups` получил поле `include-all`
- редактор `rules` получил structured-форму поверх raw-строки: можно отдельно править `type`, `payload`, `target` и дополнительные параметры, а затем собирать raw обратно без ручной правки всей строки
- `router-agent` в этом релизе не менялся: остаётся линия `0.6.22`


## Update v1.2.92

- Добавлен structured DNS editor внутри `Mihomo → Конфигурация` для частых списков и nested-веток секции `dns`.
- Из UI теперь можно редактировать `default-nameserver`, `nameserver`, `fallback`, `proxy-server-nameserver`, `fake-ip-filter`, `dns-hijack`, `nameserver-policy` и `fallback-filter` без ручной правки raw YAML.
- Для `nameserver-policy` поддержан более удобный формат строк `key = value` / `key = value1, value2`, а для `fallback-filter` вынесены частые поля `geoip`, `geoip-code`, `geosite`, `ipcidr`, `domain`.
- Safe managed-config flow не менялся: новый блок работает поверх текущего редактора/draft и не затрагивает pipeline validate/apply/rollback.

## Update v1.2.93

- `Mihomo → Конфигурация` разбит на внутренние вкладки: редактор YAML, overview, structured editors, diagnostics, diff и history.
- Это разгружает экран: теперь structured-блоки (`quick editor`, `proxy-providers`, `proxy-groups`, `rule-providers`, `rules`, `dns`) больше не висят под raw-редактором одной длинной простынёй.
- Страница `Роутер` тоже получила собственные вкладки `Обзор / Трафик / Сеть`, чтобы состояние роутера, traffic-карточки и network details были разнесены по отдельным рабочим зонам.



## Update v1.2.95

- в `Structured editors` добавлен отдельный блок `Tun / profile / sniffer`
- `tun` получил structured-форму для common nested-полей: `enable`, `stack`, `device`, `mtu`, `strict-route`, `auto-route`, `auto-detect-interface`, а также списков `dns-hijack`, `route-include-address`, `route-exclude-address`, `include-interface`, `exclude-interface`
- `profile` вынесен в отдельную компактную форму с `store-selected` и `store-fake-ip`
- `sniffer` получил базовые form-поля для `enable`, `parse-pure-ip`, `override-destination`, списка protocol keys в `sniff`, а также списков `force-domain` / `skip-domain`
- новый блок продолжает ту же идею, что и editors для providers/rules/dns: structured-форма работает поверх текущего черновика, а raw YAML остаётся как fallback
- `router-agent` в релизе не менялся: остаётся линия `0.6.22`

## Update v1.2.94

- блок `Structured editors` внутри `Mihomo → Конфигурация` получил собственные внутренние вкладки: `Quick`, `Proxy providers`, `Proxy groups`, `Rule providers`, `Rules`, `DNS`
- это дополнительно разгрузило экран: теперь формовые редакторы не висят одной длинной колонкой, а открываются как отдельные рабочие подэкраны внутри structured workspace
- `rules` получил фильтр/поиск по типу, target, provider, тексту и номеру строки
- добавлены быстрые чипы по типам правил, шаблоны для частых паттернов (`MATCH`, `RULE-SET`, `GEOIP`, `GEOSITE`, `DOMAIN-SUFFIX`) и datalist-подсказки по payload/target из текущего конфига
- редактор `rules` теперь показывает мягкие подсказки для типовых проблем: отсутствующий payload, отсутствующий target, неизвестный `rule-provider`, кастомный target вне текущих groups/providers
- после сохранения новой rule UI оставляет её выбранной в форме, чтобы можно было сразу продолжить правку, а не искать только что созданную запись в списке
- `router-agent` в этом релизе не менялся: остаётся линия `0.6.22`


## Update v1.2.96

- в `Structured editors` добавлен отдельный редактор `proxies`
- теперь common-поля прокси вынесены в форму: имя, тип, сервер, порт, `udp`, `tfo`, `network`, `dialer-proxy`, `interface-name`, `packet-encoding`
- отдельно вынесены блоки `TLS / Security / Reality`, `Auth / Identity`, а также transport helpers для `ws-opts`, `grpc-opts` и `plugin-opts`
- при rename прокси UI обновляет ссылки на него внутри `proxy-groups` и прямые target в `rules`
- при disable прокси UI показывает план последствий, чистит зависимости и переводит затронутые direct-target rules на `DIRECT`
- raw YAML остаётся fallback-режимом для более редких веток вроде `smux`, `http-opts`, `wireguard`, `hysteria2`, `tuic`
- `router-agent` в этом релизе не менялся: остаётся линия `0.6.22`

## Build stability note (v1.2.106)

- Fixed missing closing tags in the `proxy-providers` panel inside `MihomoConfigEditor.vue`.
- This patch does not change the managed-config flow; it only restores a valid Vue template so production build succeeds again.

