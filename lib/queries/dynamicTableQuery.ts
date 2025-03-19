/**
 * SQL query for creating a dynamic table that can be recalculated based on user parameters
 */

import { TEMP_TABLES } from '@/constants/tables';

/**
 * Returns the SQL query for creating a dynamic stats table
 * @param params Optional parameters to customize the query
 * @returns SQL query string
 */
export const getDynamicTableQuery = (params?: { [key: string]: any }) => {
  // For now, a simple query that selects from the schedule table
  // This can be expanded later to include filtering based on user parameters
  return `with cte_schedule as materialized (
  select
    yearweek(game_date)::int as week_id,
    game_id
  from ${TEMP_TABLES.SCHEDULE}
),
  cte_box_score_cnt as (
  select
    s.week_id,
    count(*) as gm_count
  from ${TEMP_TABLES.BOX_SCORES} bs
  join cte_schedule s on bs.game_id = s.game_id
  where bs.period = 'FullGame'
  and substring(bs."minutes", 1, instr(bs."minutes", ':') - 1)::int >= 15
  group by all
  ),
  cte_prep as materialized  (
  select 
    bs.game_id,
    bs.entity_id,  
    bs.player_name,
    CASE WHEN bs.fg_attempted > 0 then round(bs.fg_made / bs.fg_attempted,3) else 0 end as fg_pct,
    CASE WHEN bs.ft_attempted > 0 then round(bs.ft_made / bs.ft_attempted,3) else 0 end as ft_pct,
    round((fg_pct - 0.47) * bs.fg_attempted,2) as fg_v,
    round((ft_pct - 0.80) * bs.ft_attempted,2) as ft_v,
    bs.fg3_made,
    bs.points,
    bs.rebounds,
    bs.assists,
    bs.steals,
    bs.blocks,
    bs.turnovers,
-- Calculate week_id based on game_date
    s.week_id
  from ${TEMP_TABLES.BOX_SCORES} bs
  join cte_schedule s on bs.game_id = s.game_id
  where bs.period = 'FullGame'
  and substring(bs."minutes", 1, instr(bs."minutes", ':') - 1)::int >= 15
  order by week_id, entity_id
),
  cte_missing_games as (
    select 
    bs.game_id,
    entity_id,  
    player_name,
    CASE WHEN fg_attempted > 0 then round(fg_made / fg_attempted,3) else 0 end as fg_pct,
    CASE WHEN ft_attempted > 0 then round(ft_made / ft_attempted,3) else 0 end as ft_pct,
    round((fg_pct - 0.47) * fg_attempted,2) as fg_v,
    round((ft_pct - 0.80) * ft_attempted,2) as ft_v,
    fg3_made,
    points,
    rebounds,
    assists,
    steals,
    blocks,
    turnovers,
    s.week_id
  from box_scores bs
    join cte_schedule s on bs.game_id = s.game_id
  where period = 'FullGame'
  and substring("minutes", 1, instr("minutes", ':') - 1)::int < 15
  ),
  cte_final as (
select
    base.*,
    sum(
        cast(
            cast((base.fg_v > comp.fg_v) as int)
            + cast((base.ft_v > comp.ft_v) as int)
            + cast((base.fg3_made > comp.fg3_made) as int)
            + cast((base.points > comp.points) as int)
            + cast((base.rebounds > comp.rebounds) as int)
            + cast((base.assists > comp.assists) as int)
            + cast((base.steals > comp.steals) as int)
            + cast((base.blocks > comp.blocks) as int)
            + cast((base.turnovers < comp.turnovers) as int)
            + (
                cast((base.fg_v = comp.fg_v) as int)
                + cast((base.ft_v = comp.ft_v) as int)
                + cast((base.fg3_made = comp.fg3_made) as int)
                + cast((base.points = comp.points) as int)
                + cast((base.rebounds = comp.rebounds) as int)
                + cast((base.assists = comp.assists) as int)
                + cast((base.steals = comp.steals) as int)
                + cast((base.blocks = comp.blocks) as int)
                + cast((base.turnovers = comp.turnovers) as int)
            )
            * 0.5
            > 4.5 as int
        )
    ) as "wins",
  bsc.gm_count
from cte_prep as base
left join cte_prep as comp on comp.entity_id <> base.entity_id and comp.week_id = base.week_id
  left join cte_box_score_cnt bsc on bsc.week_id = base.week_id
group by all
union all
select mg.*, -1 as wins, bsc.gm_count from cte_missing_games mg
  left join cte_box_score_cnt bsc on bsc.week_id = mg.week_id
order by wins desc
)
select *, case when wins <> -1 then round(wins / gm_count,4) else -1 end as game_quality
from cte_final`;
};

/**
 * Returns the SQL statement to create or replace the dynamic table
 * @param tableName The name of the temporary table to create
 * @param params Optional parameters to customize the query
 * @returns SQL statement for creating the table
 */
export const createDynamicTableStatement = (tableName: string, params?: { [key: string]: any }) => {
  const query = getDynamicTableQuery(params);
  return `CREATE OR REPLACE TEMP TABLE ${tableName} AS ${query}`;
};
