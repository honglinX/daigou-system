"use client";
import { useState, useEffect, useCallback } from "react";
import { Package, Calendar, Loader2, DollarSign, Image as ImageIcon, MapPin, CheckCircle2, ShoppingCart, X, Hash, Palette, Scaling, Copy, Trash2 } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { recognizeAddressFromImage } from "@/utils/ocr";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // 快捷建单表单状态
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [newClientData, setNewClientData] = useState({ name: "", wechat: "" });
  const [newTotalCny, setNewTotalCny] = useState("");
  const [shippingInfo, setShippingInfo] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);

  // 多商品购物车
  const [cart, setCart] = useState([
    { name: "", article_number: "", color: "", size: "", quantity: 1, unit_price_cny: "" }
  ]);


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [clientsRes, productsRes, ordersRes] = await Promise.all([
      supabase.from('clients').select('id, name').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('orders')
        .select(`
          id, 
          status, 
          total_cny, 
          exchange_rate, 
          created_at, 
          shipping_info_snapshot,
          clients(id, name, wechat_id),
          order_items( quantity, unit_price_cad, products(id, name, article_number, color, size, image_url, price_cad) )
        `)
        .order('created_at', { ascending: false })
    ]);

    if (clientsRes.error) console.error("Clients fetch error:", clientsRes.error);
    if (productsRes.error) console.error("Products fetch error:", productsRes.error);
    if (ordersRes.error) console.error("Orders fetch error:", ordersRes.error);

    if (clientsRes.data) setClients(clientsRes.data);
    if (productsRes.data) setAvailableProducts(productsRes.data);
    if (ordersRes.data) setOrders(ordersRes.data);
    
    setIsLoading(false);
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
            const blob = item.getAsFile();
            if (blob) {
                // Focus out logic to prevent it grabbing random inputs if we handle global, 
                // but this is attached to textarea so e.preventDefault is fine.
                e.preventDefault();
                setIsRecognizing(true);
                try {
                const text = await recognizeAddressFromImage(blob);
                setShippingInfo(text);
                } catch (err) {
                console.error("OCR 失败", err);
                alert("文字提取失败，请重试跨洋解析。");
                } finally {
                setIsRecognizing(false);
                }
            }
        }
    }
  }, []);

  const updateCart = (index: number, field: keyof typeof cart[0], value: any) => {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], [field]: value };
    
    // 智能双向自动补全：货号带出名称，或名称带出货号/尺码/颜色
    if (field === 'article_number' && typeof value === 'string' && value.length > 3) {
        // 利用货号查找，不区分大小写
        const match = availableProducts.find(p => p.article_number && p.article_number.toUpperCase() === value.toUpperCase());
        if (match) {
            if (!newCart[index].name) newCart[index].name = match.name;
            if (!newCart[index].color) newCart[index].color = match.color || '';
            if (!newCart[index].size) newCart[index].size = match.size || '';
        }
    } else if (field === 'name' && typeof value === 'string' && value.length > 2) {
        const match = availableProducts.find(p => p.name.includes(value) || value.includes(p.name));
        if (match) {
            if (!newCart[index].article_number) newCart[index].article_number = match.article_number || '';
            // 如果产品库拥有通用颜色，带出
            if (!newCart[index].color && match.color) newCart[index].color = match.color;
        }
    }
    
    setCart(newCart);
  };

  const addCartItem = () => setCart([...cart, { name: "", article_number: "", color: "", size: "", quantity: 1, unit_price_cny: "" }]);
  const removeCartItem = (index: number) => setCart(cart.filter((_, i) => i !== index));

  const handleEditOrder = (order: any) => {
    setEditingOrderId(order.id);
    setSelectedClientId(order.clients?.id || "");
    setNewTotalCny(order.total_cny?.toString() || "");
    setShippingInfo(order.shipping_info_snapshot || "");
    
    // Map order items to cart
    const newCart = order.order_items.map((oi: any) => ({
      name: oi.products?.name || "",
      article_number: oi.products?.article_number || "",
      color: oi.products?.color || "",
      size: oi.products?.size || "",
      quantity: oi.quantity,
      unit_price_cny: oi.unit_price_cad?.toString() || ""
    }));
    setCart(newCart);
    setIsFormOpen(true);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveOrder = async () => {

    if (!selectedClientId) {
      alert("请选择下单客户或创建新客户！"); return;
    }
    if (selectedClientId === "NEW" && !newClientData.name) {
      alert("请填写新客户的姓名！"); return;
    }
    const hasEmptyItem = cart.some(item => !item.name.trim() || item.quantity < 1);
    if (cart.length === 0 || hasEmptyItem) {
      alert("请至少添加一件商品！"); return;
    }
    if (!shippingInfo) {
      alert("请填写运单回执地址！"); return;
    }


    setIsSubmitting(true);

    try {
      let finalClientId = selectedClientId;

      if (selectedClientId === "NEW") {
        const { data: cData, error: cErr } = await supabase.from('clients').insert([{
           name: newClientData.name, 
           wechat_id: newClientData.wechat || null
        }]).select().single();
        if (cErr) throw cErr;
        finalClientId = cData.id;

        await supabase.from('client_addresses').insert([{
           client_id: finalClientId,
           address_text: shippingInfo,
           is_default: true
        }]);
      }

      // 0. 库存检查与智能回查
      let finalStatus = 'stored';
      
      // 如果是编辑订单，我们先做内存级的库存映射回退（虚拟回放）
      const tempProducts = JSON.parse(JSON.stringify(availableProducts));
      if (editingOrderId) {
          const originalOrder = orders.find(o => o.id === editingOrderId);
          if (originalOrder && originalOrder.status === 'stored') {
              for (const oi of originalOrder.order_items || []) {
                  if (oi.products?.id) {
                      const tp = tempProducts.find((p: any) => p.id === oi.products.id);
                      if (tp) tp.stock_quantity = (tp.stock_quantity || 0) + oi.quantity;
                  }
              }
          }
      }

      for (const item of cart) {
          const pData = tempProducts.find((p: any) => 
              (p.article_number && item.article_number && p.article_number === item.article_number) || 
              (p.name === item.name)
          );
          if (!pData || (pData.stock_quantity || 0) < item.quantity) {
              finalStatus = 'pending';
              break;
          }
      }

      // 如果最终状态判定可存，执行真实的数据库库存变更
      // 为保证一致性：若是编辑且原先是stored，我们先在库里把之前的库存加回去
      if (editingOrderId) {
          const originalOrder = orders.find(o => o.id === editingOrderId);
          if (originalOrder && originalOrder.status === 'stored') {
              for (const oi of originalOrder.order_items || []) {
                  if (oi.products?.id) {
                      const pData = availableProducts.find(p => p.id === oi.products.id);
                      if (pData) {
                          const recovered = (pData.stock_quantity || 0) + oi.quantity;
                          await supabase.from('products').update({ stock_quantity: recovered }).eq('id', pData.id);
                          pData.stock_quantity = recovered; // 同步本地引用
                      }
                  }
              }
          }
      }

      if (finalStatus === 'stored') {
          for (const item of cart) {
              const pData = availableProducts.find(p => 
                  (p.article_number && item.article_number && p.article_number === item.article_number) || 
                  (p.name === item.name)
              );
              if (pData) {
                  const newStock = Math.max(0, (pData.stock_quantity || 0) - item.quantity);
                  await supabase.from('products').update({ stock_quantity: newStock }).eq('id', pData.id);
                  pData.stock_quantity = newStock; // 同步本地引用
              }
          }
      }

      // 1. 生成或更新物流快照包裹订单
      const currentRate = parseFloat(localStorage.getItem('daigou_exchange_rate') || '5.35');
      const orderPayload = {
        client_id: finalClientId,
        exchange_rate: currentRate, 
        total_cny: newTotalCny ? parseFloat(newTotalCny) : null,
        shipping_info_snapshot: shippingInfo,
        status: finalStatus
      };

      let orderId = editingOrderId;

      if (editingOrderId) {
        const { error: updateErr } = await supabase.from('orders').update(orderPayload).eq('id', editingOrderId);
        if (updateErr) throw updateErr;

        // Delete existing items for update
        const { error: deleteErr } = await supabase.from('order_items').delete().eq('order_id', editingOrderId);
        if (deleteErr) throw deleteErr;
      } else {
        const { data: orderData, error: orderErr } = await supabase.from('orders').insert([orderPayload]).select().single();
        if (orderErr) throw orderErr;
        orderId = orderData.id;
      }

      // 2. 将购物车内的商品链接或创建至图谱底库
      const orderItemsToInsert = [];
      for (const item of cart) {
          
          let pData = availableProducts.find(p => 
              (p.article_number && item.article_number && p.article_number.toUpperCase() === item.article_number.toUpperCase()) || 
              (p.name && item.name && p.name.trim() === item.name.trim())
          );

          if (!pData) {
            const { data: newP, error: pErr } = await supabase.from('products').insert([{
                brand: '特例抓单',
                name: item.name,
                article_number: item.article_number || null,
                color: item.color || '-',
                size: item.size || '-',
                price_cad: 0, 
                stock_quantity: 0 
            }]).select().single();
            if (pErr) throw pErr;
            pData = newP;
          }

          orderItemsToInsert.push({
              order_id: orderId,
              product_id: pData.id,
              quantity: item.quantity,
              unit_price_cad: item.unit_price_cny ? parseFloat(item.unit_price_cny) : 0
          });
      }

      // 批量插入所有明细
      if (orderItemsToInsert.length > 0) {
        const { error: itemsErr } = await supabase.from('order_items').insert(orderItemsToInsert);
        if (itemsErr) throw itemsErr;
      }

      await fetchData();
      setSelectedOrders([]);
      setCart([{ name: "", article_number: "", color: "", size: "", quantity: 1, unit_price_cny: "" }]);
      setNewTotalCny("");
      setShippingInfo("");
      setNewClientData({ name: "", wechat: "" });
      setSelectedClientId("");
      setIsFormOpen(false);
      setEditingOrderId(null);

    } catch (err) {
      console.error(err);
      alert("保存失败，请检查数据完整性或重试！");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pending': return <span className="px-2 py-1 rounded bg-orange-100 text-orange-700 text-xs font-bold shrink-0">待采购</span>;
      case 'purchased': return <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs font-bold shrink-0">已采购待入库</span>;
      case 'stored': return <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold shrink-0">已入库待打包</span>;
      case 'shipped_intl': return <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0">国际转运中</span>;
      case 'shipped_local': return <span className="px-2 py-1 rounded bg-cyan-100 text-cyan-700 text-xs font-bold shrink-0">国内清关派送</span>;
      case 'delivered': return <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold shrink-0">已签收闭环</span>;
      default: return <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-bold shrink-0">{status}</span>;
    }
  };

  // 生成原生的 HTML datalist 用于极致的智能零依赖联想提示
  const uniqueNames = Array.from(new Set(availableProducts.map(p => p.name).filter(Boolean)));
  const uniqueArticles = Array.from(new Set(availableProducts.map(p => p.article_number).filter(Boolean)));

  const handleBatchStatusUpdate = async (newStatus: string) => {
    if (selectedOrders.length === 0) return;
    setIsSubmitting(true);
    try {
      await supabase.from('orders').update({ status: newStatus }).in('id', selectedOrders);
      await fetchData();
      setSelectedOrders([]);
    } catch (err) {
      console.error(err);
      alert("批量更新状态失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTracking = async (orderId: string, tracking: string) => {
    try {
      await supabase.from('orders').update({ tracking_number: tracking }).eq('id', orderId);
      // Update local state to avoid refetching
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, tracking_number: tracking } : o));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]);
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("确定要销毁该笔订单吗？此操作将同步抹除关联的所有商品项，若订单为已入库状态，则会自动返还库存。")) return;
    
    setIsSubmitting(true);
    try {
      const orderToDel = orders.find(o => o.id === orderId);

      // 1. 先删除关联项（如果 DB 没有级联删除）
      await supabase.from('order_items').delete().eq('order_id', orderId);
      // 2. 删除主订单
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;
      
      // 3. 释放/恢复扣减过的库存
      if (orderToDel && orderToDel.status === 'stored') {
          for (const oi of orderToDel.order_items || []) {
             if (oi.products?.id) {
                 const pData = availableProducts.find(p => p.id === oi.products.id);
                 if (pData) {
                    const newStock = (pData.stock_quantity || 0) + oi.quantity;
                    await supabase.from('products').update({ stock_quantity: newStock }).eq('id', pData.id);
                    pData.stock_quantity = newStock; // 同步本地内存
                 }
             }
          }
      }

      await fetchData();
    } catch (err) {
      console.error(err);
      alert("订单销毁失败，请重试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8 h-full overflow-y-auto w-full relative">
      
      {/* 隐藏的数据集挂靠，用于 input list="..." 属性调用 */}
      <datalist id="datalist-product-names">
        {uniqueNames.map((name, i) => <option key={i} value={name} />)}
      </datalist>
      <datalist id="datalist-product-articles">
        {uniqueArticles.map((art, i) => <option key={i} value={art} />)}
      </datalist>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">订单流转台</h1>
          <p className="mt-1 text-sm text-gray-500">双向智能建单、客户归档及包裹生命周期</p>
        </div>
        <button 
          onClick={() => {
            if (isFormOpen && editingOrderId) {
              setEditingOrderId(null);
              setCart([{ name: "", article_number: "", color: "", size: "", quantity: 1, unit_price_cny: "" }]);
              setNewTotalCny("");
              setShippingInfo("");
              setSelectedClientId("");
            } else {
              setIsFormOpen(!isFormOpen);
            }
          }}
          disabled={isLoading}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm tracking-wide hover:bg-blue-700 transition shadow-sm border border-transparent disabled:opacity-50"
        >
          {isFormOpen ? (editingOrderId ? "取消修改" : "收起面板") : "+ 创建一笔新订单"}
        </button>

      </div>

      {isFormOpen && (
        <div className="mb-8 bg-white dark:bg-zinc-950 border border-blue-100 dark:border-blue-900/30 rounded-2xl shadow-lg overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/40">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
               <Package className="w-5 h-5 text-blue-600" /> {editingOrderId ? "正在修改现有订单" : "超级快捷建单中心"}
            </h2>

          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
             {/* 左侧：客户与地址与款项 */}
             <div className="flex flex-col gap-5 border-r border-transparent lg:border-gray-100 dark:lg:border-zinc-800 lg:pr-6">
                
                <div>
                  <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-1.5">1. 选择所属履约客户</label>
                  <select 
                    value={selectedClientId} 
                    onChange={e => setSelectedClientId(e.target.value)}
                    className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 bg-gray-50 dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium transition"
                  >
                    <option value="" disabled>下拉选择以往合作入档客户...</option>
                    <option value="NEW" className="font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30">➕ 无前置单，立刻建档一键录入新客</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  {selectedClientId === "NEW" && (
                    <div className="mt-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 p-4 rounded-xl">
                       <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-widest">完成后将永久沉淀至你的客户档案库</p>
                       <div className="grid grid-cols-2 gap-3">
                          <input placeholder="真实客户姓名 (必填)" value={newClientData.name} onChange={e => setNewClientData({...newClientData, name: e.target.value})} className="col-span-1 w-full border border-blue-200 dark:border-blue-800 rounded bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                          <input placeholder="微信联系人标识 (选填)" value={newClientData.wechat} onChange={e => setNewClientData({...newClientData, wechat: e.target.value})} className="col-span-1 w-full border border-blue-200 dark:border-blue-800 rounded bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                       </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-1.5 flex justify-between">
                     <span>2. 锁定跨境收货地址快照</span>
                     <span className="text-[10px] text-gray-400 font-normal border border-gray-200 dark:border-zinc-700 px-1.5 py-0.5 rounded shadow-sm bg-white dark:bg-black">支持微信地址长截图截留 Ctrl+V</span>
                  </label>
                  <div className="relative">
                    <textarea 
                      value={shippingInfo}
                      onChange={e => setShippingInfo(e.target.value)}
                      onPaste={handlePaste}
                      className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl p-3 bg-gray-50 dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[140px] resize-none transition-all placeholder:text-gray-400"
                      placeholder="复制并贴入含省市等地址段。若贴入微信文字图片，系统亦可免云端实现脱机抓取..."
                    />
                    {isRecognizing && (
                      <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm rounded-xl flex items-center justify-center flex-col z-10 transition-all">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                        <span className="text-xs font-bold text-blue-600 tracking-widest uppercase">全速引擎正在处理图谱...</span>
                      </div>
                    )}
                  </div>
                </div>

             </div>

             {/* 右侧：多商品清单 */}
             <div className="flex flex-col gap-4">
                <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-zinc-800">
                   3. 指派单据内挂靠的实体货品 (共 {cart.reduce((a,b) => a + (b.quantity||0), 0)} 件)
                </label>
                
                <div className="flex-1 overflow-y-auto pr-2 max-h-[350px] space-y-3 custom-scrollbar">
                   {cart.map((item, idx) => (
                      <div key={idx} className="bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 relative group transition hover:border-blue-300 dark:hover:border-blue-700">
                         {cart.length > 1 && (
                            <button onClick={() => removeCartItem(idx)} className="absolute top-2.5 right-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded-full transition opacity-0 group-hover:opacity-100 z-10">
                               <X className="w-4 h-4" />
                            </button>
                         )}
                         <div className="grid grid-cols-12 gap-2.5 relative">
                            {/* 名称支持 Autocomplete 联想 */}
                            <div className="col-span-12 md:col-span-6 group relative flex items-center">
                               <input 
                                  list="datalist-product-names" 
                                  placeholder="精准商品名称缩写 (双击可展开历史库)" 
                                  value={item.name} 
                                  onChange={e => updateCart(idx, 'name', e.target.value)} 
                                  className="w-full border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-sm font-medium outline-none focus:ring-1 focus:ring-blue-500 shadow-sm" 
                               />
                            </div>
                            <div className="col-span-6 md:col-span-3 flex items-center gap-2">
                               <span className="text-xs font-bold text-gray-400 shrink-0">数量</span>
                               <input type="number" min="1" value={item.quantity} onChange={e => updateCart(idx, 'quantity', parseInt(e.target.value)||1)} className="w-full border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 font-bold text-blue-600 shadow-sm text-center" />
                            </div>
                            <div className="col-span-6 md:col-span-3 flex items-center gap-2">
                               <span className="text-xs font-bold text-gray-400 shrink-0">结算单价</span>
                               <input type="number" step="0.01" value={item.unit_price_cny} onChange={e => updateCart(idx, 'unit_price_cny', e.target.value)} className="w-full border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 font-bold text-emerald-600 shadow-sm text-center" placeholder="选填" />
                            </div>

                            
                            {/* 货号同样支持智能带出（利用 list 进行双反联想查找） */}
                            <div className="col-span-4 md:col-span-4 flex items-center bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded overflow-hidden shadow-sm">
                               <div className="bg-gray-100 dark:bg-zinc-800 px-2 py-1.5 border-r border-gray-200 dark:border-zinc-700 text-gray-400"><Hash className="w-3.5 h-3.5" /></div>
                               <input list="datalist-product-articles" placeholder="选填货号" value={item.article_number} onChange={e => updateCart(idx, 'article_number', e.target.value)} className="w-full px-2 py-1 text-xs outline-none bg-transparent uppercase font-mono" />
                            </div>
                            <div className="col-span-4 md:col-span-4 flex items-center bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded overflow-hidden shadow-sm">
                               <div className="bg-gray-100 dark:bg-zinc-800 px-2 py-1.5 border-r border-gray-200 dark:border-zinc-700 text-gray-400"><Palette className="w-3.5 h-3.5" /></div>
                               <input placeholder="指定颜色" value={item.color} onChange={e => updateCart(idx, 'color', e.target.value)} className="w-full px-2 py-1 text-xs outline-none bg-transparent" />
                            </div>
                            <div className="col-span-4 md:col-span-4 flex items-center bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded overflow-hidden shadow-sm">
                               <div className="bg-gray-100 dark:bg-zinc-800 px-2 py-1.5 border-r border-gray-200 dark:border-zinc-700 text-gray-400"><Scaling className="w-3.5 h-3.5" /></div>
                               <input placeholder="选尺码" value={item.size} onChange={e => updateCart(idx, 'size', e.target.value)} className="w-full px-2 py-1 text-xs outline-none bg-transparent uppercase" />
                            </div>
                         </div>
                      </div>
                   ))}
                </div>

                <button onClick={addCartItem} className="w-full py-2.5 rounded-xl border-2 border-dashed border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition flex items-center justify-center gap-2">
                   <ShoppingCart className="w-4 h-4" /> 向该单包裹追加入挂靠列
                </button>

             </div>

          </div>

          <div className="p-5 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/80 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-3 w-full md:w-1/2">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">此单共向客户收取预结 (CNY)</span>
                <div className="relative w-full">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><DollarSign className="h-4 w-4 text-gray-400" /></div>
                  <input type="number" step="0.01" value={newTotalCny} onChange={e => setNewTotalCny(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-zinc-600 pl-10 pr-3 py-2.5 bg-white dark:bg-zinc-950 font-black text-blue-600 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="全包一口总收款金额如 1285.00" />
                </div>
             </div>
             
             <button onClick={handleSaveOrder} disabled={isSubmitting} className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-base tracking-widest hover:bg-blue-700 hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 border border-transparent">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {editingOrderId ? "确认修改订单数据" : "正式生成合规包裹清单"}
             </button>

          </div>
        </div>
      )}

      {/* 批量操作条 */}
      {selectedOrders.length > 0 && (
        <div className="sticky top-4 z-50 bg-blue-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between mb-8 animate-in slide-in-from-top-4 duration-300">
           <div className="flex items-center gap-4">
              <span className="text-sm font-black uppercase tracking-widest pl-2">已选中 {selectedOrders.length} 个订单</span>
              <div className="h-6 w-px bg-blue-400/50"></div>
              <div className="flex gap-2">
                 {['purchased', 'stored', 'shipped_intl', 'shipped_local', 'delivered'].map(st => (
                    <button key={st} onClick={() => handleBatchStatusUpdate(st)} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-black uppercase transition border border-white/10">
                       改为{st === 'purchased' ? '已采' : st === 'stored' ? '入库' : st === 'shipped_intl' ? '国际' : st === 'shipped_local' ? '国内' : '完成'}
                    </button>
                 ))}
              </div>
           </div>
           <button onClick={() => setSelectedOrders([])} className="text-white/60 hover:text-white transition"><X className="w-5 h-5"/></button>
        </div>
      )}

      {/* 订单历史列表 */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 text-gray-400 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm font-bold tracking-widest uppercase">底层联表抓取物流单据中...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 shadow-sm text-gray-400">
             <Package className="w-12 h-12 mb-3 opacity-20" />
             <p className="font-bold text-gray-600 dark:text-gray-300">系统尚无运转单据</p>
             <p className="text-xs mt-1 font-medium opacity-60">点击上方大蓝钮一键开启首笔跨境大区运作</p>
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className={`bg-white dark:bg-zinc-950 border ${selectedOrders.includes(order.id) ? 'border-blue-500 shadow-blue-500/10' : 'border-gray-100 dark:border-zinc-800'} rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 group relative`}>
              <div className="absolute top-5 left-2">
                 <input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => toggleSelectOrder(order.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-50 dark:border-zinc-800/50 pb-4 mb-4 pl-8">
                <div className="flex flex-row items-center justify-between w-full md:w-auto md:justify-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xl border border-blue-100 dark:border-blue-800/30">
                      {order.clients?.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
                        {order.clients?.name}
                        <span className="text-[10px] font-mono font-medium text-gray-400 bg-gray-50 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-gray-100 dark:border-zinc-800 select-all">Wechat ID 凭证录挂: {order.clients?.wechat_id || '未绑定'}</span>
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                        <Calendar className="w-3 h-3" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-row-reverse md:flex-row items-center justify-between w-full md:w-auto gap-3">
                   <button 
                      onClick={() => handleEditOrder(order)}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-400 hover:text-blue-600 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                   >
                      修改
                   </button>
                   <button 
                      onClick={() => handleDeleteOrder(order.id)}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                   >
                      删除
                   </button>
                   {/* 利润计算 */}
                   {(() => {
                      const costCny = order.order_items?.reduce((s: number, i: any) => s + (i.unit_price_cad || 0) * i.quantity, 0) || 0;
                      const profitCny = (order.total_cny || 0) - costCny;
                      return (
                        <div className="hidden sm:flex flex-col items-end mr-4">
                           <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">预估利润</span>
                           <span className={`text-xs font-black ${profitCny > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              ¥{profitCny.toFixed(2)}
                           </span>
                        </div>
                      );
                   })()}
                   {getStatusBadge(order.status)}
                   <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 bg-gray-50 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-zinc-800 select-all">
                     <span className="text-[10px] text-gray-500 font-medium tracking-wide">单据一口价收</span>
                     <span className="text-base text-blue-600 tracking-tight">¥{order.total_cny ? parseFloat(order.total_cny).toFixed(2) : '未填'}</span>
                   </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Package className="w-3.5 h-3.5"/> 连环单多重明细追责</h4>
                    <div className="space-y-2">
                       {order.order_items?.map((oi: any, i: number) => (
                           <div key={i} className="flex gap-4 bg-gray-50/80 dark:bg-zinc-900/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80 hover:border-blue-100 transition-colors">
                               <div className="w-12 h-12 shrink-0 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm overflow-hidden flex justify-center items-center">
                                  {oi.products?.image_url ? <img src={oi.products.image_url} className="w-full h-full object-cover"/> : <ImageIcon className="w-5 h-5 text-gray-300"/>}
                               </div>
                               <div className="flex-1 min-w-0 flex flex-col justify-center">
                                  <div className="flex justify-between items-start mb-1">
                                     <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate pr-2">{oi.products?.name}</span>
                                     <span className="text-sm font-black text-gray-400 px-1 bg-white dark:bg-black rounded border border-gray-200 dark:border-zinc-800 shadow-sm shrink-0">x{oi.quantity}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                                      {oi.products?.article_number && <span className="uppercase font-mono font-medium tracking-wider bg-white dark:bg-black rounded-sm border border-gray-100 dark:border-zinc-800 px-1 shadow-sm">#{oi.products.article_number}</span>}
                                      {oi.products?.color && <span className="font-medium">颜 {oi.products.color}</span>}
                                      {oi.products?.size && <span className="font-black">尺 {oi.products.size}码</span>}
                                  </div>
                               </div>
                           </div>
                       ))}
                    </div>
                 </div>
                 
                 <div className="flex flex-col">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><MapPin className="w-3.5 h-3.5"/> 物流最终落地指向位</h4>
                    <div className="bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200/50 dark:border-yellow-900/20 rounded-xl p-4 flex-1 group/address relative hover:border-yellow-400/50 transition duration-300 shadow-inner">
                       <Copy className="absolute top-4 right-4 w-4 h-4 text-yellow-600/30 group-hover/address:text-yellow-600 cursor-pointer hidden md:block active:scale-95 transition-transform" />
                       <p className="text-[13px] text-yellow-900 dark:text-yellow-600/80 leading-relaxed font-bold tracking-wide whitespace-pre-wrap select-all pr-6">
                         {order.shipping_info_snapshot || '（本批次特殊派件，无收货落地指向痕迹保留）'}
                       </p>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                       <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-xl border border-blue-100 dark:border-blue-800/30 flex-1 flex items-center gap-2">
                          <span className="text-[10px] font-black text-blue-600 uppercase">运单号</span>
                          <input 
                             type="text" 
                             placeholder="贴入国际/国内运单号..." 
                             value={order.tracking_number || ''} 
                             onChange={(e) => handleUpdateTracking(order.id, e.target.value)}
                             className="bg-transparent border-none outline-none text-xs font-bold text-blue-700 dark:text-blue-400 w-full placeholder:text-blue-300" 
                          />
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
