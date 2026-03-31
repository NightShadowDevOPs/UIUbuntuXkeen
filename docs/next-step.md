Next: push v0.6.33 and rerun GitHub Actions. First verify whether CI becomes green on the simplified pnpm setup path; if not, fix the first explicit install/build error that now appears in the raw job log.

# Следующий шаг после v0.6.33

1. Прогнать GitHub Actions из релиза `v0.6.33`.
2. Проверить, ушёл ли bootstrap/build blocker после перехода на `pnpm/action-setup` и отказа от `flag-icons` glob.
3. Если CI ещё не зелёный — брать уже первую явную ошибку из raw log и чинить точечно.
