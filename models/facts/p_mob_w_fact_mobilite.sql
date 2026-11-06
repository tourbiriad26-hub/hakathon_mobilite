{{ config(
    materialized='table',
    alias='p_mob_w_fact_mobilite'
) }}

-- Fact au format long : 1 ligne = 1 territoire x 1 indicateur x 1 année
-- Les parts sont recalculées à chaque maille à partir des effectifs (jamais sommées).

-- VARIABLES
{% set var_annee_mobpro = 2022 %}
{% set var_annee_filosofi = 2021 %}
{% set var_suffixe_filosofi = 21 %}

-- Mailles d'agrégation MOBPRO (colonnes de ref_geo)
{% set mailles = ['codgeo', 'epci', 'zone_emploi', 'departement', 'region'] %}

WITH ref_geo AS (
    SELECT codegeo AS codgeo, epci, zone_emploi, departement, region
    FROM {{ ref('p_mob_w_dim_geo') }}
    WHERE maille = 'Commune'
),

-- ============================================================
-- 1. MOBPRO : 1 ligne = 1 individu pondéré (ipondi)
--    trans : 1 pas de déplacement, 2 marche, 3 vélo, 4 2RM, 5 voiture, 6 TC
--    (vérifier avec le dictionnaire des variables du millésime)
-- ============================================================
mobpro AS (
    SELECT
        g.*,
        m.dclt::varchar   AS codgeo_travail,
        m.trans::varchar  AS trans,
        m.ipondi::numeric AS poids
    FROM {{ source('insee', 'fd_mobpro_' ~ var_annee_mobpro) }} m
    INNER JOIN ref_geo g ON m.commune::varchar = g.codgeo
),

mobpro_agg AS (
{% for col in mailles %}
    SELECT
        {{ col }}                                                  AS codegeo,
        SUM(poids)                                                 AS nb_actifs_occupes,
        SUM(poids) FILTER (WHERE trans <> '1')                     AS nb_navetteurs,
        SUM(poids) FILTER (WHERE trans = '2')                      AS nb_marche,
        SUM(poids) FILTER (WHERE trans = '3')                      AS nb_velo,
        SUM(poids) FILTER (WHERE trans = '4')                      AS nb_2rm,
        SUM(poids) FILTER (WHERE trans = '5')                      AS nb_voiture,
        SUM(poids) FILTER (WHERE trans = '6')                      AS nb_tc,
        SUM(poids) FILTER (WHERE codgeo_travail <> codgeo)         AS nb_hors_commune
    FROM mobpro
    WHERE {{ col }} IS NOT NULL
    GROUP BY {{ col }}
    {% if not loop.last %}UNION ALL{% endif %}
{% endfor %}
),

fact_mobpro AS (
    SELECT a.codegeo, v.code_indicateur, v.nombre, {{ var_annee_mobpro }} AS annee
    FROM mobpro_agg a
    CROSS JOIN LATERAL (VALUES
        ('nb_actifs_occupes', a.nb_actifs_occupes),
        ('nb_navetteurs',     a.nb_navetteurs),
        ('part_tc',           100.0 * a.nb_tc           / NULLIF(a.nb_navetteurs, 0)),
        ('part_voiture',      100.0 * a.nb_voiture      / NULLIF(a.nb_navetteurs, 0)),
        ('part_velo',         100.0 * a.nb_velo         / NULLIF(a.nb_navetteurs, 0)),
        ('part_marche',       100.0 * a.nb_marche       / NULLIF(a.nb_navetteurs, 0)),
        ('part_2rm',          100.0 * a.nb_2rm          / NULLIF(a.nb_navetteurs, 0)),
        ('part_hors_commune', 100.0 * a.nb_hors_commune / NULLIF(a.nb_actifs_occupes, 0))
    ) AS v(code_indicateur, nombre)
),

-- ============================================================
-- 2. FILOSOFI : valeurs déjà calculées à la commune (secret statistique = 's' -> NULL)
--    Médiane et taux non agrégeables : mailles supra à charger depuis les fichiers EPCI/DEP/REG
-- ============================================================
fact_filosofi AS (
    SELECT
        f.codgeo::varchar AS codegeo,
        'mediane_niveau_vie'::varchar AS code_indicateur,
        CASE WHEN f.med{{ var_suffixe_filosofi }}::varchar ~ '^[0-9.]+$' THEN f.med{{ var_suffixe_filosofi }}::numeric END AS nombre,
        {{ var_annee_filosofi }} AS annee
    FROM {{ source('insee', 'filosofi_com_' ~ var_annee_filosofi) }} f
    INNER JOIN ref_geo g ON f.codgeo::varchar = g.codgeo

    UNION ALL

    SELECT
        f.codgeo::varchar,
        'taux_pauvrete',
        CASE WHEN f.tp60{{ var_suffixe_filosofi }}::varchar ~ '^[0-9.]+$' THEN f.tp60{{ var_suffixe_filosofi }}::numeric END,
        {{ var_annee_filosofi }}
    FROM {{ source('insee', 'filosofi_com_' ~ var_annee_filosofi) }} f
    INNER JOIN ref_geo g ON f.codgeo::varchar = g.codgeo
)

-- ============================================================
-- UNION FINALE (ajouter ici les nouveaux blocs : validations, chômage ZE, ICU...)
-- ============================================================
SELECT codegeo::varchar, code_indicateur::varchar, ROUND(nombre, 2) AS nombre, annee::integer
FROM (
    SELECT * FROM fact_mobpro
    UNION ALL
    SELECT * FROM fact_filosofi
) u
WHERE nombre IS NOT NULL
