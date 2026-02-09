// frontend/src/components/Stats.tsx
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/auth';

type TabKey = 'solo' | 'battle' | 'overall' | 'typing';
type PeriodValue = '7' | '30' | '90' | 'all';

const PERIODS: { label: string; value: PeriodValue }[] = [
  { label: '7日', value: '7' },
  { label: '30日', value: '30' },
  { label: '90日', value: '90' },
  { label: '全期間', value: 'all' },
];

const DUMMY_SETS = [
  { id: 'all', name: '全てのセット' },
  { id: 'default', name: 'デフォルト' },
  { id: 'programming', name: 'プログラミング' },
  { id: 'animals', name: '動物' },
  { id: 'english_hard', name: '英単語（Hard）' },
];

// --- サブコンポーネント: 五角形チャート ---
function RadarPentagon({ data }: { data: any }) {
  if (!data) return <div className="h-48 flex items-center justify-center text-xs opacity-30">データ収集中...</div>;
  
  const keys = ['roman', 'digit', 'kanji', 'hiragana', 'symbol'];
  const labels = ['英字', '数字', '漢字', 'かな', '記号'];
  const center = 100;
  const radius = 70;

  const getCoords = (index: number, val: number) => {
    const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
    const r = radius * Math.min(Math.max(val, 0.2), 1.0); 
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const points = keys.map((k, i) => {
    const score = data[k] ? (data[k].accuracy / 100) : 0.2;
    const { x, y } = getCoords(i, score);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="flex justify-center items-center py-4">
      <svg width="200" height="200" className="overflow-visible">
        {[0.2, 0.4, 0.6, 0.8, 1.0].map(r => (
          <polygon key={r} points={keys.map((_, i) => `${getCoords(i, r).x},${getCoords(i, r).y}`).join(' ')} fill="none" stroke="#e2e8f0" strokeWidth="1" />
        ))}
        <polygon points={points} fill="rgba(20, 83, 45, 0.15)" stroke="#14532d" strokeWidth="2.5" strokeLinejoin="round" />
        {labels.map((label, i) => {
          const { x, y } = getCoords(i, 1.25);
          return <text key={i} x={x} y={y} textAnchor="middle" fontSize="10" fontWeight="900" fill="#64748b">{label}</text>;
        })}
      </svg>
    </div>
  );
}

// --- サブコンポーネント: 文字数別ミス率棒グラフ ---
function MissRateBarChart({ buckets, selected, onSelect }: { buckets: any[], selected: string | null, onSelect: (b: string) => void }) {
  return (
    <div className="flex items-end justify-around gap-2 h-44 border-b border-slate-100 pb-2">
      {buckets.map((b) => (
        <button key={b.bucket} onClick={() => onSelect(b.bucket)}
          className={`group flex-1 flex flex-col items-center transition-all ${selected === b.bucket ? 'scale-105' : 'opacity-60 hover:opacity-100'}`}>
          <div className={`w-full max-w-[32px] rounded-t-lg transition-colors ${selected === b.bucket ? 'bg-rose-500 shadow-md' : 'bg-[#14532d]/20 group-hover:bg-[#14532d]/40'}`} 
            style={{ height: `${Math.max(b.miss_rate * 100, 5)}%` }} />
          <span className={`text-[10px] font-black mt-2 truncate ${selected === b.bucket ? 'text-rose-600' : 'text-slate-400'}`}>{b.bucket}文字</span>
        </button>
      ))}
      {buckets.length === 0 && <div className="text-xs text-slate-300 py-10">データがありません</div>}
    </div>
  );
}

// --- メインコンポーネント ---
export default function Stats() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabKey>('solo');
  const [period, setPeriod] = useState<PeriodValue>('30');
  const [setId, setSetId] = useState('all');
  const [isPC, setIsPC] = useState<boolean>(() => typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true);

  const [data, setData] = useState<any>(null);
  const [lengthStats, setLengthStats] = useState<any[]>([]);
  const [radarData, setRadarData] = useState<any>(null);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [wrongChars, setWrongChars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 成長指標計算 (手順2-⑥)
  const growthStats = useMemo(() => {
    if (!data?.sessions || data.sessions.length === 0) return { diff: null, current: '--' };
    const latest = data.sessions[0].accuracy;
    if (data.sessions.length >= 2) {
      const diff = latest - data.sessions[1].accuracy;
      return { diff: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`, current: `${latest.toFixed(1)}%` };
    }
    return { diff: null, current: `${latest.toFixed(1)}%` };
  }, [data]);

  // ライバル分析計算
  const rivalStats = useMemo(() => {
    if (tab !== 'battle' || !data?.sessions) return [];
    const rivals: Record<string, { name: string; wins: number; total: number; scoreDiff: number }> = {};
    data.sessions.forEach((s: any) => {
      const name = s.opponent_name || "Rival";
      if (!rivals[name]) rivals[name] = { name, wins: 0, total: 0, scoreDiff: 0 };
      rivals[name].total += 1;
      if (s.result === 'win') rivals[name].wins += 1;
      rivals[name].scoreDiff += (s.score_for - s.score_against);
    });
    return Object.values(rivals).sort((a, b) => b.total - a.total).slice(0, 3);
  }, [data, tab]);

  // ★復活・強化版: 推薦（Recommendation）ロジック (手順2-⑤)
  const recommendation = useMemo(() => {
    if (tab !== 'overall' || !data || !radarData) return null;

    // 1. 精度が低い文字種を最優先でチェック (閾値 80%)
    const weakTypes = Object.entries(radarData)
      .filter(([_, val]: any) => val.accuracy < 80)
      .sort((a: any, b: any) => a[1].accuracy - b[1].accuracy);

    if (weakTypes.length > 0) {
      const labels: any = { roman: '英字', kanji: '漢字', hiragana: 'かな', digit: '数字', symbol: '記号' };
      const typeLabel = labels[weakTypes[0][0]];
      return {
        title: `${typeLabel}の強化が必要です`,
        desc: `${typeLabel}の精度が低めです。専門セットで五角形を整えましょう。`,
        target: "/memory-sets",
        action: "練習セットを探す"
      };
    }

    // 2. 正解率が低いセット（80%未満）を次にチェック
    const weakSet = [...(data.set_summaries || [])]
      .filter(s => s.avg_accuracy < 80)
      .sort((a, b) => (a.avg_accuracy || 0) - (b.avg_accuracy || 0))[0];

    if (weakSet) {
      return {
        title: `セット「${weakSet.set_id}」を復習しましょう`,
        desc: `平均正解率が${weakSet.avg_accuracy.toFixed(1)}%です。まずは90%突破を目指しましょう。`,
        target: "/solo",
        action: "このセットに挑戦"
      };
    }

    return { 
      title: "絶好調です！", 
      desc: "全体的に高い水準です。対戦ロビーで実力を試してみませんか？", 
      target: "/lobby", 
      action: "対戦ロビーへ" 
    };
  }, [tab, data, radarData]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [res, lRes, rRes] = await Promise.all([
          authFetch(`/api/stats/${tab}?period=${period}&set_id=${setId}`),
          authFetch(`/api/stats/${tab}/length?period=${period}&set_id=${setId}`),
          authFetch(`/api/stats/${tab}/radar?period=${period}&set_id=${setId}`)
        ]);
        if (res.ok) setData(await res.json());
        if (lRes.ok) setLengthStats((await lRes.json()).buckets || []);
        if (rRes.ok) setRadarData(await rRes.json());
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchAll();
  }, [tab, period, setId]);

  useEffect(() => {
    if (!selectedBucket) return;
    const fetchWrongs = async () => {
      try {
        const res = await authFetch(`/api/stats/${tab}/wrong_chars?bucket=${selectedBucket}&period=${period}&set_id=${setId}`);
        if (res.ok) setWrongChars((await res.json()).chars || []);
      } catch (e) { console.error(e); }
    };
    fetchWrongs();
  }, [selectedBucket, tab, period, setId]);

  useEffect(() => {
    const handler = () => setIsPC(window.matchMedia('(min-width: 768px)').matches);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (loading && !data) return <div className="h-screen theme-garden-bg flex items-center justify-center font-black text-[#14532d] animate-pulse text-xl">庭園の記録を整理中...</div>;

  return (
    <div className="min-h-screen theme-garden-bg p-4 md:p-8 overflow-y-auto font-hakoniwa">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 pb-4">
        <div className="backdrop-blur bg-white/60 rounded-2xl shadow border border-[#14532d]/10 p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <button onClick={() => navigate('/')} className="bg-white/80 hover:bg-white rounded-xl px-3 py-2 font-black text-[#14532d] shadow-sm">← ホーム</button>
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {[['solo','ソロ'],['battle','バトル'],['overall','総合'],['typing','タイプ']].map(([k, l]) => (
                  <button key={k} onClick={() => { setTab(k as TabKey); setSelectedBucket(null); }} 
                    className={`px-4 py-2 rounded-xl font-black transition ${tab === k ? 'bg-[#14532d] text-white shadow' : 'bg-white/80 text-[#14532d] hover:bg-white'}`}>{l}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <select className="bg-white/80 rounded-xl px-3 py-1.5 font-bold text-[#14532d] text-xs shadow-sm" value={period} onChange={(e) => setPeriod(e.target.value as PeriodValue)}>
                  {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <select className="bg-white/80 rounded-xl px-3 py-1.5 font-bold text-[#14532d] text-xs shadow-sm" value={setId} onChange={(e) => setSetId(e.target.value)}>
                  {DUMMY_SETS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8 pb-20 mt-6">
        <section>
          <SectionTitle>① 成長カード</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="直近の伸び" value={growthStats.diff || growthStats.current} sub={growthStats.diff ? `前回: ${data.sessions[1].accuracy.toFixed(1)}%` : "初回プレイ"} 
              color={growthStats.diff?.startsWith('+') ? "text-emerald-600" : growthStats.diff?.startsWith('-') ? "text-rose-600" : "text-[#14532d]"} />
            <StatCard title="90%達成まで" value={data?.required_attempts_by_set?.[0]?.required_attempts_90 ? `${data.required_attempts_by_set[0].required_attempts_90}回` : '--'} sub="到達プレイ回数の目安" color="text-amber-600" />
            <StatCard title="安定度" value={data?.set_summaries?.[0]?.stdev_accuracy < 5 ? '極めて高い' : '上昇中'} sub="正解率のブレ（標準偏差）" color="text-indigo-600" />
          </div>
        </section>

        <section>
        <SectionTitle>② 成長グラフ</SectionTitle>

        {/* 成長グラフ（軸付き） */}
        <div className="theme-white-wood-card p-6 h-72">
          <div className="text-sm font-black text-[#14532d]/80 mb-4 text-center">
            正解率の推移
          </div>

          {/* グラフ領域 */}
          <div className="flex gap-3 h-52">
            {/* Y軸ラベル */}
            <div className="w-10 relative pb-5 overflow-visible">
              {/* Y軸タイトル：100%の上に重ねて表示（目盛り位置は動かさない） */}
              <div
                className="absolute bottom-0 text-[10px] font-black text-slate-400 whitespace-nowrap"
                style={{ bottom: '100%', transform: 'translateY(-10px)' }}
              >
                正解率（%）
              </div>

              <div className="absolute left-0 right-0 top-0 bottom-5 text-[10px] font-black text-slate-400">
                {[100, 75, 50, 25, 0].map((v) => {
                  // 端(0/100)だけははみ出し防止で寄せる
                  const isTop = v === 120;
                  const isBottom = v === 0;

                  return (
                    <div
                      key={v}
                      className="absolute right-0 leading-none"
                      style={{
                        top: isTop ? '0%' : isBottom ? '100%' : `${100 - v}%`,
                        transform: isTop ? 'translateY(0)' : isBottom ? 'translateY(-100%)' : 'translateY(-50%)',
                      }}
                    >
                      {v}%
                    </div>
                  );
                })}
              </div>
            </div>

            {/* プロット領域 */}
            <div className="relative flex-1">
              {/* ★背景（白） */}
              <div className="absolute left-0 right-0 top-0 bottom-5 bg-white/60 rounded-xl" />
              {/* 中身は前面に */}
              <div className="relative z-10 h-full">
                {/* グリッド（水平線） */}
                <div className="absolute left-0 right-0 top-0 bottom-5  flex flex-col justify-between pointer-events-none">
                  {[100, 75, 50, 25, 0].map((v) => (
                    <div key={v} 
                    className="absolute left-0 right-0 border-t border-slate-200/70" 
                    style={{ top: `${100 - v}%` }}
                    />
                  ))}
                </div>

                {/* X軸（下線） */}
                <div className="absolute left-0 right-0 bottom-5 border-t-2 border-slate-300" />

                {/* 線＋点（SVGで描画：直近15回） */}
                {(() => {
                  const points = (data?.sessions || []).slice(0, 15).reverse();

                  if (points.length === 0) {
                    return (
                      <div className="absolute left-0 right-0 top-0 bottom-5 flex items-center justify-center">
                        <div className="text-slate-300 font-bold">データ収集中...</div>
                      </div>
                    );
                  }

                  const n = points.length;

                  // SVG上の座標を %（0〜100）で作る
                    const toXY = (i: number, acc: number) => {
                      const x = n === 1 ? 50 : (i / (n - 1)) * 100;
                      const y = 100 - Math.min(Math.max(acc, 0), 100);
                      return { x, y };
                    };


                  const polyPoints = points
                    .map((s: any, i: number) => {
                      const acc = Number(s.accuracy || 0);
                      const { x, y } = toXY(i, acc);
                      return `${x},${y}`;
                    })
                    .join(' ');

                  // X軸目盛り（1, 5, 10, last）だけ表示
                  const tickIndexSet = new Set<number>([1, 5, 10, n]);

                  return (
                    <>
                      {/* SVG: 線と点 */}
                      <svg
                        className="absolute left-0 right-0 top-0 bottom-5 pointer-events-none overflow-visible"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        {/* 線 */}
                        {n >= 2 && (
                          <polyline
                            points={polyPoints}
                            fill="none"
                            stroke="#14532d"
                            strokeWidth="1.2"
                            vectorEffect="non-scaling-stroke"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            opacity="0.9"
                          />
                        )}

                        {/* 点の当たり判定（透明で大きめ） */}
                        {points.map((s: any, i: number) => {
                          const acc = Number(s.accuracy || 0);
                          const { x, y } = toXY(i, acc);
                          const label = `${new Date(s.created_at).toLocaleDateString()}\u00A0: ${acc.toFixed(1)}%`;

                          return (
                            <g key={`hit-${i}`}>
                              <circle
                                cx={x}
                                cy={y}
                                r="3"                 // ←当たり判定の大きさ（好みで 2〜5）
                                fill="transparent"
                                stroke="transparent"
                                pointerEvents="all"
                              >
                                <title>{label}</title>
                              </circle>
                            </g>
                          );
                        })}

                        {/* 点 */}
                        {points.map((s: any, i: number) => {
                          const acc = Number(s.accuracy || 0);
                          const { x, y } = toXY(i, acc);
                          const label = `${new Date(s.created_at).toLocaleDateString()}: ${acc.toFixed(1)}%`;
                          return (
                            <g key={i}>
                              {/* 外側リングっぽく */}
                              <circle cx={x} cy={y} r="0.4" fill="#14532d" />
                              <circle cx={x} cy={y} r="0.4" fill="#14532d" />
                            </g>
                          );
                        })}
                      </svg>

                      {/* クリック/ホバーしやすい当たり判定（任意：太め透明） */}
                      <svg
                        className="absolute left-0 right-0 top-0 bottom-5 pointer-events-none"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        {n >= 2 && (
                          <polyline
                            points={polyPoints}
                            fill="none"
                            stroke="transparent"
                            strokeWidth="14"
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                      </svg>

                      {/* X軸の目盛り（小さい縦線） */}
                      {points.map((_, i: number) => {
                        const idx = i + 1;
                        if (!tickIndexSet.has(idx)) return null;

                        const x = n === 1 ? 50 : (i / (n - 1)) * 100;
                        return (
                          <div
                            key={idx}
                            className="absolute bottom-5 h-2 border-l border-slate-400"
                            style={{ left: `${x}%`, transform: 'translateX(-50%)' }}
                          />
                        );
                      })}

                      {/* X軸の数値ラベル（任意：欲しければ） */}
                      {points.map((_, i: number) => {
                        const idx = i + 1;
                        if (!tickIndexSet.has(idx)) return null;

                        const x = n === 1 ? 50 : (i / (n - 1)) * 100;
                        return (
                          <div
                            key={`label-${idx}`}
                            className="absolute bottom-0 text-[10px] font-black text-slate-400"
                            style={{ left: `${x}%`, transform: 'translateX(-50%)' }}
                          >
                            {idx}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}

                {/* X軸タイトル：右端の値の横に表示 */}
                <div
                  className="absolute bottom-0 text-[10px] font-black text-slate-400 whitespace-nowrap"
                  style={{ left: '100%', transform: 'translateX(6px)' }}
                >
                  プレイ数（回）
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


        <section>
          <SectionTitle>③ 詳細分析</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
              {tab === 'overall' && recommendation && (
                <div className="bg-gradient-to-br from-[#14532d] to-[#064e3b] p-6 rounded-[2rem] text-white shadow-xl animate-pop-in">
                  <p className="text-[10px] font-black opacity-60 mb-1 uppercase tracking-widest">✨ アドバイス</p>
                  <h3 className="text-xl font-black mb-2">{recommendation.title}</h3>
                  <p className="text-xs opacity-80 mb-4 leading-relaxed">{recommendation.desc}</p>
                  <button onClick={() => navigate(recommendation.target)} className="w-full bg-white text-[#14532d] py-2 rounded-xl font-black text-sm hover:scale-105 transition shadow-lg">{recommendation.action}</button>
                </div>
              )}
              <div className="theme-white-wood-card p-6">
                <div className="text-sm font-black text-[#14532d]/80 mb-2">苦手ジャンル分析</div>
                <RadarPentagon data={radarData} />
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              {tab === 'battle' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                  <div className="theme-white-wood-card p-6">
                    <div className="text-sm font-black text-[#14532d]/80 mb-4">ライバル分析 (TOP3)</div>
                    <div className="space-y-3">
                      {rivalStats.map(r => (
                        <div key={r.name} className="flex justify-between items-center bg-white/50 p-3 rounded-xl border border-[#14532d]/10">
                          <span className="font-black text-slate-700 text-xs">{r.name}</span>
                          <span className={`text-xs font-black ${r.scoreDiff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{r.wins}勝 / {r.scoreDiff > 0 ? '+' : ''}{r.scoreDiff}pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <StatCard title="通算勝率" value={`${data?.set_summaries?.[0]?.win_rate?.toFixed(0) || 0}%`} sub="WINS / TOTAL" />
                </div>
              ) : (
                <div className="theme-white-wood-card p-6">
                  <div className="text-sm font-black text-[#14532d]/80 mb-4 flex justify-between">
                    <span>文字数別ミス率</span>
                    <span className="text-[10px] opacity-40 italic">棒をクリックで詳細表示</span>
                  </div>
                  <MissRateBarChart buckets={lengthStats} selected={selectedBucket} onSelect={setSelectedBucket} />
                  {selectedBucket && (
                    <div className="mt-4 p-4 bg-rose-50/50 rounded-2xl border border-rose-100 animate-fade-in">
                      <h4 className="text-[10px] font-black text-rose-800 mb-3 flex items-center gap-2">⚠️ {selectedBucket}文字セットでの苦手文字</h4>
                      <div className="flex flex-wrap gap-2">
                        {wrongChars.map((wc, i) => (
                          <div key={i} className="bg-white px-2 py-1 rounded-lg border border-rose-100 flex items-center gap-2">
                            <span className="text-lg font-black font-mono text-slate-700">{wc.char}</span>
                            <span className="text-[10px] font-black text-rose-400">x{wc.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-slate-800 p-6 rounded-[2rem] shadow-xl text-white">
                <div className="text-[10px] font-black opacity-50 mb-4 uppercase tracking-widest">🔥 要復習単語</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data?.top_missed_words?.slice(0, 6).map((w: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-white/10 p-3 rounded-xl">
                      <div className="min-w-0"><div className="font-black text-sm truncate">{w.word_text}</div><div className="text-[10px] opacity-40 truncate">{w.kana}</div></div>
                      <div className="text-rose-400 font-black text-xs whitespace-nowrap ml-2">{w.miss_count} Miss</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-black text-[#14532d] mb-4 flex items-center gap-2 px-2 opacity-80">{children}</h2>;
}

function StatCard({ title, value, sub, color = "text-[#14532d]" }: { title: string; value: string; sub: string, color?: string }) {
  return (
    <div className="bg-white/80 rounded-2xl shadow-sm p-6 border border-[#14532d]/10 transition-transform hover:scale-[1.02]">
      <div className="text-[10px] font-black text-[#14532d]/60 uppercase tracking-widest">{title}</div>
      <div className={`text-4xl font-black mt-2 ${color}`}>{value}</div>
      <div className="text-[10px] font-bold text-[#14532d]/40 mt-1">{sub}</div>
    </div>
  );
}