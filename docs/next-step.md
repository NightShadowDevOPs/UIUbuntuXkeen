# Следующий шаг после v0.6.27

1. Запустить workflow из релиза `v0.6.27`.
2. Если build снова упадёт, взять уже **первую реальную ошибку Vite/Rollup**, а не инфраструктурную ошибку bootstrap.
3. Следующий hotfix делать только по фактическому логу сборки.


## After v0.6.28
- Re-run GitHub Actions and capture the first real install/build error if the pipeline still fails.
