"use client";
import { useState, useEffect } from "react";
import { User, MapPin, Copy, Loader2 } from "lucide-react";
import { supabase } from "@/utils/supabase";

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", wechat: "", address: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('clients')
      .select(`id, name, wechat_id, client_addresses ( address_text )`)
      .order('created_at', { ascending: false });
    
    if (data) {
      const formatted = data.map((c: any) => ({
        id: c.id,
        name: c.name,
        wechat: c.wechat_id,
        address: c.client_addresses?.[0]?.address_text || "暂无预设地址"
      }));
      setClients(formatted);
    }
    setIsLoading(false);
  };

  const handleAddClient = async () => {
    if (!form.name || !form.address) {
      alert("请填写客户姓名及默认收货地址！");
      return;
    }
    setIsSubmitting(true);
    
    try {
      // 1. 插入到客户基础资料表
      const { data: clientData, error: clientErr } = await supabase.from('clients')
        .insert([{ name: form.name, wechat_id: form.wechat }])
        .select().single();
        
      if (clientErr) throw clientErr;
      
      // 2. 将长文本地址作为默认地址绑定给该客户 (利用阶段1设计的不拆分存储结构)
      const { error: addressErr } = await supabase.from('client_addresses')
        .insert([{ client_id: clientData.id, address_text: form.address, is_default: true }]);
        
      if (addressErr) throw addressErr;
      
      await fetchClients();
      setForm({ name: "", wechat: "", address: "" });
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      alert("因网络或数据库限制操作失败，请重试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("地址复制成功！");
  };

  return (
    <div className="flex-1 p-4 md:p-8 h-full overflow-y-auto w-full">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">客户档案</h1>
          <p className="mt-1 text-sm text-gray-500">云端实时同步私域客户及免拆分长文本地址库</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          disabled={isLoading}
          className="bg-zinc-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-md font-medium text-sm hover:opacity-90 transition shadow-sm disabled:opacity-50"
        >
          {isFormOpen ? "取消新增" : "+ 新增客户"}
        </button>
      </div>

      {isFormOpen && (
        <div className="mb-8 bg-white dark:bg-zinc-950 p-6 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <h2 className="text-lg font-medium mb-4">录入新客户资料</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">姓名 / 昵称 (必填)</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 bg-gray-50 dark:bg-zinc-900 outline-none focus:border-blue-500" placeholder="客户标识" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">微信 ID (选填)</label>
              <input value={form.wechat} onChange={e => setForm({...form, wechat: e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 bg-gray-50 dark:bg-zinc-900 outline-none focus:border-blue-500" placeholder="搜索所用微信号" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">默认长文本地址 (必填，支持直接粘贴一整段)</label>
              <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full h-24 border border-gray-300 dark:border-zinc-700 rounded-md p-3 bg-gray-50 dark:bg-zinc-900 outline-none focus:border-blue-500 resize-none text-sm" placeholder="刘德华 13912345678 北京朝阳区..." />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleAddClient} disabled={isSubmitting} className="bg-blue-600 flex items-center gap-2 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? "同步中..." : "保存记录至云端"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 text-gray-400 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm">正在加载云端客户数据...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col bg-white dark:bg-zinc-950 items-center justify-center p-20 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm text-gray-500">
           <span className="text-4xl mb-4">👥</span>
           <h3 className="font-medium text-lg text-gray-900 dark:text-white mb-2">暂无客户记录</h3>
           <p className="text-sm">点击上方「新增客户」开始构建属于你的代购私域流量池。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {clients.map(client => (
            <div key={client.id} className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm transition hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900/50">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-full">
                    <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{client.name}</h3>
                    <p className="text-xs text-gray-500">WeChat: {client.wechat || "未填写"}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                  <p className="flex-1 break-all line-clamp-3 leading-relaxed">{client.address}</p>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={() => handleCopy(client.address)} className="text-xs flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                    <Copy className="w-3 h-3" /> 复制地址
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
