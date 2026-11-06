{{ config(
    materialized='table',
    alias='p_mob_w_dim_geo'
) }}

-- Dimension géographique Île-de-France (reg = 11)
-- Clé : codegeo (unique toutes mailles confondues en IDF : commune 5 car., EPCI 9, ZE 4, dép. 2, région '11')

WITH com AS (
    
),

lib AS (
    
)

-- 1. Communes
SELECT
    'Commune'   AS maille,
    codgeo      AS codegeo,
    libgeo,
    epci,
    ze2020      AS zone_emploi,
    dep         AS departement,
    reg         AS region
FROM com

UNION ALL

-- 2. EPCI (dont Métropole du Grand Paris) - un EPCI peut couvrir plusieurs départements, donc pas de dep
SELECT DISTINCT
    'EPCI'      AS maille,
    c.epci      AS codegeo,
    l.libgeo,
    NULL        AS epci,
    NULL        AS zone_emploi,
    NULL        AS departement,
    '11'        AS region
FROM com c
LEFT JOIN lib l ON l.nivgeo = 'EPCI' AND l.codgeo = c.epci
WHERE c.epci IS NOT NULL AND c.epci <> 'ZZZZZZZZZ'

UNION ALL

-- 3. Zones d'emploi (utile pour le défi emploi : chômage par ZE)
SELECT DISTINCT
    'Zone d''emploi' AS maille,
    c.ze2020    AS codegeo,
    l.libgeo,
    NULL        AS epci,
    NULL        AS zone_emploi,
    NULL        AS departement,
    '11'        AS region
FROM com c
LEFT JOIN lib l ON l.nivgeo = 'ZE2020' AND l.codgeo = c.ze2020
WHERE c.ze2020 IS NOT NULL

UNION ALL

-- 4. Départements
SELECT DISTINCT
    'Département' AS maille,
    dep           AS codegeo,
    CASE dep
        WHEN '75' THEN 'Paris'
        WHEN '77' THEN 'Seine-et-Marne'
        WHEN '78' THEN 'Yvelines'
        WHEN '91' THEN 'Essonne'
        WHEN '92' THEN 'Hauts-de-Seine'
        WHEN '93' THEN 'Seine-Saint-Denis'
        WHEN '94' THEN 'Val-de-Marne'
        WHEN '95' THEN 'Val-d''Oise'
        ELSE dep
    END           AS libgeo,
    NULL          AS epci,
    NULL          AS zone_emploi,
    NULL          AS departement,
    reg           AS region
FROM com

UNION ALL

-- 5. Région
SELECT
    'Région'          AS maille,
    '11'              AS codegeo,
    'Île-de-France'   AS libgeo,
    NULL, NULL, NULL, NULL
