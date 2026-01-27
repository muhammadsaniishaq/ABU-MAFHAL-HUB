-- Query to check existing payment events for the specific reference seen in logs
select * from payment_events 
where reference like 'dva_%' 
order by processed_at desc 
limit 5;
