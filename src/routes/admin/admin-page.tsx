import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ClockIcon,
  DownloadIcon,
  FilmIcon,
  FolderIcon,
  HardDriveIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";

import { AppLogo } from "@/components/app-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, api, type AdminSummary } from "@/lib/api";
import { useSession } from "@/lib/auth-client";

import { formatBytes, formatDuration, statusOf } from "./admin-format";
import { AdminExportsTable } from "./admin-exports-table";
import { AdminProjectsTable } from "./admin-projects-table";
import { AdminUsersTable } from "./admin-users-table";

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersIcon;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-xl leading-none font-semibold whitespace-nowrap tabular-nums sm:text-2xl">
            {value}
          </span>
          <span className="mt-1 truncate text-xs text-muted-foreground">
            {label}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CenteredState({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-svh place-items-center bg-background p-2">
      {children}
    </div>
  );
}

/**
 * Màn quản trị `/admin` — xem người dùng đang dùng dự án ra sao. Chỉ email admin
 * vào được (máy chủ trả 403; xem `server/routes/admin-routes.ts`), trang bắt lỗi đó
 * để hiện "không có quyền" thay vì màn trắng. Chốt thật ở máy chủ.
 *
 * Bố cục CAO CỐ ĐỊNH: đầu trang dính, vùng nội dung TỰ CUỘN — hợp lối một-trang của
 * app (body không cuộn) và vẫn xem hết được khi dữ liệu nhiều.
 */
export function AdminPage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminSummary()
      .then(setSummary)
      .catch((cause) => {
        if (cause instanceof ApiError && cause.status === 403) setDenied(true);
        else setError(cause instanceof Error ? cause.message : "Lỗi tải dữ liệu");
      });
  }, []);

  if (denied) {
    return (
      <CenteredState>
        <Card className="max-w-md">
          <CardContent>
            <Empty>
              <EmptyTitle>Không có quyền truy cập</EmptyTitle>
              <EmptyDescription>
                Màn quản trị chỉ mở cho tài khoản admin. Bạn đang đăng nhập bằng{" "}
                {session?.user?.email ?? "tài khoản này"}.{" "}
                <Link to="/" className="text-primary underline">
                  Về trang chủ
                </Link>
              </EmptyDescription>
            </Empty>
          </CardContent>
        </Card>
      </CenteredState>
    );
  }

  if (error) {
    return (
      <CenteredState>
        <Card className="max-w-md">
          <CardContent className="text-sm text-destructive">{error}</CardContent>
        </Card>
      </CenteredState>
    );
  }

  if (!summary) {
    return (
      <CenteredState>
        <Spinner />
      </CenteredState>
    );
  }

  const { overview, byStatus, users, orphanProjects, recent, recentExports } =
    summary;

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      {/* Đầu trang dính — không cuộn theo nội dung. */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <AppLogo showName={false} />
          <div className="flex flex-col leading-tight">
            <span className="font-heading font-semibold">Quản trị</span>
            <span className="text-xs text-muted-foreground">
              Người dùng &amp; dự án
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" render={<Link to="/" />}>
          Về trang chủ
        </Button>
      </header>

      {/* VÙNG CUỘN — mọi nội dung nằm trong đây. */}
      <main className="flex-1 overflow-y-auto p-2">
        <div className="mx-auto flex max-w-6xl flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <StatCard icon={UsersIcon} label="Người dùng" value={String(overview.users)} />
            <StatCard icon={DownloadIcon} label="Đã export" value={String(overview.exports)} />
            <StatCard icon={FolderIcon} label="Dự án" value={String(overview.projects)} />
            <StatCard icon={FilmIcon} label="Tệp media" value={String(overview.media)} />
            <StatCard icon={HardDriveIcon} label="Dung lượng" value={formatBytes(overview.mediaBytes)} />
            <StatCard icon={ClockIcon} label="Giờ video" value={formatDuration(overview.videoSeconds)} />
            <StatCard icon={ZapIcon} label="Tác vụ" value={String(overview.jobs)} />
          </div>

          <Card>
            <CardContent className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm text-muted-foreground">
                Dự án theo trạng thái
              </span>
              {byStatus.map((row) => (
                <Badge key={row.status} variant={statusOf(row.status).variant}>
                  {statusOf(row.status).label}: {row.count}
                </Badge>
              ))}
              {orphanProjects > 0 ? (
                <Badge variant="outline">Chưa gắn chủ (cũ): {orphanProjects}</Badge>
              ) : null}
            </CardContent>
          </Card>

          <AdminUsersTable users={users} />
          <AdminExportsTable exports={recentExports} />
          <AdminProjectsTable projects={recent} />
        </div>
      </main>
    </div>
  );
}
