-- Robô da Black: esquema do motor de oportunidades.
-- NÃO APLICADO EM NENHUM BANCO. Pensado para um projeto Supabase PRÓPRIO do Robô da Black
-- (não misturar com Axei, Dossiê ou Paulinho). Tudo no schema "robo".
-- Quem escreve: o coletor (service role). Quem lê o banco: coletor e bot.
-- O app NÃO lê o banco direto: lê o snapshot ofertas.json que o coletor publica (barato e aguenta pico da Black).

create schema if not exists robo;

-- Lojas ---------------------------------------------------------------------
create table if not exists robo.lojas (
  id               bigint generated always as identity primary key,
  nome             text not null unique,                 -- 'Mercado Livre', 'Amazon', 'KaBuM!'
  dominio          text not null unique,                 -- 'mercadolivre.com.br'
  tipo             text not null check (tipo in ('marketplace', 'varejista', 'marca', 'independente')),
  confiavel        boolean not null default false,       -- está na lista de grandes (score.js → DOMINIOS_CONFIAVEIS)
  idade_dominio_dias int,                                -- RDAP; atualizado 1x por mês
  aceita_cartao    boolean,
  cnpj             text,
  atualizado_em    timestamptz not null default now()
);

-- Produtos canônicos (o "mesmo produto" entre lojas) ------------------------
create table if not exists robo.produtos (
  id          bigint generated always as identity primary key,
  chave       text not null unique,                      -- 'ean:0789...' | 'mod:samsung|a36|128gb,6gb' | 'tit:...'
  confianca   text not null check (confianca in ('alta', 'media', 'baixa')),
  ean         text,
  marca       text,
  modelo      text,
  nome        text not null,
  cat         text not null,                             -- mesmos ids de RB_CATEGORIAS do app
  criado_em   timestamptz not null default now()
);
create index if not exists produtos_ean_idx on robo.produtos (ean) where ean is not null;
create index if not exists produtos_cat_idx on robo.produtos (cat);

-- Ofertas: o estado ATUAL de cada anúncio (1 linha por URL) -----------------
create table if not exists robo.ofertas (
  id               bigint primary key,                   -- idEstavel() do motor (o app usa número)
  produto_id       bigint not null references robo.produtos(id),
  loja_id          bigint not null references robo.lojas(id),
  fonte            text not null,                        -- 'mercadolivre' | 'shopee' | 'awin' | 'manual' ...
  url              text not null unique,
  url_afiliado     text,
  img              text,
  vendedor_id      text,
  vendedor_oficial boolean,
  reputacao        text check (reputacao in ('alta', 'media', 'baixa', 'nova')),
  preco            numeric(12,2) not null check (preco > 0),
  preco_de         numeric(12,2),                         -- o riscado que a loja mostra
  -- avaliação (motor.js)
  referencia       numeric(12,2),
  base             text check (base in ('mercado', 'historico')),
  mercado          numeric(12,2),
  lojas_comparadas int,
  outra_loja       text,
  outra_preco      numeric(12,2),
  classe           text not null check (classe in ('imperdivel', 'otimo', 'bom', 'sem_desconto', 'falso', 'sem_dados')),
  real             numeric(6,3),
  anunciado        numeric(6,3),
  menor_90         boolean,
  score            smallint check (score between 0 and 100),
  faixa            text check (faixa in ('seguro', 'atencao', 'cuidado', 'evite')),
  motivos          jsonb not null default '[]',
  ativa            boolean not null default true,         -- some do site / sem estoque = false
  visto_em         timestamptz not null default now(),    -- última vez que a fonte trouxe
  atualizado_em    timestamptz not null default now()
);
create index if not exists ofertas_vitrine_idx on robo.ofertas (classe, real desc) where ativa;
create index if not exists ofertas_produto_idx on robo.ofertas (produto_id);

-- Histórico de preços: só grava quando MUDA (ou 1x por dia, para provar que o preço continuou) --
create table if not exists robo.historico_precos (
  produto_id   bigint not null references robo.produtos(id),
  loja_id      bigint not null references robo.lojas(id),
  preco        numeric(12,2) not null,
  coletado_em  timestamptz not null default now(),
  primary key (produto_id, loja_id, coletado_em)
);
create index if not exists historico_produto_tempo_idx on robo.historico_precos (produto_id, coletado_em desc);

-- Menor preço por produto por dia (é o que o motor lê para mediana 60 d e mínimo 90 d).
create or replace view robo.preco_diario as
  select produto_id, (coletado_em at time zone 'America/Sao_Paulo')::date as dia, min(preco) as menor
  from robo.historico_precos
  group by 1, 2;

create or replace function robo.registrar_preco() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT'
     or new.preco is distinct from old.preco
     or (old.visto_em at time zone 'America/Sao_Paulo')::date < (new.visto_em at time zone 'America/Sao_Paulo')::date then
    insert into robo.historico_precos (produto_id, loja_id, preco, coletado_em)
    values (new.produto_id, new.loja_id, new.preco, new.visto_em)
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists ofertas_historico on robo.ofertas;
create trigger ofertas_historico after insert or update of preco, visto_em on robo.ofertas
  for each row execute function robo.registrar_preco();

-- Relâmpago: 5 por dia ------------------------------------------------------
create table if not exists robo.relampago (
  dia        date not null,
  posicao    smallint not null check (posicao between 1 and 5),
  oferta_id  bigint not null references robo.ofertas(id),
  real       numeric(6,3) not null,
  primary key (dia, posicao)
);

-- Robô do Telegram ------------------------------------------------------------
-- Assinante = comprador do plano R$ 34,90 que ligou o robô. app_id = id local do app (vai no /start).
create table if not exists robo.assinantes (
  id                bigint generated always as identity primary key,
  app_id            text not null unique,
  telegram_chat_id  bigint unique,
  email_compra      text,                                -- casa com a venda no checkout (liberação)
  plano             text not null default 'completo' check (plano in ('oportunidades', 'completo')),
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now()
);

create table if not exists robo.alvos_robo (
  id            bigint generated always as identity primary key,
  assinante_id  bigint not null references robo.assinantes(id) on delete cascade,
  cats          text[] not null default '{}',
  termos        text[] not null default '{}',             -- 'iphone 15', 'airfryer'
  desconto_min  numeric(4,3) not null default 0.15,
  orcamento     numeric(12,2),
  classes       text[] not null default '{imperdivel,otimo}',
  quando        text not null default 'na_hora' check (quando in ('na_hora', 'resumo_diario')),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);
create index if not exists alvos_ativos_idx on robo.alvos_robo (assinante_id) where ativo;

create table if not exists robo.alertas_enviados (
  id            bigint generated always as identity primary key,
  assinante_id  bigint not null references robo.assinantes(id) on delete cascade,
  produto_chave text not null,
  oferta_id     bigint references robo.ofertas(id),
  preco         numeric(12,2) not null,
  enviado_em    timestamptz not null default now()
);
create index if not exists alertas_assinante_idx on robo.alertas_enviados (assinante_id, enviado_em desc);

-- Log das coletas (para saber se o robô está vivo) -------------------------
create table if not exists robo.coletas (
  id           bigint generated always as identity primary key,
  fonte        text not null,
  iniciada_em  timestamptz not null default now(),
  terminada_em timestamptz,
  ofertas      int,
  erros        jsonb not null default '[]'
);

-- Segurança: nada exposto ao público. Coletor e bot usam a service role (ignora RLS).
alter table robo.lojas            enable row level security;
alter table robo.produtos         enable row level security;
alter table robo.ofertas          enable row level security;
alter table robo.historico_precos enable row level security;
alter table robo.relampago        enable row level security;
alter table robo.assinantes       enable row level security;
alter table robo.alvos_robo       enable row level security;
alter table robo.alertas_enviados enable row level security;
alter table robo.coletas          enable row level security;

-- Limpeza (rodar pelo pg_cron 1x por dia, depois de ligado):
--   delete from robo.historico_precos where coletado_em < now() - interval '400 days';
--   delete from robo.alertas_enviados where enviado_em < now() - interval '120 days';
--   update robo.ofertas set ativa = false where visto_em < now() - interval '6 hours';
