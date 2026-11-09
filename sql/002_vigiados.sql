-- Caça Black Fraude: o produto que a PESSOA quer comprar, vigiado desde o dia em que ela colou o link.
-- NÃO APLICADO EM NENHUM BANCO. Depende de 001_esquema.sql.
-- Quanto antes a pessoa cola o link, mais "antes" existe para comparar na Black.

create table if not exists robo.vigiados (
  id            bigint generated always as identity primary key,
  app_id        text not null,                          -- id local do app (o mesmo do /start do Telegram)
  assinante_id  bigint references robo.assinantes(id) on delete set null,
  loja          text not null,                          -- links.js → idDoLink().loja
  id_loja       text not null,                          -- MLB24047848, ASIN, shopid.itemid...
  url           text not null,
  produto_id    bigint references robo.produtos(id),    -- preenchido quando o coletor acha o produto
  preco_inicial numeric(12,2),
  avisar        boolean not null default true,          -- manda no Telegram quando cair de verdade
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  unique (app_id, loja, id_loja)
);

-- O coletor busca cada item distinto uma vez por rodada, não uma vez por pessoa.
create index if not exists vigiados_item_idx on robo.vigiados (loja, id_loja) where ativo;

create or replace view robo.itens_vigiados as
  select loja, id_loja, min(url) as url, count(*) as pessoas, min(criado_em) as desde
  from robo.vigiados where ativo
  group by loja, id_loja;

alter table robo.vigiados enable row level security;
