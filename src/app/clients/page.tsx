"use client";
import { useState, useEffect } from "react";
import { User, MapPin, Copy, Loader2, Edit, Trash2, CheckCircle2, X } from "lucide-react";
import { supabase } from "@/utils/supabase";

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", wechat: "", address: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

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

  const handleEditClient = (client: any) => {
    setEditingClientId(client.id);
    setForm({
      name: client.name,
      wechat: client.wechat || "",
      address: client.address
    });
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm("确定要删除该客户吗？此操作不可撤销，且可能影响历史订单关联记录。")) return;
    
    try {
      // 级联删除通常在 DB 层配置，这里手动清理地址
      await supabase.from('client_addresses').delete().eq('client_id', id);
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      await fetchClients();
    } catch (err) {
      console.error(err);
      alert("删除失败，该客户可能仍有未处理的订单记录。");
    }
  };

  const handleSaveClient = async () => {
    if (!form.name || !form.address) {
      alert("请填写客户姓名及默认收货地址！");
      return;
    }
    setIsSubmitting(true);
    
    try {
      if (editingClientId) {
        // 更新客户资料
        const { error: clientErr } = await supabase.from('clients')
          .update({ name: form.name, wechat_id: form.wechat })
          .eq('id', editingClientId);
        if (clientErr) throw clientErr;

        // 更新默认地址 (简化逻辑：直接更新第一条或全部清除后插回)
        const { error: addressErr } = await supabase.from('client_addresses')
          .update({ address_text: form.address })
          .eq('client_id', editingClientId);
        if (addressErr) throw addressErr;

      } else {
        // 1. 插入到客户基础资料表
        const { data: clientData, error: clientErr } = await supabase.from('clients')
          .insert([{ name: form.name, wechat_id: form.wechat }])
          .select().single();
          
        if (clientErr) throw clientErr;
        
        // 2. 将长文本地址作为默认地址绑定给该客户
        const { error: addressErr } = await supabase.from('client_addresses')
          .insert([{ client_id: clientData.id, address_text: form.address, is_default: true }]);
          
        if (addressErr) throw addressErr;
      }
      
      await fetchClients();
      setForm({ name: "", wechat: "", address: "" });
      setIsFormOpen(false);
      setEditingClientId(null);
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
    <div className="flex-1 p-4 md:p-8 h-full overflow-y-auto w-full max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">客户档案中心</h1>
          <p className="mt-1 text-sm font-bold text-gray-500 uppercase tracking-widest">私域核心履约资产库 / 零散地址自动化沉淀</p>
        </div>
        <button 
          onClick={() => {
            if (isFormOpen && editingClientId) {
               setEditingClientId(null);
               setForm({ name: "", wechat: "", address: "" });
            } else {
               setIsFormOpen(!isFormOpen);
            }
          }}
          disabled={isLoading}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
        >
          {isFormOpen ? (editingClientId ? "取消修改" : "收起面板") : <><User className="w-4 h-4"/> 新增合作客户</>}
        </button>
      </div>

      {isFormOpen && (
        <div className="mb-8 bg-white dark:bg-zinc-950 p-6 border border-blue-100 dark:border-blue-900/30 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 mb-6 text-blue-600">
             {editingClientId ? <Edit className="w-5 h-5"/> : <User className="w-5 h-5"/>}
             <h2 className="text-xl font-black tracking-tight">{editingClientId ? "正在修正现有客户档案" : "录入新合作客户资料"}</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">客户姓名 / 昵称 (必填)</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-900/50 outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all" placeholder="请输入用于识别客户的姓名..." />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">微信 ID / 联系方式 (选填)</label>
                <input value={form.wechat} onChange={e => setForm({...form, wechat: e.target.value})} className="w-full border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-900/50 outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all" placeholder="Wechat ID 或常用备注..." />
              </div>
            </div>
            
            <div>
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">默认收货地址快照 (必填)</label>
              <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full h-[124px] border border-gray-200 dark:border-zinc-800 rounded-xl p-4 bg-gray-50 dark:bg-zinc-900/50 outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm font-bold leading-relaxed transition-all" placeholder="刘德华 13912345678 北京市朝阳区 XXX 街道..." />
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button onClick={handleSaveClient} disabled={isSubmitting} className="bg-blue-600 flex items-center gap-2 text-white px-8 py-3 rounded-xl text-base font-black tracking-widest hover:bg-blue-700 hover:shadow-lg transition-all disabled:opacity-50">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              {editingClientId ? "确认同步修改" : "保存新客至云端"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 text-gray-400 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <p className="text-sm font-black uppercase tracking-widest">底层档案引擎抓取中...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col bg-white dark:bg-zinc-950 items-center justify-center p-20 border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm text-gray-500">
           <User className="w-16 h-16 mb-4 opacity-10" />
           <h3 className="font-black text-xl text-gray-900 dark:text-white mb-2 uppercase tracking-tight">暂无任何客户联锁</h3>
           <p className="text-sm font-medium opacity-60">点击右上角「新增合作客户」开启私域核心资产沉淀第一步。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map(client => (
            <div key={client.id} className="bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-900 rounded-2xl p-6 shadow-sm transition-all hover:shadow-xl hover:border-blue-200 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
              
              <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 w-12 h-12 rounded-xl flex items-center justify-center border border-blue-100 dark:border-blue-800/30">
                    <span className="text-xl font-black text-blue-600 dark:text-blue-400">{client.name[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white tracking-tight text-lg leading-tight">{client.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                       <span className="text-[10px] bg-gray-100 dark:bg-zinc-800 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase">ID {client.wechat || "NA"}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-1">
                   <button 
                     onClick={() => handleEditClient(client)} 
                     className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                     title="修正档案"
                   >
                     <Edit className="w-4 h-4" />
                   </button>
                   <button 
                     onClick={() => handleDeleteClient(client.id)}
                     className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                     title="销毁档案"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </div>
              
              <div className="space-y-4 relative z-10">
                <div className="bg-gray-50/50 dark:bg-zinc-900/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80 group/address relative">
                  <MapPin className="w-4 h-4 absolute top-3.5 left-3 text-gray-300" />
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-bold leading-relaxed pl-7 break-all line-clamp-2 min-h-[32px]">
                    {client.address}
                  </p>
                </div>
                
                <div className="flex justify-end pr-1">
                  <button 
                    onClick={() => handleCopy(client.address)} 
                    className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition"
                  >
                    <Copy className="w-3 h-3" /> 一键复制地址
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

