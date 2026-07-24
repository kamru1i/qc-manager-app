-- RPC functions for user-level global_settings key updates using jsonb_set
-- Prevents race-condition overwrites of other keys in global_settings JSONB.

CREATE OR REPLACE FUNCTION public.set_user_hidden_tabs(p_user_id uuid, p_hidden_tabs jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() <> p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: You can only update your own settings.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{hidden_tabs}',
        COALESCE(p_hidden_tabs, '[]'::jsonb),
        true
      )
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_hidden_tabs(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_hidden_tabs(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_user_hidden_tabs(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_vpn_list(p_vpn_list jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_supervisor() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only supervisor or admin can configure VPN list.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{vpn_list}',
        COALESCE(p_vpn_list, '[]'::jsonb),
        true
      )
  WHERE true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_vpn_list(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_vpn_list(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_user_vpn_list(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
