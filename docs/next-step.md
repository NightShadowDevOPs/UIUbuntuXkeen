Next: rerun GitHub Actions on v0.6.30 and capture the first real runtime/build error if CI still fails.

# Следующий шаг после v0.6.30

1. Прогнать GitHub Actions из релиза `v0.6.30`.
2. Если build снова упадёт, взять уже **первую реальную ошибку pnpm/vite**, а не bootstrap/lockfile-шум.
3. После разблокировки CI отдельно локально пересобрать и закоммитить актуальный `pnpm-lock.yaml`, чтобы вернуть `--frozen-lockfile`.
