# UIUbuntuXkeen v0.6.42 — cleanup and recovery baseline

## Что очищено из дистрибутива
- `router-agent/`
- `_api.sh`
- `_api_new.sh`
- `_backup_new.sh`
- `extracted_api_1.2.72.sh`
- `extracted_api_1271.sh`
- `extracted_api_final.sh`

## Почему это удалено
Это не часть подтверждённого Ubuntu runtime-контура проекта. Эти файлы и папки были историческим хвостом роутерной ветки и только создавали путаницу в релизах.

## Подтверждённый recovery/update-механизм
1. Остановить `mihomo`.
2. Удалить папку UI.
3. Запустить `mihomo` снова.
4. `mihomo` сам заново скачивает UI из репозитория.

## Граница этого релиза
Релиз **не** добавляет новый backend, новый service или новый deploy-контур. Это безопасный cleanup/stabilize-шаг от восстановленной базы `v0.6.41`.
