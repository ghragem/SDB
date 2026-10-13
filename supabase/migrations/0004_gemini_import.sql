-- Gemini como provider preferido e importação de conversas sem duplicar.

alter table public.preferences drop constraint preferences_ai_provider_check;
alter table public.preferences add constraint preferences_ai_provider_check
  check (ai_provider in ('anthropic','openai','gemini'));

-- Conversa importada (ChatGPT etc.) é identificada pelo id de origem: reimportar não duplica.
create unique index brain_notes_external_id_uniq
  on public.brain_notes (user_id, (metadata->>'external_id'))
  where metadata ? 'external_id';
