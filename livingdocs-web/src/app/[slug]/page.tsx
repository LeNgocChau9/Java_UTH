"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { navItemByHref, navItemsForRoles } from "@/lib/navigation";

export default function SectionPage() {
  const params = useParams<{ slug: string }>();
  const href = `/${params.slug}`;
  const item = navItemByHref(href);
  const { ready, roles } = useSession();
  const allowed = navItemsForRoles(roles).some((entry) => entry.href === href);

  return (
    <AppShell>
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {item?.label ?? "Không có mục này"}
        </h1>
        <p className="mt-5 max-w-[58ch] text-base leading-7 text-slate-500">
          {!ready
            ? "Đang đọc quyền của phiên đăng nhập."
            : !item
              ? "Đường dẫn này không thuộc menu LivingDocs."
              : allowed
                ? `Mục này thuộc vai trò ${item.role}. Các vai trò khác không thấy nó trên thanh bên.`
                : "Tài khoản hiện tại không có quyền mở mục này."}
        </p>
      </article>
    </AppShell>
  );
}
