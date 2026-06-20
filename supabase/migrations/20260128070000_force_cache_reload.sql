-- Force schema cache reload by executing a DDL statement
create table if not exists dummy_reload_table (id serial primary key);
drop table if exists dummy_reload_table;
