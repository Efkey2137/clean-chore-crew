
-- Allow one-way transfers (no target_date needed when giving a shift to anyone)
ALTER TABLE public.swap_requests ALTER COLUMN target_date DROP NOT NULL;

-- Accept a swap request: swap two days, or transfer requester's day to target when target_date IS NULL
CREATE OR REPLACE FUNCTION public.accept_swap_request(_swap_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.swap_requests%ROWTYPE;
  a_user uuid;
  b_user uuid;
BEGIN
  SELECT * INTO s FROM public.swap_requests WHERE id = _swap_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Swap not found'; END IF;
  IF auth.uid() <> s.target_id THEN RAISE EXCEPTION 'Only target may accept'; END IF;
  IF s.status <> 'pending' THEN RAISE EXCEPTION 'Already resolved'; END IF;

  IF s.target_date IS NULL THEN
    -- One-way transfer: requester's day goes to target
    UPDATE public.assignments SET user_id = s.target_id WHERE date = s.requester_date;
  ELSE
    -- True swap
    SELECT user_id INTO a_user FROM public.assignments WHERE date = s.requester_date;
    SELECT user_id INTO b_user FROM public.assignments WHERE date = s.target_date;
    IF a_user IS NULL OR b_user IS NULL THEN RAISE EXCEPTION 'Missing assignment'; END IF;
    UPDATE public.assignments SET user_id = b_user WHERE date = s.requester_date;
    UPDATE public.assignments SET user_id = a_user WHERE date = s.target_date;
  END IF;

  UPDATE public.swap_requests
    SET status = 'accepted', resolved_at = now()
    WHERE id = _swap_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_swap_request(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_swap_request(uuid) TO authenticated;

-- Admin: assign a user to a date and rotate the roster from that date forward
CREATE OR REPLACE FUNCTION public.admin_assign_and_rotate(_date date, _user uuid, _days int DEFAULT 60)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  roster_ids uuid[];
  roster_len int;
  start_idx int;
  i int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT array_agg(user_id ORDER BY position) INTO roster_ids
  FROM public.roster_members WHERE active = true;

  DELETE FROM public.assignments WHERE date >= _date;

  IF roster_ids IS NULL OR array_length(roster_ids, 1) IS NULL THEN
    INSERT INTO public.assignments(date, user_id) VALUES (_date, _user);
    RETURN;
  END IF;

  roster_len := array_length(roster_ids, 1);
  start_idx := COALESCE(array_position(roster_ids, _user), 0); -- 1-based or 0 if not in roster

  IF start_idx = 0 THEN
    -- Not in roster: place the user on _date, continue roster from position 1
    INSERT INTO public.assignments(date, user_id) VALUES (_date, _user);
    FOR i IN 1.._days - 1 LOOP
      INSERT INTO public.assignments(date, user_id)
      VALUES (_date + i, roster_ids[((i - 1) % roster_len) + 1]);
    END LOOP;
  ELSE
    FOR i IN 0.._days - 1 LOOP
      INSERT INTO public.assignments(date, user_id)
      VALUES (_date + i, roster_ids[((start_idx - 1 + i) % roster_len) + 1]);
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_and_rotate(date, uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_assign_and_rotate(date, uuid, int) TO authenticated;
