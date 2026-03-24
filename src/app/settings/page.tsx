"use client";
import { useState, useEffect } from "react";
import { Save, CheckCircle2, Settings, DollarSign, Percent } from "lucide-react";

export default function SettingsPage() {
  const [exchangeRate, setExchangeRate] = useState("5.35");
  const [taxRate, setTaxRate] = useState("13");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedRate = localStorage.getItem("daigou_exchange_rate");
    const savedTax = localStorage.getItem("daigou_tax_rate");
    if (savedRate) setExchangeRate(savedRate);
    if (savedTax) setTaxRate(savedTax);
  }, []);

  const handleSave = () => {
    localStorage.setItem("daigou_exchange_rate", exchangeRate);
    localStorage.setItem("daigou_tax_rate", taxRate);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 p-4 md:p-8 h-full overflow-y-auto w-full relative">
      <div className="mb-8 pl-1 border-l-4 border-blue-500 rounded-sm">
        <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white pl-3 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-500" />系统核心配置
        </h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 pl-3 uppercase tracking-widest font-semibold">
           配置今日汇率与税率，参数将贯穿全局订单新建流程并永久封存入单据
        </p>
      </div>

      <div className="max-w-xl bg-white dark:bg-zinc-950 p-6 md:p-8 border border-gray-100 dark:border-zinc-800 rounded-3xl shadow-sm space-y-8 mt-6">
        <div>
          <label className="block text-sm font-black tracking-widest text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2 uppercase">
              <DollarSign className="w-4 h-4 text-emerald-500" /> 默认加币计算转换汇率 (CAD 直转 CNY)
          </label>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-emerald-500 font-bold">¥</span></div>
             <input type="number" step="0.01" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} className="w-full border border-emerald-200 dark:border-emerald-800/50 rounded-xl pl-10 pr-4 py-3.5 bg-emerald-50 dark:bg-emerald-900/10 outline-none focus:ring-2 focus:ring-emerald-500 transition text-lg font-black text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="text-[11px] font-bold text-gray-400 mt-2 tracking-widest uppercase">该参数仅会影响未来「新增」的订单，历史订单按照创建当时的快照锁定</p>
        </div>

        <div>
          <label className="block text-sm font-black tracking-widest text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2 uppercase">
              <Percent className="w-4 h-4 text-blue-500" /> 海外默认计税基础费率 (Ontario HST)
          </label>
          <div className="relative">
             <input type="number" step="0.5" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="w-full border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 bg-gray-50 dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-blue-500 transition text-lg font-black text-gray-700 dark:text-gray-200" />
             <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none"><span className="text-gray-400 font-black">%</span></div>
          </div>
        </div>

        <button onClick={handleSave} className="w-full bg-blue-600 text-white px-4 py-4 rounded-xl font-black text-sm tracking-widest hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2 mt-4 active:scale-95">
          {saved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {saved ? "终端参数已同步" : "写入系统本地云节点"}
        </button>
      </div>
    </div>
  );
}
