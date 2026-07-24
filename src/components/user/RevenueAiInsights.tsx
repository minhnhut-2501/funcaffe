'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Lock, Loader2, TrendingUp, AlertTriangle, Lightbulb, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canUseAI } from '@/lib/permission';
import { aiService, type AiRevenueAnalysis } from '@/services';
import { ApiError } from '@/lib/api-client';

export default function RevenueAiInsights() {
  const { user } = useAuth();
  const allowed = canUseAI(user?.subscription);
  const [data, setData] = useState<AiRevenueAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function analyze(refresh = false) {
    setLoading(true);
    setError('');
    try {
      const res = await aiService.revenueAnalysis(refresh);
      setData(res.analysis);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không thể phân tích lúc này. Thử lại sau nhé.');
    } finally {
      setLoading(false);
    }
  }

  // Gói không có AI: thẻ mời nâng cấp
  if (!allowed) {
    return (
      <div className="mb-6 rounded-2xl border border-line bg-white shadow-soft p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-bean-tint grid place-items-center shrink-0">
          <Lock className="w-5 h-5 text-bean" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-bean" /> Phân tích doanh thu bằng AI
          </p>
          <p className="text-sm text-cafe-500">Nâng cấp Pro Max để AI tự đọc số liệu và gợi ý cách tăng doanh thu.</p>
        </div>
        <Link href="/user/subscription" className="btn-primary text-sm shrink-0">Nâng cấp</Link>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-line bg-white shadow-soft overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
        <p className="font-semibold text-ink flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-bean" /> Phân tích doanh thu bằng AI
        </p>
        {data ? (
          <button onClick={() => analyze(true)} disabled={loading} className="btn-secondary text-sm flex items-center gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Phân tích lại
          </button>
        ) : (
          <button onClick={() => analyze(false)} disabled={loading} className="btn-primary text-sm flex items-center gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Đang phân tích…' : 'Phân tích ngay'}
          </button>
        )}
      </div>

      <div className="p-5">
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {!data && !error && !loading && (
          <p className="text-sm text-cafe-500 text-center py-4">
            Bấm <span className="font-semibold text-ink">Phân tích ngay</span> để AI đọc số liệu bán hàng và đưa ra nhận xét, cảnh báo và gợi ý.
          </p>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center gap-2 text-cafe-500 py-6 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" /> AI đang đọc số liệu…
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <p className="text-sm text-ink/90 leading-relaxed bg-sand rounded-xl p-3.5">{data.tom_tat}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InsightList title="Điểm nổi bật" icon={TrendingUp} tone="green" items={data.diem_noi_bat} />
              <InsightList title="Cảnh báo" icon={AlertTriangle} tone="red" items={data.canh_bao} />
              <InsightList title="Gợi ý hành động" icon={Lightbulb} tone="gold" items={data.goi_y_hanh_dong} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InsightList({ title, icon: Icon, tone, items }: {
  title: string; icon: typeof TrendingUp; tone: 'green' | 'red' | 'gold'; items: string[];
}) {
  const toneCls = {
    green: 'text-green-700 bg-green-50 border-green-100',
    red: 'text-red-700 bg-red-50 border-red-100',
    gold: 'text-gold-deep bg-gold/10 border-gold/20',
  }[tone];

  return (
    <div className={`rounded-xl border p-3.5 ${toneCls}`}>
      <p className="flex items-center gap-1.5 font-semibold text-sm mb-2">
        <Icon className="w-4 h-4" /> {title}
      </p>
      {(!items || items.length === 0) ? (
        <p className="text-xs opacity-70">Không có.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="text-sm text-ink/85 flex gap-1.5">
              <span className="opacity-60">•</span><span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
