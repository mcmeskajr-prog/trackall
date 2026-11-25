-- Apagar conta: corre UMA vez no Supabase (SQL Editor).
-- Apaga os dados do utilizador e a própria conta de login (auth.users).
-- Sem esta função, o botão «Apagar conta» só consegue apagar os dados e a conta de login fica (dá para entrar outra vez).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.collection_likes where user_id = uid;
  delete from public.tierlist_likes   where user_id = uid;
  delete from public.collections      where user_id = uid;
  delete from public.tierlists        where user_id = uid;
  delete from public.library          where user_id = uid;   -- inclui a linha __hall_of_fame__
  delete from public.friendships      where requester_id = uid or addressee_id = uid;
  delete from public.profile_private  where id = uid;
  delete from public.profiles         where id = uid;

  -- o código de convite usado fica gasto, mas deixa de apontar para esta conta (senão a chave estrangeira impede apagar o login)
  update public.invite_codes set used_by = null where used_by = uid;

  -- por fim, a conta de login
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
