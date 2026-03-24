"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Tag, DollarSign, Loader2, Image as ImageIcon, Barcode, Hash, Palette, Scaling, ScanLine, UploadCloud, Plus, Package, CheckCircle2, X } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { recognizeProductTagFromImage } from "@/utils/ocr";

export default function ProductsPage() {
  const [groupedProducts, setGroupedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 建档模式：新增主商品 (SPU) vs 新增变体 (SKU)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [skuModalGroup, setSkuModalGroup] = useState<any | null>(null);

  // 新增主商品表单 (SPU+首个SKU)
  const [form, setForm] = useState({ 
    brand: "", name: "", article_number: "", image_url: "",
    price_cad: "", barcodes: "", color: "", size: "" 
  });
  
  // 新增变体表单 (仅SKU)
  const [skuForm, setSkuForm] = useState({
    color: "", size: "", barcodes: "", price_cad: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
       // SPU-SKU 前端聚类算法：按货号或商品名聚合成一款，其下包含多个具体尺码颜色的 SKU
       const groups: Record<string, any> = {};
       data.forEach(item => {
           // 优先匹配货号聚类，若无货号则按名字聚类
           const key = item.article_number || item.name;
           if (!groups[key]) {
               groups[key] = {
                   id_key: key,
                   brand: item.brand,
                   name: item.name,
                   article_number: item.article_number,
                   image_url: item.image_url,
                   skus: []
               };
           } else {
               // 若主图为空跑后续发现有图，则借用变体图
               if (!groups[key].image_url && item.image_url) groups[key].image_url = item.image_url;
               // 若品牌名称为空发现有后续，借用
               if ((!groups[key].brand || groups[key].brand === '无品牌' || groups[key].brand === '特例抓单') && item.brand) {
                   groups[key].brand = item.brand;
               }
           }
           
           groups[key].skus.push({
               id: item.id,
               color: item.color || '-',
               size: item.size || '-',
               price_cad: item.price_cad,
               barcodes: item.barcodes || []
           });
       });
       setGroupedProducts(Object.values(groups));
    }
    setIsLoading(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 400;
            let width = img.width, height = img.height;
            if (width > height) {
                if (width > MAX_SIZE) { height = Math.round(height * (MAX_SIZE / width)); width = MAX_SIZE; }
            } else {
                if (height > MAX_SIZE) { width = Math.round(width * (MAX_SIZE / height)); height = MAX_SIZE; }
            }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            setForm({ ...form, image_url: canvas.toDataURL('image/webp', 0.8) });
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 添加首款商品 (SPU + SKU)
  const handleAddSpu = async () => {
    if (!form.name || !form.price_cad) {
      alert("请填写商品款名与成本原价！"); return;
    }
    setIsSubmitting(true);
    const barcodesArray = form.barcodes ? form.barcodes.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean) : [];
    
    try {
      const { error } = await supabase.from('products').insert([{
        brand: form.brand || '无品牌',
        name: form.name,
        article_number: form.article_number || null,
        image_url: form.image_url || '',
        color: form.color || null,
        size: form.size || null,
        price_cad: parseFloat(form.price_cad) || 0,
        barcodes: barcodesArray
      }]);
      if (error) throw error;
      await fetchProducts();
      setForm({ brand: "", name: "", price_cad: "", article_number: "", barcodes: "", color: "", size: "", image_url: "" });
      setIsFormOpen(false);
    } catch (err: any) {
      console.error(err);
      alert("创建主商品档案失败！");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 往现有款下添加尺码/颜色变体 (Add SKU)
  const handleAddSku = async () => {
     if (!skuForm.price_cad) {
         alert("请填写该变体的专柜成本加币价！"); return;
     }
     setIsSubmitting(true);
     const barcodesArray = skuForm.barcodes ? skuForm.barcodes.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean) : [];
     
     try {
         const { error } = await supabase.from('products').insert([{
            brand: skuModalGroup.brand,
            name: skuModalGroup.name,
            article_number: skuModalGroup.article_number,
            image_url: skuModalGroup.image_url, // 继承主图
            color: skuForm.color || null,
            size: skuForm.size || null,
            price_cad: parseFloat(skuForm.price_cad) || 0,
            barcodes: barcodesArray
         }]);
         if (error) throw error;
         await fetchProducts();
         setSkuForm({ color: "", size: "", barcodes: "", price_cad: "" });
         setSkuModalGroup(null);
     } catch (err) {
         console.error(err);
         alert("追加 SKU 变体失败！");
     } finally {
         setIsSubmitting(false);
     }
  };

  const handlePasteTag = useCallback(async (e: React.ClipboardEvent, isSpuMode: boolean = true) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          e.preventDefault();
          setIsRecognizing(true);
          try {
            const text = await recognizeProductTagFromImage(blob);
            const priceMatch = text.match(/(?:CAD|CA\$|[$])?\s*(\d+\.\d{2})/i) || text.match(/(?:CAD|CA\$|[$])\s*(\d+)/i);
            const sizeMatch = text.match(/\b(?:SIZE|US|UK|EUR)?\s*:?\s*(XXS|XS|S|M|L|XL|XXL|OS|\d{1,2})\b/i);
            const barcodeMatches = text.match(/\b\d{10,14}\b/g);
            const articleMatch = text.match(/\b([A-Z0-9]{5,12})\b/g);
            
            if (isSpuMode) {
                let parsed = { ...form };
                if (priceMatch) parsed.price_cad = priceMatch[1];
                if (sizeMatch && !parsed.size) parsed.size = sizeMatch[1].toUpperCase();
                if (barcodeMatches) parsed.barcodes = barcodeMatches.join(', ');
                if (articleMatch) {
                    const validArticles = articleMatch.filter(a => /[A-Z]/.test(a) && /[0-9]/.test(a));
                    if (validArticles.length > 0) parsed.article_number = validArticles[0];
                }
                setForm(parsed);
            } else {
                let parsed = { ...skuForm };
                if (priceMatch) parsed.price_cad = priceMatch[1];
                if (sizeMatch && !parsed.size) parsed.size = sizeMatch[1].toUpperCase();
                if (barcodeMatches) parsed.barcodes = barcodeMatches.join(', ');
                setSkuForm(parsed);
            }
          } catch (err) {
            alert("吊牌识别失败，核心数据提取异常");
          } finally {
            setIsRecognizing(false);
          }
        }
      }
    }
  }, [form, skuForm]);

  return (
    <div className="flex-1 p-4 md:p-8 h-full overflow-y-auto w-full relative">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">服装级商品款型档案 (SPU/SKU)</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">建立一套货号，无限衍生多颜色与尺码的精准 SKU，完美匹配条码扫货流</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          disabled={isLoading}
          className="bg-blue-600 dark:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold text-sm tracking-wide hover:bg-blue-700 transition shadow-sm disabled:opacity-50 shrink-0 border border-transparent shadow-blue-500/20"
        >
          {isFormOpen ? "取消新建服饰款式" : "+ 新建主商品款型 (SPU)"}
        </button>
      </div>

      {isFormOpen && (
        <div className="mb-8 bg-white dark:bg-zinc-950 border border-blue-100 dark:border-blue-900/30 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-5 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/30">
             <h2 className="text-lg font-black flex items-center gap-2 tracking-tight text-gray-900 dark:text-white">
               <Package className="w-5 h-5 text-blue-500" />
               录入主款型档案图谱
             </h2>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* 上传实物图 */}
            <div className="lg:col-span-1 border-r border-transparent lg:border-gray-100 dark:lg:border-zinc-800 lg:pr-6 flex flex-col gap-3">
              <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase">实拍首图 (极低算力压缩)</label>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-square border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl overflow-hidden cursor-pointer hover:border-blue-400 transition bg-gray-50 dark:bg-zinc-900 flex items-center justify-center relative group"
              >
                {form.image_url ? (
                   <>
                     <img src={form.image_url} alt="预览" className="w-full h-full object-cover" />
                     <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center text-white text-sm font-bold tracking-widest">点击置换</div>
                   </>
                ) : (
                  <div className="flex flex-col items-center text-gray-400">
                    <UploadCloud className="w-8 h-8 opacity-50 mb-3" />
                    <span className="text-xs font-bold tracking-widest">上传基础主图</span>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 content-start">
              <div className="lg:col-span-3"><h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-zinc-800 pb-2 uppercase tracking-widest">SPU 主型号基底数据</h3></div>
              
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1"><Tag className="w-3.5 h-3.5"/>品牌</label>
                <input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-950 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" placeholder="例如 Lululemon" />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1.5 text-blue-600">商品通称 (必填)</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-950 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold" placeholder="例如 Define 紧身修身运动外套" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1 text-blue-600"><Hash className="w-3.5 h-3.5"/>系统关联货号</label>
                <input value={form.article_number} onChange={e => setForm({...form, article_number: e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-950 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono uppercase font-bold" placeholder="LW3CQ3S" />
              </div>

              <div className="lg:col-span-3 mt-3"><h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-zinc-800 pb-2 uppercase tracking-widest relative">初始化首件变种 (SKU 第 1 号)<span className="absolute right-0 top-0 text-[10px] text-gray-400 font-normal">支持此区域选中后直贴微信吊牌截图提取</span></h3></div>
              
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4" onPaste={(e) => handlePasteTag(e, true)}>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-400 mb-1 flex items-center gap-1 uppercase tracking-widest"><Palette className="w-3 h-3"/> 指定颜色</label>
                    <input value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 rounded bg-gray-50 dark:bg-zinc-900 px-3 py-1.5 text-sm" placeholder="骨白" />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-400 mb-1 flex items-center gap-1 uppercase tracking-widest"><Scaling className="w-3 h-3"/> 尺码/Size</label>
                    <input value={form.size} onChange={e => setForm({...form, size: e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 rounded bg-gray-50 dark:bg-zinc-900 px-3 py-1.5 text-sm uppercase" placeholder="4 或 XS" />
                  </div>
                  <div className="md:col-span-1">
                     <label className="block text-[10px] font-bold text-gray-400 mb-1 flex items-center gap-1 uppercase tracking-widest text-emerald-600"><DollarSign className="w-3 h-3"/> 原价 (CAD)</label>
                     <input type="number" step="0.01" value={form.price_cad} onChange={e => setForm({...form, price_cad: e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 rounded bg-gray-50 dark:bg-zinc-900 px-3 py-1.5 text-sm font-mono text-emerald-700 dark:text-emerald-400 font-bold" placeholder="118.00" />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-400 mb-1 flex items-center gap-1 uppercase tracking-widest"><Barcode className="w-3 h-3"/> 绑定单向条码</label>
                    <input value={form.barcodes} onChange={e => setForm({...form, barcodes: e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 rounded bg-gray-50 dark:bg-zinc-900 px-3 py-1.5 text-[11px] font-mono tracking-widest" placeholder="12345678" />
                  </div>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 bg-gray-50 dark:bg-zinc-900/30 border-t border-gray-100 dark:border-zinc-800 flex justify-end">
            <button onClick={handleAddSpu} disabled={isSubmitting} className="bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-black tracking-widest hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20 transition disabled:opacity-50 flex items-center gap-2 border border-transparent">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} 共生建档 (SPU+第一枚SKU)
            </button>
          </div>
        </div>
      )}

      {/* SPU -> SKU Grouped List Display */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-32 text-gray-400 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <p className="text-sm font-bold tracking-widest uppercase">计算组装多维 SPU/SKU 中...</p>
        </div>
      ) : groupedProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-32 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-3xl bg-white dark:bg-zinc-950 shadow-sm text-gray-400">
           <Package className="w-16 h-16 mb-4 opacity-20" />
           <h3 className="font-black text-xl text-gray-900 dark:text-white mb-2">图片货柜空空如也</h3>
           <p className="text-sm font-medium text-gray-500 dark:text-gray-400 text-center">系统检测到暂无款式商品存在。你的首个商品会自动成为模板。</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedProducts.map((group, groupIdx) => (
            <div key={groupIdx} className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition duration-300">
              <div className="flex flex-col md:flex-row border-b border-gray-100 dark:border-zinc-800">
                 {/* Left SPU Info */}
                 <div className="md:w-1/3 xl:w-1/4 bg-gray-50 dark:bg-zinc-900/40 p-6 flex flex-col items-center md:items-start border-b md:border-b-0 md:border-r border-gray-100 dark:border-zinc-800">
                    <div className="w-32 h-32 md:w-full md:h-auto md:aspect-square bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-sm overflow-hidden mb-5 flex justify-center items-center shrink-0">
                       {group.image_url ? <img src={group.image_url} alt={group.name} className="w-full h-full object-cover"/> : <ImageIcon className="w-8 h-8 opacity-20 text-gray-500" />}
                    </div>
                    <div className="flex flex-col items-center md:items-start w-full text-center md:text-left">
                       <span className="text-[10px] font-black tracking-widest text-blue-600 dark:text-blue-500 uppercase bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-sm mb-2">{group.brand}</span>
                       <h3 className="font-black text-lg text-gray-900 dark:text-white leading-tight mb-2 tracking-tight">{group.name}</h3>
                       {group.article_number && (
                           <span className="text-xs font-mono font-bold text-gray-500 bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center gap-1.5 self-center md:self-start">
                              <Hash className="w-3.5 h-3.5" />{group.article_number}
                           </span>
                       )}
                    </div>
                 </div>

                 {/* Right SKU Table */}
                 <div className="md:w-2/3 xl:w-3/4 p-0 md:p-6 flex flex-col w-full overflow-hidden">
                    <div className="flex items-center justify-between px-6 md:px-0 py-4 md:py-0 mb-0 md:mb-5">
                       <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                           <GridIcon className="w-4 h-4 text-blue-500" />
                           该款式下的变体序列 (SKUs)
                           <span className="bg-gray-100 dark:bg-zinc-800 text-gray-500 text-[10px] px-2 py-0.5 rounded-full font-bold">{group.skus.length}</span>
                       </h4>
                       <button 
                         onClick={() => setSkuModalGroup(group)}
                         className="flex items-center gap-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                       >
                         <Plus className="w-3 h-3" /> 新增衍生变体
                       </button>
                    </div>

                    <div className="overflow-x-auto border-y md:border border-gray-100 dark:border-zinc-800 md:rounded-xl">
                      <table className="min-w-full text-left text-[13px] text-gray-500 bg-white dark:bg-zinc-950">
                         <thead className="bg-gray-50/80 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-800">
                           <tr>
                              <th className="px-5 py-3 font-bold text-gray-400 uppercase tracking-widest text-[10px]">规格颜色</th>
                              <th className="px-5 py-3 font-bold text-gray-400 uppercase tracking-widest text-[10px]">款式尺码</th>
                              <th className="px-5 py-3 font-bold text-gray-400 uppercase tracking-widest text-[10px]">关联扫码ID</th>
                              <th className="px-5 py-3 font-bold text-gray-400 uppercase tracking-widest text-[10px] text-right">进货原价</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50">
                           {group.skus.map((sku: any) => (
                              <tr key={sku.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition group/row">
                                 <td className="px-5 py-3 font-bold text-gray-800 dark:text-gray-200">
                                   <div className="flex items-center gap-2"><Palette className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" /> {sku.color}</div>
                                 </td>
                                 <td className="px-5 py-3 font-black text-gray-900 dark:text-white tracking-widest">
                                   <div className="flex items-center gap-2"><Scaling className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" /> {sku.size}</div>
                                 </td>
                                 <td className="px-5 py-3">
                                   <div className="flex flex-wrap gap-1.5">
                                      {sku.barcodes.length > 0 ? sku.barcodes.map((code: string, idx: number) => (
                                          <span key={idx} className="bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 px-2 py-0.5 rounded text-[10px] font-mono select-all">
                                             {code}
                                          </span>
                                      )) : <span className="text-gray-300 dark:text-gray-600 italic">无挂载</span>}
                                   </div>
                                 </td>
                                 <td className="px-5 py-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                                    CA$ {parseFloat(sku.price_cad).toFixed(2)}
                                 </td>
                              </tr>
                           ))}
                         </tbody>
                      </table>
                    </div>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SKU 追加变体悬浮窗 Modal */}
      {skuModalGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-900/50">
                <h3 className="text-lg font-black flex items-center gap-2 text-gray-900 dark:text-white"><Plus className="w-5 h-5 text-blue-600"/> 为当前款式分裂新 SKU</h3>
                <button onClick={() => { setSkuModalGroup(null); setSkuForm({ color: "", size: "", barcodes: "", price_cad: "" }) }} className="text-gray-400 hover:text-black dark:hover:text-white transition p-2 bg-white dark:bg-zinc-800 rounded-full border border-gray-200 dark:border-zinc-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                 {/* 父款式卡片概览 */}
                 <div className="mb-6 flex gap-4 bg-gray-50/80 dark:bg-zinc-900/40 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 items-center">
                   <div className="w-14 h-14 shrink-0 rounded-xl bg-white border border-gray-200 dark:border-zinc-700 shadow-sm overflow-hidden flex items-center justify-center">
                     {skuModalGroup.image_url ? <img src={skuModalGroup.image_url} className="w-full h-full object-cover"/> : <ImageIcon className="w-5 h-5 text-gray-300"/>}
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-0.5">继承以下基底档案</p>
                     <p className="text-sm font-black text-gray-900 dark:text-white truncate">{skuModalGroup.name}</p>
                     <p className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 max-w-max bg-blue-50 dark:bg-blue-900/20 px-1 py-0.5 rounded mt-1">#{skuModalGroup.article_number || '无货号基础档案'}</p>
                   </div>
                 </div>

                 {/* 可选 OCR */}
                 <div className="mb-5 relative" onPaste={(e) => handlePasteTag(e, false)}>
                    <div className="absolute inset-0 border-2 border-dashed border-transparent hover:border-blue-400/50 rounded-xl pointer-events-none transition duration-300"></div>
                 </div>

                 <div className="grid grid-cols-2 gap-5" onPaste={(e) => handlePasteTag(e, false)}>
                    <div className="col-span-2 relative text-center pb-2 cursor-pointer group" tabIndex={0}>
                       <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400 bg-gray-50/80 dark:bg-zinc-900 px-3 py-1 rounded-full border border-gray-200 dark:border-zinc-800 border-dashed group-hover:bg-blue-50 group-hover:text-blue-500 transition">支持此处直接 Ctrl+V 分析实体吊牌补全变体参数</span>
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1 uppercase tracking-widest"><Palette className="w-3 h-3"/> 新变体外观颜色</label>
                      <input value={skuForm.color} onChange={e => setSkuForm({...skuForm, color: e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-900 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="例如骨白色" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1 uppercase tracking-widest"><Scaling className="w-3 h-3"/> 新变体尺码/Size</label>
                      <input value={skuForm.size} onChange={e => setSkuForm({...skuForm, size: e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-900 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-black uppercase" placeholder="例如 L / 4码" />
                    </div>
                    
                    <div className="col-span-2">
                       <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-500 mb-1.5 flex items-center gap-1 uppercase tracking-widest"><DollarSign className="w-3 h-3"/> 该尺码专属进货原价 (CAD 必填)</label>
                       <input type="number" step="0.01" value={skuForm.price_cad} onChange={e => setSkuForm({...skuForm, price_cad: e.target.value})} className="w-full border border-emerald-200 dark:border-emerald-800/50 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 px-4 py-2.5 text-base font-mono font-bold text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="118.00" />
                    </div>

                    <div className="col-span-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
                      <label className="block text-[11px] font-bold text-gray-400 mb-2 flex items-center gap-1 uppercase tracking-widest"><Barcode className="w-3 h-3"/> 附加机器辨识条码 (可选多个, 逗号分隔)</label>
                      <input value={skuForm.barcodes} onChange={e => setSkuForm({...skuForm, barcodes: e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 px-4 py-2 text-xs font-mono tracking-widest shadow-inner outline-none focus:ring-1 focus:ring-blue-500" placeholder="扫描枪条码录入" />
                    </div>
                 </div>

                 {isRecognizing && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm flex justify-center items-center flex-col z-10 rounded-3xl">
                       <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-3" />
                       <span className="font-black tracking-widest text-blue-700">吊牌数据裂变装载中...</span>
                    </div>
                 )}
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 flex gap-4">
                 <button onClick={() => { setSkuModalGroup(null); setSkuForm({ color: "", size: "", barcodes: "", price_cad: "" }) }} className="w-1/3 py-3.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-sm tracking-widest hover:bg-gray-50 transition shadow-sm">
                    暂不分裂
                 </button>
                 <button 
                  onClick={handleAddSku}
                  disabled={isSubmitting}
                  className="w-2/3 py-3.5 bg-blue-600 text-white rounded-xl font-black text-sm tracking-widest hover:bg-blue-700 transition disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-blue-500/30"
                 >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5 text-blue-300" />}
                    确认扩容该尺码子变体
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

// Custom GridIcon missing from lucid-react generic import
function GridIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}
