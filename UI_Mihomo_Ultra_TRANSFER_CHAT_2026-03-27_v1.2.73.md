27.03.2026 UI Mihomo / Ultra — сообщение для нового чата (вставь целиком)

Проект: UI Mihomo / Ultra
Репозиторий: NightShadowDevOPs/UltraUIXkeen
Локальная папка: Y:\Мой диск\Git\UltraUIXkeen
Путь на роутере/сервере: /opt/UltraUIXkeen
Стек: Vue 3 + TypeScript + router-agent (shell/cgi на роутере)

Текущие версии:
- UI: v1.2.73
- router-agent: 0.6.19

Что сделано в v1.2.73:
- users DB conflict UI для IP labels теперь показывает scope рядом с label
- winner/result по labels показывает уже не только текст метки, но и фактическую область действия правила, которая уйдёт на роутер
- в smart merge labels router/local строки теперь показывают scope по backend'ам
- в custom-режиме для labels явно видно, что scope сохраняется локальным, а меняется только текст label
- details и exported conflict preview стали scope-aware для label conflicts
- router-agent в этом релизе не менялся

Что важно по текущему состоянию:
- router-agent после v1.2.72 стабилен по основному пути: `status`, `qos_status`, `traffic_live` отвечают
- подтверждённые agent-фиксы: `#!/opt/bin/sh`, локальный `serverVersion`, встроенный `version_cmp_sh()`
- остаточный host-traffic / `Broken pipe` log noise ещё не исправлен и должен идти отдельным безопасным шагом

Команды для проверки на роутере:
```sh
clear
wget -T 5 -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=status"
wget -T 5 -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=qos_status"
wget -T 5 -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=traffic_live"
```

Следующий логичный шаг:
- отдельным безопасным патчем дочистить остаточный host-traffic / Broken pipe log noise, уже не трогая рабочий CGI/status путь агента
