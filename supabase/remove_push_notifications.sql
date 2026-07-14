-- =========================================================================
-- SQL Script: Remove Push Notification System Database Objects
-- Run this in your Supabase SQL Editor to clean up push-related objects.
-- =========================================================================

-- 1. Drop push subscriptions table (this automatically drops dependent policies)
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;

-- 2. Drop RPC functions related to push subscriptions
DROP FUNCTION IF EXISTS public.get_user_ids_by_roles(TEXT[]) CASCADE;
DROP FUNCTION IF EXISTS public.get_push_subscriptions_for_users(UUID[]) CASCADE;
DROP FUNCTION IF EXISTS public.delete_push_subscription(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.register_push_subscription(UUID, TEXT, TEXT, TEXT) CASCADE;
