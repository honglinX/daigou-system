"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingBag, Users, Settings, PackageOpen } from "lucide-react";
import clsx from "clsx";

const navigation = [
  { name: "数据看板", href: "/", icon: LayoutDashboard },
  { name: "订单流转", href: "/orders", icon: ShoppingBag },
  { name: "客户档案", href: "/clients", icon: Users },
  { name: "商品库", href: "/products", icon: PackageOpen },
  { name: "系统设置", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full w-64 flex-col border-r border-gray-200 bg-white dark:bg-zinc-950 dark:border-zinc-800 shrink-0">
        <div className="flex h-16 items-center px-6 border-b border-gray-200 dark:border-zinc-800">
          <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">代购业务系统</span>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const isExact = item.href === "/" ? pathname === "/" : isActive;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  isExact
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800",
                  "group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
                )}
              >
                <Icon
                  className={clsx(
                    isExact ? "text-blue-600 dark:text-blue-400" : "text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300",
                    "mr-3 h-5 w-5 flex-shrink-0 transition-colors"
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] flex h-[68px] bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-t border-gray-200 dark:border-zinc-800 justify-around items-center px-1 pb-safe">
         {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const isExact = item.href === "/" ? pathname === "/" : isActive;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center justify-center w-full h-full relative transition-colors duration-200",
                  isExact ? "text-blue-600 dark:text-blue-400" : "text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <div className={clsx("absolute top-0 w-8 h-1 rounded-b-full transition-all duration-300", isExact ? "bg-blue-600" : "bg-transparent")} />
                <Icon className={clsx("w-6 h-6 mb-1 transition-transform duration-300", isExact && "scale-110")} />
                <span className={clsx("text-[10px] font-medium tracking-wide", isExact && "font-bold")}>{item.name}</span>
              </Link>
            );
          })}
      </div>
    </>
  );
}
