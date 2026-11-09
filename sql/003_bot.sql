-- Jackbot no Telegram: o que o bot precisa guardar de cada pessoa além do 001.
-- NÃO APLICADO EM NENHUM BANCO. Depende de 001_esquema.sql e 002_vigiados.sql.
alter table robo.assinantes add column if not exists nome            text;
alter table robo.assinantes add column if not exists pausado         boolean not null default false;
alter table robo.assinantes add column if not exists silencio_noite  boolean not null default true;  -- 22h–8h só imperdível
alter table robo.assinantes add column if not exists estado          text not null default '{}';     -- último link checado etc. (JSON)
