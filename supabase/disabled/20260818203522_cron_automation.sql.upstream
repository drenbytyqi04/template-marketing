create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('krijo24-automation') where exists (select 1 from cron.job where jobname = 'krijo24-automation');

select cron.schedule(
  'krijo24-automation',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://project--5a3f77fc-1723-4fd4-b3a8-1d753f001fad.lovable.app/api/public/cron/automation',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpramd3cmxja3VsZWFlcHNobmZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTM5MjIsImV4cCI6MjEwMTY4OTkyMn0.-XeZg06y8NWFCmoLYYmKJZPIomxsdWh9lKGBY7FD_CA"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);