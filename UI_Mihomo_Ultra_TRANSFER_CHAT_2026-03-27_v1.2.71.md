27.03.2026 UI Mihomo / Ultra — сообщение для нового чата (вставь целиком)

Проект: UI Mihomo / Ultra
Репозиторий: NightShadowDevOPs/UltraUIXkeen
Локальная папка: Y:\Мой диск\Git\UltraUIXkeen
Путь на роутере/сервере: /opt/UltraUIXkeen
Стек: Vue 3 + TypeScript + router-agent (shell/cgi на роутере)

Текущие версии:
- UI: v1.2.71
- router-agent: 0.6.18

Что сделано в v1.2.71:
- router-agent переведён на стабильный CGI shebang: generated `api.sh` теперь использует `#!/opt/bin/sh`
- это фиксирует реальную аварию на роутере, где `uhttpd` запускал payload через несовместимый `/bin/sh` и валил `syntax error: unexpected "{" (expecting "then")`
- сохранены уже рабочие агентные фиксы: `read_conntrack_table()`, неблокирующий `rehydrate`, более жёсткий stale-process cleanup на restart
- остаточный шум host-traffic temp files пока не менялся и должен идти отдельным безопасным шагом

Важно по проекту:
- UI на роутере обновляется через встроенный механизм интерфейса, не через git pull
- если меняется router-agent, нужно синхронизировать версию в install.sh и status API
- в каждом релизе обновлять docs/chat-transfer.md и корневой TRANSFER_CHAT

Команды для проверки на роутере:
```sh
clear
wget -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=status"
wget -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=qos_status"
wget -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=traffic_live"
```

Следующий логичный шаг:
- отдельным безопасным патчем дочистить остаточный host-traffic log noise, не трогая уже рабочий CGI/shebang путь агента
