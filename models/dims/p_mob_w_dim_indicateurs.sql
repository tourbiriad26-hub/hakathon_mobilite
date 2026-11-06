{{ config(
    materialized='table',
    alias='p_mob_w_dim_indicateurs'
) }}

-- Dictionnaire des indicateurs. code_indicateur = clé stable utilisée par les dashboards Superset : ne pas renommer.
-- type_mesure : effectif | part | taux | montant  (ne jamais sommer part/taux)

SELECT
    code_indicateur::varchar,
    nom_indicateur::varchar,
    description::varchar,
    famille_indicateur::varchar,
    type_mesure::varchar,
    unite::varchar,
    defi::varchar,
    source::varchar,
    producteur::varchar
FROM (VALUES
    -- Mobilité domicile-travail (RP 2022 - MOBPRO)
    ('nb_actifs_occupes',  'Actifs occupés',                         'Actifs occupés de 15 ans ou plus résidant sur le territoire',                              'Mobilité domicile-travail', 'effectif', 'personnes', 'défi 2 - emploi',     'INSEE - RP 2022, fichier détail MOBPRO', 'INSEE'),
    ('nb_navetteurs',      'Actifs se déplaçant pour travailler',    'Actifs occupés hors "pas de déplacement" (base de calcul des parts modales)',              'Mobilité domicile-travail', 'effectif', 'personnes', 'défi 2 - emploi',     'INSEE - RP 2022, fichier détail MOBPRO', 'INSEE'),
    ('part_tc',            'Part modale transports en commun',       'Part des actifs se rendant au travail en transports en commun',                           'Mobilité domicile-travail', 'part',     '%',         'défi 2 - emploi',     'INSEE - RP 2022, fichier détail MOBPRO', 'INSEE'),
    ('part_voiture',       'Part modale voiture',                    'Part des actifs se rendant au travail en voiture, camion ou fourgonnette',                'Mobilité domicile-travail', 'part',     '%',         'défi 2 - emploi',     'INSEE - RP 2022, fichier détail MOBPRO', 'INSEE'),
    ('part_velo',          'Part modale vélo',                       'Part des actifs se rendant au travail à vélo (y compris VAE)',                            'Mobilité domicile-travail', 'part',     '%',         'défi 2 - emploi',     'INSEE - RP 2022, fichier détail MOBPRO', 'INSEE'),
    ('part_marche',        'Part modale marche',                     'Part des actifs se rendant au travail à pied',                                            'Mobilité domicile-travail', 'part',     '%',         'défi 2 - emploi',     'INSEE - RP 2022, fichier détail MOBPRO', 'INSEE'),
    ('part_2rm',           'Part modale deux-roues motorisé',        'Part des actifs se rendant au travail en deux-roues motorisé',                            'Mobilité domicile-travail', 'part',     '%',         'défi 2 - emploi',     'INSEE - RP 2022, fichier détail MOBPRO', 'INSEE'),
    ('part_hors_commune',  'Part travaillant hors commune',          'Part des actifs occupés travaillant hors de leur commune de résidence',                   'Mobilité domicile-travail', 'part',     '%',         'défi 2 - emploi',     'INSEE - RP 2022, fichier détail MOBPRO', 'INSEE'),
    -- Revenus (Filosofi 2021)
    ('mediane_niveau_vie', 'Médiane du niveau de vie',               'Médiane du revenu disponible par unité de consommation',                                  'Revenus',                   'montant',  '€',         'défi 2 - emploi',     'INSEE - Filosofi 2021',                  'INSEE'),
    ('taux_pauvrete',      'Taux de pauvreté',                       'Part de la population sous le seuil de pauvreté (60 % du niveau de vie médian)',          'Revenus',                   'taux',     '%',         'défi 2 - emploi',     'INSEE - Filosofi 2021',                  'INSEE')
) AS t(code_indicateur, nom_indicateur, description, famille_indicateur, type_mesure, unite, defi, source, producteur)
