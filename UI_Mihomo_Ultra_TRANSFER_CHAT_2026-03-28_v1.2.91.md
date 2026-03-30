28.03.2026 UI Mihomo / Ultra — сообщение для нового чата (вставь целиком)

Проект: UI Mihomo / Ultra
Репозиторий: NightShadowDevOPs/UltraUIXkeen
Локальная папка: Y:\Мой диск\Git\UltraUIXkeen
Путь на роутере/сервере: /opt/UltraUIXkeen
Стек: Vue 3 + TypeScript + router-agent (shell/cgi на роутере)

Текущие версии:
- UI: v1.2.91
- v1.2.91: страница `Mihomo` разложена на вкладки `Обзор / Runtime / Providers / Rules / Config`; в `Mihomo → Конфигурация` редактор `proxy-providers` получил nested-поля `health-check/override`, `proxy-groups` — поле `include-all`, а `rules` — structured-форму поверх raw-режима
- router-agent: 0.6.22

Правила по проекту:
- всегда отдавать архив релиза
- commit message давать отдельно
- команды для роутера давать отдельно
- в командах для роутера добавлять clear
- UI на роутере обновляется через встроенный механизм интерфейса, не через git pull
- если меняется router-agent, нужно синхронизировать версию в install.sh и status API
- в каждом релизе обновлять docs/chat-transfer.md и корневой TRANSFER_CHAT

Что важно по текущему состоянию:
- users DB conflict cockpit по scope меток и apply-preview из v1.2.73 сохранён
- router-agent стабильный CGI/status путь сохранён: shebang `#!/opt/bin/sh`, `serverVersion` локальный, `version_cmp_sh()` в payload есть
- safe managed config flow из v1.2.75 сохранён: draft, baseline, history, validate/apply, rollback на previous active и fallback на baseline
- с v1.2.76 редактор конфигурации вынесен из Settings в отдельный верхнеуровневый раздел `Mihomo`
- v1.2.80: в `Mihomo → Конфигурация` добавлен line-diff для `active / draft / baseline / editor`, чтобы видеть точные изменения перед проверкой и применением
- v1.2.81: добавлен отдельный диагностический блок причин `validate / apply / rollback / restore`, а `router-agent` расширен до линии `0.6.21` безопасными полями ответа без изменения логики применения
- v1.2.82: в `Mihomo → Конфигурация` добавлен структурированный обзор типовых секций `config.yaml` для `active / draft / baseline / editor`, чтобы быстро видеть режим, порты, модули и объём маршрутизации без чтения всего YAML
- v1.2.83: добавлен отдельный блок последней успешно применённой версии; `router-agent 0.6.22` теперь хранит и отдаёт `lastSuccessful` как опорную реально поднятую ревизию и даёт использовать её в diff/загрузке в редактор
- v1.2.84: добавлен быстрый редактор частых top-level параметров `config.yaml` прямо в `Mihomo → Конфигурация`; он работает поверх содержимого редактора, умеет быстро менять режим, логирование, LAN/IPv6, unified-delay, find-process-mode, geodata-mode, controller/secret и основные порты, не меняя сам safe apply/rollback flow
- v1.2.85: добавлен структурированный preview быстрых top-level изменений перед записью в редактор; UI теперь заранее показывает, какие ключи будут добавлены/изменены/удалены, и помечает, какие зоны Mihomo это затронет (`runtime`, `network`, `controller`, `ports`)
- v1.2.86: быстрый редактор расширен на частые scalar-поля секций `tun` и `dns`; теперь из формы можно читать, preview-ить и записывать `tun.enable`, `tun.stack`, `tun.auto-route`, `tun.auto-detect-interface`, `dns.enable`, `dns.ipv6`, `dns.listen`, `dns.enhanced-mode` без пересборки остального YAML
- v1.2.87: в `Mihomo → Конфигурация` добавлен отдельный редактор `proxy-providers`: можно редактировать провайдеров по одному, дублировать, добавлять нового из шаблона и отключать ненужного прямо в YAML-редакторе; при отключении UI подчистит ссылки в `proxy-groups` (`use/providers`) и при необходимости подставит безопасную заглушку `DIRECT` в опустевшие группы
- v1.2.88: добавлен отдельный редактор `proxy-groups`: теперь группы можно редактировать по одной, дублировать и добавлять из шаблона; переименование обновляет ссылки в других `proxy-groups` и целевые группы в `rules`, а отключение безопасно удаляет блок, чистит входящие ссылки, подставляет `DIRECT` в опустевшие группы и переводит затронутые `rules` на `DIRECT`
- v1.2.90: добавлены редакторы `rule-providers` и `rules`; `rule-providers` умеют редактирование/добавление/дублирование/отключение с удалением связанных `RULE-SET`-строк из `rules`, а `rules` получили отдельный построчный редактор с безопасным сохранением и удалением отдельных правил
- v1.2.91: страница `Mihomo` больше не простыня — сделаны отдельные вкладки рабочего пространства; в structured-редакторах добавлены nested `health-check/override` для `proxy-providers`, `include-all` для `proxy-groups` и structured-форма для `rules`
- левое меню разбито на логические группы: `Мониторинг / Сеть и Mihomo / Управление`
- Settings разгружен и разбит на подблоки: `Интерфейс / Бэкенды / Трафик и подписи / Страницы и карточки`
- baseline не должен перезаписываться обычным сохранением черновика; он меняется только через отдельное действие «Сделать активную конфигурацию эталонной»

Порядок работы по проекту:
1. Собираем релиз архивом
2. Пользователь обновляет локальный репозиторий через GitHub Desktop
3. UI на роутере обновляется через встроенный механизм интерфейса
4. Если меняется router-agent — обновляем его отдельно через install.sh
5. Для нового чата используем docs/chat-transfer.md и корневой TRANSFER_CHAT как точку переноса

Команды для проверки на роутере:
```sh
clear
wget -T 5 -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=status"
wget -T 5 -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=mihomo_cfg_state"
wget -T 5 -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=mihomo_cfg_history"
```

Следующий логичный шаг:
- после v1.2.91 логично добивать structured-списки `dns.nameserver / dns.fallback / dns-hijack`, а затем по необходимости расширять nested-настройки `proxy-groups` и rule options уже без возврата к длинной странице
