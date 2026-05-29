
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read all auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles read all auth" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Signup trigger: create profile + assign default role.
-- First user becomes admin, others become 'user'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
  assigned_role app_role;
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'user';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Roster
CREATE TABLE public.roster_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  position INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roster_members TO authenticated;
GRANT ALL ON public.roster_members TO service_role;
ALTER TABLE public.roster_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roster read all auth" ON public.roster_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "roster admin all" ON public.roster_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Assignments: one row per date
CREATE TABLE public.assignments (
  date DATE PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments read all auth" ON public.assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "assignments admin write" ON public.assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Swap requests
CREATE TYPE public.request_status AS ENUM ('pending', 'accepted', 'rejected');

CREATE TABLE public.swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_date DATE NOT NULL,
  target_date DATE NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  seen_by_requester BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.swap_requests TO authenticated;
GRANT ALL ON public.swap_requests TO service_role;
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swap read involved" ON public.swap_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "swap insert as requester" ON public.swap_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "swap update involved" ON public.swap_requests FOR UPDATE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- Buyout requests
CREATE TABLE public.buyout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  seen_by_requester BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE ON public.buyout_requests TO authenticated;
GRANT ALL ON public.buyout_requests TO service_role;
ALTER TABLE public.buyout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyout read involved or admin" ON public.buyout_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "buyout insert own" ON public.buyout_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "buyout update by admin or owner" ON public.buyout_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR auth.uid() = requester_id);
