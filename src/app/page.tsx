"use client";
import { useState, useEffect, useCallback } from "react";
import { ArrowUpRight, ArrowDownRight, DollarSign, Package, ShoppingCart, Loader2, ScanLine, Image as ImageIcon, CheckCircle2, X } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { recognizeProductTagFromImage } from "@/utils/ocr";

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState([
    { name: "未付余款预估 (CNY)", value: "¥0.00", change: "待回款", trend: "up", icon: DollarSign },
    { name: "待采购商品总件数", value: "0", change: "急需扫货", trend: "down", icon: ShoppingCart },
    { name: "在途物流包裹数量", value: "0", change: "安全运送中", trend: "up", icon: Package },
    { name: "全盘利润严算 (CNY)", value: "¥0.00", change: "系统自动计算", trend: "up", icon: DollarSign },
  ]);
  
  const [groupedPurchaseList, setGroupedPurchaseList] = useState<any[]>([]);
  const [recentStoredList, setRecentStoredList] = useState<any[]>([]);
  
  const [purchasingProduct, setPurchasingProduct] = useState<any | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [scannedData, setScannedData] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    // Core query: Pull ALL historical order data (and embedded associated entities) for exact profit & metric calculation
    const { data: allOrders } = await supabase.from('orders')
      .select(`
        id, 
        status, 
        total_cny, 
        exchange_rate,
        clients(name),
        order_items( quantity, unit_price_cad, products(name, price_cad, image_url) )
      `)
      .order('created_at', { ascending: false });

    if (allOrders) {
      const shippingCount = allOrders.filter(o => ['shipped_intl', 'shipped_local'].includes(o.status)).length;
      const unpaidCny = allOrders.filter(o => o.status !== 'delivered').reduce((acc, curr) => acc + (Number(curr.total_cny) || 0), 0);
      
      // Calculate Exact Realized Profit
      let calculatedProfitCny = 0;
      allOrders.forEach(o => {
          const rev = Number(o.total_cny) || 0;
          const rate = Number(o.exchange_rate) || 5.35;
          let totalCostCad = 0;
          // Sum cost across multiple items in the order
          if (o.order_items) {
             o.order_items.forEach((oi: any) => {
                 const itemCost = Number(oi.products?.price_cad) || 0;
                 const qty = Number(oi.quantity) || 1;
                 totalCostCad += itemCost * qty;
             });
          }
          const profit = rev - (totalCostCad * rate);
          if (!isNaN(profit)) calculatedProfitCny += profit;
      });
      
      // 聚合多商品清单
      const groups: Record<string, { productName: string, count: number, orderIds: string[], clients: string[], image: string }> = {};
      const stored: any[] = [];

      let totalPendingItemsCount = 0;

      allOrders.forEach(order => {
        const cName = (order.clients as any)?.name || "未知客户";
        
        if (order.order_items && order.order_items.length > 0) {
            order.order_items.forEach((oi: any) => {
                const productData = oi.products;
                const pName = productData?.name || "未归档特例商品";
                const pImage = productData?.image_url || "";
                const qty = Number(oi.quantity) || 1;
                
                if (order.status === 'pending') {
                  totalPendingItemsCount += qty;
                  if (!groups[pName]) {
                    groups[pName] = { productName: pName, count: 0, orderIds: [], clients: [], image: pImage };
                  }
                  groups[pName].count += qty;
                  if (!groups[pName].orderIds.includes(order.id)) groups[pName].orderIds.push(order.id);
                  if (!groups[pName].clients.includes(cName)) groups[pName].clients.push(cName);
                } else if (order.status === 'stored') {
                  // Push merely for display logs
                  stored.push({ ...order, productName: `${pName} (x${qty})`, clientName: cName, image: pImage });
                }
            });
        }
      });
      
      setStats([
        { name: "未付余款预估 (CNY)", value: `¥${unpaidCny.toFixed(2)}`, change: "未收回票款", trend: unpaidCny > 0 ? "up" : "down", icon: DollarSign },
        { name: "待采购总件数", value: `${totalPendingItemsCount} 件`, change: totalPendingItemsCount > 0 ? "急需扫货跑腿" : "无积压任务", trend: totalPendingItemsCount > 0 ? "down" : "up", icon: ShoppingCart },
        { name: "在途物流包裹", value: `${shippingCount} 票`, change: "跨国物流运送中", trend: "up", icon: Package },
        { name: "全盘纯利核算 (CNY)", value: `¥${calculatedProfitCny.toFixed(2)}`, change: "紧密挂钩当日汇率", trend: calculatedProfitCny > 0 ? "up" : "down", icon: DollarSign },
      ]);

      setGroupedPurchaseList(Object.values(groups));
      setRecentStoredList(stored.slice(0, 5));
    }
    
    setIsLoading(false);
  };

  const handlePasteTag = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          e.preventDefault();
          setIsRecognizing(true);
          try {
            const text = await recognizeProductTagFromImage(blob);
            let price = text.match(/(?:CAD|CA\$|[$])?\s*(\d+\.\d{2})/i)?.[1] || "";
            let size = text.match(/\b(?:SIZE|US|UK|EUR)?\s*:?\s*(XXS|XS|S|M|L|XL|XXL|OS|\d{1,2})\b/i)?.[1]?.toUpperCase() || "";
            let barcode = text.match(/\b\d{10,14}\b/)?.[0] || "";

            setScannedData({ price, size, barcode, raw: text });
          } catch (err) {
            console.error(err);
            alert("吊牌解析失败，请确保截图包含清晰文字。");
          } finally {
            setIsRecognizing(false);
          }
        }
      }
    }
  }, []);

  const handleConfirmPurchase = async () => {
    if (!purchasingProduct || purchasingProduct.orderIds.length === 0) return;
    setIsSubmitting(true);
    
    try {
      const targetOrderId = purchasingProduct.orderIds[purchasingProduct.orderIds.length - 1];
      
      const { error } = await supabase.from('orders')
        .update({ status: 'purchased' })
        .eq('id', targetOrderId);

      if (error) throw error;
      
      alert(scannedData ? `✅ 采购成功！实付截获: CAD ${scannedData.price || "未查明"}。该状态已更新为【已采购】。` : "✅ 无吊牌盲扫成功！单品单号状态已更新。");
      
      setPurchasingProduct(null);
      setScannedData(null);
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert("同步采购状态失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8 h-full overflow-y-auto w-full relative">
      <div className="mb-8 pl-1 border-l-4 border-blue-500 rounded-sm">
        <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white pl-3">全盘系统看板</h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 pl-3 uppercase tracking-widest font-semibold flex items-center gap-2">
           实时严密测算系统级利润与多商品流转 <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded animate-pulse">Online</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="overflow-hidden rounded-2xl bg-white p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 dark:bg-zinc-950 dark:border-zinc-800 transition-all hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-gray-400 dark:text-gray-500 uppercase">{stat.name}</p>
                  <p className="mt-3 text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-blue-500" /> : stat.value}
                  </p>
                </div>
                <div className={`rounded-full p-3 ${stat.name.includes("利润") ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-400' : 'bg-gray-50 text-gray-400 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800'}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 flex items-center text-xs">
                {stat.trend === "up" ? <ArrowUpRight className="mr-1 h-3.5 w-3.5 text-emerald-500" /> : <ArrowDownRight className="mr-1 h-3.5 w-3.5 text-blue-500" />}
                <span className={stat.trend === "up" ? "text-emerald-600 font-bold" : "text-blue-600 font-bold"}>
                  {stat.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        
        <div className="lg:col-span-3 rounded-2xl bg-white p-6 shadow-sm border border-blue-100 dark:bg-zinc-950 dark:border-blue-900/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 dark:opacity-5 pointer-events-none"></div>
          
          <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2 relative z-10">
             <ShoppingCart className="w-5 h-5 text-blue-600" /> 
             图文集中多维采购清单 
             <span className="bg-blue-600 text-white text-[11px] px-2.5 py-0.5 rounded-full font-bold ml-auto shrink-0 shadow-sm border border-blue-700">
               {groupedPurchaseList.length} 款急需扫货
             </span>
          </h2>
          
          <div className="mt-6 flex flex-col gap-4 relative z-10">
            {isLoading ? (
               <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto my-12" />
            ) : groupedPurchaseList.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl bg-gray-50/50 dark:bg-zinc-900/10">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
                <p className="text-sm font-medium tracking-wide">太完美了，所有的多件订单都已经采购完毕！</p>
              </div>
            ) : groupedPurchaseList.map((group, i) => (
              <div 
                key={i} 
                onClick={() => setPurchasingProduct(group)}
                className="group flex flex-col sm:flex-row gap-4 rounded-xl border border-gray-100 p-4 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md bg-white dark:bg-zinc-950"
              >
                <div className="w-20 h-20 shrink-0 rounded-lg bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 overflow-hidden flex items-center justify-center">
                  {group.image ? (
                     <img src={group.image} className="w-full h-full object-cover" alt="thumb" />
                  ) : (
                     <ImageIcon className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-center">
                   <div className="flex justify-between items-start mb-1">
                     <h3 className="text-[15px] font-bold text-gray-900 dark:text-white line-clamp-2 pr-4">{group.productName}</h3>
                     <div className="shrink-0 flex items-center justify-center bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-10 h-10 rounded-full border border-blue-100 dark:border-blue-800">
                        <span className="text-base font-black">×{group.count}</span>
                     </div>
                   </div>
                   <p className="text-xs text-gray-500 mb-3">分配客户: <span className="font-medium text-gray-700 dark:text-gray-300">{Array.from(new Set(group.clients)).slice(0, 3).join(', ')}{new Set(group.clients).size > 3 ? ' 等...' : ''}</span></p>
                   
                   <button className="text-[11px] font-bold tracking-wide w-fit bg-gray-900 dark:bg-white text-white dark:text-black py-1.5 px-3 rounded shadow-sm hover:scale-105 transition-transform flex items-center gap-1.5">
                      <ScanLine className="w-3.5 h-3.5" /> 扫描实景截留核销
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-zinc-950 dark:border-zinc-800">
          <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
             <Package className="w-5 h-5 text-emerald-500" />
             近期大包流转记录
          </h2>
          <div className="mt-6 flex flex-col gap-3">
            {isLoading ? (
               <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto my-12" />
            ) : recentStoredList.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-gray-400 border border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
                <p className="text-sm font-medium">暂无处于「已入库」状态的包裹流转</p>
              </div>
            ) : recentStoredList.map((order, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3.5 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/30 hover:border-emerald-200 transition">
                <div className="w-12 h-12 shrink-0 rounded-md bg-white border border-gray-200 dark:bg-zinc-800 dark:border-zinc-700 overflow-hidden flex items-center justify-center">
                  {order.image ? (
                     <img src={order.image} className="w-full h-full object-cover" alt="thumb" />
                  ) : (
                     <Package className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <div className="flex flex-col flex-1 overflow-hidden">
                  <h3 className="text-[13px] font-bold text-gray-800 dark:text-gray-200 line-clamp-1 truncate">{order.productName}</h3>
                  <p className="text-[11px] text-gray-500 mt-1 truncate">所属: {order.clientName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {purchasingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           {/* 实景提货 Modal */}
           <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900/80 sticky top-0 z-10">
                <h3 className="text-lg font-black flex items-center gap-2"><ScanLine className="w-5 h-5 text-blue-600"/> 实景相机扫描系统</h3>
                <button onClick={() => { setPurchasingProduct(null); setScannedData(null); }} className="text-gray-400 hover:text-black dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 p-2 rounded-full transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                 <div className="mb-6 flex gap-4 bg-gray-50 dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 items-center">
                   <div className="w-16 h-16 shrink-0 rounded-lg bg-white border border-gray-200 dark:bg-black dark:border-zinc-700 overflow-hidden flex items-center justify-center">
                     {purchasingProduct.image ? <img src={purchasingProduct.image} className="w-full h-full object-cover"/> : <ImageIcon className="w-6 h-6 text-gray-300"/>}
                   </div>
                   <div>
                     <p className="text-[11px] font-bold text-blue-600 tracking-widest uppercase mb-1">正在履约采办</p>
                     <p className="text-sm font-black text-gray-900 dark:text-white line-clamp-2">{purchasingProduct.productName}</p>
                   </div>
                 </div>

                 <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                    请直对价签 / 吊牌贴图 (Ctrl+V)
                 </label>
                 <div 
                    className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl p-8 text-center bg-white dark:bg-zinc-950 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors focus:ring-4 focus:ring-blue-500/20 outline-none cursor-pointer group"
                    onPaste={handlePasteTag}
                    tabIndex={0}
                  >
                    {isRecognizing ? (
                      <div className="flex flex-col items-center text-blue-600">
                        <Loader2 className="w-10 h-10 animate-spin mb-4" />
                        <span className="text-sm font-bold tracking-widest">神经引擎全力解析极速返回...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-gray-400 group-hover:text-blue-500 transition-colors">
                        <ScanLine className="w-10 h-10 mb-3 opacity-40 group-hover:opacity-100" />
                        <span className="text-sm font-bold">单击本区后按 <kbd className="bg-gray-100 dark:bg-zinc-800 border-b-2 border-gray-300 dark:border-zinc-600 rounded px-2 py-1 mx-1 text-gray-700 dark:text-gray-300">Ctrl+V</kbd> 提取小票</span>
                        <span className="text-xs mt-3 opacity-60 font-medium">全程本地硬件算力不消耗流量</span>
                      </div>
                    )}
                  </div>

                  {scannedData && (
                    <div className="mt-5 border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-5 font-mono text-sm relative">
                       <CheckCircle2 className="w-6 h-6 text-emerald-500 absolute top-5 right-5" />
                       <p className="text-emerald-800 dark:text-emerald-400 font-bold mb-3 tracking-wide">✅ OCR 小票解析成功！</p>
                       <ul className="space-y-2 text-[13px] text-emerald-900 dark:text-emerald-300 font-medium bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-emerald-500/10 dark:border-emerald-500/20">
                         <li className="flex justify-between border-b border-emerald-500/10 dark:border-emerald-500/10 pb-1.5"><span>实付打折价:</span> <span className="font-black">CAD {scannedData.price || '未查明'}</span></li>
                         <li className="flex justify-between border-b border-emerald-500/10 dark:border-emerald-500/10 pb-1.5 pt-1"><span>捕获精准尺码:</span> <span className="font-black">{scannedData.size || '未能提取'}</span></li>
                         <li className="flex justify-between pt-1"><span>仓库留底条码:</span> <span className="font-bold">{scannedData.barcode || '未查明'}</span></li>
                       </ul>
                    </div>
                  )}
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex gap-3">
                 <button onClick={() => { setPurchasingProduct(null); setScannedData(null); }} className="px-6 py-3.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm hover:bg-gray-200 transition">
                    取消
                 </button>
                 <button 
                  onClick={handleConfirmPurchase}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3.5 bg-blue-600 text-white rounded-xl font-black text-base tracking-widest hover:bg-blue-700 transition disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-blue-500/30"
                 >
                    {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                    一键确认 提取核销 1 套件
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
