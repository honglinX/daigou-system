"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Tag, DollarSign, Loader2, Image as ImageIcon, Barcode, Hash, Palette, Scaling, ScanLine, UploadCloud, Plus, Package, CheckCircle2, X, Camera, PlusCircle, Search, Trash2, Edit2 } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { scanBarcodeFromImage } from "@/utils/ocr";

export default function ProductsPage() {
  const [groupedProducts, setGroupedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const [form, setForm] = useState({ 
    brand: "", name: "", article_number: "", image_url: "",
    price_cad: "", barcodes: "", color: "", size: "" 
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (data) {
       const groups: Record<string, any> = {};
       data.forEach(item => {
           const key = item.article_number || item.name;
           if (!groups[key]) {
               groups[key] = { id_key: key, brand: item.brand, name: item.name, article_number: item.article_number, image_url: item.image_url, skus: [] };
           }
           groups[key].skus.push({ id: item.id, color: item.color || '-', size: item.size || '-', price_cad: item.price_cad, barcodes: item.barcodes || [], stock_quantity: item.stock_quantity || 0 });
       });
       setGroupedProducts(Object.values(groups));
    }
    setIsLoading(false);
  };

  const filteredProducts = groupedProducts.filter(group => 
    group.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.article_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm("确定要永久删除这件商品吗？")) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert("删除失败: " + error.message);
    else fetchProducts();
  };

  const handleEdit = (id: string) => {
    // Find the product in all data or from grouped list
    // Finding it from the flattened list is easier.
    // We'll search by id in the grouped skus.
    let target = null;
    for (const group of groupedProducts) {
        target = group.skus.find((s: any) => s.id === id);
        if (target) {
            setForm({
                brand: group.brand || "",
                name: group.name || "",
                article_number: group.article_number || "",
                image_url: group.image_url || "",
                price_cad: target.price_cad.toString(),
                barcodes: target.barcodes.join(', '),
                color: target.color,
                size: target.size
            });
            setEditingId(id);
            setIsFormOpen(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            break;
        }
    }
  };

  const processOcrFile = async (blob: any) => {
      setIsRecognizing(true);
      try {
        const barcode = await scanBarcodeFromImage(blob);

        if (!barcode) {
            alert("未能识别出清晰条码，请调整角度重试");
            return;
        }

        setForm(prev => ({ ...prev, 
            barcodes: barcode || prev.barcodes
        }));
      } catch (err) { 
          console.error(err); 
          alert("识别过程发生错误");
      } finally { 
          setIsRecognizing(false); 
      }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 600;
            let width = img.width, height = img.height;
            if (width > height) { if (width > MAX_SIZE) { height = Math.round(height * (MAX_SIZE / width)); width = MAX_SIZE; } } 
            else { if (height > MAX_SIZE) { width = Math.round(width * (MAX_SIZE / height)); height = MAX_SIZE; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            setForm({ ...form, image_url: canvas.toDataURL('image/webp', 0.8) });
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-1 p-4 md:p-8 h-full overflow-y-auto w-full bg-slate-50 dark:bg-zinc-950">
      <div className="mb-10 flex justify-between items-center px-4">
        <div>
           <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none mb-1">代购商品档案</h1>
           <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest pl-0.5">Automated Barcode Scan v14.0</p>
        </div>
        <div className="flex-1 max-w-md mx-6 hidden md:block relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
                type="text" 
                placeholder="搜索名称、品牌或货号..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 dark:bg-zinc-900 border-none rounded-full px-12 py-3 text-xs font-bold focus:ring-2 focus:ring-blue-500 transition outline-none"
            />
        </div>
        <button onClick={() => {
            if (isFormOpen && editingId) {
                setEditingId(null);
                setForm({ brand: "", name: "", price_cad: "", article_number: "", barcodes: "", color: "", size: "", image_url: "" });
            }
            setIsFormOpen(!isFormOpen);
        }} className="bg-blue-600 text-white px-8 py-3.5 rounded-full font-black shadow-xl active:scale-95 transition text-xs tracking-widest uppercase">
            {isFormOpen ? "收起面板" : "+ 建档新货"}
        </button>
      </div>

      {/* 搜索框 (移动端专用) */}
      <div className="md:hidden px-4 mb-6 relative">
          <Search className="absolute left-8 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
              type="text" 
              placeholder="搜索档案..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl px-12 py-4 text-xs font-bold focus:ring-2 focus:ring-blue-500 transition shadow-sm outline-none"
          />
      </div>

      {isFormOpen && (
        <div className="mb-10 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-[3rem] shadow-2xl p-8" onPaste={(e) => {
            const file = e.clipboardData.items[0]?.getAsFile();
            if (file) processOcrFile(file);
        }}>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                <div className="lg:col-span-1 border-r border-slate-50 dark:border-zinc-800/50 pr-8">
                    <div onClick={() => fileInputRef.current?.click()} className="aspect-square bg-slate-50/50 dark:bg-zinc-800/30 rounded-[2.5rem] border-2 border-dashed border-slate-100 flex items-center justify-center cursor-pointer overflow-hidden group">
                        {form.image_url ? <img src={form.image_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" /> : <UploadCloud className="w-10 h-10 text-slate-200" />}
                        <input type="file" hidden ref={fileInputRef} onChange={handleImageSelect} />
                    </div>
                    <p className="mt-6 text-[9px] text-slate-400 font-bold uppercase text-center leading-loose tracking-[0.2em]">点击上传展示图<br/>或粘贴吊牌图 AI 智能匹配</p>
                </div>

                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="space-y-6">
                        <div><label className="text-[10px] font-black text-slate-400 mb-2 block uppercase tracking-widest pl-1">品牌</label><input type="text" value={form.brand} placeholder="Polo Ralph Lauren" onChange={e => setForm({...form, brand: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-bold outline-none" /></div>
                        <div><label className="text-[10px] font-black text-slate-400 mb-2 block uppercase tracking-widest pl-1">款式名称</label><input type="text" value={form.name} placeholder="麻花毛衣经典款" onChange={e => setForm({...form, name: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-bold outline-none" /></div>
                        <div><label className="text-[10px] font-black text-blue-500 mb-2 block uppercase tracking-widest pl-1">专柜货号 (Article No.)</label><input type="text" value={form.article_number} placeholder="200782777001" onChange={e => setForm({...form, article_number: e.target.value})} className="w-full px-6 py-4.5 bg-blue-50 text-blue-600 rounded-2xl font-black outline-none border border-blue-100 text-lg shadow-inner" /></div>
                    </div>
                    <div className="space-y-6">
                        <div><label className="text-[10px] font-black text-slate-400 mb-2 block uppercase tracking-widest pl-1">加币成本价</label><input type="number" value={form.price_cad} placeholder="0.00" onChange={e => setForm({...form, price_cad: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-bold outline-none" /></div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 mb-2 block uppercase tracking-widest pl-1">EAN / UPC 条码</label>
                            <div className="relative group">
                                <input type="text" value={form.barcodes} placeholder="884094387311" onChange={e => setForm({...form, barcodes: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-bold outline-none pr-12 transition" />
                                <input type="file" hidden accept="image/*" id="cam-spu" capture="environment" onChange={e => {
                                    if (e.target.files && e.target.files[0]) {
                                        processOcrFile(e.target.files[0]);
                                    }
                                }} />
                                <label htmlFor="cam-spu" className="absolute right-2.5 top-2.5 p-2 bg-blue-600 text-white rounded-xl cursor-pointer hover:bg-blue-700 transition shadow-lg shadow-blue-500/30"><Camera className="w-4 h-4"/></label>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div><label className="text-[10px] font-black text-slate-400 mb-2 block uppercase">颜色</label><input type="text" value={form.color} placeholder="..." onChange={e => setForm({...form, color: e.target.value})} className="w-full px-4 py-4.5 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-bold outline-none text-center" /></div>
                            <div><label className="text-[10px] font-black text-slate-400 mb-2 block uppercase">尺码</label><input type="text" value={form.size} placeholder="..." onChange={e => setForm({...form, size: e.target.value})} className="w-full px-4 py-4.5 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-bold outline-none text-center" /></div>
                        </div>
                    </div>
                    <div className="flex flex-col justify-end">
                        <button onClick={async () => {
                           if (!form.name) { alert("商品名称为必填项"); return; }
                           setIsSubmitting(true);
                           try {
                               const bccs = form.barcodes ? form.barcodes.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean) : [];
                               const payload = { 
                                   brand: form.brand || '无品牌', 
                                   name: form.name, 
                                   article_number: form.article_number || null, 
                                   image_url: form.image_url || '', 
                                   color: form.color || null, 
                                   size: form.size || null, 
                                   price_cad: parseFloat(form.price_cad) || 0, 
                                   barcodes: bccs 
                               };

                               if (editingId) {
                                   const { error } = await supabase.from('products').update(payload).eq('id', editingId);
                                   if (error) throw error;
                                   alert("✅ 档案更新成功");
                               } else {
                                   const { error } = await supabase.from('products').insert([{ ...payload, stock_quantity: 1 }]);
                                   if (error) throw error;
                                   alert("🎉 商品档案已成功入库");
                               }

                               await fetchProducts();
                               setForm({ brand: "", name: "", price_cad: "", article_number: "", barcodes: "", color: "", size: "", image_url: "" });
                               setEditingId(null);
                               setIsFormOpen(false);
                           } catch (err: any) {
                               console.error("Save error:", err);
                               alert(`执行失败: ${err.message || "未知错误"}`);
                           } finally {
                               setIsSubmitting(false);
                           }
                        }} disabled={isSubmitting || isRecognizing} className="w-full bg-blue-600 text-white py-5 rounded-[1.5rem] font-black text-xl shadow-[0_25px_50px_-12px_rgba(59,130,246,0.4)] active:scale-95 transition flex items-center justify-center gap-3 disabled:opacity-50">
                            {isRecognizing && <Loader2 className="animate-spin w-6 h-6" />}
                            {isRecognizing ? "正在识别条码..." : editingId ? "确认修改档案" : "正式档案入库"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* 列表渲染 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 px-4 pb-24">
          {filteredProducts.map(group => (
              <div key={group.id_key} className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-[3rem] p-7 hover:shadow-[0_45px_90px_rgba(0,0,0,0.06)] transition-all group animate-in zoom-in-95 duration-500">
                  <div className="aspect-square rounded-[2.25rem] bg-slate-50/50 dark:bg-zinc-800/40 overflow-hidden mb-7 ring-1 ring-slate-100 dark:ring-zinc-800">{group.image_url ? <img src={group.image_url} className="w-full h-full object-cover group-hover:scale-110 transition duration-1000" /> : <ImageIcon className="w-full h-full p-20 text-slate-100" />}</div>
                  <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4"><span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-blue-50 text-blue-600 tracking-wider group-hover:bg-blue-600 group-hover:text-white transition-colors">{group.brand}</span></div>
                      <h3 className="font-extrabold text-xl text-slate-900 dark:text-white mb-2 line-clamp-1">{group.name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 mb-6 tracking-widest uppercase">Article: {group.article_number}</p>
                      
                      <div className="space-y-2">{group.skus.map((sku: any) => (
                          <div key={sku.id} className={`flex items-center justify-between p-3.5 rounded-2xl ${sku.stock_quantity <= 1 ? 'bg-red-50/80 dark:bg-red-900/10 border-red-100/50 dark:border-red-900/20' : 'bg-slate-50/50 dark:bg-zinc-800/60 border-transparent'} text-[11px] font-bold border hover:border-slate-100 transition shadow-sm hover:shadow-md`}>
                              <span className={`${sku.stock_quantity <= 1 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-gray-300'} font-black`}>{sku.color} / {sku.size} <span className="text-blue-600 ml-2 font-black tracking-tight">${sku.price_cad}</span></span>
                              <div className="flex items-center gap-4">
                                  {sku.stock_quantity > 0 ? (
                                      <span className={`${sku.stock_quantity <= 1 ? 'text-red-600 bg-red-100 dark:bg-red-900/40' : 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'} px-2.5 py-1 rounded-lg font-black tracking-tighter shadow-sm`}>
                                          {sku.stock_quantity <= 1 ? '⚠️ 缺货临界' : '现货'}:{sku.stock_quantity}
                                      </span>
                                  ) : (
                                      <span className="text-slate-400 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg font-black tracking-tighter">断货</span>
                                  )}
                                  <div className="flex items-center gap-2">
                                      <button onClick={() => handleEdit(sku.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"><Edit2 className="w-3.5 h-3.5"/></button>
                                      <button onClick={() => handleDelete(sku.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"><Trash2 className="w-3.5 h-3.5"/></button>
                                      <button onClick={async () => {
                                          const add = prompt("入库件数:", "1");
                                          if (!add || isNaN(parseInt(add))) return;
                                          await supabase.from('products').update({ stock_quantity: (sku.stock_quantity || 0) + parseInt(add) }).eq('id', sku.id);
                                          fetchProducts();
                                      }} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-700 text-blue-600 rounded-lg shadow-sm border border-slate-100 dark:border-zinc-600 hover:scale-110 active:scale-95 transition font-black text-sm">+</button>
                                  </div>
                              </div>
                          </div>
                      ))}</div>
                  </div>
              </div>
          ))}
      </div>
      
      {isRecognizing && <div className="fixed bottom-10 inset-x-0 mx-auto w-fit bg-zinc-900 text-white px-10 py-6 rounded-full shadow-[0_35px_70px_rgba(0,0,0,0.5)] z-[100] flex items-center gap-5 animate-in fade-in slide-in-from-bottom-12"><ScanLine className="animate-pulse w-7 h-7 text-blue-400" /><span className="text-sm font-black uppercase tracking-[0.4em] pl-1">条码识别中...</span></div>}
    </div>
  );
}
