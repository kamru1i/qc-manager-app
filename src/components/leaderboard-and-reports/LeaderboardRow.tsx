import React from 'react';
import { LeaderboardUser } from '@/hooks/quotes-tracker/useLeaderboardData';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import { Trophy, Award } from 'lucide-react';

interface LeaderboardRowProps {
  user: LeaderboardUser;
  isCurrentUser: boolean;
}

export const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ user, isCurrentUser }) => {
  // Construct a temp profile object for UserDisplayName compatibility
  const tempProfile = React.useMemo(() => ({
    id: user.user_id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    job_role: user.job_role,
    global_settings: {
      top_performer_badge: user.badge
    }
  }), [user]);

  // Premium badge rendering for the top 5 staff in the Current Rank column
  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="inline-flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 px-2.5 py-1 rounded-xl text-xs font-bold shadow-sm shadow-yellow-950/20">
          <Trophy className="h-3.5 w-3.5 fill-yellow-400/10 shrink-0" />
          <span>#01</span>
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="inline-flex items-center gap-1 bg-slate-300/10 border border-slate-400/20 text-slate-200 px-2.5 py-1 rounded-xl text-xs font-bold shadow-sm shadow-slate-900/10">
          <Trophy className="h-3.5 w-3.5 text-slate-350 fill-slate-300/10 shrink-0" />
          <span>#02</span>
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="inline-flex items-center gap-1 bg-amber-600/10 border border-amber-650/20 text-amber-500 px-2.5 py-1 rounded-xl text-xs font-bold shadow-sm shadow-amber-950/10">
          <Trophy className="h-3.5 w-3.5 text-amber-500 fill-amber-500/10 shrink-0" />
          <span>#03</span>
        </div>
      );
    }
    if (rank === 4) {
      return (
        <div className="inline-flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-xl text-xs font-bold">
          <Award className="h-3.5 w-3.5 shrink-0" />
          <span>#04</span>
        </div>
      );
    }
    if (rank === 5) {
      return (
        <div className="inline-flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-xl text-xs font-bold">
          <Award className="h-3.5 w-3.5 shrink-0" />
          <span>#05</span>
        </div>
      );
    }
    return <span className="text-slate-450 font-bold">#{String(rank).padStart(2, '0')}</span>;
  };

  return (
    <tr
      className={`border-b border-slate-850/20 hover:bg-slate-900/10 text-xs transition-colors ${
        isCurrentUser ? 'bg-blue-950/10 border-l-2 border-l-blue-600' : ''
      }`}
    >
      {/* 1. Employee Name (uses UserDisplayName for consistent spacing and visual badge checkmark) */}
      <td className="p-4 pl-6 font-semibold text-slate-200 text-left">
        <div className="flex flex-col min-w-0">
          <div className="inline-flex items-center gap-1.5 flex-wrap">
            <UserDisplayName
              profile={tempProfile as any}
              badge={user.badge}
              rank={user.rank}
              showRank={false}
              showBadge={true}
              tooltipPosition="bottom"
              nameClassName="text-sm font-bold text-theme-text-primary hover:text-blue-400 transition-colors"
            />
          </div>
          <span className="text-[9px] text-slate-500 font-bold tracking-wider mt-0.5">
            {user.username.toUpperCase()}
          </span>
        </div>
      </td>

      {/* 2. Current Rank (renders premium badge for top 5, otherwise formatted text) */}
      <td className="p-4 text-center font-bold text-slate-400 text-sm">
        <div className="flex justify-center">
          {renderRankBadge(user.rank)}
        </div>
      </td>

      {/* 3. Today's Submissions */}
      <td className="p-4 text-center font-bold text-slate-350 text-sm">
        {user.todays_count}
      </td>

      {/* 4. Current Month Submissions (Selected Month) */}
      <td className="p-4 text-center font-bold text-slate-300 text-sm">
        {user.months_count}
      </td>

      {/* 5. Selected Year Submissions (Yearly) */}
      <td className="p-4 text-center font-bold text-slate-300 text-sm pr-6">
        {user.overall_score}
      </td>
    </tr>
  );
};
