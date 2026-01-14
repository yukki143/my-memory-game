// frontend/src/components/Ranking.tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Mode = 'solo' | 'battle';

type RankRow = {
  rank: number;
  username: string;
  timeSec?: number;      // solo向け（仮）
  accuracy?: number;     // 0-100（仮）
  avgSpeed?: number;     // WPM相当（仮）
  score?: string;        // battle向け（仮）例: "5-3"
  createdAt?: string;    // 表示用（仮）
};

// API未接続でも画面が成立する “最小のダミーデータ”
const DUMMY_SOLO: RankRow[] = [
  { rank: 1, username: 'PlayerA', timeSec: 42.3, accuracy: 98, avgSpeed: 230, createdAt: '2026-01-10' },
  { rank: 2, username: 'PlayerB', timeSec: 45.8, accuracy: 96, avgSpeed: 210, createdAt: '2026-01-09' },
  { rank: 3, username: 'PlayerC', timeSec: 49.1, accuracy: 93, avgSpeed: 190, createdAt: '2026-01-08' },
];

const DUMMY_BATTLE: RankRow[] = [
  { rank: 1, username: 'PlayerA', score: '5-1', createdAt: '2026-01-10' },
  { rank: 2, username: 'PlayerD', score: '5-2', createdAt: '2026-01-09' },
  { rank: 3, username: 'PlayerB', score: '5-3', createdAt: '2026-01-08' },
];

function ModeTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-4 py-2 rounded-xl font-black transition select-none',
        active ? 'bg-[#14532d] text-white shadow' : 'bg-white/80 text-[#14532d] hover:bg-white shadow-sm',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

export default function Ranking() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('solo');

  const rows = useMemo(() => (mode === 'solo' ? DUMMY_SOLO : DUMMY_BATTLE), [mode]);

  return (
    <div className="min-h-screen theme-garden-bg p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="backdrop-blur bg-white/50 rounded-2xl shadow border border-[#14532d]/10 p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="bg-white/80 hover:bg-white rounded-xl px-3 py-2 font-black text-[#14532d] shadow-sm"
            >
              ← ホーム
            </button>
            <div className="text-base md:text-lg font-black text-[#14532d]">ランキング</div>
            <div className="text-xs font-black text-[#14532d]/60 bg-white/70 px-2 py-1 rounded-lg">
              UI BOX
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <ModeTab active={mode === 'solo'} label="ソロ" onClick={() => setMode('solo')} />
            <ModeTab active={mode === 'battle'} label="バトル" onClick={() => setMode('battle')} />
          </div>

          <div className="mt-2 text-xs font-bold text-[#14532d]/60">
            ※ ここは最小の仮ページです（API接続後に実データ表示へ置き換え）
          </div>
        </div>

        {/* Table */}
        <div className="theme-white-wood-card p-4 md:p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-left text-xs font-black text-[#14532d]/70 border-b border-[#14532d]/10">
                  <th className="py-3 pr-3">#</th>
                  <th className="py-3 pr-3">ユーザー</th>
                  {mode === 'solo' ? (
                    <>
                      <th className="py-3 pr-3">タイム</th>
                      <th className="py-3 pr-3">正確率</th>
                      <th className="py-3 pr-3">速度</th>
                      <th className="py-3 pr-3">日付</th>
                    </>
                  ) : (
                    <>
                      <th className="py-3 pr-3">スコア</th>
                      <th className="py-3 pr-3">日付</th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr key={`${mode}-${r.rank}-${r.username}`} className="border-b border-[#14532d]/10">
                    <td className="py-3 pr-3 font-black text-[#14532d]">{r.rank}</td>
                    <td className="py-3 pr-3 font-black text-[#14532d]">{r.username}</td>

                    {mode === 'solo' ? (
                      <>
                        <td className="py-3 pr-3 font-bold text-[#14532d]/80">
                          {typeof r.timeSec === 'number' ? `${r.timeSec.toFixed(1)}s` : '—'}
                        </td>
                        <td className="py-3 pr-3 font-bold text-[#14532d]/80">
                          {typeof r.accuracy === 'number' ? `${r.accuracy}%` : '—'}
                        </td>
                        <td className="py-3 pr-3 font-bold text-[#14532d]/80">
                          {typeof r.avgSpeed === 'number' ? `${r.avgSpeed}` : '—'}
                        </td>
                        <td className="py-3 pr-3 text-xs font-bold text-[#14532d]/60">{r.createdAt ?? '—'}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 pr-3 font-bold text-[#14532d]/80">{r.score ?? '—'}</td>
                        <td className="py-3 pr-3 text-xs font-bold text-[#14532d]/60">{r.createdAt ?? '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs font-bold text-[#14532d]/60">
            次のステップ：バックエンドのランキングAPIに接続して実データを表示します。
          </div>
        </div>
      </div>
    </div>
  );
}
