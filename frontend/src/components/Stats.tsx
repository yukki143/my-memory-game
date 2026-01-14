// frontend/src/components/Stats.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type TabKey = 'solo' | 'battle' | 'overall' | 'typing';
type PeriodValue = '7' | '30' | '90' | 'all';

const PERIODS: { label: string; value: PeriodValue }[] = [
  { label: '7日', value: '7' },
  { label: '30日', value: '30' },
  { label: '90日', value: '90' },
  { label: '全期間', value: 'all' },
];

// UI箱としての仮データ（API接続後に置き換える）
const DUMMY_SETS = [
  { id: 'all', name: '全て' },
  { id: 'default', name: 'デフォルト' },
  { id: 'programming', name: 'プログラミング' },
  { id: 'animals', name: '動物' },
  { id: 'english_hard', name: '英単語（Hard）' },
];

function TabButton({
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
      onClick={onClick}
      className={[
        'px-4 py-2 rounded-xl font-black transition select-none',
        active
          ? 'bg-[#14532d] text-white shadow'
          : 'bg-white/80 text-[#14532d] hover:bg-white shadow-sm',
      ].join(' ')}
      type="button"
    >
      {label}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl md:text-2xl font-black text-[#14532d]">{children}</h2>;
}

function PlaceholderCard({
  title,
  children,
  sub,
}: {
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="theme-white-wood-card p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-black text-[#14532d]/80">{title}</div>
          {sub && <div className="text-xs font-bold text-[#14532d]/60 mt-1">{sub}</div>}
        </div>
        <div className="text-xs font-black text-[#14532d]/60 bg-white/70 px-2 py-1 rounded-lg">
          UI BOX
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function GrowthCards({ tab }: { tab: TabKey }) {
  const cards = useMemo(() => {
    if (tab === 'battle') {
      return [
        { title: '直近の成長', value: '—', hint: '勝率/スコア差の伸び（予定）' },
        { title: '接戦での強さ', value: '—', hint: '1点差以内の勝率（予定）' },
        { title: '安定度', value: '—', hint: 'ブレの小ささ（予定）' },
      ];
    }
    if (tab === 'overall') {
      return [
        { title: '今週の成長', value: '—', hint: 'ソロ＋バトル総合（予定）' },
        { title: '伸びてるセット', value: '—', hint: 'TOP3（予定）' },
        { title: '次のおすすめ', value: '—', hint: '1〜2個だけ提案（予定）' },
      ];
    }
    if (tab === 'typing') {
      return [
        { title: '正確さ', value: '—', hint: '誤字率（予定）' },
        { title: '速度', value: '—', hint: 'WPM相当（予定）' },
        { title: 'Backspace率', value: '—', hint: 'クセの指標（予定）' },
      ];
    }
    // solo
    return [
      { title: '直近の成長', value: '—', hint: '正答率/タイムの伸び（予定）' },
      { title: '90%到達', value: '—', hint: '必要暗記回数（予定）' },
      { title: '安定度', value: '—', hint: 'ブレの小ささ（予定）' },
    ];
  }, [tab]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.title} className="bg-white/80 rounded-2xl shadow p-5 border border-[#14532d]/10">
          <div className="text-sm font-black text-[#14532d]/80">{c.title}</div>
          <div className="text-3xl font-black text-[#14532d] mt-2">{c.value}</div>
          <div className="text-xs font-bold text-[#14532d]/60 mt-2">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}

function GrowthGraphBox({ tab }: { tab: TabKey }) {
  const label =
    tab === 'battle'
      ? '成長グラフ（勝率/スコア差など）'
      : tab === 'overall'
        ? '成長グラフ（総合）'
        : tab === 'typing'
          ? '成長グラフ（タイピング）'
          : '成長グラフ（タイム/正答率/速度）';

  return (
    <PlaceholderCard
      title={label}
      sub="API接続後：折れ線グラフ（移動平均切替）を表示"
    >
      <div className="h-56 md:h-72 rounded-2xl bg-[#14532d]/5 border border-[#14532d]/10 flex items-center justify-center">
        <div className="text-sm font-black text-[#14532d]/60 text-center px-6">
          ここにグラフ（プレイ回×指標）を表示します
          <div className="text-xs font-bold mt-2">
            ※ まずはUIの箱だけ配置しています
          </div>
        </div>
      </div>
    </PlaceholderCard>
  );
}

function SoloDetails() {
  return (
    <div className="space-y-4">
      <PlaceholderCard title="セット別サマリ（カード一覧）" sub="得意/苦手/最近/伸び順などで並べ替え（予定）">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white/70 rounded-2xl p-4 border border-[#14532d]/10">
              <div className="font-black text-[#14532d]">セット名</div>
              <div className="text-xs font-bold text-[#14532d]/60 mt-1">
                ベスト/平均/伸び/安定度 など
              </div>
            </div>
          ))}
        </div>
      </PlaceholderCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PlaceholderCard title="文字数ごとの間違いやすさ（棒グラフ）" sub="棒クリック → 間違えた文字一覧（予定）">
          <div className="h-48 rounded-2xl bg-[#14532d]/5 border border-[#14532d]/10 flex items-center justify-center">
            <div className="text-sm font-black text-[#14532d]/60 text-center px-6">
              文字数バケット別ミス率
              <div className="text-xs font-bold mt-2">クリックでミス文字TOP表示</div>
            </div>
          </div>
        </PlaceholderCard>

        <PlaceholderCard title="五角形チャート（暗記の得意）" sub="ローマ字/数字/漢字/ひらがな/記号（予定）">
          <div className="h-48 rounded-2xl bg-[#14532d]/5 border border-[#14532d]/10 flex items-center justify-center">
            <div className="text-sm font-black text-[#14532d]/60 text-center px-6">
              五角形レーダー
            </div>
          </div>
        </PlaceholderCard>

        <PlaceholderCard title="苦手（TOP）" sub="苦手単語TOP10 / 最近ミス / 克服（予定）">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between bg-white/70 rounded-xl px-4 py-2 border border-[#14532d]/10">
                <div className="font-black text-[#14532d]">word</div>
                <div className="text-xs font-black text-[#14532d]/60">ミス率 —%</div>
              </div>
            ))}
          </div>
        </PlaceholderCard>
      </div>
    </div>
  );
}

function BattleDetails() {
  return (
    <div className="space-y-4">
      <PlaceholderCard title="セット別：勝率バー" sub="勝率順／棒の太さで試合数（予定）">
        <div className="h-48 rounded-2xl bg-[#14532d]/5 border border-[#14532d]/10 flex items-center justify-center">
          <div className="text-sm font-black text-[#14532d]/60">ここにセット別勝率バー</div>
        </div>
      </PlaceholderCard>

      <PlaceholderCard title="試合履歴（カード一覧）" sub="日付/相手/セット/結果/スコア（予定）">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white/70 rounded-2xl p-4 border border-[#14532d]/10">
              <div className="flex items-center justify-between">
                <div className="font-black text-[#14532d]">VS opponent</div>
                <div className="text-xs font-black text-[#14532d]/60">WIN 5-3</div>
              </div>
              <div className="text-xs font-bold text-[#14532d]/60 mt-1">セット / 日付</div>
            </div>
          ))}
        </div>
      </PlaceholderCard>

      <PlaceholderCard title="試合詳細（リプレイ風）" sub="ラウンド推移グラフ＋傾向（予定）">
        <div className="h-56 rounded-2xl bg-[#14532d]/5 border border-[#14532d]/10 flex items-center justify-center">
          <div className="text-sm font-black text-[#14532d]/60">ここにラウンド推移グラフ</div>
        </div>
      </PlaceholderCard>
    </div>
  );
}

function OverallDetails() {
  return (
    <div className="space-y-4">
      <PlaceholderCard title="あなたの型（カード）" sub="スピード型/安定型/成長型/対戦型（予定）">
        <div className="bg-white/70 rounded-2xl p-4 border border-[#14532d]/10">
          <div className="font-black text-[#14532d] text-lg">あなたの型：—</div>
          <div className="text-xs font-bold text-[#14532d]/60 mt-2">
            指標をもとに“成長”が見える形で一言まとめます
          </div>
        </div>
      </PlaceholderCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PlaceholderCard title="五角形レーダー（総合）" sub="速さ/正確さ/安定度/成長/対戦力（予定）">
          <div className="h-56 rounded-2xl bg-[#14532d]/5 border border-[#14532d]/10 flex items-center justify-center">
            <div className="text-sm font-black text-[#14532d]/60">ここに総合レーダー</div>
          </div>
        </PlaceholderCard>

        <PlaceholderCard title="今週のハイライト" sub="伸びてるセット/苦手/熱い試合（予定）">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white/70 rounded-xl px-4 py-2 border border-[#14532d]/10">
                <div className="text-sm font-black text-[#14532d]">ハイライト</div>
                <div className="text-xs font-bold text-[#14532d]/60">短い説明</div>
              </div>
            ))}
          </div>
        </PlaceholderCard>
      </div>

      <PlaceholderCard title="次にやると良いこと（提案）" sub="1〜2個に絞って提案（予定）">
        <div className="space-y-2">
          <div className="bg-white/70 rounded-xl px-4 py-2 border border-[#14532d]/10">
            <div className="text-sm font-black text-[#14532d]">提案 1</div>
            <div className="text-xs font-bold text-[#14532d]/60">理由（短く）</div>
          </div>
          <div className="bg-white/70 rounded-xl px-4 py-2 border border-[#14532d]/10">
            <div className="text-sm font-black text-[#14532d]">提案 2</div>
            <div className="text-xs font-bold text-[#14532d]/60">理由（短く）</div>
          </div>
        </div>
      </PlaceholderCard>
    </div>
  );
}

function TypingDetails() {
  return (
    <div className="space-y-4">
      <PlaceholderCard title="キーヒートマップ" sub="ミスが多いキーを強調（予定）">
        <div className="h-56 rounded-2xl bg-[#14532d]/5 border border-[#14532d]/10 flex items-center justify-center">
          <div className="text-sm font-black text-[#14532d]/60">ここにキーボード表示</div>
        </div>
      </PlaceholderCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PlaceholderCard title="文字数ごとのタイポしやすさ（棒グラフ）" sub="棒クリック → 間違えた文字一覧（予定）">
          <div className="h-56 rounded-2xl bg-[#14532d]/5 border border-[#14532d]/10 flex items-center justify-center">
            <div className="text-sm font-black text-[#14532d]/60 text-center px-6">
              文字数バケット別タイポ率
              <div className="text-xs font-bold mt-2">クリックでミス文字TOP表示</div>
            </div>
          </div>
        </PlaceholderCard>

        <PlaceholderCard title="五角形チャート（タイピングの得意）" sub="ローマ字/数字/漢字/ひらがな/記号（予定）">
          <div className="h-56 rounded-2xl bg-[#14532d]/5 border border-[#14532d]/10 flex items-center justify-center">
            <div className="text-sm font-black text-[#14532d]/60">ここに五角形レーダー</div>
          </div>
        </PlaceholderCard>
      </div>

      <PlaceholderCard title="ミス分類" sub="置換/抜け/余計/連打（予定）">
        <div className="space-y-2">
          {['置換', '抜け', '余計', '連打'].map((t) => (
            <div key={t} className="flex items-center justify-between bg-white/70 rounded-xl px-4 py-2 border border-[#14532d]/10">
              <div className="font-black text-[#14532d]">{t}</div>
              <div className="text-xs font-black text-[#14532d]/60">—%</div>
            </div>
          ))}
        </div>
      </PlaceholderCard>
    </div>
  );
}

export default function Stats() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabKey>('solo');
  const [period, setPeriod] = useState<PeriodValue>('30');

  const [setQuery, setSetQuery] = useState('');
  const [setId, setSetId] = useState('all');

  const [opponentQuery, setOpponentQuery] = useState('');
  const [opponentId, setOpponentId] = useState('all');

  const [isPC, setIsPC] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 768px)').matches;
  });

  useEffect(() => {
    const handler = () => setIsPC(window.matchMedia('(min-width: 768px)').matches);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const tabs = useMemo(() => {
    const baseTabs: { key: TabKey; label: string }[] = [
      { key: 'solo', label: 'ソロ' },
      { key: 'battle', label: 'バトル' },
      { key: 'overall', label: '総合' },
    ];
    if (isPC) baseTabs.push({ key: 'typing', label: 'タイピング' });
    return baseTabs;
  }, [isPC]);

  const filteredSets = useMemo(() => {
    const q = setQuery.trim().toLowerCase();
    if (!q) return DUMMY_SETS;
    return DUMMY_SETS.filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }, [setQuery]);

  return (
    <div className="min-h-screen theme-garden-bg p-4 md:p-8">
      {/* Header (sticky): tabs + filters */}
      <div className="sticky top-0 z-30 pb-4">
        <div className="backdrop-blur bg-white/50 rounded-2xl shadow border border-[#14532d]/10 p-3 md:p-4">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="bg-white/80 hover:bg-white rounded-xl px-3 py-2 font-black text-[#14532d] shadow-sm"
              >
                ← ホーム
              </button>
              <div className="text-sm md:text-base font-black text-[#14532d]/70">
                成績（UI骨格）
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {/* Tabs */}
              <div className="flex flex-wrap gap-2">
                {tabs.map((t) => (
                  <TabButton
                    key={t.key}
                    active={tab === t.key}
                    label={t.label}
                    onClick={() => setTab(t.key)}
                  />
                ))}
              </div>

              {/* Filters (right) */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-black text-[#14532d]/70">期間</div>
                  <select
                    className="bg-white/80 rounded-xl px-3 py-2 font-bold text-[#14532d] shadow-sm border border-[#14532d]/10"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as PeriodValue)}
                  >
                    {PERIODS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-xs font-black text-[#14532d]/70">セット</div>
                  <div className="flex items-center gap-2">
                    <input
                      value={setQuery}
                      onChange={(e) => setSetQuery(e.target.value)}
                      placeholder="検索（仮）"
                      className="w-36 md:w-48 bg-white/80 rounded-xl px-3 py-2 font-bold text-[#14532d] shadow-sm border border-[#14532d]/10"
                    />
                    <select
                      className="bg-white/80 rounded-xl px-3 py-2 font-bold text-[#14532d] shadow-sm border border-[#14532d]/10"
                      value={setId}
                      onChange={(e) => setSetId(e.target.value)}
                    >
                      {filteredSets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {tab === 'battle' && (
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-black text-[#14532d]/70">相手</div>
                    <div className="flex items-center gap-2">
                      <input
                        value={opponentQuery}
                        onChange={(e) => setOpponentQuery(e.target.value)}
                        placeholder="検索（仮）"
                        className="w-28 md:w-40 bg-white/80 rounded-xl px-3 py-2 font-bold text-[#14532d] shadow-sm border border-[#14532d]/10"
                      />
                      <select
                        className="bg-white/80 rounded-xl px-3 py-2 font-bold text-[#14532d] shadow-sm border border-[#14532d]/10"
                        value={opponentId}
                        onChange={(e) => setOpponentId(e.target.value)}
                      >
                        <option value="all">全て</option>
                        <option value="dummy">（仮）Opponent</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs font-bold text-[#14532d]/60">
              ※ この画面は API 未接続の「UIの箱」です（成長カード → 成長グラフ → セット別詳細の順で固定）
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto space-y-6">
        <SectionTitle>① 成長カード</SectionTitle>
        <GrowthCards tab={tab} />

        <SectionTitle>② 成長グラフ</SectionTitle>
        <GrowthGraphBox tab={tab} />

        <SectionTitle>③ セット別詳細</SectionTitle>
        {tab === 'solo' && <SoloDetails />}
        {tab === 'battle' && <BattleDetails />}
        {tab === 'overall' && <OverallDetails />}
        {tab === 'typing' && <TypingDetails />}
      </div>
    </div>
  );
}
