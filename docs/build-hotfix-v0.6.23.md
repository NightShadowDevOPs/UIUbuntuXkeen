# Build hotfix audit — v0.6.23

## Что сделано

- Добавлен workflow `.github/workflows/build-ui.yml`.
- Шаг `Build UI` теперь запускает `pnpm exec vite build --debug` и печатает полный лог через `tee build-ui.log`.
- При падении workflow выводит содержимое `build-ui.log` прямо в лог Actions.
- Артефакты логов не добавлялись.

## Зачем

Предыдущий pipeline показывал только `Process completed with exit code 1`, без нормальной причины падения. После этого релиза GitHub Actions должен показывать уже реальную ошибку Vite/Rollup, а не немой `exit code 1`.
