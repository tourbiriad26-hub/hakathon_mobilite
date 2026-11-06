# hakathon_mobilite
Le répo github du challenge hakathon mobilité paris 202
pour tester la connection entre la base de données et dbt, à coller dans le terminal:

pip install dbt-postgres
$env:DBT_PG_PASSWORD = "ton_mdp"
# si besoin : $env:DBT_PG_DBNAME = "le nom de la bdd (par exemple: postgres)"
dbt debug