-- Create dismissed_notifications table
CREATE TABLE IF NOT EXISTS public.dismissed_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  notification_id TEXT NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_notification UNIQUE (user_id, notification_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.dismissed_notifications ENABLE ROW LEVEL SECURITY;

-- Enable Realtime for dismissed_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.dismissed_notifications;

-- Create RLS Policies
CREATE POLICY "Users can read own dismissed notifications" 
  ON public.dismissed_notifications 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dismissed notifications" 
  ON public.dismissed_notifications 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dismissed notifications" 
  ON public.dismissed_notifications 
  FOR DELETE 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can do everything on dismissed notifications"
  ON public.dismissed_notifications
  FOR ALL
  USING (public.is_admin());
